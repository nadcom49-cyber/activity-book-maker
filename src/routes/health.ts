import { createFileRoute } from "@tanstack/react-router";

// A JSON endpoint for uptime checks. Private like every route: the Gateway
// signs the caller in (a personal access token works).
export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: () => Response.json({ ok: true }),
    },
  },
});
