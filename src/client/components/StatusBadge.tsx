import { Badge } from "@/client/components/ui/badge";
import { STATUSES, type BookStatus } from "@/lib/books";

const VARIANTS: Record<BookStatus, "outline" | "secondary" | "success"> = {
  draft: "outline",
  planned: "secondary",
  drawing: "secondary",
  ready: "success",
};

export function StatusBadge({ status }: { status: string }) {
  const known = (status in STATUSES ? status : "draft") as BookStatus;
  return (
    <Badge variant={VARIANTS[known]} data-testid="book-status">
      {STATUSES[known]}
    </Badge>
  );
}
