import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { Button } from "@/client/components/ui/button";
import { Card } from "@/client/components/ui/card";
import type { BookDetail } from "@/client/features/book/types";

export function PreviewPanel({ detail }: { detail: BookDetail }) {
  const [index, setIndex] = useState(0);
  const pages = detail.pages;
  if (pages.length === 0) {
    return (
      <EmptyState
        title="Nothing to preview yet"
        description="Plan or add pages first."
      />
    );
  }
  const at = Math.min(index, pages.length - 1);
  const page = pages[at]!;
  const ratio =
    detail.book.pageSize === "a4" ? "aspect-[210/297]" : "aspect-[8.5/11]";
  const thumbs = detail.thumbnails.filter((t) => t.imageUrl);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={at === 0}
          onClick={() => setIndex(at - 1)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <span
          data-testid="preview-counter"
          className="text-sm text-muted-foreground"
        >
          Page {at + 1} of {pages.length}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={at === pages.length - 1}
          onClick={() => setIndex(at + 1)}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <Card
        data-testid="preview-page"
        className={`mx-auto w-full max-w-md overflow-hidden p-0 ${ratio}`}
      >
        {page.imageUrl ? (
          <img
            src={page.imageUrl}
            alt={page.title}
            className="size-full bg-background object-contain"
          />
        ) : (
          <div className="space-y-3 p-6">
            <div className="text-lg font-semibold">{page.title}</div>
            <p className="whitespace-pre-line text-sm">{page.content}</p>
          </div>
        )}
      </Card>
      <div className="space-y-2">
        <div className="text-sm font-medium">Thumbnails</div>
        <div
          data-testid="preview-thumbnails"
          className="grid grid-cols-4 gap-2"
        >
          {thumbs.map((thumb) => (
            <img
              key={thumb.slot}
              src={thumb.imageUrl!}
              alt={`Thumbnail ${thumb.slot}`}
              className="aspect-square w-full rounded-md border border-border object-cover"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
