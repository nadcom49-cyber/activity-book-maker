import { createFileRoute } from "@tanstack/react-router";
import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { ownsSeries } from "@/server/series";
import { serveImage } from "@/server/serveImage";

// A series' bundle images, only for the member who owns the series.
export const Route = createFileRoute("/bundle-files/$seriesId/$name")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getEveryAppUser(request, env);
        if (!user || !(await ownsSeries(user.id, params.seriesId)))
          return new Response("Not found", { status: 404 });
        return serveImage(`series/${params.seriesId}/`, params.name);
      },
    },
  },
});
