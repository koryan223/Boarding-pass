"use client"

import useSWR from "swr"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Student } from "@/lib/student-management"

export const ALL = "all"
export const NONE = "none"

export type StudentFilterState = {
  groupId: string
  mealPlanType: string
  locationId: string
  mealsPerWeek: string
}

export const DEFAULT_STUDENT_FILTERS: StudentFilterState = {
  groupId: ALL,
  mealPlanType: ALL,
  locationId: ALL,
  mealsPerWeek: ALL,
}

type NamedOption = { id: string; name: string }

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Failed to load ${url}`)
    return res.json()
  })

export function getEffectiveMealPlanType(student: Student): Student["meal_plan_type"] {
  if (student.meal_plan_type) return student.meal_plan_type
  return student.meal_plan === 0 ? "count" : "standard"
}

function matches(value: string | null, filter: string) {
  if (filter === ALL) return true
  if (filter === NONE) return !value
  return value === filter
}

export function applyStudentFilters(students: Student[], filters: StudentFilterState) {
  return students.filter(
    (student) =>
      matches(student.group_id, filters.groupId) &&
      matches(student.base_location_id, filters.locationId) &&
      (filters.mealPlanType === ALL || getEffectiveMealPlanType(student) === filters.mealPlanType) &&
      (filters.mealsPerWeek === ALL ||
        (getEffectiveMealPlanType(student) === "standard" && String(student.meal_plan) === filters.mealsPerWeek)),
  )
}

export function MealPlanBreakdown({
  students,
  filters,
  onChange,
}: {
  students: Student[]
  filters: StudentFilterState
  onChange: (filters: StudentFilterState) => void
}) {
  const base = applyStudentFilters(students, { ...filters, mealsPerWeek: ALL })

  const weekly = new Map<number, number>()
  let prepaid = 0
  let countOnly = 0
  for (const student of base) {
    const type = getEffectiveMealPlanType(student)
    if (type === "standard") weekly.set(student.meal_plan, (weekly.get(student.meal_plan) ?? 0) + 1)
    else if (type === "prepaid") prepaid++
    else countOnly++
  }
  const weeklyEntries = [...weekly.entries()].sort((a, b) => a[0] - b[0])
  const weeklyTotal = weeklyEntries.reduce((sum, [, n]) => sum + n, 0)

  const toggle = (value: string) =>
    onChange({ ...filters, mealsPerWeek: filters.mealsPerWeek === value ? ALL : value })

  return (
    <section aria-labelledby="meal-plan-breakdown" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="meal-plan-breakdown" className="text-sm font-medium">
          Meal plan breakdown
        </h2>
        <p className="text-xs text-muted-foreground">
          {base.length} students match the filters above. Click a weekly plan to list those students.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {weeklyEntries.map(([meals, n]) => {
          const value = String(meals)
          const active = filters.mealsPerWeek === value
          return (
            <Button
              key={meals}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              onClick={() => toggle(value)}
            >
              <span>{meals} meals/week</span>
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground tabular-nums">
                {n}
              </span>
            </Button>
          )
        })}
        {weeklyEntries.length > 0 && (
          <span className="self-center text-xs text-muted-foreground">Standard total: {weeklyTotal}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          Prepaid: <span className="font-semibold text-foreground tabular-nums">{prepaid}</span>
        </span>
        <span>
          Count only: <span className="font-semibold text-foreground tabular-nums">{countOnly}</span>
        </span>
      </div>
    </section>
  )
}

export function StudentFilters({
  filters,
  onChange,
}: {
  filters: StudentFilterState
  onChange: (filters: StudentFilterState) => void
}) {
  const { data: groupData } = useSWR<{ groups: NamedOption[] }>("/api/groups", fetcher)
  const { data: locationData } = useSWR<{ locations: NamedOption[] }>("/api/locations?accessible=1", fetcher)

  const groups = [...(groupData?.groups ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  const locations = [...(locationData?.locations ?? [])].sort((a, b) => a.name.localeCompare(b.name))

  const isFiltered =
    filters.groupId !== ALL ||
    filters.mealPlanType !== ALL ||
    filters.locationId !== ALL ||
    filters.mealsPerWeek !== ALL

  const update = (key: keyof StudentFilterState, value: string) => onChange({ ...filters, [key]: value })

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="filter-group">Group</Label>
        <Select value={filters.groupId} onValueChange={(value) => update("groupId", value)}>
          <SelectTrigger id="filter-group" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All groups</SelectItem>
            <SelectItem value={NONE}>Unassigned</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="filter-meal-plan">Meal Plan Type</Label>
        <Select value={filters.mealPlanType} onValueChange={(value) => update("mealPlanType", value)}>
          <SelectTrigger id="filter-meal-plan" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All meal plans</SelectItem>
            <SelectItem value="standard">Standard (Weekly)</SelectItem>
            <SelectItem value="prepaid">Prepaid</SelectItem>
            <SelectItem value="count">Count Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="filter-location">Base Location</Label>
        <Select value={filters.locationId} onValueChange={(value) => update("locationId", value)}>
          <SelectTrigger id="filter-location" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All locations</SelectItem>
            <SelectItem value={NONE}>No base location</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="self-start sm:self-auto"
        onClick={() => onChange(DEFAULT_STUDENT_FILTERS)}
        disabled={!isFiltered}
      >
        <X className="mr-1 h-4 w-4" />
        Clear filters
      </Button>
    </div>
  )
}
