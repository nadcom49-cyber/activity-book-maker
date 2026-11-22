import { createFileRoute } from "@tanstack/react-router";
import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { ownedBook } from "@/server/books";
import { serveImage } from "@/server/serveImage";

// A book's images, only for the member who owns the book.
export const Route = createFileRoute("/files/$bookId/$name")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getEveryAppUser(request, env);
        if (!user) return new Response("Not found", { status: 404 });
        const book = await ownedBook(user.id, params.bookId);
        if (!book) return new Response("Not found", { status: 404 });
        return serveImage(`books/${book.id}/`, params.name);
      },
    },
  },
});
