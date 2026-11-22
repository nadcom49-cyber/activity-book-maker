import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { listings, pages } from "@/db/schema";
import { GRADES, LANGUAGES, SUBJECTS } from "@/lib/books";
import { askJson } from "@/server/ai";
import { requireBook } from "@/server/books";

export const listingFields = z
  .object({
    title: z.string().trim().max(200),
    description: z.string().trim().max(5000),
    grades: z.string().trim().max(200),
    subjects: z.string().trim().max(200),
    tags: z.array(z.string().trim().min(1).max(60)).max(20),
    priceCents: z.number().int().min(0).max(100_000).nullable(),
  })
  .strict();
export const saveListingInput = listingFields
  .extend({ bookId: z.string().uuid() })
  .strict();
export const writeListingInput = z
  .object({ bookId: z.string().uuid() })
  .strict();

export type ListingFields = z.infer<typeof listingFields>;

/** Asks the model for a listing; returns it unsaved for the member to edit. */
export async function writeListing(
  ownerId: string,
  bookId: string,
): Promise<ListingFields> {
  const book = await requireBook(ownerId, bookId);
  const pageRows = await db
    .select({ kind: pages.kind, title: pages.title })
    .from(pages)
    .where(eq(pages.bookId, bookId))
    .orderBy(pages.position);
  const answer = await askJson<Record<string, unknown>>(
    "listing",
    [
      "You write a store listing for a printable activity book sold on teacher marketplaces.",
      `Return {"title","description","grades","subjects","tags":[up to 13 short strings],"price": number in US dollars}.`,
      "The title is search-friendly and under 80 characters. The description says what is inside and who it is for, in a few short paragraphs.",
      "Write in the book's language.",
    ].join("\n"),
    {
      title: book.title,
      grade: GRADES[book.grade as keyof typeof GRADES],
      subject: SUBJECTS[book.subject as keyof typeof SUBJECTS],
      language: LANGUAGES[book.language as keyof typeof LANGUAGES],
      pageCount: pageRows.length || book.pageCount,
      pages: pageRows.map((p) => `${p.kind}: ${p.title}`),
    },
  );
  const str = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  const price = Number(answer["price"]);
  return {
    title: str(answer["title"], 200),
    description: str(answer["description"], 5000),
    grades: str(answer["grades"], 200),
    subjects: str(answer["subjects"], 200),
    tags: (Array.isArray(answer["tags"]) ? answer["tags"] : [])
      .map((t) => String(t).trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 20),
    priceCents:
      Number.isFinite(price) && price >= 0 ? Math.round(price * 100) : null,
  };
}

export async function saveListing(
  ownerId: string,
  { bookId, ...fields }: z.infer<typeof saveListingInput>,
) {
  await requireBook(ownerId, bookId);
  const values = { ...fields, tags: JSON.stringify(fields.tags) };
  await db
    .insert(listings)
    .values({ bookId, ...values })
    .onConflictDoUpdate({ target: listings.bookId, set: values });
  return { ok: true };
}
