import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { nicheIdeas } from "@/db/schema";
import { MAX_PAGES } from "@/lib/books";
import { askJson } from "@/server/ai";

export const suggestInput = z
  .object({ keyword: z.string().trim().min(2, "Enter a keyword").max(100) })
  .strict();

export function listIdeas(ownerId: string) {
  return db
    .select()
    .from(nicheIdeas)
    .where(eq(nicheIdeas.ownerId, ownerId))
    .orderBy(desc(nicheIdeas.createdAt), nicheIdeas.rank);
}

export async function getIdea(ownerId: string, ideaId: string) {
  const [idea] = await db
    .select()
    .from(nicheIdeas)
    .where(and(eq(nicheIdeas.id, ideaId), eq(nicheIdeas.ownerId, ownerId)));
  return idea ?? null;
}

/** Asks the model for ranked niche ideas and saves them to the member's history. */
export async function suggestIdeas(
  ownerId: string,
  { keyword }: z.infer<typeof suggestInput>,
) {
  const answer = await askJson<{ ideas?: unknown }>(
    "niches",
    [
      "You suggest niches for printable activity books sold to teachers and parents.",
      `Return {"ideas":[{"title","angle","suggestedPages","demand"}]} with 3 to 6 ideas, best first.`,
      `suggestedPages is a whole number from 4 to ${MAX_PAGES}. demand is one short sentence on who buys it and when.`,
    ].join("\n"),
    { keyword },
  );
  const list = Array.isArray(answer.ideas) ? answer.ideas : [];
  const createdAt = new Date().toISOString().replace("T", " ").slice(0, 19);
  const rows = list
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object",
    )
    .slice(0, 6)
    .map((item, rank) => ({
      id: crypto.randomUUID(),
      ownerId,
      keyword,
      rank,
      title: String(item["title"] ?? "")
        .trim()
        .slice(0, 200),
      angle: String(item["angle"] ?? "")
        .trim()
        .slice(0, 500),
      suggestedPages: Math.min(
        MAX_PAGES,
        Math.max(1, Math.round(Number(item["suggestedPages"]) || 8)),
      ),
      demandNote: String(item["demand"] ?? "")
        .trim()
        .slice(0, 500),
      createdAt,
    }))
    .filter((row) => row.title);
  if (!rows.length) throw new Error("No ideas came back. Try another keyword.");
  await db.insert(nicheIdeas).values(rows);
  return rows;
}

export async function deleteIdea(ownerId: string, ideaId: string) {
  await db
    .delete(nicheIdeas)
    .where(and(eq(nicheIdeas.id, ideaId), eq(nicheIdeas.ownerId, ownerId)));
  return { ok: true };
}
