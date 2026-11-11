"use client"

import { useState } from "react"
import useSWR from "swr"
import useSWRInfinite from "swr/infinite"
import { Loader2, RefreshCw, ScrollText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import type { AuditLogPage } from "@/lib/audit-log"
import { AuditLogFilters, EMPTY_FILTERS, type AuditFilters, type AuditUserOption } from "./audit-log-filters"
import { AuditLogTable } from "./audit-log-table"

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error ?? "Could not load the audit log")
  return body as T
}

function startOfLocalDay(date: string, addDays = 0) {
  const day = new Date(`${date}T00:00:00`)
  day.setDate(day.getDate() + addDays)
  return day.toISOString()
}

function pageUrl(filters: AuditFilters, cursor: number | null) {
  const params = new URLSearchParams()
  if (filters.search) params.set("q", filters.search)
  if (filters.actor !== "all") params.set("actor", filters.actor)
  if (filters.action !== "all") params.set("action", filters.action)
  if (filters.area !== "all") params.set("area", filters.area)
  if (filters.from) params.set("from", startOfLocalDay(filters.from))
  if (filters.to) params.set("to", startOfLocalDay(filters.to, 1))
  if (cursor) params.set("cursor", String(cursor))
  return `/api/admin/audit-log?${params}`
}

export function AuditLogViewer() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS)

  const { data: users } = useSWR<AuditUserOption[]>("/api/admin/users", fetchJson)

  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite<AuditLogPage>(
    (_index, previous: AuditLogPage | null) => {
      if (previous && previous.nextCursor === null) return null
      return pageUrl(filters, previous?.nextCursor ?? null)
    },
    fetchJson,
  )

  const pages = data ?? []
  const entries = pages.flatMap((page) => page.entries)
  const names = Object.assign({}, ...pages.map((page) => page.names)) as Record<string, string>
  const hasMore = pages.length > 0 && pages[pages.length - 1].nextCursor !== null
  const isLoadingMore = size > pages.length && !error
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  return (
    <div className="flex flex-col gap-6">
      <AuditLogFilters filters={filters} onChange={setFilters} users={Array.isArray(users) ? users : []} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Activity</CardTitle>
            <CardDescription>Newest first. Entries cannot be edited or deleted.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
            <RefreshCw className={isValidating ? "h-4 w-4 mr-2 animate-spin" : "h-4 w-4 mr-2"} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Could not load the audit log"}
            </p>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12" role="status">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="sr-only">Loading audit log</span>
            </div>
          ) : entries.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ScrollText />
                </EmptyMedia>
                <EmptyTitle>{isFiltered ? "No matching activity" : "No activity recorded yet"}</EmptyTitle>
                <EmptyDescription>
                  {isFiltered
                    ? "Try a different search or clear the filters."
                    : "Changes and sign-ins will appear here as they happen."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <AuditLogTable entries={entries} names={names} />
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Showing {entries.length.toLocaleString()} {entries.length === 1 ? "entry" : "entries"}
                </p>
                {hasMore && (
                  <Button variant="outline" onClick={() => setSize(size + 1)} disabled={isLoadingMore}>
                    {isLoadingMore && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Load more
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
