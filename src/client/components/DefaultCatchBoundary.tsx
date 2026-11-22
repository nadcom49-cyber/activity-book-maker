import { Link, useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { errorMessage } from "@/client/lib/errors";
import { Button, buttonVariants } from "@/client/components/ui/button";
import { Card, CardContent, CardFooter } from "@/client/components/ui/card";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="text-center text-destructive">
          {errorMessage(error)}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={() => void router.invalidate()}>
            Try again
          </Button>
          <Link
            to="/"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Books
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
