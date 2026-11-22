import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/client/components/AppShell";
import {
  BookFieldsForm,
  DEFAULT_BOOK,
} from "@/client/components/BookFieldsForm";
import { BackLink } from "@/client/components/BackLink";
import { PageHeader } from "@/client/components/PageHeader";
import { Button, buttonVariants } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { errorMessage } from "@/client/lib/errors";
import { createBook } from "@/serverFunctions/books";
import { getIdea } from "@/serverFunctions/ideas";

export const Route = createFileRoute("/books/new")({
  validateSearch: z.object({ idea: z.string().uuid().optional() }),
  loaderDeps: ({ search }) => ({ idea: search.idea }),
  loader: ({ deps }) =>
    deps.idea ? getIdea({ data: { id: deps.idea } }) : Promise.resolve(null),
  component: NewBookPage,
});

function NewBookPage() {
  const idea = Route.useLoaderData();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const initial = idea
    ? {
        ...DEFAULT_BOOK,
        title: idea.title,
        sourceKind: "trend" as const,
        sourceText: idea.angle,
        pageCount: idea.suggestedPages,
      }
    : DEFAULT_BOOK;

  return (
    <AppShell>
      <PageHeader
        title="New book"
        backLink={<BackLink to="/">Books</BackLink>}
      />
      <Card>
        <CardContent>
          <BookFieldsForm
            key={idea?.id ?? "blank"}
            initial={initial}
            onSubmit={async (values) => {
              setPending(true);
              try {
                const book = await createBook({ data: values });
                await navigate({
                  to: "/books/$bookId",
                  params: { bookId: book.id },
                });
              } catch (error) {
                toast.error(errorMessage(error));
                setPending(false);
              }
            }}
            footer={
              <div className="flex justify-end gap-2">
                <Link to="/" className={buttonVariants({ variant: "outline" })}>
                  Cancel
                </Link>
                <Button type="submit" pending={pending}>
                  Create book
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
