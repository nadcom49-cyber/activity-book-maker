import { env } from "cloudflare:workers";

const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Stores an image under the book's (or series') prefix and returns its key. */
export async function putImage(
  scope: "books" | "series",
  ownerObjectId: string,
  label: string,
  bytes: Uint8Array,
  type: string,
): Promise<string> {
  const extension = TYPES[type];
  if (!extension) throw new Error("Use a PNG, JPEG or WebP image.");
  if (bytes.byteLength > MAX_IMAGE_BYTES)
    throw new Error("Images can be 8 MB at most.");
  const name = `${label}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  const key = `${scope}/${ownerObjectId}/${name}`;
  await env.files.put(key, bytes, { httpMetadata: { contentType: type } });
  return key;
}

export async function deleteKeys(keys: (string | null | undefined)[]) {
  const list = keys.filter((key): key is string => Boolean(key));
  if (list.length) await env.files.delete(list);
}

export async function deletePrefix(prefix: string) {
  let cursor: string | undefined;
  do {
    const listed = await env.files.list({ prefix, cursor });
    if (listed.objects.length)
      await env.files.delete(listed.objects.map((object) => object.key));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

export function getObject(key: string) {
  return env.files.get(key);
}

/** The path a page loads an image from: /files/<book>/<name> or /bundle-files/<series>/<name>. */
export function imageUrl(key: string | null): string | null {
  if (!key) return null;
  const [scope, id, name] = key.split("/");
  return scope === "series"
    ? `/bundle-files/${id}/${name}`
    : `/files/${id}/${name}`;
}
