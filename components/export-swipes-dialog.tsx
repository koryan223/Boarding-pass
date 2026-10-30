"use client"

import { useState } from "react"
import useSWR from "swr"
import { Download, Loader2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { downloadFile } from "@/lib/csv"

interface Location {
  id: string
  name: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function toDateInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function ExportSwipesDialog() {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const weekAgo = new Date(today.getTime() - 6 * 86_400_000)
  const [startDate, setStartDate] = useState(toDateInput(weekAgo))
  const [endDate, setEndDate] = useState(toDateInput(today))
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useSWR<{ locations?: Location[] }>(open ? "/api/locations?accessible=1" : null, fetcher)
  const locations = data?.locations ?? []
  const selectedIds = selected ?? new Set(locations.map((l) => l.id))

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selectedIds)
    if (checked) next.add(id)
    else next.delete(id)
    setSelected(next)
  }

  const allChecked = locations.length > 0 && selectedIds.size === locations.length

  const handleExport = async () => {
    setError(null)
    if (!startDate || !endDate || startDate > endDate) {
      setError("The start date must be on or before the end date.")
      return
    }
    if (selectedIds.size === 0) {
      setError("Select at least one location.")
      return
    }

    const from = new Date(`${startDate}T00:00:00`)
    const to = new Date(`${endDate}T00:00:00`)
    to.setDate(to.getDate() + 1)

    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      locations: [...selectedIds].join(","),
    })

    setIsExporting(true)
    try {
      const response = await fetch(`/api/exports/swipes?${params}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Export failed (HTTP ${response.status})`)
      }
      const count = Number(response.headers.get("X-Row-Count") ?? "0")
      if (count === 0) {
        setError("No swipes found for these dates and locations.")
        return
      }
      downloadFile(`meal-swipes_${startDate}_to_${endDate}.csv`, await response.blob())
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Swipes
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export meal swipes</DialogTitle>
          <DialogDescription>Download a CSV of every swipe in a date range.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="export-start">Start date</Label>
              <Input
                id="export-start"
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="export-end">End date</Label>
              <Input
                id="export-end"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Locations</Label>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading locations...</p>
            ) : locations.length === 0 ? (
              <p className="text-sm text-destructive">You don&apos;t have access to any locations.</p>
            ) : locations.length === 1 ? (
              <p className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {locations[0].name}
              </p>
            ) : (
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(checked) =>
                      setSelected(checked === true ? new Set(locations.map((l) => l.id)) : new Set())
                    }
                  />
                  All locations
                </label>
                <div className="flex flex-col gap-2 border-t pt-2">
                  {locations.map((location) => (
                    <label key={location.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedIds.has(location.id)}
                        onCheckedChange={(checked) => toggle(location.id, checked === true)}
                      />
                      {location.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting || locations.length === 0}>
            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Download CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
