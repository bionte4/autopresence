import Link from "next/link";

export function ListControls({
  basePath,
  q,
  sort,
  direction,
  page,
  pageCount,
  total,
  sortOptions,
}: {
  basePath: string;
  q: string;
  sort: string;
  direction: "asc" | "desc";
  page: number;
  pageCount: number;
  total: number;
  sortOptions: Array<{ value: string; label: string }>;
}) {
  const nextDirection = direction === "asc" ? "desc" : "asc";
  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-col gap-2 sm:flex-row sm:items-end" action={basePath}>
        <label className="flex flex-1 flex-col gap-1 text-xs text-ink-2">
          Cari
          <input name="q" defaultValue={q} className="field" />
        </label>
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="direction" value={direction} />
        <button type="submit" className="btn">
          Terapkan
        </button>
      </form>
      <div className="flex flex-wrap gap-3 text-sm">
        {sortOptions.map((option) => (
          <Link
            key={option.value}
            href={`${basePath}?q=${encodeURIComponent(q)}&sort=${option.value}&direction=${option.value === sort ? nextDirection : "asc"}`}
            className="underline"
          >
            Urutkan {option.label}
            {option.value === sort ? (direction === "asc" ? " ↑" : " ↓") : ""}
          </Link>
        ))}
      </div>
      <nav className="flex items-center justify-between text-sm" aria-label="Halaman">
        <span>
          Halaman {page} dari {pageCount} ({total} data)
        </span>
        <div className="flex gap-3">
          {page > 1 ? (
            <Link href={`${basePath}?q=${encodeURIComponent(q)}&sort=${sort}&direction=${direction}&page=${page - 1}`}>
              Sebelumnya
            </Link>
          ) : null}
          {page < pageCount ? (
            <Link href={`${basePath}?q=${encodeURIComponent(q)}&sort=${sort}&direction=${direction}&page=${page + 1}`}>
              Berikutnya
            </Link>
          ) : null}
        </div>
      </nav>
    </div>
  );
}
