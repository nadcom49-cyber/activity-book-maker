import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`);

/** The app's record of a member, keyed by the Gateway's user id. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: createdAt(),
});

export const series = sqliteTable(
  "series",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("series_owner").on(t.ownerId)],
);

export const nicheIdeas = sqliteTable(
  "niche_ideas",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    keyword: text("keyword").notNull(),
    rank: integer("rank").notNull(),
    title: text("title").notNull(),
    angle: text("angle").notNull(),
    suggestedPages: integer("suggested_pages").notNull(),
    demandNote: text("demand_note").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("niche_ideas_owner").on(t.ownerId)],
);

export const books = sqliteTable(
  "books",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    seriesId: text("series_id"),
    title: text("title").notNull(),
    sourceKind: text("source_kind").notNull(),
    sourceText: text("source_text").notNull(),
    grade: text("grade").notNull(),
    subject: text("subject").notNull(),
    language: text("language").notNull(),
    pageSize: text("page_size").notNull(),
    pageCount: integer("page_count").notNull(),
    status: text("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (t) => [
    index("books_owner").on(t.ownerId),
    index("books_series").on(t.seriesId),
  ],
);

export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey(),
    bookId: text("book_id").notNull(),
    position: integer("position").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    prompt: text("prompt").notNull(),
    imageKey: text("image_key"),
  },
  (t) => [index("pages_book").on(t.bookId, t.position)],
);

export const thumbnails = sqliteTable(
  "thumbnails",
  {
    bookId: text("book_id").notNull(),
    slot: integer("slot").notNull(),
    prompt: text("prompt").notNull(),
    imageKey: text("image_key"),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.slot] })],
);

export const listings = sqliteTable("listings", {
  bookId: text("book_id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  grades: text("grades").notNull(),
  subjects: text("subjects").notNull(),
  tags: text("tags").notNull(),
  priceCents: integer("price_cents"),
});

export const bundles = sqliteTable(
  "bundles",
  {
    seriesId: text("series_id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    tags: text("tags").notNull(),
    imageKeys: text("image_keys").notNull().default("[]"),
  },
  (t) => [uniqueIndex("bundles_series").on(t.seriesId)],
);
