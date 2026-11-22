import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { isAdmin } from "@every-app/sdk/server";
import { z } from "zod";
import * as books from "@/server/books";
import * as listings from "@/server/listings";
import * as pages from "@/server/pages";
import { ensureUser } from "@/server/users";

const parse =
  <T>(schema: z.ZodType<T>) =>
  (data: unknown) =>
    schema.parse(data);

export const getViewer = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(({ context: { user } }) => ({ isAdmin: isAdmin(user) }));

export const getBooks = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(({ context }) => books.listBooks(context.user.id));

export const getBook = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(parse(books.lookupInput))
  .handler(({ data, context }) =>
    books.getBookDetail(context.user.id, data.id),
  );

export const createBook = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(books.createBookInput))
  .handler(async ({ data, context: { user } }) => {
    await ensureUser(user);
    return books.createBook(user.id, data);
  });

export const updateBook = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(books.updateBookInput))
  .handler(({ data, context }) => books.updateBook(context.user.id, data));

export const deleteBook = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(books.bookIdInput))
  .handler(({ data, context }) => books.deleteBook(context.user.id, data.id));

export const planBook = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(pages.planInput))
  .handler(({ data, context }) => pages.planBook(context.user.id, data.bookId));

export const savePage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(pages.savePageInput))
  .handler(({ data, context }) => pages.savePage(context.user.id, data));

export const movePage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(pages.movePageInput))
  .handler(({ data, context }) => pages.movePage(context.user.id, data));

export const deletePage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(pages.pageRefInput))
  .handler(({ data, context }) => pages.deletePage(context.user.id, data));

export const drawPage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(pages.drawPageInput))
  .handler(({ data, context }) => pages.drawPage(context.user.id, data));

export const drawThumbnail = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(pages.thumbnailInput))
  .handler(({ data, context }) => pages.drawThumbnail(context.user.id, data));

export const saveThumbnailPrompt = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(pages.thumbnailInput))
  .handler(({ data, context }) =>
    pages.saveThumbnailPrompt(context.user.id, data),
  );

export const uploadImage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(pages.uploadInput))
  .handler(({ data, context }) => pages.uploadImage(context.user.id, data));

export const writeListing = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(listings.writeListingInput))
  .handler(({ data, context }) =>
    listings.writeListing(context.user.id, data.bookId),
  );

export const saveListing = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(listings.saveListingInput))
  .handler(({ data, context }) => listings.saveListing(context.user.id, data));

// Admins see and delete every member's books; everyone else is refused.
export const getAllBooks = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(({ context: { user } }) => {
    if (!isAdmin(user)) throw new Error("Only admins can do this.");
    return books.listAllBooks();
  });

export const adminDeleteBook = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(books.bookIdInput))
  .handler(({ data, context: { user } }) => {
    if (!isAdmin(user)) throw new Error("Only admins can do this.");
    return books.adminDeleteBook(data.id);
  });
