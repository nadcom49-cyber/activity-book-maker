import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Images, Library, Trash2, Wand2, X } from "lucide-react";
import { AppShell } from "@/client/components/AppShell";
import { BackLink } from "@/client/components/BackLink";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { CopyButton } from "@/client/components/CopyButton";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import type { SeriesDetail } from "@/client/features/book/types";
import { errorMessage } from "@/client/lib/errors";
import {
  buildBundleZip,
  composeBundleImages,
  download,
} from "@/client/lib/export";
import { SERIES_MAX, SERIES_MIN, slugify } from "@/lib/books";
import {
  addSeriesBook,
  deleteSeries,
  getSeries,
  removeSeriesBook,
  saveBundleImages,
  saveBundleListing,
  writeBundleListing,
} from "@/serverFunctions/ideas";

export const Route = createFileRoute("/series/$seriesId")({
  loader: ({ params }) => getSeries({ data: { seriesId: params.seriesId } }),
  component: SeriesPage,
});

type Detail = SeriesDetail;

function SeriesPage() {
  const detail = Route.useLoaderData();
  if (!detail) {
    return (
      <AppShell>
        <PageHeader
          title="Series not found"
          backLink={<BackLink to="/series">Series</BackLink>}
        />
        <EmptyState
          kind="error"
          icon={Library}
          title="This series was deleted, or it isn't yours."
        />
      </AppShell>
    );
  }
  return <SeriesView detail={detail} />;
}

function SeriesView({ detail }: { detail: Detail }) {
  const router = useRouter();
  const navigate = useNavigate();
  const seriesId = detail.series.id;
  const [adding, setAdding] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<"ask" | "busy" | null>(null);
  const refresh = () => router.invalidate();
  const enough = detail.books.length >= SERIES_MIN;

  async function run(key: string, action: () => Promise<unknown>) {
    setWorking(key);
    try {
      await action();
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setWorking(null);
    }
  }

  const candidates = Object.fromEntries(
    detail.candidates.map((b) => [b.id, b.title]),
  ) as Record<string, string>;

  return (
    <AppShell>
      <PageHeader
        backLink={<BackLink to="/series">Series</BackLink>}
        title={detail.series.title}
        description={`${detail.books.length} of up to ${SERIES_MAX} books`}
        actions={
          <Button
            variant="outline"
            size="sm"
            aria-label="Delete series"
            onClick={() => setDeleting("ask")}
          >
            <Trash2 aria-hidden />
          </Button>
        }
      />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Books</h2>
        <Card className="gap-0 divide-y divide-border p-0">
          {detail.books.map((book) => (
            <div
              key={book.id}
              data-testid="series-book"
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="flex aspect-[3/4] w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                {book.coverUrl ? (
                  <img
                    src={book.coverUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : null}
              </div>
              <Link
                to="/books/$bookId"
                params={{ bookId: book.id }}
                className="min-w-0 flex-1 truncate font-medium hover:underline"
              >
                {book.title}
              </Link>
              <StatusBadge status={book.status} />
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${book.title} from the series`}
                pending={working === `remove-${book.id}`}
                onClick={() =>
                  void run(`remove-${book.id}`, () =>
                    removeSeriesBook({ data: { seriesId, bookId: book.id } }),
                  )
                }
              >
                <X aria-hidden />
              </Button>
            </div>
          ))}
          {detail.books.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              No books in this series.
            </div>
          ) : null}
        </Card>
        {detail.books.length < SERIES_MAX && detail.candidates.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="sm:w-72">
              <ChoiceSelect
                testId="add-book"
                value={adding}
                options={candidates}
                onChange={setAdding}
                placeholder="Choose a book"
              />
            </div>
            <Button
              variant="outline"
              disabled={!adding}
              pending={working === "add"}
              onClick={() =>
                adding &&
                void run("add", async () => {
                  await addSeriesBook({ data: { seriesId, bookId: adding } });
                  setAdding(null);
                })
              }
            >
              Add to series
            </Button>
          </div>
        ) : null}
      </section>

      {enough ? (
        <BundleSection detail={detail} onChange={refresh} />
      ) : (
        <EmptyState
          title="No bundle yet"
          description={`A bundle needs ${SERIES_MIN} books at least.`}
        />
      )}

      {deleting ? (
        <ConfirmDialog
          title={`Delete the series "${detail.series.title}"?`}
          confirmLabel="Delete series"
          destructive
          pending={deleting === "busy"}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            setDeleting("busy");
            try {
              await deleteSeries({ data: { seriesId } });
              await navigate({ to: "/series" });
            } catch (error) {
              toast.error(errorMessage(error));
              setDeleting(null);
            }
          }}
        >
          Its bundle is deleted. The books stay.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}

function BundleSection({
  detail,
  onChange,
}: {
  detail: Detail;
  onChange: () => Promise<void>;
}) {
  const seriesId = detail.series.id;
  const [title, setTitle] = useState(detail.bundle?.title ?? "");
  const [description, setDescription] = useState(
    detail.bundle?.description ?? "",
  );
  const [tags, setTags] = useState(detail.bundle?.tags.join(", ") ?? "");
  const [working, setWorking] = useState<
    "write" | "save" | "images" | "zip" | null
  >(null);
  const images = detail.bundle?.imageUrls ?? [];

  async function step(kind: typeof working, action: () => Promise<void>) {
    setWorking(kind);
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setWorking(null);
    }
  }

  const tagList = () =>
    tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Bundle</h2>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Listing</CardTitle>
          <Button
            variant="outline"
            size="sm"
            pending={working === "write"}
            onClick={() =>
              void step("write", async () => {
                const written = await writeBundleListing({
                  data: { seriesId },
                });
                setTitle(written.title);
                setDescription(written.description);
                setTags(written.tags.join(", "));
              })
            }
          >
            <Wand2 aria-hidden />
            Write bundle listing
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bundle-title">Bundle title</Label>
              <CopyButton
                value={title}
                label="Copy title"
                size="icon-xs"
                variant="ghost"
                successMessage="Copied"
              />
            </div>
            <Input
              id="bundle-title"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bundle-description">Bundle description</Label>
              <CopyButton
                value={description}
                label="Copy description"
                size="icon-xs"
                variant="ghost"
                successMessage="Copied"
              />
            </div>
            <Textarea
              id="bundle-description"
              value={description}
              rows={5}
              maxLength={5000}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bundle-tags">Bundle tags</Label>
              <CopyButton
                value={tags}
                label="Copy tags"
                size="icon-xs"
                variant="ghost"
                successMessage="Copied"
              />
            </div>
            <Input
              id="bundle-tags"
              value={tags}
              placeholder="Separated by commas"
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button
              pending={working === "save"}
              onClick={() =>
                void step("save", async () => {
                  await saveBundleListing({
                    data: { seriesId, title, description, tags: tagList() },
                  });
                  await onChange();
                  toast.success("Bundle listing saved");
                })
              }
            >
              Save bundle listing
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Images</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              pending={working === "images"}
              onClick={() =>
                void step("images", async () => {
                  const composed = await composeBundleImages(
                    title || detail.series.title,
                    detail.books,
                  );
                  await saveBundleImages({
                    data: {
                      seriesId,
                      images: composed.map((data) => ({
                        type: "image/png" as const,
                        data,
                      })),
                    },
                  });
                  await onChange();
                })
              }
            >
              <Images aria-hidden />
              Make bundle images
            </Button>
            <Button
              size="sm"
              disabled={images.length === 0}
              pending={working === "zip"}
              onClick={() =>
                void step("zip", async () => {
                  const zip = await buildBundleZip({
                    title,
                    description,
                    tags: tagList(),
                    imageUrls: images,
                  });
                  download(
                    zip,
                    `${slugify(title || detail.series.title)}-bundle.zip`,
                    "application/zip",
                  );
                })
              }
            >
              <Download aria-hidden />
              Download bundle ZIP
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {images.length ? (
            <div className="grid grid-cols-2 gap-3">
              {images.map((url, i) => (
                <div
                  key={url}
                  data-testid="bundle-image"
                  className="overflow-hidden rounded-md border border-border"
                >
                  <img
                    src={url}
                    alt={`Bundle image ${i + 1}`}
                    className="aspect-square w-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No images yet.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
