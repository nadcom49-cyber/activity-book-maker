import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { books, bundles, pages, series } from "@/db/schema";
import { SERIES_MAX, SERIES_MIN } from "@/lib/books";
import { askJson, fromBase64 } from "@/server/ai";
import { createBook, parseTags } from "@/server/books";
import { deleteKeys, deletePrefix, imageUrl, putImage } from "@/server/files";
import { getIdea } from "@/server/ideas";

const id = z.string().uuid();
const range = `${SERIES_MIN} to ${SERIES_MAX} books`;

export const planSeriesInput = z
  .object({
    ideaId: id,
    count: z.number().int().min(SERIES_MIN, range).max(SERIES_MAX, range),
  })
  .strict();
export const seriesBookInput = z.object({ seriesId: id, bookId: id }).strict();
export const seriesIdInput = z.object({ seriesId: id }).strict();
export const seriesLookupInput = z
  .object({ seriesId: z.string().max(100) })
  .strict();
export const bundleListingInput = z
  .object({
    seriesId: id,
    title: z.string().trim().max(200),
    description: z.string().trim().max(5000),
    tags: z.array(z.string().trim().min(1).max(60)).max(20),
  })
  .strict();
export const bundleImagesInput = z
  .object({
    seriesId: id,
    images: z
      .array(
        z
          .object({
            type: z.literal("image/png"),
            data: z.string().max(12_000_000),
          })
          .strict(),
      )
      .length(4),
  })
  .strict();

async function ownedSeries(ownerId: string, seriesId: string) {
  const [row] = await db
    .select()
    .from(series)
    .where(and(eq(series.id, seriesId), eq(series.ownerId, ownerId)));
  return row ?? null;
}

async function requireSeries(ownerId: string, seriesId: string) {
  const row = await ownedSeries(ownerId, seriesId);
  if (!row) throw new Error("Series not found");
  return row;
}

function seriesBooks(ownerId: string, seriesId: string) {
  return db
    .select()
    .from(books)
    .where(and(eq(books.seriesId, seriesId), eq(books.ownerId, ownerId)))
    .orderBy(asc(books.createdAt), asc(books.id));
}

export async function listSeries(ownerId: string) {
  return db
    .select({
      id: series.id,
      title: series.title,
      createdAt: series.createdAt,
      books: count(books.id),
    })
    .from(series)
    .leftJoin(
      books,
      and(eq(books.seriesId, series.id), eq(books.ownerId, ownerId)),
    )
    .where(eq(series.ownerId, ownerId))
    .groupBy(series.id)
    .orderBy(desc(series.createdAt));
}

export async function getSeriesDetail(ownerId: string, seriesId: string) {
  const row = await ownedSeries(ownerId, seriesId);
  if (!row) return null;
  const [members, [bundle], candidates] = await Promise.all([
    seriesBooks(ownerId, seriesId),
    db.select().from(bundles).where(eq(bundles.seriesId, seriesId)),
    db
      .select({ id: books.id, title: books.title })
      .from(books)
      .where(and(eq(books.ownerId, ownerId), isNull(books.seriesId)))
      .orderBy(asc(books.title)),
  ]);
  const pageRows = members.length
    ? await db
        .select({
          bookId: pages.bookId,
          imageKey: pages.imageKey,
          kind: pages.kind,
        })
        .from(pages)
        .where(
          inArray(
            pages.bookId,
            members.map((b) => b.id),
          ),
        )
        .orderBy(asc(pages.position))
    : [];
  return {
    series: row,
    books: members.map((book) => {
      const drawn = pageRows.filter((p) => p.bookId === book.id && p.imageKey);
      return {
        id: book.id,
        title: book.title,
        status: book.status,
        pageCount: book.pageCount,
        coverUrl: imageUrl(
          drawn.find((p) => p.kind === "cover")?.imageKey ?? null,
        ),
        pageUrls: drawn
          .filter((p) => p.kind !== "cover")
          .map((p) => imageUrl(p.imageKey)!),
      };
    }),
    bundle: bundle
      ? {
          title: bundle.title,
          description: bundle.description,
          tags: parseTags(bundle.tags),
          imageUrls: parseTags(bundle.imageKeys).map((key) => imageUrl(key)!),
        }
      : null,
    candidates,
  };
}

/** Plans a series from a saved idea: the model names the books, each becomes a draft. */
export async function planSeries(
  ownerId: string,
  input: z.infer<typeof planSeriesInput>,
) {
  const idea = await getIdea(ownerId, input.ideaId);
  if (!idea) throw new Error("Idea not found");
  const answer = await askJson<{ books?: unknown }>(
    "series",
    [
      "You plan a series of related printable activity books that sell well together as a bundle.",
      `Return {"books":[{"title","idea"}]} with exactly count books. Each idea is one sentence on what that book covers; together they go from easier to harder.`,
    ].join("\n"),
    { niche: idea.title, angle: idea.angle, count: input.count },
  );
  const planned = (Array.isArray(answer.books) ? answer.books : [])
    .filter(
      (b): b is Record<string, unknown> =>
        !!b && typeof b === "object" && typeof b["title"] === "string",
    )
    .slice(0, input.count);
  while (planned.length < input.count)
    planned.push({
      title: `${idea.title} ${planned.length + 1}`,
      idea: idea.angle,
    });
  const seriesId = crypto.randomUUID();
  await db.insert(series).values({ id: seriesId, ownerId, title: idea.title });
  for (const book of planned) {
    await createBook(
      ownerId,
      {
        title: String(book["title"]).trim().slice(0, 200),
        sourceKind: "idea",
        sourceText:
          `${idea.title}: ${String(book["idea"] ?? idea.angle)}`.slice(0, 4000),
        grade: "g35",
        subject: "mixed",
        language: "en",
        pageSize: "letter",
        pageCount: idea.suggestedPages,
      },
      seriesId,
    );
  }
  return { id: seriesId };
}

/** Bundle images may show any book, so a change of books clears them. */
async function clearBundleImages(seriesId: string) {
  const [bundle] = await db
    .select({ imageKeys: bundles.imageKeys })
    .from(bundles)
    .where(eq(bundles.seriesId, seriesId));
  if (!bundle) return;
  await db
    .update(bundles)
    .set({ imageKeys: "[]" })
    .where(eq(bundles.seriesId, seriesId));
  await deleteKeys(parseTags(bundle.imageKeys));
}

export async function addBook(
  ownerId: string,
  { seriesId, bookId }: z.infer<typeof seriesBookInput>,
) {
  await requireSeries(ownerId, seriesId);
  const members = await seriesBooks(ownerId, seriesId);
  if (members.length >= SERIES_MAX)
    throw new Error(`A series has ${SERIES_MAX} books at most.`);
  const [book] = await db
    .update(books)
    .set({ seriesId })
    .where(
      and(
        eq(books.id, bookId),
        eq(books.ownerId, ownerId),
        isNull(books.seriesId),
      ),
    )
    .returning({ id: books.id });
  if (!book) throw new Error("Book not found");
  await clearBundleImages(seriesId);
  return book;
}

export async function removeBook(
  ownerId: string,
  { seriesId, bookId }: z.infer<typeof seriesBookInput>,
) {
  await requireSeries(ownerId, seriesId);
  const [book] = await db
    .update(books)
    .set({ seriesId: null })
    .where(
      and(
        eq(books.id, bookId),
        eq(books.ownerId, ownerId),
        eq(books.seriesId, seriesId),
      ),
    )
    .returning({ id: books.id });
  if (!book) throw new Error("Book not found");
  await clearBundleImages(seriesId);
  return book;
}

export async function deleteSeries(ownerId: string, seriesId: string) {
  await requireSeries(ownerId, seriesId);
  await db.batch([
    db
      .update(books)
      .set({ seriesId: null })
      .where(and(eq(books.seriesId, seriesId), eq(books.ownerId, ownerId))),
    db.delete(bundles).where(eq(bundles.seriesId, seriesId)),
    db
      .delete(series)
      .where(and(eq(series.id, seriesId), eq(series.ownerId, ownerId))),
  ]);
  await deletePrefix(`series/${seriesId}/`);
  return { ok: true };
}

async function requireBundleable(ownerId: string, seriesId: string) {
  const row = await requireSeries(ownerId, seriesId);
  const members = await seriesBooks(ownerId, seriesId);
  if (members.length < SERIES_MIN)
    throw new Error(`A bundle needs ${SERIES_MIN} books at least.`);
  return { row, members };
}

export async function writeBundleListing(ownerId: string, seriesId: string) {
  const { row, members } = await requireBundleable(ownerId, seriesId);
  const answer = await askJson<Record<string, unknown>>(
    "bundle",
    [
      "You write a store listing for a bundle of printable activity books sold together.",
      `Return {"title","description","tags":[up to 13 short strings]}. The title is search-friendly and under 80 characters.`,
    ].join("\n"),
    {
      series: row.title,
      books: members.map((b) => ({ title: b.title, pages: b.pageCount })),
    },
  );
  return {
    title: String(answer["title"] ?? "")
      .trim()
      .slice(0, 200),
    description: String(answer["description"] ?? "")
      .trim()
      .slice(0, 5000),
    tags: (Array.isArray(answer["tags"]) ? answer["tags"] : [])
      .map((t) => String(t).trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 20),
  };
}

export async function saveBundleListing(
  ownerId: string,
  { seriesId, ...fields }: z.infer<typeof bundleListingInput>,
) {
  await requireBundleable(ownerId, seriesId);
  const values = { ...fields, tags: JSON.stringify(fields.tags) };
  await db
    .insert(bundles)
    .values({ seriesId, ...values })
    .onConflictDoUpdate({ target: bundles.seriesId, set: values });
  return { ok: true };
}

export async function saveBundleImages(
  ownerId: string,
  { seriesId, images }: z.infer<typeof bundleImagesInput>,
) {
  const { row } = await requireBundleable(ownerId, seriesId);
  const keys: string[] = [];
  for (const [index, image] of images.entries()) {
    keys.push(
      await putImage(
        "series",
        seriesId,
        `bundle-${index + 1}`,
        fromBase64(image.data),
        image.type,
      ),
    );
  }
  const [old] = await db
    .select({ imageKeys: bundles.imageKeys })
    .from(bundles)
    .where(eq(bundles.seriesId, seriesId));
  await db
    .insert(bundles)
    .values({
      seriesId,
      title: row.title,
      description: "",
      tags: "[]",
      imageKeys: JSON.stringify(keys),
    })
    .onConflictDoUpdate({
      target: bundles.seriesId,
      set: { imageKeys: JSON.stringify(keys) },
    });
  if (old) await deleteKeys(parseTags(old.imageKeys));
  return { ok: true };
}

/** Whether this member owns the series an image key sits under. */
export async function ownsSeries(ownerId: string, seriesId: string) {
  return (await ownedSeries(ownerId, seriesId)) !== null;
}
