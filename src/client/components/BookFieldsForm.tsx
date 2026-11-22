import { useState, type FormEvent, type ReactNode } from "react";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import {
  GRADES,
  LANGUAGES,
  MAX_PAGES,
  MIN_PAGES,
  SOURCE_KINDS,
  SUBJECTS,
  type Grade,
  type Language,
  type PageSize,
  type SourceKind,
  type Subject,
} from "@/lib/books";

export interface BookFormValues {
  title: string;
  sourceKind: SourceKind;
  sourceText: string;
  grade: Grade;
  subject: Subject;
  language: Language;
  pageSize: PageSize;
  pageCount: number;
}

export const DEFAULT_BOOK: BookFormValues = {
  title: "",
  sourceKind: "idea",
  sourceText: "",
  grade: "g35",
  subject: "mixed",
  language: "en",
  pageSize: "letter",
  pageCount: 12,
};

const SOURCE_HINTS: Record<SourceKind, string> = {
  trend: "The topic, and what's popular about it",
  cover: "Describe the cover or page: theme, layout, characters",
  idea: "What the book is about and who it's for",
  product: "Paste the product link and what you like about it",
};

/** The fields of a book, shared by the new-book page and the edit dialog. */
export function BookFieldsForm({
  initial,
  onSubmit,
  footer,
}: {
  initial: BookFormValues;
  onSubmit: (values: BookFormValues) => void;
  footer: ReactNode;
}) {
  const [values, setValues] = useState(initial);
  const [pages, setPages] = useState(String(initial.pageCount));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof BookFormValues>(
    key: K,
    value: BookFormValues[K],
  ) => setValues((v) => ({ ...v, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const pageCount = Number(pages);
    if (!Number.isInteger(pageCount) || pageCount < MIN_PAGES)
      return setError(`${MIN_PAGES} page at least`);
    if (pageCount > MAX_PAGES) return setError(`${MAX_PAGES} pages at most`);
    if (!values.title.trim() && !values.sourceText.trim())
      return setError("Give a title or describe the source");
    setError(null);
    onSubmit({ ...values, pageCount });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="book-title">Title</Label>
          <Input
            id="book-title"
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="book-source">Source</Label>
          <ChoiceSelect
            id="book-source"
            testId="source-kind"
            value={values.sourceKind}
            options={SOURCE_KINDS}
            onChange={(v) => set("sourceKind", v)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="book-grade">Grade band</Label>
          <ChoiceSelect
            id="book-grade"
            testId="grade"
            value={values.grade}
            options={GRADES}
            onChange={(v) => set("grade", v)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="book-details">Details</Label>
          <Textarea
            id="book-details"
            value={values.sourceText}
            placeholder={SOURCE_HINTS[values.sourceKind]}
            onChange={(e) => set("sourceText", e.target.value)}
            maxLength={4000}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="book-subject">Subject</Label>
          <ChoiceSelect
            id="book-subject"
            testId="subject"
            value={values.subject}
            options={SUBJECTS}
            onChange={(v) => set("subject", v)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="book-language">Language</Label>
          <ChoiceSelect
            id="book-language"
            testId="language"
            value={values.language}
            options={LANGUAGES}
            onChange={(v) => set("language", v)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="book-size">Page size</Label>
          <ChoiceSelect
            id="book-size"
            testId="page-size"
            value={values.pageSize}
            options={{ letter: "US Letter", a4: "A4" }}
            onChange={(v) => set("pageSize", v)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="book-pages">Pages</Label>
          <Input
            id="book-pages"
            type="number"
            inputMode="numeric"
            min={MIN_PAGES}
            max={MAX_PAGES}
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            aria-invalid={error?.includes("page") || undefined}
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {footer}
    </form>
  );
}
