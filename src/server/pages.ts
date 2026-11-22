import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pages, thumbnails } from "@/db/schema";
import {
  GRADES,
  LANGUAGES,
  MAX_PAGES,
  PAGE_KINDS,
  SUBJECTS,
  THUMBNAIL_SLOTS,
  normalizePlan,
} from "@/lib/books";
import { askJson, drawImage, fromBase64 } from "@/server/ai";
import { refreshStatus, requireBook } from "@/server/books";
import { deleteKeys, putImage } from "@/server/files";

type Book = Awaited<ReturnType<typeof requireBook>>;
const id = z.string().uuid();

export const planInput = z.object({ bookId: id }).strict();
export const savePageInput = z
  .object({
    bookId: id,
    pageId: id.optional(),
    kind: z.enum(Object.keys(PAGE_KINDS) as [keyof typeof PAGE_KINDS]),
    title: z.string().trim().min(1, "Title is required").max(200),
    content: z.string().trim().max(4000),
    prompt: z.string().trim().max(1000),
  })
  .strict();
export const movePageInput = z
  .object({ bookId: id, pageId: id, direction: z.enum(["up", "down"]) })
  .strict();
export const pageRefInput = z.object({ bookId: id, pageId: id }).strict();
export const drawPageInput = z
  .object({
    bookId: id,
    pageId: id,
    note: z.string().trim().max(500).optional(),
  })
  .strict();
export const uploadInput = z
  .object({
    bookId: id,
    target: z.union([
      z.object({ pageId: id }).strict(),
      z.object({ slot: z.number().int().min(1).max(4) }).strict(),
    ]),
    type: z.enum(["image/png", "image/jpeg", "image/webp"]),
    data: z.string().max(12_000_000),
  })
  .strict();
export const thumbnailInput = z
  .object({
    bookId: id,
    slot: z.number().int().min(1).max(4),
    prompt: z.string().trim().min(1).max(1000).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

function describe(book: Book) {
  return {
    title: book.title,
    source: `${book.sourceKind}: ${book.sourceText}`,
    grade: GRADES[book.grade as keyof typeof GRADES] ?? book.grade,
    subject: SUBJECTS[book.subject as keyof typeof SUBJECTS] ?? book.subject,
    language:
      LANGUAGES[book.language as keyof typeof LANGUAGES] ?? book.language,
  };
}

/** Asks the model for a whole plan and replaces the book's pages with it. */
export async function planBook(ownerId: string, bookId: string) {
  const book = await requireBook(ownerId, bookId);
  const answer = await askJson<{ pages?: unknown; thumbnails?: unknown }>(
    "plan",
    [
      "You plan a printable activity book for teachers and parents.",
      `Return {"pages":[{"kind","title","content","imagePrompt"}],"thumbnails":[4 strings]}.`,
      `Use exactly pageCount pages. kind is one of cover, teacher, activity, answer_key, thank_you.`,
      "Start with the cover, then one or two teacher pages, then activities ordered from easiest to hardest, answer keys where activities have answers, and end with a thank-you page.",
      "content is the full printable text of the page: instructions, questions, word lists. Write title and content in the book's language.",
      "imagePrompt describes a black-and-white printable illustration for the page, in English.",
      "thumbnails are four prompts for square store images showing the book.",
    ].join("\n"),
    { ...describe(book), pageCount: book.pageCount },
  );
  const planned = normalizePlan(answer.pages, book.pageCount, book.title);
  const prompts = Array.isArray(answer.thumbnails)
    ? answer.thumbnails.map((p) => String(p).slice(0, 1000))
    : [];
  const old = await db
    .select({ imageKey: pages.imageKey })
    .from(pages)
    .where(eq(pages.bookId, bookId));
  await db.batch([
    db.delete(pages).where(eq(pages.bookId, bookId)),
    db.insert(pages).values(
      planned.map((page, position) => ({
        id: crypto.randomUUID(),
        bookId,
        position,
        ...page,
      })),
    ),
    ...THUMBNAIL_SLOTS.filter((slot) => prompts[slot - 1]).map((slot) =>
      db
        .update(thumbnails)
        .set({ prompt: prompts[slot - 1]! })
        .where(and(eq(thumbnails.bookId, bookId), eq(thumbnails.slot, slot))),
    ),
  ]);
  await deleteKeys(old.map((row) => row.imageKey));
  return refreshStatus(bookId);
}

async function orderedPages(bookId: string) {
  return db
    .select({ id: pages.id, position: pages.position })
    .from(pages)
    .where(eq(pages.bookId, bookId))
    .orderBy(asc(pages.position), asc(pages.id));
}

/** Writes positions 0..n-1 in the given order. */
function renumber(bookId: string, ids: string[]) {
  return ids.map((pageId, position) =>
    db
      .update(pages)
      .set({ position })
      .where(and(eq(pages.id, pageId), eq(pages.bookId, bookId))),
  );
}

export async function savePage(
  ownerId: string,
  input: z.infer<typeof savePageInput>,
) {
  await requireBook(ownerId, input.bookId);
  const { bookId, pageId, ...fields } = input;
  if (pageId) {
    const [page] = await db
      .update(pages)
      .set(fields)
      .where(and(eq(pages.id, pageId), eq(pages.bookId, bookId)))
      .returning({ id: pages.id });
    if (!page) throw new Error("Page not found");
    return page;
  }
  const existing = await orderedPages(bookId);
  if (existing.length >= MAX_PAGES)
    throw new Error(`A book has ${MAX_PAGES} pages at most.`);
  const newId = crypto.randomUUID();
  await db
    .insert(pages)
    .values({ id: newId, bookId, position: existing.length, ...fields });
  await refreshStatus(bookId);
  return { id: newId };
}

export async function movePage(
  ownerId: string,
  input: z.infer<typeof movePageInput>,
) {
  await requireBook(ownerId, input.bookId);
  const ids = (await orderedPages(input.bookId)).map((p) => p.id);
  const from = ids.indexOf(input.pageId);
  if (from === -1) throw new Error("Page not found");
  const to = input.direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return { moved: false };
  [ids[from], ids[to]] = [ids[to]!, ids[from]!];
  await db.batch(
    renumber(input.bookId, ids) as [ReturnType<typeof renumber>[number]],
  );
  return { moved: true };
}

export async function deletePage(
  ownerId: string,
  input: z.infer<typeof pageRefInput>,
) {
  await requireBook(ownerId, input.bookId);
  const [page] = await db
    .select({ imageKey: pages.imageKey })
    .from(pages)
    .where(and(eq(pages.id, input.pageId), eq(pages.bookId, input.bookId)));
  if (!page) throw new Error("Page not found");
  const rest = (await orderedPages(input.bookId))
    .map((p) => p.id)
    .filter((p) => p !== input.pageId);
  await db.batch([
    db
      .delete(pages)
      .where(and(eq(pages.id, input.pageId), eq(pages.bookId, input.bookId))),
    ...renumber(input.bookId, rest),
  ]);
  await deleteKeys([page.imageKey]);
  return refreshStatus(input.bookId);
}

async function setPageImage(
  book: Book,
  pageId: string,
  image: { bytes: Uint8Array; type: string },
) {
  const [page] = await db
    .select({ imageKey: pages.imageKey })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.bookId, book.id)));
  if (!page) throw new Error("Page not found");
  const key = await putImage(
    "books",
    book.id,
    `page-${pageId.slice(0, 8)}`,
    image.bytes,
    image.type,
  );
  await db
    .update(pages)
    .set({ imageKey: key })
    .where(and(eq(pages.id, pageId), eq(pages.bookId, book.id)));
  await deleteKeys([page.imageKey]);
  return refreshStatus(book.id);
}

async function setThumbnailImage(
  book: Book,
  slot: number,
  image: { bytes: Uint8Array; type: string },
) {
  const [thumb] = await db
    .select({ imageKey: thumbnails.imageKey })
    .from(thumbnails)
    .where(and(eq(thumbnails.bookId, book.id), eq(thumbnails.slot, slot)));
  if (!thumb) throw new Error("Thumbnail not found");
  const key = await putImage(
    "books",
    book.id,
    `thumbnail-${slot}`,
    image.bytes,
    image.type,
  );
  await db
    .update(thumbnails)
    .set({ imageKey: key })
    .where(and(eq(thumbnails.bookId, book.id), eq(thumbnails.slot, slot)));
  await deleteKeys([thumb.imageKey]);
  return refreshStatus(book.id);
}

export async function drawPage(
  ownerId: string,
  input: z.infer<typeof drawPageInput>,
) {
  const book = await requireBook(ownerId, input.bookId);
  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.id, input.pageId), eq(pages.bookId, book.id)));
  if (!page) throw new Error("Page not found");
  const info = describe(book);
  const prompt = [
    `A printable black-and-white activity book page (portrait, clean line art, white background) for ${info.grade}, ${info.subject}.`,
    `Page: ${page.title}.`,
    page.prompt ? `Illustration: ${page.prompt}.` : "",
    page.content
      ? `Text on the page, in ${info.language}: ${page.content}`
      : "",
    page.kind === "cover"
      ? `This is the colorful cover of "${book.title}", with the title large.`
      : "",
    input.note ? `Change from the last version: ${input.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return setPageImage(book, page.id, await drawImage(prompt, "3:4"));
}

export async function drawThumbnail(
  ownerId: string,
  input: z.infer<typeof thumbnailInput>,
) {
  const book = await requireBook(ownerId, input.bookId);
  const [thumb] = await db
    .select()
    .from(thumbnails)
    .where(
      and(eq(thumbnails.bookId, book.id), eq(thumbnails.slot, input.slot)),
    );
  if (!thumb) throw new Error("Thumbnail not found");
  const prompt = [
    `A square, bright store thumbnail for the printable activity book "${book.title}".`,
    thumb.prompt,
    input.note ? `Change from the last version: ${input.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return setThumbnailImage(book, input.slot, await drawImage(prompt, "1:1"));
}

export async function saveThumbnailPrompt(
  ownerId: string,
  input: z.infer<typeof thumbnailInput>,
) {
  await requireBook(ownerId, input.bookId);
  if (!input.prompt) throw new Error("Prompt is required");
  await db
    .update(thumbnails)
    .set({ prompt: input.prompt })
    .where(
      and(eq(thumbnails.bookId, input.bookId), eq(thumbnails.slot, input.slot)),
    );
  return { ok: true };
}

export async function uploadImage(
  ownerId: string,
  input: z.infer<typeof uploadInput>,
) {
  const book = await requireBook(ownerId, input.bookId);
  const image = { bytes: fromBase64(input.data), type: input.type };
  return "pageId" in input.target
    ? setPageImage(book, input.target.pageId, image)
    : setThumbnailImage(book, input.target.slot, image);
}
