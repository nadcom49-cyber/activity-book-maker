import { useState } from "react";
import { toast } from "sonner";
import { ImageUp } from "lucide-react";
import { RedrawDialog } from "@/client/features/book/PagesPanel";
import { Button } from "@/client/components/ui/button";
import { Card } from "@/client/components/ui/card";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage } from "@/client/lib/errors";
import { readFileAsBase64 } from "@/client/lib/export";
import type { BookDetail } from "@/client/features/book/types";
import {
  drawThumbnail,
  saveThumbnailPrompt,
  uploadImage,
} from "@/serverFunctions/books";

type Thumbnail = BookDetail["thumbnails"][number];

export function ThumbnailsPanel({
  detail,
  busy,
  onChange,
}: {
  detail: BookDetail;
  busy: boolean;
  onChange: () => Promise<void>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {detail.thumbnails.map((thumb) => (
        <ThumbnailCard
          key={thumb.slot}
          bookId={detail.book.id}
          thumb={thumb}
          busy={busy}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function ThumbnailCard({
  bookId,
  thumb,
  busy,
  onChange,
}: {
  bookId: string;
  thumb: Thumbnail;
  busy: boolean;
  onChange: () => Promise<void>;
}) {
  const [prompt, setPrompt] = useState(thumb.prompt);
  const [working, setWorking] = useState<"draw" | "upload" | "save" | null>(
    null,
  );
  const [redrawing, setRedrawing] = useState(false);

  async function run(
    kind: "draw" | "upload" | "save",
    action: () => Promise<unknown>,
  ) {
    setWorking(kind);
    try {
      await action();
      await onChange();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setWorking(null);
    }
  }

  return (
    <Card data-testid="thumbnail" className="gap-3 p-3">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
        {thumb.imageUrl ? (
          <img
            src={thumb.imageUrl}
            alt={`Thumbnail ${thumb.slot}`}
            className="size-full object-cover"
          />
        ) : (
          <span className="text-sm text-muted-foreground">{thumb.slot}</span>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`thumb-${thumb.slot}`}>
          Thumbnail {thumb.slot} prompt
        </Label>
        <Textarea
          id={`thumb-${thumb.slot}`}
          value={prompt}
          rows={2}
          maxLength={1000}
          onChange={(e) => setPrompt(e.target.value)}
          onBlur={() => {
            if (prompt.trim() && prompt !== thumb.prompt)
              void run("save", () =>
                saveThumbnailPrompt({
                  data: { bookId, slot: thumb.slot, prompt },
                }),
              );
          }}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {thumb.imageUrl ? (
          <Button
            variant="outline"
            size="xs"
            disabled={busy}
            onClick={() => setRedrawing(true)}
          >
            Redraw
          </Button>
        ) : (
          <Button
            variant="outline"
            size="xs"
            disabled={busy}
            pending={working === "draw"}
            onClick={() =>
              void run("draw", () =>
                drawThumbnail({ data: { bookId, slot: thumb.slot } }),
              )
            }
          >
            Draw
          </Button>
        )}
        <Button
          variant="ghost"
          size="xs"
          pending={working === "upload"}
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
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.type !== "image/png" && file.type !== "image/jpeg") {
                toast.error("Use a PNG or JPEG image.");
                return;
              }
              void run("upload", async () =>
                uploadImage({
                  data: {
                    bookId,
                    target: { slot: thumb.slot },
                    type: file.type as "image/png",
                    data: await readFileAsBase64(file),
                  },
                }),
              );
            }}
          />
        </Button>
      </div>
      {redrawing ? (
        <RedrawDialog
          bookId={bookId}
          slot={thumb.slot}
          onClose={() => setRedrawing(false)}
          onSaved={onChange}
        />
      ) : null}
    </Card>
  );
}
