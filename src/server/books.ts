import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  books,
  bundles,
  listings,
  pages,
  series,
  thumbnails,
  users,
} from "@/db/schema";
import {
  GRADES,
  LANGUAGES,
  MAX_PAGES,
  MIN_PAGES,
  PAGE_SIZES,
  SOURCE_KINDS,
  SUBJECTS,
  THUMBNAIL_SLOTS,
  statusOf,
} from "@/lib/books";
import { deletePrefix, imageUrl } from "@/server/files";

const keys = <T extends Record<string, unknown>>(record: T) =>
  Object.keys(record) as [keyof T & string, ...(keyof T & string)[]];

export const bookFields = z
  .object({
    title: z.string().trim().max(200).default(""),
    sourceKind: z.enum(keys(SOURCE_KINDS)),
    sourceText: z.string().trim().max(4000),
    grade: z.enum(keys(GRADES)),
    subject: z.enum(keys(SUBJECTS)),
    language: z.enum(keys(LANGUAGES)),
    pageSize: z.enum(keys(PAGE_SIZES)),
    pageCount: z
      .number()
      .int()
      .min(MIN_PAGES, `${MIN_PAGES} page at least`)
      .max(MAX_PAGES, `${MAX_PAGES} pages at most`),
  })
  .strict();
export type BookFields = z.infer<typeof bookFields>;

export const createBookInput = bookFields.refine(
  (book) => book.title || book.sourceText,
  "Give a title or describe the source",
);
export const updateBookInput = bookFields
  .partial()
  .extend({ id: z.string().uuid() })
  .strict();
export const bookIdInput = z.object({ id: z.string().uuid() }).strict();
/** For reading by an id from the address bar: anything unknown is simply not found. */
export const lookupInput = z.object({ id: z.string().max(100) }).strict();

/** A book of this owner, or null. Every per-book query goes through it. */
export async function ownedBook(ownerId: string, bookId: string) {
  const [book] = await db
    .select()
    .from(books)
    .where(and(eq(books.id, bookId), eq(books.ownerId, ownerId)));
  return book ?? null;
}

export async function requireBook(ownerId: string, bookId: string) {
  const book = await ownedBook(ownerId, bookId);
  if (!book) throw new Error("Book not found");
  return book;
}

export async function listBooks(ownerId: string) {
  return db
    .select({
      id: books.id,
      title: books.title,
      status: books.status,
      grade: books.grade,
      subject: books.subject,
      language: books.language,
      pageSize: books.pageSize,
      pageCount: books.pageCount,
      seriesId: books.seriesId,
      seriesTitle: series.title,
      updatedAt: books.updatedAt,
    })
    .from(books)
    .leftJoin(series, eq(series.id, books.seriesId))
    .where(eq(books.ownerId, ownerId))
    .orderBy(desc(books.updatedAt), desc(books.createdAt));
}

export async function getBookDetail(ownerId: string, bookId: string) {
  const book = await ownedBook(ownerId, bookId);
  if (!book) return null;
  const [pageRows, thumbRows, [listing], [seriesRow]] = await Promise.all([
    db
      .select()
      .from(pages)
      .where(eq(pages.bookId, bookId))
      .orderBy(asc(pages.position)),
    db
      .select()
      .from(thumbnails)
      .where(eq(thumbnails.bookId, bookId))
      .orderBy(asc(thumbnails.slot)),
    db.select().from(listings).where(eq(listings.bookId, bookId)),
    book.seriesId
      ? db
          .select({ id: series.id, title: series.title })
          .from(series)
          .where(and(eq(series.id, book.seriesId), eq(series.ownerId, ownerId)))
      : Promise.resolve([]),
  ]);
  return {
    book,
    series: seriesRow ?? null,
    pages: pageRows.map(({ imageKey, ...page }) => ({
      ...page,
      imageUrl: imageUrl(imageKey),
    })),
    thumbnails: thumbRows.map(({ imageKey, ...thumb }) => ({
      ...thumb,
      imageUrl: imageUrl(imageKey),
    })),
    listing: listing ? { ...listing, tags: parseTags(listing.tags) } : null,
  };
}

export function parseTags(value: string): string[] {
  try {
    const tags: unknown = JSON.parse(value);
    return Array.isArray(tags) ? tags.map(String) : [];
  } catch {
    return [];
  }
}

function titleOf(input: Pick<BookFields, "title" | "sourceText">) {
  return (
    input.title ||
    input.sourceText.split(/\s+/).slice(0, 8).join(" ").slice(0, 200)
  );
}

/** Creates the book with its four thumbnail slots, in one batch. */
export async function createBook(
  ownerId: string,
  input: BookFields,
  seriesId: string | null = null,
) {
  const id = crypto.randomUUID();
  const title = titleOf(input);
  await db.batch([
    db.insert(books).values({ id, ownerId, seriesId, ...input, title }),
    db.insert(thumbnails).values(
      THUMBNAIL_SLOTS.map((slot) => ({
        bookId: id,
        slot,
        prompt: defaultThumbnailPrompt(title, slot),
      })),
    ),
  ]);
  return { id };
}

export function defaultThumbnailPrompt(title: string, slot: number) {
  return [
    `The cover of "${title}" on a tidy desk`,
    `Two inside pages of "${title}" side by side`,
    `A finished activity page of "${title}" with a pencil`,
    `A collage of several pages of "${title}"`,
  ][slot - 1]!;
}

export async function updateBook(
  ownerId: string,
  { id, ...change }: z.infer<typeof updateBookInput>,
) {
  if (change.title !== undefined && !change.title)
    throw new Error("Title is required");
  const [book] = await db
    .update(books)
    .set({ ...change, updatedAt: sql`(current_timestamp)` })
    .where(and(eq(books.id, id), eq(books.ownerId, ownerId)))
    .returning({ id: books.id });
  if (!book) throw new Error("Book not found");
  return book;
}

/**
 * Deletes a book, its pages, thumbnails, listing and images. A series that
 * loses it loses its bundle images too: they may show this book.
 */
export async function removeBook(book: {
  id: string;
  seriesId: string | null;
}) {
  await db.batch([
    db.delete(pages).where(eq(pages.bookId, book.id)),
    db.delete(thumbnails).where(eq(thumbnails.bookId, book.id)),
    db.delete(listings).where(eq(listings.bookId, book.id)),
    db.delete(books).where(eq(books.id, book.id)),
    ...(book.seriesId
      ? [
          db
            .update(bundles)
            .set({ imageKeys: "[]" })
            .where(eq(bundles.seriesId, book.seriesId)),
        ]
      : []),
  ]);
  await deletePrefix(`books/${book.id}/`);
}

export async function deleteBook(ownerId: string, bookId: string) {
  const book = await requireBook(ownerId, bookId);
  await removeBook(book);
  return { id: book.id };
}

/** Recomputes and stores a book's status from its pages and thumbnails. */
export async function refreshStatus(bookId: string) {
  const [[pageCounts], [thumbCounts]] = await Promise.all([
    db
      .select({
        pages: count(),
        drawn: sql<number>`sum(case when ${pages.imageKey} is not null then 1 else 0 end)`,
      })
      .from(pages)
      .where(eq(pages.bookId, bookId)),
    db
      .select({ drawn: count() })
      .from(thumbnails)
      .where(
        and(eq(thumbnails.bookId, bookId), isNotNull(thumbnails.imageKey)),
      ),
  ]);
  const status = statusOf({
    pages: pageCounts?.pages ?? 0,
    drawnPages: Number(pageCounts?.drawn ?? 0),
    drawnThumbnails: thumbCounts?.drawn ?? 0,
  });
  await db
    .update(books)
    .set({ status, updatedAt: sql`(current_timestamp)` })
    .where(eq(books.id, bookId));
  return status;
}

/** Every member's books, for admins. */
export function listAllBooks() {
  return db
    .select({
      id: books.id,
      title: books.title,
      status: books.status,
      ownerEmail: users.email,
      updatedAt: books.updatedAt,
    })
    .from(books)
    .leftJoin(users, eq(users.id, books.ownerId))
    .orderBy(desc(books.updatedAt));
}

export async function adminDeleteBook(bookId: string) {
  const [book] = await db
    .select({ id: books.id, seriesId: books.seriesId })
    .from(books)
    .where(eq(books.id, bookId));
  if (!book) throw new Error("Book not found");
  await removeBook(book);
  return { id: book.id };
}

export async function booksByIds(ownerId: string, ids: string[]) {
  if (!ids.length) return [];
  return db
    .select()
    .from(books)
    .where(and(eq(books.ownerId, ownerId), inArray(books.id, ids)));
}
