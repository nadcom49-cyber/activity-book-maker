import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { ThemePreferenceRadio } from "@/client/components/ThemePreferenceMenuItems";

/**
 * The frame every page sits in: a bar with the way back to the Gateway and
 * the theme pick, then one scrolling column. The document itself doesn't
 * scroll (src/client/styles/app.css); the column does. A page starts with a
 * `PageHeader`. An app with more than one page puts its tabs or links in
 * `nav`.
 */
export function AppShell({ children }: { children: ReactNode }) {
  // From the root route's loader (src/serverFunctions/gateway.ts).
  const gatewayUrl = useRouterState({
    select: (state) => {
      const root = state.matches[0]?.loaderData;
      return root && "gatewayUrl" in root ? root.gatewayUrl : null;
    },
  });
  const isAdmin = useRouterState({
    select: (state) => {
      const root = state.matches[0]?.loaderData;
      return Boolean(root && "isAdmin" in root && root.isAdmin);
    },
  });
  const nav = (
    <nav className="flex min-w-0 items-center gap-3 overflow-x-auto text-sm">
      <NavLink to="/" exact>
        Books
      </NavLink>
      <NavLink to="/ideas">Ideas</NavLink>
      <NavLink to="/series">Series</NavLink>
      {isAdmin ? <NavLink to="/admin">Admin</NavLink> : null}
    </nav>
  );
  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-border">
        <div
          className={`${COLUMN} flex h-12 items-center justify-between gap-3`}
        >
          <div className="flex min-w-0 items-center gap-4">
            {gatewayUrl ? (
              <a
                href={gatewayUrl}
                className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="size-4" aria-hidden />
                All apps
              </a>
            ) : null}
            {nav}
          </div>
          <ThemePreferenceRadio />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <main className={`${COLUMN} space-y-10 pt-8 pb-24 md:pt-10`}>
          {children}
        </main>
      </div>
    </div>
  );
}

function NavLink({
  to,
  exact = false,
  children,
}: {
  to: "/" | "/ideas" | "/series" | "/admin";
  exact?: boolean;
  children: ReactNode;
}) {
  const active = useRouterState({
    select: (state) => {
      const path = state.location.pathname;
      if (to === "/") return path === "/" || path.startsWith("/books");
      return exact ? path === to : path.startsWith(to);
    },
  });
  return (
    <Link
      to={to}
      className={
        active
          ? "shrink-0 font-medium text-foreground"
          : "shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}

/** The column the bar and the page share. */
const COLUMN = "mx-auto w-full max-w-3xl px-4 md:px-10";
