import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Plus } from "lucide-react";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { StatusBadge } from "@/client/components/StatusBadge";
import { buttonVariants } from "@/client/components/ui/button";
import { Card } from "@/client/components/ui/card";
import { GRADES, LANGUAGES, PAGE_SIZES, SUBJECTS } from "@/lib/books";
import { getBooks } from "@/serverFunctions/books";

export const Route = createFileRoute("/")({
  loader: () => getBooks(),
  component: BooksPage,
});

const label = <T extends Record<string, unknown>>(map: T, key: string) =>
  (map as Record<string, unknown>)[key] as string | undefined;

function BooksPage() {
  const books = Route.useLoaderData();
  return (
    <AppShell>
      <PageHeader
        title="Books"
        actions={
          <Link to="/books/new" className={buttonVariants()}>
            <Plus aria-hidden />
            New book
          </Link>
        }
      />
      {books.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          media="rows"
          title="No books yet"
          description="Start one from your own idea, or from a niche on the Ideas page."
        />
      ) : (
        <Card className="divide-y divide-border p-0 gap-0">
          {books.map((book) => (
            <div
              key={book.id}
              data-testid="book-row"
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div className="min-w-0 space-y-0.5">
                <Link
                  to="/books/$bookId"
                  params={{ bookId: book.id }}
                  className="font-medium hover:underline"
                >
                  {book.title}
                </Link>
                <div className="text-sm text-muted-foreground">
                  {[
                    label(GRADES, book.grade),
                    label(SUBJECTS, book.subject),
                    label(LANGUAGES, book.language),
                    `${book.pageCount} pages`,
                    PAGE_SIZES[book.pageSize as keyof typeof PAGE_SIZES]?.label,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {book.seriesTitle ? (
                    <>
                      {" · "}
                      <Link
                        to="/series/$seriesId"
                        params={{ seriesId: book.seriesId! }}
                        className="hover:underline"
                      >
                        {book.seriesTitle}
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
              <StatusBadge status={book.status} />
            </div>
          ))}
        </Card>
      )}
    </AppShell>
  );
}
