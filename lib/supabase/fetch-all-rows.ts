type Page<T> = {
  data: T[] | null
  error: unknown
  count?: number | null
}

// Supabase returns at most 1,000 rows per request, so larger result sets have to be read page by page.
// The query passed in must have a stable ORDER BY (end with a unique column) or pages can overlap.
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = []

  while (true) {
    const { data, error, count } = await fetchPage(rows.length, rows.length + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) return rows

    rows.push(...data)
    if (typeof count === "number" && rows.length >= count) return rows
  }
}
