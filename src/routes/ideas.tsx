import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Lightbulb, Sparkles, Trash2 } from "lucide-react";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button, buttonVariants } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { errorMessage } from "@/client/lib/errors";
import { SERIES_MAX, SERIES_MIN } from "@/lib/books";
import {
  deleteIdea,
  getIdeas,
  planSeries,
  suggestIdeas,
} from "@/serverFunctions/ideas";

export const Route = createFileRoute("/ideas")({
  loader: () => getIdeas(),
  component: IdeasPage,
});

type Idea = ReturnType<typeof Route.useLoaderData>[number];

function IdeasPage() {
  const ideas = Route.useLoaderData();
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [pending, setPending] = useState(false);
  const [series, setSeries] = useState<Idea | null>(null);

  async function suggest(event: FormEvent) {
    event.preventDefault();
    if (keyword.trim().length < 2) return toast.error("Enter a keyword");
    setPending(true);
    try {
      await suggestIdeas({ data: { keyword } });
      await router.invalidate();
      setKeyword("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  const groups: { key: string; keyword: string; ideas: Idea[] }[] = [];
  for (const idea of ideas) {
    const key = `${idea.createdAt}|${idea.keyword}`;
    const group = groups.find((g) => g.key === key);
    if (group) group.ideas.push(idea);
    else groups.push({ key, keyword: idea.keyword, ideas: [idea] });
  }

  return (
    <AppShell>
      <PageHeader title="Ideas" />
      <Card>
        <CardContent>
          <form
            onSubmit={suggest}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="keyword">Keyword</Label>
              <Input
                id="keyword"
                value={keyword}
                placeholder="fractions, dinosaurs, sight words…"
                maxLength={100}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <Button type="submit" pending={pending}>
              <Sparkles aria-hidden />
              Suggest ideas
            </Button>
          </form>
        </CardContent>
      </Card>

      {groups.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No ideas yet"
          description="Enter a keyword to get niche ideas. They stay here for later."
        />
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {group.keyword} · {group.ideas[0]!.createdAt.slice(0, 10)}
            </h2>
            <div className="space-y-2">
              {group.ideas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onSeries={() => setSeries(idea)}
                />
              ))}
            </div>
          </section>
        ))
      )}
      {series ? (
        <PlanSeriesDialog idea={series} onClose={() => setSeries(null)} />
      ) : null}
    </AppShell>
  );
}

function IdeaCard({ idea, onSeries }: { idea: Idea; onSeries: () => void }) {
  const router = useRouter();
  return (
    <Card data-testid="idea-card" className="gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="font-medium">{idea.title}</div>
          <p className="text-sm text-muted-foreground">{idea.angle}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Delete idea"
          onClick={async () => {
            try {
              await deleteIdea({ data: { id: idea.id } });
              await router.invalidate();
            } catch (error) {
              toast.error(errorMessage(error));
            }
          }}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <div className="text-sm">
        <span className="font-medium">{idea.suggestedPages} pages</span>
        {idea.demandNote ? (
          <span className="text-muted-foreground"> · {idea.demandNote}</span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          to="/books/new"
          search={{ idea: idea.id }}
          className={buttonVariants({ size: "sm" })}
        >
          Start a book
        </Link>
        <Button size="sm" variant="outline" onClick={onSeries}>
          Plan a series
        </Button>
      </div>
    </Card>
  );
}

function PlanSeriesDialog({
  idea,
  onClose,
}: {
  idea: Idea;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [count, setCount] = useState("3");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const n = Number(count);
    if (!Number.isInteger(n) || n < SERIES_MIN || n > SERIES_MAX)
      return setError(`Choose ${SERIES_MIN} to ${SERIES_MAX} books.`);
    setError(null);
    setPending(true);
    try {
      const created = await planSeries({ data: { ideaId: idea.id, count: n } });
      await navigate({
        to: "/series/$seriesId",
        params: { seriesId: created.id },
      });
    } catch (e) {
      toast.error(errorMessage(e));
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Plan a series: {idea.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="series-count">Number of books</Label>
            <Input
              id="series-count"
              type="number"
              min={SERIES_MIN}
              max={SERIES_MAX}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="max-w-24"
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
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
              Create series
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
