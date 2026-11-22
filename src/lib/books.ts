// Shared by pages and server: the choices a book offers and the rules a plan keeps.

export const MAX_PAGES = 16;
export const MIN_PAGES = 1;
export const THUMBNAIL_SLOTS = [1, 2, 3, 4] as const;
export const SERIES_MIN = 2;
export const SERIES_MAX = 6;

export const SOURCE_KINDS = {
  trend: "Trending topic",
  cover: "Cover or page I like",
  idea: "My own idea",
  product: "Product link",
} as const;
export type SourceKind = keyof typeof SOURCE_KINDS;

export const GRADES = {
  prek: "Pre-K – K",
  g12: "Grades 1–2",
  g35: "Grades 3–5",
  g68: "Grades 6–8",
} as const;
export type Grade = keyof typeof GRADES;

export const SUBJECTS = {
  math: "Math",
  reading: "Reading",
  writing: "Writing",
  science: "Science",
  social: "Social studies",
  art: "Art",
  mixed: "Mixed",
} as const;
export type Subject = keyof typeof SUBJECTS;

export const LANGUAGES = {
  en: "English",
  fr: "French",
  es: "Spanish",
} as const;
export type Language = keyof typeof LANGUAGES;

export const PAGE_SIZES = {
  letter: { label: "US Letter", width: 612, height: 792 },
  a4: { label: "A4", width: 595.28, height: 841.89 },
} as const;
export type PageSize = keyof typeof PAGE_SIZES;

export const PAGE_KINDS = {
  cover: "Cover",
  teacher: "Teacher page",
  activity: "Activity",
  answer_key: "Answer key",
  thank_you: "Thank you",
} as const;
export type PageKind = keyof typeof PAGE_KINDS;

export const STATUSES = {
  draft: "Draft",
  planned: "Planned",
  drawing: "Drawing",
  ready: "Ready",
} as const;
export type BookStatus = keyof typeof STATUSES;

/** Where a book stands, from how much of it exists. */
export function statusOf(counts: {
  pages: number;
  drawnPages: number;
  drawnThumbnails: number;
}): BookStatus {
  if (counts.pages === 0) return "draft";
  const drawn = counts.drawnPages + counts.drawnThumbnails;
  if (drawn === 0) return "planned";
  if (
    counts.drawnPages === counts.pages &&
    counts.drawnThumbnails === THUMBNAIL_SLOTS.length
  )
    return "ready";
  return "drawing";
}

export interface PlannedPage {
  kind: PageKind;
  title: string;
  content: string;
  prompt: string;
}

const KIND_ORDER: Record<PageKind, number> = {
  cover: 0,
  teacher: 1,
  activity: 2,
  answer_key: 3,
  thank_you: 4,
};

/**
 * A model's plan made to fit the book: known kinds only, one cover first and
 * one thank-you page last, teacher pages before activities, answer keys after,
 * activities kept in the model's easy-to-hard order, and no more than
 * `pageCount` pages (activities give way first).
 */
export function normalizePlan(
  raw: unknown,
  pageCount: number,
  bookTitle: string,
): PlannedPage[] {
  const list = Array.isArray(raw) ? raw : [];
  const pages: PlannedPage[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const kind = String(record["kind"] ?? "activity") as PageKind;
    if (!(kind in KIND_ORDER)) continue;
    pages.push({
      kind,
      title: text(record["title"], 200) || PAGE_KINDS[kind],
      content: text(record["content"], 4000),
      prompt: text(record["imagePrompt"] ?? record["prompt"], 1000),
    });
  }
  const cover = pages.find((p) => p.kind === "cover") ?? {
    kind: "cover" as const,
    title: bookTitle,
    content: "",
    prompt: `Cover for ${bookTitle}`,
  };
  const thanks = pages.find((p) => p.kind === "thank_you");
  const middle = pages
    .filter((p) => p.kind !== "cover" && p.kind !== "thank_you")
    .map((page, index) => ({ page, index }))
    .sort(
      (a, b) =>
        KIND_ORDER[a.page.kind] - KIND_ORDER[b.page.kind] || a.index - b.index,
    )
    .map(({ page }) => page);
  const room = Math.max(0, pageCount - 1 - (thanks && pageCount > 1 ? 1 : 0));
  while (middle.length > room) {
    let drop = -1;
    for (let i = middle.length - 1; i >= 0; i--) {
      if (middle[i]!.kind === "activity") {
        drop = i;
        break;
      }
    }
    middle.splice(drop === -1 ? middle.length - 1 : drop, 1);
  }
  return [cover, ...middle, ...(thanks && pageCount > 1 ? [thanks] : [])];
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** "Fraction Pizza Party!" as "fraction-pizza-party", for file names. */
export function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "book"
  );
}
