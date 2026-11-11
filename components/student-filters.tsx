"use client"

import useSWR from "swr"
import { ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Student } from "@/lib/student-management"

export const NONE = "none"

// An empty list means "no restriction" for that filter.
export type StudentFilterState = {
  groupIds: string[]
  mealPlanTypes: string[]
  locationIds: string[]
  mealsPerWeek: string[]
}

export const DEFAULT_STUDENT_FILTERS: StudentFilterState = {
  groupIds: [],
  mealPlanTypes: [],
  locationIds: [],
  mealsPerWeek: [],
}

type NamedOption = { id: string; name: string }
type FilterOption = { value: string; label: string }

const MEAL_PLAN_TYPE_OPTIONS: FilterOption[] = [
  { value: "standard", label: "Standard (Weekly)" },
  { value: "prepaid", label: "Prepaid" },
  { value: "count", label: "Count Only" },
]

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Failed to load ${url}`)
    return res.json()
  })

export function getEffectiveMealPlanType(student: Student): Student["meal_plan_type"] {
  if (student.meal_plan_type) return student.meal_plan_type
  return student.meal_plan === 0 ? "count" : "standard"
}

export function hasActiveStudentFilters(filters: StudentFilterState) {
  return (
    filters.groupIds.length > 0 ||
    filters.mealPlanTypes.length > 0 ||
    filters.locationIds.length > 0 ||
    filters.mealsPerWeek.length > 0
  )
}

function matchesAny(value: string | null, selected: string[]) {
  return selected.length === 0 || selected.includes(value || NONE)
}

function toggleValue(selected: string[], value: string) {
  return selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
}

export function applyStudentFilters(students: Student[], filters: StudentFilterState) {
  return students.filter((student) => {
    const type = getEffectiveMealPlanType(student)
    return (
      matchesAny(student.group_id, filters.groupIds) &&
      matchesAny(student.base_location_id, filters.locationIds) &&
      matchesAny(type, filters.mealPlanTypes) &&
      (filters.mealsPerWeek.length === 0 ||
        (type === "standard" && filters.mealsPerWeek.includes(String(student.meal_plan))))
    )
  })
}

export function MealPlanBreakdown({
  students,
  filters,
  onChange,
  isLoading = false,
}: {
  students: Student[]
  filters: StudentFilterState
  onChange: (filters: StudentFilterState) => void
  isLoading?: boolean
}) {
  const base = applyStudentFilters(students, { ...filters, mealsPerWeek: [] })

  // Selected plans stay listed even at zero so they can always be switched off again.
  const weekly = new Map<string, number>(filters.mealsPerWeek.map((value) => [value, 0]))
  let prepaid = 0
  let countOnly = 0
  for (const student of base) {
    const type = getEffectiveMealPlanType(student)
    if (type === "standard") {
      const key = String(student.meal_plan)
      weekly.set(key, (weekly.get(key) ?? 0) + 1)
    } else if (type === "prepaid") prepaid++
    else countOnly++
  }
  const weeklyEntries = [...weekly.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))
  const weeklyTotal = weeklyEntries.reduce((sum, [, n]) => sum + n, 0)

  return (
    <section aria-labelledby="meal-plan-breakdown" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="meal-plan-breakdown" className="text-base font-semibold text-foreground">
          Meal plan breakdown
        </h2>
        <p className="text-sm text-muted-foreground">
          {isLoading && students.length === 0
            ? "Loading students..."
            : `${base.length} students match the search and filters. Select weekly plans to list those students.`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {weeklyEntries.map(([meals, n]) => {
          const active = filters.mealsPerWeek.includes(meals)
          return (
            <Button
              key={meals}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              onClick={() => onChange({ ...filters, mealsPerWeek: toggleValue(filters.mealsPerWeek, meals) })}
            >
              <span>{meals} meals/week</span>
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground tabular-nums">
                {n}
              </span>
            </Button>
          )
        })}
        {weeklyEntries.length === 0 && !isLoading && (
          <span className="text-sm text-muted-foreground">No students on a weekly plan.</span>
        )}
      </div>
      <dl className="flex flex-col gap-2 border-t border-border pt-4 text-sm text-muted-foreground sm:flex-row sm:gap-0">
        <div className="flex items-baseline sm:pr-6">
          <dt>Total:</dt>
          <dd className="ml-2 font-semibold text-foreground tabular-nums">{weeklyTotal}</dd>
        </div>
        <div className="flex items-baseline sm:border-l sm:border-border sm:px-6">
          <dt>Prepaid:</dt>
          <dd className="ml-2 font-semibold text-foreground tabular-nums">{prepaid}</dd>
        </div>
        <div className="flex items-baseline sm:border-l sm:border-border sm:pl-6">
          <dt>Count only:</dt>
          <dd className="ml-2 font-semibold text-foreground tabular-nums">{countOnly}</dd>
        </div>
      </dl>
    </section>
  )
}

function MultiSelectFilter({
  id,
  label,
  allLabel,
  options,
  selected,
  onChange,
}: {
  id: string
  label: string
  allLabel: string
  options: FilterOption[]
  selected: string[]
  onChange: (selected: string[]) => void
}) {
  const selectedLabels = options.filter((option) => selected.includes(option.value)).map((option) => option.label)
  const summary =
    selected.length === 0 ? allLabel : selectedLabels.length > 0 ? selectedLabels.join(", ") : `${selected.length} selected`

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <Label id={`${id}-label`} htmlFor={id}>
        {label}
      </Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-labelledby={`${id}-label ${id}-value`}
            className="w-full justify-between gap-2 bg-transparent font-normal"
          >
            <span id={`${id}-value`} className="truncate">
              {summary}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {selected.length > 1 && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                  {selected.length}
                </span>
              )}
              <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-72 w-(--radix-dropdown-menu-trigger-width) min-w-56 overflow-y-auto"
        >
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selected.includes(option.value)}
              onCheckedChange={() => onChange(toggleValue(selected, option.value))}
              onSelect={(event) => event.preventDefault()}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={selected.length === 0}
            onSelect={(event) => {
              event.preventDefault()
              onChange([])
            }}
          >
            Clear selection
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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

  const toOptions = (items: NamedOption[] | undefined, noneLabel: string): FilterOption[] => [
    { value: NONE, label: noneLabel },
    ...[...(items ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({ value: item.id, label: item.name })),
  ]

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <MultiSelectFilter
        id="filter-group"
        label="Group"
        allLabel="All groups"
        options={toOptions(groupData?.groups, "Unassigned")}
        selected={filters.groupIds}
        onChange={(groupIds) => onChange({ ...filters, groupIds })}
      />
      <MultiSelectFilter
        id="filter-meal-plan"
        label="Meal Plan Type"
        allLabel="All meal plans"
        options={MEAL_PLAN_TYPE_OPTIONS}
        selected={filters.mealPlanTypes}
        onChange={(mealPlanTypes) => onChange({ ...filters, mealPlanTypes })}
      />
      <MultiSelectFilter
        id="filter-location"
        label="Base Location"
        allLabel="All locations"
        options={toOptions(locationData?.locations, "No base location")}
        selected={filters.locationIds}
        onChange={(locationIds) => onChange({ ...filters, locationIds })}
      />

      <Button
        variant="ghost"
        size="sm"
        className="self-start sm:self-auto"
        onClick={() => onChange(DEFAULT_STUDENT_FILTERS)}
        disabled={!hasActiveStudentFilters(filters)}
      >
        <X className="mr-1 h-4 w-4" />
        Clear filters
      </Button>
    </div>
  )
}
