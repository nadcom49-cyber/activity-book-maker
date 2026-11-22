import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  FilePlus2,
  ImageUp,
  Pencil,
  Trash2,
  Wand2,
} from "lucide-react";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card } from "@/client/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage } from "@/client/lib/errors";
import { readFileAsBase64 } from "@/client/lib/export";
import { MAX_PAGES, PAGE_KINDS, type PageKind } from "@/lib/books";
import type { BookDetail } from "@/client/features/book/types";
import {
  deletePage,
  drawPage,
  drawThumbnail,
  movePage,
  planBook,
  savePage,
  uploadImage,
} from "@/serverFunctions/books";

type Page = BookDetail["pages"][number];

export function PagesPanel({
  detail,
  busy,
  onChange,
}: {
  detail: BookDetail;
  busy: boolean;
  onChange: () => Promise<void>;
}) {
  const bookId = detail.book.id;
  const [planning, setPlanning] = useState<"ask" | "busy" | null>(null);
  const [editing, setEditing] = useState<Page | "new" | null>(null);
  const [redrawing, setRedrawing] = useState<Page | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const full = detail.pages.length >= MAX_PAGES;

  async function run(key: string, action: () => Promise<unknown>) {
    setWorking(key);
    try {
      await action();
      await onChange();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setWorking(null);
    }
  }

  async function plan() {
    setPlanning("busy");
    try {
      await planBook({ data: { bookId } });
      await onChange();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPlanning(null);
    }
  }

  async function upload(page: Page, file: File | undefined) {
    if (!file) return;
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      toast.error("Use a PNG or JPEG image.");
      return;
    }
    await run(`upload-${page.id}`, async () =>
      uploadImage({
        data: {
          bookId,
          target: { pageId: page.id },
          type: file.type as "image/png",
          data: await readFileAsBase64(file),
        },
      }),
    );
  }

  if (detail.pages.length === 0) {
    return (
      <>
        <EmptyState
          icon={FilePlus2}
          title="No pages yet"
          description={`Plan all ${detail.book.pageCount} pages with AI, or add them one at a time.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => void plan()} pending={planning === "busy"}>
                <Wand2 aria-hidden />
                Plan pages
              </Button>
              <Button variant="outline" onClick={() => setEditing("new")}>
                Add page
              </Button>
            </div>
          }
        />
        {editing ? (
          <PageDialog
            bookId={bookId}
            page={editing}
            onClose={() => setEditing(null)}
            onSaved={onChange}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPlanning("ask")}
          disabled={busy}
        >
          <Wand2 aria-hidden />
          Plan again
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing("new")}
          disabled={full || busy}
        >
          <FilePlus2 aria-hidden />
          Add page
        </Button>
      </div>
      <ol className="space-y-2">
        {detail.pages.map((page, index) => (
          <li key={page.id}>
            <Card data-testid="page-row" className="flex-row gap-3 p-3">
              <div className="flex aspect-[3/4] w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                {page.imageUrl ? (
                  <img
                    src={page.imageUrl}
                    alt={page.title}
                    className="size-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{index + 1}</span>
                  <Badge variant="outline">
                    {PAGE_KINDS[page.kind as PageKind] ?? page.kind}
                  </Badge>
                </div>
                <div data-testid="page-title" className="font-medium">
                  {page.title}
                </div>
                {page.content ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {page.content}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  {page.imageUrl ? (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setRedrawing(page)}
                      disabled={busy}
                    >
                      Redraw
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="xs"
                      pending={working === `draw-${page.id}`}
                      disabled={busy}
                      onClick={() =>
                        void run(`draw-${page.id}`, () =>
                          drawPage({ data: { bookId, pageId: page.id } }),
                        )
                      }
                    >
                      Draw
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="xs"
                    pending={working === `upload-${page.id}`}
                    disabled={busy}
                    render={<label />}
                    nativeButton={false}
                  >
                    <ImageUp aria-hidden />
                    Upload image
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="sr-only"
                      data-testid="page-upload-input"
                      onChange={(e) => {
                        void upload(page, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </Button>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Edit page"
                  onClick={() => setEditing(page)}
                >
                  <Pencil aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Move up"
                  disabled={index === 0 || working !== null}
                  onClick={() =>
                    void run(`move-${page.id}`, () =>
                      movePage({
                        data: { bookId, pageId: page.id, direction: "up" },
                      }),
                    )
                  }
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Move down"
                  disabled={
                    index === detail.pages.length - 1 || working !== null
                  }
                  onClick={() =>
                    void run(`move-${page.id}`, () =>
                      movePage({
                        data: { bookId, pageId: page.id, direction: "down" },
                      }),
                    )
                  }
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Delete page"
                  disabled={working !== null || busy}
                  onClick={() =>
                    void run(`delete-${page.id}`, () =>
                      deletePage({ data: { bookId, pageId: page.id } }),
                    )
                  }
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      {editing ? (
        <PageDialog
          bookId={bookId}
          page={editing}
          onClose={() => setEditing(null)}
          onSaved={onChange}
        />
      ) : null}
      {redrawing ? (
        <RedrawDialog
          bookId={bookId}
          page={redrawing}
          onClose={() => setRedrawing(null)}
          onSaved={onChange}
        />
      ) : null}
      {planning === "ask" ||
      (planning === "busy" && detail.pages.length > 0) ? (
        <ConfirmDialog
          title="Plan the book again?"
          confirmLabel="Plan again"
          pending={planning === "busy"}
          onClose={() => setPlanning(null)}
          onConfirm={() => void plan()}
        >
          Every page and its picture is replaced.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function PageDialog({
  bookId,
  page,
  onClose,
  onSaved,
}: {
  bookId: string;
  page: Page | "new";
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const existing = page === "new" ? null : page;
  const [kind, setKind] = useState<PageKind>(
    (existing?.kind as PageKind) ?? "activity",
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [prompt, setPrompt] = useState(existing?.prompt ?? "");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return toast.error("Title is required");
    setPending(true);
    try {
      await savePage({
        data: { bookId, pageId: existing?.id, kind, title, content, prompt },
      });
      await onSaved();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit page" : "Add page"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="page-kind">Kind</Label>
            <ChoiceSelect
              id="page-kind"
              testId="page-kind"
              value={kind}
              options={PAGE_KINDS}
              onChange={setKind}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="page-title">Title</Label>
            <Input
              id="page-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="page-content">Text</Label>
            <Textarea
              id="page-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              maxLength={4000}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="page-prompt">Illustration prompt</Label>
            <Textarea
              id="page-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              maxLength={1000}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" pending={pending}>
              Save page
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RedrawDialog({
  bookId,
  page,
  onClose,
  onSaved,
  slot,
}: {
  bookId: string;
  page?: Page;
  slot?: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Redraw {page ? `"${page.title}"` : `thumbnail ${slot}`}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            try {
              if (page)
                await drawPage({
                  data: { bookId, pageId: page.id, note: note || undefined },
                });
              else
                await drawThumbnail({
                  data: { bookId, slot: slot!, note: note || undefined },
                });
              await onSaved();
              onClose();
            } catch (error) {
              toast.error(errorMessage(error));
              setPending(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="redraw-note">Note</Label>
            <Textarea
              id="redraw-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What to change"
              rows={3}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" pending={pending}>
              {page ? "Redraw page" : "Redraw thumbnail"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
