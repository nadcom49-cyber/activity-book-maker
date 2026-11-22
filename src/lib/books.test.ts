import { describe, expect, it } from "vitest";
import { normalizePlan, slugify, statusOf } from "@/lib/books";

describe("normalizePlan", () => {
  const raw = [
    { kind: "activity", title: "Easy", content: "a", imagePrompt: "p" },
    { kind: "thank_you", title: "Thanks", content: "", imagePrompt: "" },
    { kind: "answer_key", title: "Key", content: "", imagePrompt: "" },
    { kind: "cover", title: "Cover", content: "", imagePrompt: "" },
    { kind: "activity", title: "Hard", content: "b", imagePrompt: "p" },
    { kind: "teacher", title: "Guide", content: "", imagePrompt: "" },
    { kind: "nonsense", title: "Dropped", content: "", imagePrompt: "" },
  ];

  it("orders cover, teacher, activities easy to hard, answer key, thank you", () => {
    expect(normalizePlan(raw, 16, "Book").map((p) => p.title)).toEqual([
      "Cover",
      "Guide",
      "Easy",
      "Hard",
      "Key",
      "Thanks",
    ]);
  });

  it("fits the page count, dropping the hardest activities first", () => {
    const plan = normalizePlan(raw, 5, "Book");
    expect(plan).toHaveLength(5);
    expect(plan.map((p) => p.title)).toEqual([
      "Cover",
      "Guide",
      "Easy",
      "Key",
      "Thanks",
    ]);
  });

  it("always has a cover", () => {
    expect(normalizePlan([], 4, "My Book")[0]).toMatchObject({
      kind: "cover",
      title: "My Book",
    });
  });
});

describe("statusOf", () => {
  it("follows the book from draft to ready", () => {
    expect(statusOf({ pages: 0, drawnPages: 0, drawnThumbnails: 0 })).toBe(
      "draft",
    );
    expect(statusOf({ pages: 8, drawnPages: 0, drawnThumbnails: 0 })).toBe(
      "planned",
    );
    expect(statusOf({ pages: 8, drawnPages: 8, drawnThumbnails: 3 })).toBe(
      "drawing",
    );
    expect(statusOf({ pages: 8, drawnPages: 8, drawnThumbnails: 4 })).toBe(
      "ready",
    );
  });
});

describe("slugify", () => {
  it("makes file names", () => {
    expect(slugify("Ça va? Les Fractions!")).toBe("ca-va-les-fractions");
  });
});
