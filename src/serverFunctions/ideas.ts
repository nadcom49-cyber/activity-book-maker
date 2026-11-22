import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as ideas from "@/server/ideas";
import * as series from "@/server/series";
import { ensureUser } from "@/server/users";

const parse =
  <T>(schema: z.ZodType<T>) =>
  (data: unknown) =>
    schema.parse(data);
const idInput = z.object({ id: z.string().uuid() }).strict();

export const getIdeas = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(({ context }) => ideas.listIdeas(context.user.id));

export const getIdea = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(parse(z.object({ id: z.string().max(100) }).strict()))
  .handler(({ data, context }) => ideas.getIdea(context.user.id, data.id));

export const suggestIdeas = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(ideas.suggestInput))
  .handler(async ({ data, context: { user } }) => {
    await ensureUser(user);
    return ideas.suggestIdeas(user.id, data);
  });

export const deleteIdea = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(idInput))
  .handler(({ data, context }) => ideas.deleteIdea(context.user.id, data.id));

export const getSeriesList = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(({ context }) => series.listSeries(context.user.id));

export const getSeries = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(parse(series.seriesLookupInput))
  .handler(({ data, context }) =>
    series.getSeriesDetail(context.user.id, data.seriesId),
  );

export const planSeries = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(series.planSeriesInput))
  .handler(async ({ data, context: { user } }) => {
    await ensureUser(user);
    return series.planSeries(user.id, data);
  });

export const addSeriesBook = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(series.seriesBookInput))
  .handler(({ data, context }) => series.addBook(context.user.id, data));

export const removeSeriesBook = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(series.seriesBookInput))
  .handler(({ data, context }) => series.removeBook(context.user.id, data));

export const deleteSeries = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(series.seriesIdInput))
  .handler(({ data, context }) =>
    series.deleteSeries(context.user.id, data.seriesId),
  );

export const writeBundleListing = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(series.seriesIdInput))
  .handler(({ data, context }) =>
    series.writeBundleListing(context.user.id, data.seriesId),
  );

export const saveBundleListing = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(series.bundleListingInput))
  .handler(({ data, context }) =>
    series.saveBundleListing(context.user.id, data),
  );

export const saveBundleImages = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(parse(series.bundleImagesInput))
  .handler(({ data, context }) =>
    series.saveBundleImages(context.user.id, data),
  );
