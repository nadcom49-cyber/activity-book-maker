import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Button } from "@/client/components/ui/button";
import { Card } from "@/client/components/ui/card";
import { errorMessage } from "@/client/lib/errors";
import {
  adminDeleteBook,
  getAllBooks,
  getViewer,
} from "@/serverFunctions/books";

export const Route = createFileRoute("/admin")({
  loader: async () => {
    const { isAdmin } = await getViewer();
    return { isAdmin, books: isAdmin ? await getAllBooks() : [] };
  },
  component: AdminPage,
});

type Row = ReturnType<typeof Route.useLoaderData>["books"][number];

function AdminPage() {
  const { isAdmin, books: initial } = Route.useLoaderData();
  const router = useRouter();
  const [books, setBooks] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState<{ row: Row; busy: boolean } | null>(
    null,
  );

  if (!isAdmin) {
    return (
      <AppShell>
        <PageHeader title="All books" />
        <EmptyState
          kind="error"
          icon={ShieldAlert}
          title="Only admins can open this page."
        />
      </AppShell>
    );
  }

  async function reload() {
    setRefreshing(true);
    try {
      setBooks(await getAllBooks());
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="All books"
        actions={
          <Button
            variant="outline"
            size="sm"
            pending={refreshing}
            onClick={() => void reload()}
          >
            <RefreshCw aria-hidden />
            Refresh
          </Button>
        }
      />
      {books.length === 0 ? (
        <EmptyState title="No books yet" />
      ) : (
        <Card className="gap-0 divide-y divide-border p-0">
          {books.map((row) => (
            <div
              key={row.id}
              data-testid="admin-book-row"
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{row.title}</div>
                <div className="text-sm text-muted-foreground">
                  {row.ownerEmail ?? "Unknown member"}
                </div>
              </div>
              <StatusBadge status={row.status} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleting({ row, busy: false })}
              >
                Delete
              </Button>
            </div>
          ))}
        </Card>
      )}
      {deleting ? (
        <ConfirmDialog
          title={`Delete "${deleting.row.title}"?`}
          confirmLabel="Delete"
          destructive
          pending={deleting.busy}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            setDeleting({ ...deleting, busy: true });
            try {
              await adminDeleteBook({ data: { id: deleting.row.id } });
              setBooks((list) => list.filter((b) => b.id !== deleting.row.id));
              setDeleting(null);
              await router.invalidate();
            } catch (error) {
              toast.error(errorMessage(error));
              setDeleting(null);
            }
          }}
        >
          Its pages, images and listing are deleted too.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
