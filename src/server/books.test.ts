import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

// An in-memory SQLite with the app's migrations stands in for D1.
const testDb = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/db", () => ({
  get db() {
    return testDb.current;
  },
}));

const books = await import("./books");
const pages = await import("./pages");

beforeAll(async () => {
  const db = drizzle(createClient({ url: ":memory:" }), { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  });
  testDb.current = db;
});

const fields = {
  title: "Ocean Tracing",
  sourceKind: "idea" as const,
  sourceText: "Trace ocean animals",
  grade: "g12" as const,
  subject: "art" as const,
  language: "en" as const,
  pageSize: "letter" as const,
  pageCount: 6,
};

describe("books", () => {
  it("belong to the member who made them", async () => {
    const { id } = await books.createBook("alice", fields);
    expect((await books.listBooks("alice")).map((b) => b.id)).toContain(id);
    expect(await books.listBooks("bob")).toHaveLength(0);
    expect(await books.getBookDetail("bob", id)).toBeNull();
    await expect(
      books.updateBook("bob", { id, title: "Taken" }),
    ).rejects.toThrow("Book not found");
    await expect(books.deleteBook("bob", id)).rejects.toThrow("Book not found");
    const detail = await books.getBookDetail("alice", id);
    expect(detail?.book.title).toBe("Ocean Tracing");
    expect(detail?.thumbnails).toHaveLength(4);
  });

  it("keep page positions contiguous and refuse another member's pages", async () => {
    const { id } = await books.createBook("alice", {
      ...fields,
      title: "Pages",
    });
    const made = [];
    for (const title of ["One", "Two", "Three"]) {
      made.push(
        await pages.savePage("alice", {
          bookId: id,
          kind: "activity",
          title,
          content: "",
          prompt: "",
        }),
      );
    }
    await expect(
      pages.savePage("bob", {
        bookId: id,
        kind: "activity",
        title: "Mine",
        content: "",
        prompt: "",
      }),
    ).rejects.toThrow("Book not found");
    await pages.movePage("alice", {
      bookId: id,
      pageId: made[2]!.id,
      direction: "up",
    });
    await pages.deletePage("alice", { bookId: id, pageId: made[0]!.id });
    const detail = await books.getBookDetail("alice", id);
    expect(detail?.pages.map((p) => [p.position, p.title])).toEqual([
      [0, "Three"],
      [1, "Two"],
    ]);
    expect(detail?.book.status).toBe("planned");
  });
});
