import { z } from "zod";

export type ListQuery = {
  page: number;
  pageSize: number;
  q: string;
  sort: string;
  direction: "asc" | "desc";
};

export function parseListQuery(
  params: Record<string, string | undefined>,
  sortFields: [string, ...string[]],
  defaultSort: string,
): ListQuery {
  return z
    .object({
      page: z.coerce.number().int().positive(),
      pageSize: z.coerce.number().int().positive().max(100),
      q: z.string().trim().max(100),
      sort: z.enum(sortFields),
      direction: z.enum(["asc", "desc"]),
    })
    .parse({
      page: params.page ?? "1",
      pageSize: params.pageSize ?? "20",
      q: params.q ?? "",
      sort: params.sort ?? defaultSort,
      direction: params.direction ?? "asc",
    });
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function visiblePage(page: number, pageSize: number, total: number): number {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(page, pageCount);
}
