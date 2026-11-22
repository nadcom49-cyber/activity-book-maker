import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  BookX,
  Download,
  FileText,
  Paintbrush,
  Pencil,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/client/components/AppShell";
import { BackLink } from "@/client/components/BackLink";
import {
  BookFieldsForm,
  type BookFormValues,
} from "@/client/components/BookFieldsForm";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { StatusBadge } from "@/client/components/StatusBadge";
import { ListingPanel } from "@/client/features/book/ListingPanel";
import { PagesPanel } from "@/client/features/book/PagesPanel";
import { PreviewPanel } from "@/client/features/book/PreviewPanel";
import { ThumbnailsPanel } from "@/client/features/book/ThumbnailsPanel";
import type { BookDetail } from "@/client/features/book/types";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Progress } from "@/client/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/client/components/ui/tabs";
import { errorMessage } from "@/client/lib/errors";
import { buildPdf, buildZip, download } from "@/client/lib/export";
import {
  GRADES,
  LANGUAGES,
  PAGE_SIZES,
  SUBJECTS,
  slugify,
  type PageSize,
} from "@/lib/books";
import {
  deleteBook,
  drawPage,
  drawThumbnail,
  getBook,
  updateBook,
} from "@/serverFunctions/books";

export const Route = createFileRoute("/books/$bookId")({
  loader: ({ params }) => getBook({ data: { id: params.bookId } }),
  component: BookPage,
});

function BookPage() {
  const detail = Route.useLoaderData();
  if (!detail) {
    return (
      <AppShell>
        <PageHeader
          title="Book not found"
          backLink={<BackLink to="/">Books</BackLink>}
        />
        <EmptyState
          kind="error"
          icon={BookX}
          title="This book was deleted, or it isn't yours."
        />
      </AppShell>
    );
  }
  return <BookView detail={detail} />;
}

function formValues(book: BookDetail["book"]): BookFormValues {
  return {
    title: book.title,
    sourceKind: book.sourceKind as BookFormValues["sourceKind"],
    sourceText: book.sourceText,
    grade: book.grade as BookFormValues["grade"],
    subject: book.subject as BookFormValues["subject"],
    language: book.language as BookFormValues["language"],
    pageSize: book.pageSize as BookFormValues["pageSize"],
    pageCount: book.pageCount,
  };
}

function BookView({ detail }: { detail: BookDetail }) {
  const { book } = detail;
  const router = useRouter();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<"ask" | "busy" | null>(null);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "zip" | null>(null);
  const refresh = () => router.invalidate();
  const pageSize = book.pageSize as PageSize;

  async function drawAll() {
    const pages = detail.pages.filter((p) => !p.imageUrl);
    const thumbs = detail.thumbnails.filter((t) => !t.imageUrl);
    const total = pages.length + thumbs.length;
    if (total === 0) return;
    setProgress({ done: 0, total });
    let done = 0;
    try {
      for (const page of pages) {
        await drawPage({ data: { bookId: book.id, pageId: page.id } });
        setProgress({ done: ++done, total });
        await refresh();
      }
      for (const thumb of thumbs) {
        await drawThumbnail({ data: { bookId: book.id, slot: thumb.slot } });
        setProgress({ done: ++done, total });
        await refresh();
      }
    } catch (error) {
      toast.error(errorMessage(error));
      await refresh();
    } finally {
      setProgress(null);
    }
  }

  async function exportAs(kind: "pdf" | "zip") {
    setExporting(kind);
    try {
      const pages = detail.pages;
      if (kind === "pdf") {
        download(
          await buildPdf(pageSize, pages),
          `${slugify(book.title)}.pdf`,
          "application/pdf",
        );
      } else {
        const zip = await buildZip({
          title: book.title,
          pageSize,
          pages,
          thumbnails: detail.thumbnails,
          listing: detail.listing,
        });
        download(zip, `${slugify(book.title)}.zip`, "application/zip");
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(null);
    }
  }

  const missing =
    detail.pages.filter((p) => !p.imageUrl).length +
    detail.thumbnails.filter((t) => !t.imageUrl).length;

  return (
    <AppShell>
      <PageHeader
        backLink={
          detail.series ? (
            <BackLink
              to="/series/$seriesId"
              params={{ seriesId: detail.series.id }}
            >
              {detail.series.title}
            </BackLink>
          ) : (
            <BackLink to="/">Books</BackLink>
          )
        }
        title={book.title}
        description={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={book.status} />
            <span>
              {[
                GRADES[book.grade as keyof typeof GRADES],
                SUBJECTS[book.subject as keyof typeof SUBJECTS],
                LANGUAGES[book.language as keyof typeof LANGUAGES],
                `${book.pageCount} pages`,
                PAGE_SIZES[pageSize]?.label,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden />
              Edit book
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label="Delete book"
              onClick={() => setDeleting("ask")}
            >
              <Trash2 aria-hidden />
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => void drawAll()}
          pending={progress !== null}
          disabled={detail.pages.length === 0 || missing === 0}
        >
          <Paintbrush aria-hidden />
          Draw all
        </Button>
        <Button
          variant="outline"
          onClick={() => void exportAs("pdf")}
          pending={exporting === "pdf"}
          disabled={detail.pages.length === 0}
        >
          <FileText aria-hidden />
          Download PDF
        </Button>
        <Button
          variant="outline"
          onClick={() => void exportAs("zip")}
          pending={exporting === "zip"}
          disabled={detail.pages.length === 0}
        >
          <Download aria-hidden />
          Download ZIP
        </Button>
      </div>
      {progress ? (
        <div data-testid="draw-progress" className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Drawing {Math.min(progress.done + 1, progress.total)} of{" "}
            {progress.total}
          </div>
          <Progress value={(progress.done / progress.total) * 100} />
        </div>
      ) : null}

      <Tabs defaultValue="pages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="thumbnails">Thumbnails</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="listing">Listing</TabsTrigger>
        </TabsList>
        <TabsContent value="pages">
          <PagesPanel
            detail={detail}
            busy={progress !== null}
            onChange={refresh}
          />
        </TabsContent>
        <TabsContent value="thumbnails">
          <ThumbnailsPanel
            detail={detail}
            busy={progress !== null}
            onChange={refresh}
          />
        </TabsContent>
        <TabsContent value="preview">
          <PreviewPanel detail={detail} />
        </TabsContent>
        <TabsContent value="listing">
          <ListingPanel detail={detail} onChange={refresh} />
        </TabsContent>
      </Tabs>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit book</DialogTitle>
          </DialogHeader>
          <BookFieldsForm
            initial={formValues(book)}
            onSubmit={async (values) => {
              setSaving(true);
              try {
                await updateBook({ data: { id: book.id, ...values } });
                await refresh();
                setEditing(false);
              } catch (error) {
                toast.error(errorMessage(error));
              } finally {
                setSaving(false);
              }
            }}
            footer={
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" pending={saving}>
                  Save
                </Button>
              </div>
            }
          />
        </DialogContent>
      </Dialog>

      {deleting ? (
        <ConfirmDialog
          title={`Delete "${book.title}"?`}
          confirmLabel="Delete"
          destructive
          pending={deleting === "busy"}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            setDeleting("busy");
            try {
              await deleteBook({ data: { id: book.id } });
              await navigate({ to: "/" });
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
