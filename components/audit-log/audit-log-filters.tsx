"use client"

import { useState, type FormEvent } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AUDIT_ACTION_LABELS, AUDIT_AREA_LABELS } from "@/lib/audit-log"

export interface AuditFilters {
  search: string
  actor: string
  action: string
  area: string
  from: string
  to: string
}

export interface AuditUserOption {
  id: string
  email: string
}

export const EMPTY_FILTERS: AuditFilters = { search: "", actor: "all", action: "all", area: "all", from: "", to: "" }

interface AuditLogFiltersProps {
  filters: AuditFilters
  onChange: (filters: AuditFilters) => void
  users: AuditUserOption[]
}

export function AuditLogFilters({ filters, onChange, users }: AuditLogFiltersProps) {
  const [searchDraft, setSearchDraft] = useState(filters.search)

  const set = (patch: Partial<AuditFilters>) => onChange({ ...filters, ...patch })

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    set({ search: searchDraft.trim() })
  }

  const clear = () => {
    setSearchDraft("")
    onChange(EMPTY_FILTERS)
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={submitSearch} className="flex flex-col gap-1.5">
          <Label htmlFor="audit-search">Search</Label>
          <div className="flex gap-2">
            <Input
              id="audit-search"
              type="search"
              placeholder="Student name, UIN, or user email"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault()
              }}
            />
            <Button type="submit" variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </form>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-actor">Who</Label>
            <Select value={filters.actor} onValueChange={(actor) => set({ actor })}>
              <SelectTrigger id="audit-actor" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.email}
                  </SelectItem>
                ))}
                <SelectItem value="system">Automatic and system</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-action">Action</Label>
            <Select value={filters.action} onValueChange={(action) => set({ action })}>
              <SelectTrigger id="audit-action" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-area">Area</Label>
            <Select value={filters.area} onValueChange={(area) => set({ area })}>
              <SelectTrigger id="audit-area" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All areas</SelectItem>
                {Object.entries(AUDIT_AREA_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-from">From</Label>
            <Input
              id="audit-from"
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => set({ from: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-to">To</Label>
            <Input
              id="audit-to"
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => set({ to: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Button variant="ghost" size="sm" onClick={clear}>
            <X className="h-4 w-4 mr-2" />
            Clear filters
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
