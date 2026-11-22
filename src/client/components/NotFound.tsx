import { Link } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { buttonVariants } from "@/client/components/ui/button";

/** An address with no page behind it. */
export function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <EmptyState
        variant="plain"
        icon={SearchX}
        title="Page not found"
        action={
          <Link to="/" className={buttonVariants()}>
            Go to Books
          </Link>
        }
      />
    </div>
  );
}
