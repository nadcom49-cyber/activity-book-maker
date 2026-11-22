import type { getBookDetail } from "@/server/books";
import type { getSeriesDetail } from "@/server/series";

export type BookDetail = NonNullable<Awaited<ReturnType<typeof getBookDetail>>>;
export type SeriesDetail = NonNullable<
  Awaited<ReturnType<typeof getSeriesDetail>>
>;
