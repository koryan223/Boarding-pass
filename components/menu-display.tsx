"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Coffee, Sun, Moon, Loader2, MapPin, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react"

interface MenuItem {
  id: string
  day_of_week: string
  meal_type: string
  menu_items: string
  location_id?: string
}

interface Location {
  id: string
  name: string
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"]
const MEALS = ["Breakfast", "Lunch", "Dinner"]

// Helper function to get the Monday of a given week
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Helper function to format date as "Mon 1/15"
function formatDateShort(date: Date): string {
  const dayShort = DAY_SHORT[date.getDay() - 1] // Monday = 1, so -1 for index
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${dayShort} ${month}/${day}`
}

// Helper function to format week range as "Jan 13 - Jan 17, 2025"
function formatWeekRange(monday: Date): string {
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)

  const monMonth = monday.toLocaleDateString("en-US", { month: "short" })
  const friMonth = friday.toLocaleDateString("en-US", { month: "short" })
  const year = friday.getFullYear()

  if (monMonth === friMonth) {
    return `${monMonth} ${monday.getDate()} - ${friday.getDate()}, ${year}`
  }
  return `${monMonth} ${monday.getDate()} - ${friMonth} ${friday.getDate()}, ${year}`
}

const getMealIcon = (mealType: string) => {
  switch (mealType) {
    case "Breakfast":
      return <Coffee className="h-4 w-4" />
    case "Lunch":
      return <Sun className="h-4 w-4" />
    case "Dinner":
      return <Moon className="h-4 w-4" />
    default:
      return null
  }
}

const getMealRowColor = (mealType: string) => {
  switch (mealType) {
    case "Breakfast":
      return "bg-amber-50"
    case "Lunch":
      return "bg-sky-50"
    case "Dinner":
      return "bg-indigo-50"
    default:
      return ""
  }
}

const getMealLabelColor = (mealType: string) => {
  switch (mealType) {
    case "Breakfast":
      return "bg-amber-100 text-amber-800"
    case "Lunch":
      return "bg-sky-100 text-sky-800"
    case "Dinner":
      return "bg-indigo-100 text-indigo-800"
    default:
      return ""
  }
}

export function MenuDisplay() {
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [todayIndex, setTodayIndex] = useState(-1)
  const [role, setRole] = useState<string | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [userLoaded, setUserLoaded] = useState(false)
  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(() => getMonday(new Date()))
  const [actualTodayMonday] = useState<Date>(() => getMonday(new Date()))
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Only admins and staff (who manage menus) may switch locations.
  // Dining station users stay pinned to their assigned base location.
  const canSwitchLocation = role === "admin" || role === "staff"

  // The location name currently being displayed (derived from the selection for switchers).
  const currentLocationName = canSwitchLocation
    ? locations.find((l) => l.id === selectedLocationId)?.name || locationName
    : locationName

  // Get dates for the current displayed week
  const getWeekDates = useCallback(() => {
    return DAYS.map((_, index) => {
      const date = new Date(currentWeekMonday)
      date.setDate(currentWeekMonday.getDate() + index)
      return date
    })
  }, [currentWeekMonday])

  // Check if we're viewing the current week
  const isCurrentWeek = currentWeekMonday.getTime() === actualTodayMonday.getTime()

  // Navigation handlers
  const goToPreviousWeek = () => {
    const prevMonday = new Date(currentWeekMonday)
    prevMonday.setDate(prevMonday.getDate() - 7)
    setCurrentWeekMonday(prevMonday)
  }

  const goToNextWeek = () => {
    const nextMonday = new Date(currentWeekMonday)
    nextMonday.setDate(nextMonday.getDate() + 7)
    setCurrentWeekMonday(nextMonday)
  }

  const goToCurrentWeek = () => {
    setCurrentWeekMonday(actualTodayMonday)
  }

  // Format week_start_date for API
  const getWeekStartDateString = useCallback(() => {
    return currentWeekMonday.toISOString().split("T")[0]
  }, [currentWeekMonday])

  // Load the current user's role and base location once. For admins/staff we also
  // load the full location list so they can switch which location's menu they view.
  const loadUser = useCallback(async (retryCount = 0): Promise<void> => {
    const MAX_RETRIES = 3
    const RETRY_DELAY = 2000

    try {
      const userResponse = await fetch("/api/auth/me")
      if (!isMountedRef.current) return

      if (!userResponse.ok) {
        if ((userResponse.status === 401 || userResponse.status === 429) && retryCount < MAX_RETRIES) {
          const delay = userResponse.status === 429 ? RETRY_DELAY * (retryCount + 1) : RETRY_DELAY
          await new Promise((resolve) => setTimeout(resolve, delay))
          if (!isMountedRef.current) return
          return loadUser(retryCount + 1)
        }
        throw new Error("Failed to get user info")
      }

      const userData = await userResponse.json()
      if (!isMountedRef.current) return

      setRole(userData.role || null)
      setLocationName(userData.location_name || null)
      setSelectedLocationId(userData.location_id || null)

      if (userData.role === "admin" || userData.role === "staff") {
        try {
          const locRes = await fetch("/api/locations")
          if (locRes.ok && isMountedRef.current) {
            const locData = await locRes.json()
            const list: Location[] = (locData.locations || locData || []).filter(
              (l: Location) => l.name.toLowerCase() !== "unassigned",
            )
            setLocations(list)
            // Fall back to the first location if the user has no base location assigned.
            if (!userData.location_id && list.length > 0) {
              setSelectedLocationId(list[0].id)
            }
          }
        } catch {
          // Non-fatal: without the list the user simply cannot switch locations.
        }
      }

      if (isMountedRef.current) setUserLoaded(true)
    } catch (err) {
      if (!isMountedRef.current) return
      if (retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)))
        if (!isMountedRef.current) return
        return loadUser(retryCount + 1)
      }
      setError(err instanceof Error ? err.message : "Failed to load user info. Please try again.")
      setLoading(false)
      setUserLoaded(true)
    }
  }, [])

  // Fetch the menu for the selected location and week.
  const fetchMenus = useCallback(
    async (retryCount = 0): Promise<void> => {
      const MAX_RETRIES = 3
      const RETRY_DELAY = 2000

      if (!selectedLocationId) {
        setMenus([])
        setLoading(false)
        return
      }

      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      try {
        setError(null)
        const weekDate = getWeekStartDateString()
        const response = await fetch(`/api/menu?location_id=${selectedLocationId}&week_start_date=${weekDate}`, {
          signal,
        })

        if (!isMountedRef.current || signal.aborted) return

        if (response.ok) {
          const data = await response.json()
          if (isMountedRef.current) setMenus(data)
        } else if ((response.status === 401 || response.status === 429) && retryCount < MAX_RETRIES) {
          const delay = response.status === 429 ? RETRY_DELAY * (retryCount + 1) : RETRY_DELAY
          await new Promise((resolve) => setTimeout(resolve, delay))
          if (!isMountedRef.current) return
          return fetchMenus(retryCount + 1)
        } else {
          let errorMessage = "Failed to fetch menu data"
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } catch {
            if (response.status === 429) {
              errorMessage = "Too many requests. Please wait a moment."
            }
          }
          throw new Error(errorMessage)
        }

        if (isMountedRef.current) setLoading(false)
      } catch (err) {
        const isAbortError =
          err instanceof Error &&
          (err.name === "AbortError" ||
            err.message.includes("aborted") ||
            err.message === "Failed to fetch" ||
            signal.aborted)

        if (isAbortError || !isMountedRef.current) return

        console.error("Failed to fetch menus:", err)

        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAY * (retryCount + 1)
          await new Promise((resolve) => setTimeout(resolve, delay))
          if (!isMountedRef.current) return
          return fetchMenus(retryCount + 1)
        }

        setError(err instanceof Error ? err.message : "Failed to load menu. Please try again.")
        setLoading(false)
      }
    },
    [selectedLocationId, getWeekStartDateString],
  )

  // Initial load: set today index and load the user.
  useEffect(() => {
    isMountedRef.current = true

    const currentDay = new Date().toLocaleDateString("en-US", { weekday: "long" })
    const index = DAYS.indexOf(currentDay)
    if (index !== -1) {
      setTodayIndex(index)
    }

    loadUser()

    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [loadUser])

  // Fetch menus once the user is loaded and whenever the location or week changes.
  useEffect(() => {
    if (!userLoaded) return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setLoading(true)
        fetchMenus()
      }
    }, 100)

    return () => {
      clearTimeout(timer)
    }
  }, [userLoaded, fetchMenus])

  const getMenuForDayAndMeal = (day: string, meal: string) => {
    const menu = menus.find((m) => m.day_of_week === day && m.meal_type === meal)
    return menu?.menu_items || ""
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            Weekly Menu
            <Badge variant="outline" className="ml-2">
              Mon - Fri
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-destructive" />
            <p>{error}</p>
            <button
              onClick={() => {
                setLoading(true)
                setError(null)
                fetchMenus()
              }}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!selectedLocationId && !loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            Weekly Menu
            <Badge variant="outline" className="ml-2">
              Mon - Fri
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No menu available. Please contact an administrator to assign your location.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const weekDates = getWeekDates()

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Weekly Menu</CardTitle>
            {canSwitchLocation && locations.length > 0 ? (
              <Select
                value={selectedLocationId ?? ""}
                onValueChange={(value) => setSelectedLocationId(value)}
              >
                <SelectTrigger className="h-8 w-[210px]">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <SelectValue placeholder="Select location" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : currentLocationName ? (
              <Badge variant="secondary" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {currentLocationName}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousWeek} className="h-8 w-8 bg-transparent">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[180px] text-center">{formatWeekRange(currentWeekMonday)}</div>
            <Button variant="outline" size="icon" onClick={goToNextWeek} className="h-8 w-8 bg-transparent">
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentWeek && (
              <Button variant="ghost" size="sm" onClick={goToCurrentWeek} className="text-xs bg-transparent">
                Today
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px] font-semibold">Meal</TableHead>
              {weekDates.map((date, index) => {
                const isToday = isCurrentWeek && todayIndex === index
                return (
                  <TableHead
                    key={DAYS[index]}
                    className={`font-semibold text-center ${isToday ? "bg-primary/10" : ""}`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{formatDateShort(date)}</span>
                      {isToday && (
                        <Badge variant="secondary" className="text-xs">
                          Today
                        </Badge>
                      )}
                    </div>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {MEALS.map((meal) => (
              <TableRow key={meal} className={getMealRowColor(meal)}>
                <TableCell className={`font-medium ${getMealLabelColor(meal)} rounded-l`}>
                  <div className="flex items-center gap-2">
                    {getMealIcon(meal)}
                    {meal}
                  </div>
                </TableCell>
                {DAYS.map((day, index) => {
                  const items = getMenuForDayAndMeal(day, meal)
                  const isToday = isCurrentWeek && todayIndex === index
                  return (
                    <TableCell key={day} className={`min-w-[120px] ${isToday ? "bg-primary/5" : ""}`}>
                      {items ? (
                        <p className="text-sm whitespace-pre-wrap">{items}</p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">-</p>
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
