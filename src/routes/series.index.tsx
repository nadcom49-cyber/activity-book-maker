import { createFileRoute, Link } from "@tanstack/react-router";
import { Library } from "lucide-react";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Card } from "@/client/components/ui/card";
import { getSeriesList } from "@/serverFunctions/ideas";

export const Route = createFileRoute("/series/")({
  loader: () => getSeriesList(),
  component: SeriesListPage,
});

function SeriesListPage() {
  const list = Route.useLoaderData();
  return (
    <AppShell>
      <PageHeader title="Series" />
      {list.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No series yet"
          description={
            <>
              Plan one from a niche on the{" "}
              <Link to="/ideas" className="underline">
                Ideas
              </Link>{" "}
              page.
            </>
          }
        />
      ) : (
        <Card className="gap-0 divide-y divide-border p-0">
          {list.map((row) => (
            <div
              key={row.id}
              data-testid="series-row"
              className="flex items-center justify-between gap-2 px-4 py-3"
            >
              <Link
                to="/series/$seriesId"
                params={{ seriesId: row.id }}
                className="font-medium hover:underline"
              >
                {row.title}
              </Link>
              <span className="text-sm text-muted-foreground">
                {row.books} {row.books === 1 ? "book" : "books"}
              </span>
            </div>
          ))}
        </Card>
      )}
    </AppShell>
  );
}
