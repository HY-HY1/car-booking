import "server-only";

// Supabase hands back at most 1,000 rows a request, so platform-wide reads
// that can go past that are read a page at a time. `cap` stops a runaway read:
// the numbers built on it are then a floor, which `truncated` says.

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export async function allRows<T>(page: (from: number, to: number) => Page<T>, cap = 50_000) {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; from < cap; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < size) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

// Throws the first error among several Supabase results.
export function check(...results: { error: { message: string } | null }[]) {
  for (const r of results) if (r.error) throw new Error(r.error.message);
}
