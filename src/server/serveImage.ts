import { getObject } from "@/server/files";

export async function serveImage(prefix: string, name: string) {
  if (!/^[a-z0-9-]+\.(png|jpg|webp)$/.test(name))
    return new Response("Not found", { status: 404 });
  const object = await getObject(prefix + name);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type":
        object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
