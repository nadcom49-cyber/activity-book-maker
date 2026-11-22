import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { CopyButton } from "@/client/components/CopyButton";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage } from "@/client/lib/errors";
import type { BookDetail } from "@/client/features/book/types";
import { saveListing, writeListing } from "@/serverFunctions/books";

interface Draft {
  title: string;
  description: string;
  grades: string;
  subjects: string;
  tags: string;
  price: string;
}

const toDraft = (
  listing:
    | BookDetail["listing"]
    | Awaited<ReturnType<typeof writeListing>>
    | null,
): Draft => ({
  title: listing?.title ?? "",
  description: listing?.description ?? "",
  grades: listing?.grades ?? "",
  subjects: listing?.subjects ?? "",
  tags: listing?.tags.join(", ") ?? "",
  price:
    listing?.priceCents == null ? "" : (listing.priceCents / 100).toFixed(2),
});

export function ListingPanel({
  detail,
  onChange,
}: {
  detail: BookDetail;
  onChange: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(detail.listing));
  const [working, setWorking] = useState<"write" | "save" | null>(null);
  const set = (key: keyof Draft) => (value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function write() {
    setWorking("write");
    try {
      setDraft(
        toDraft(await writeListing({ data: { bookId: detail.book.id } })),
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setWorking(null);
    }
  }

  async function save() {
    const price = draft.price.trim()
      ? Math.round(Number(draft.price) * 100)
      : null;
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      toast.error("Enter the price as a number, such as 4.50");
      return;
    }
    setWorking("save");
    try {
      await saveListing({
        data: {
          bookId: detail.book.id,
          title: draft.title,
          description: draft.description,
          grades: draft.grades,
          subjects: draft.subjects,
          tags: draft.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          priceCents: price,
        },
      });
      await onChange();
      toast.success("Listing saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setWorking(null);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void write()}
            pending={working === "write"}
          >
            <Wand2 aria-hidden />
            Write listing
          </Button>
        </div>
        <Field
          id="listing-title"
          label="Listing title"
          copy="title"
          value={draft.title}
        >
          <Input
            id="listing-title"
            value={draft.title}
            maxLength={200}
            onChange={(e) => set("title")(e.target.value)}
          />
        </Field>
        <Field
          id="listing-description"
          label="Description"
          copy="description"
          value={draft.description}
        >
          <Textarea
            id="listing-description"
            value={draft.description}
            rows={6}
            maxLength={5000}
            onChange={(e) => set("description")(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="listing-grades"
            label="Grades"
            copy="grades"
            value={draft.grades}
          >
            <Input
              id="listing-grades"
              value={draft.grades}
              maxLength={200}
              onChange={(e) => set("grades")(e.target.value)}
            />
          </Field>
          <Field
            id="listing-subjects"
            label="Subjects"
            copy="subjects"
            value={draft.subjects}
          >
            <Input
              id="listing-subjects"
              value={draft.subjects}
              maxLength={200}
              onChange={(e) => set("subjects")(e.target.value)}
            />
          </Field>
        </div>
        <Field id="listing-tags" label="Tags" copy="tags" value={draft.tags}>
          <Input
            id="listing-tags"
            value={draft.tags}
            placeholder="Separated by commas"
            onChange={(e) => set("tags")(e.target.value)}
          />
        </Field>
        <Field
          id="listing-price"
          label="Price (USD)"
          copy="price"
          value={draft.price}
        >
          <Input
            id="listing-price"
            value={draft.price}
            inputMode="decimal"
            className="max-w-40"
            onChange={(e) => set("price")(e.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Button onClick={() => void save()} pending={working === "save"}>
            Save listing
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  copy,
  value,
  children,
}: {
  id: string;
  label: string;
  copy: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <CopyButton
          value={value}
          label={`Copy ${copy}`}
          size="icon-xs"
          variant="ghost"
          successMessage="Copied"
        />
      </div>
      {children}
    </div>
  );
}
