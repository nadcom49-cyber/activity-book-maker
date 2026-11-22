// The app's tools for AI clients, served by the Gateway at /mcp with the
// signed-in user. They read the same scoped queries the pages use.
import { ToolError, defineTools } from "@every-app/sdk/server";
import { z } from "zod";
import * as books from "@/server/books";

export const tools = defineTools(
  {
    list_books: {
      description:
        "List the user's activity books with their status, grade, subject, language and page count.",
      risk: "read",
      input: z.object({}).strict(),
      handler: (_input, { user }) => books.listBooks(user.id),
    },
    get_book: {
      description:
        "One of the user's books with its page plan, thumbnails and store listing.",
      risk: "read",
      input: books.bookIdInput,
      handler: async (input, { user }) =>
        (await books.getBookDetail(user.id, input.id)) ??
        raise("No book with that id"),
    },
  },
  { instructions: "Call list_books first when a book id isn't already known." },
);

function raise(message: string): never {
  throw new ToolError(message);
}
