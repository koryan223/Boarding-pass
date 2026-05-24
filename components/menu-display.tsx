"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Coffee, Sun, Moon, Loader2, MapPin, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react"

interface MenuItem {
  id: string
  day_of_week: string
  meal_type: string
  menu_items: string
  location_id?: string
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
  const [locationName, setLocationName] = useState<string | null>(null)
  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(() => getMonday(new Date()))
  const [actualTodayMonday] = useState<Date>(() => getMonday(new Date()))
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

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

  const fetchUserLocationAndMenus = useCallback(async (retryCount = 0): Promise<void> => {
    const MAX_RETRIES = 3
    const RETRY_DELAY = 2000

    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      setError(null)

      const userResponse = await fetch("/api/auth/me", { signal })

      if (!isMountedRef.current || signal.aborted) return

      // Handle rate limiting and auth errors with retry
      if (!userResponse.ok) {
        if ((userResponse.status === 401 || userResponse.status === 429) && retryCount < MAX_RETRIES) {
          const delay = userResponse.status === 429 ? RETRY_DELAY * (retryCount + 1) : RETRY_DELAY
          await new Promise((resolve) => setTimeout(resolve, delay))
          if (!isMountedRef.current) return
          return fetchUserLocationAndMenus(retryCount + 1)
        }
        throw new Error("Failed to get user info")
      }

      const userData = await userResponse.json()

      if (!isMountedRef.current) return

      if (userData.location_name) {
        setLocationName(userData.location_name)
        const weekDate = getWeekStartDateString()
        const response = await fetch(`/api/menu?week_start_date=${weekDate}`, { signal })

        if (!isMountedRef.current || signal.aborted) return

        if (response.ok) {
          const data = await response.json()
          if (isMountedRef.current) {
            setMenus(data)
          }
        } else if ((response.status === 401 || response.status === 429) && retryCount < MAX_RETRIES) {
          // Auth may be refreshing or rate limited, retry with backoff
          const delay = response.status === 429 ? RETRY_DELAY * (retryCount + 1) : RETRY_DELAY
          await new Promise((resolve) => setTimeout(resolve, delay))
          if (!isMountedRef.current) return
          return fetchUserLocationAndMenus(retryCount + 1)
        } else {
          // Try to parse error, but handle non-JSON responses
          let errorMessage = "Failed to fetch menu data"
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } catch {
            // Response is not JSON (e.g., "Too Many Requests")
            if (response.status === 429) {
              errorMessage = "Too many requests. Please wait a moment."
            }
          }
          throw new Error(errorMessage)
        }
      } else {
        setLocationName(null)
        setMenus([])
      }

      if (isMountedRef.current) {
        setLoading(false)
      }
    } catch (err) {
      // Check if request was aborted or component unmounted
      const isAbortError = err instanceof Error && (
        err.name === "AbortError" || 
        err.message.includes("aborted") ||
        err.message === "Failed to fetch" ||
        signal.aborted
      )
      
      if (isAbortError || !isMountedRef.current) {
        return
      }

      console.error("Failed to fetch menus:", err)

      if (retryCount < MAX_RETRIES) {
        // Exponential backoff for retries
        const delay = RETRY_DELAY * (retryCount + 1)
        await new Promise((resolve) => setTimeout(resolve, delay))
        if (!isMountedRef.current) return
        return fetchUserLocationAndMenus(retryCount + 1)
      }

      setError(err instanceof Error ? err.message : "Failed to load menu. Please try again.")
      setLoading(false)
    }
  }, [getWeekStartDateString])

  // Initial load and set today index
  useEffect(() => {
    isMountedRef.current = true

    const currentDay = new Date().toLocaleDateString("en-US", { weekday: "long" })
    const index = DAYS.indexOf(currentDay)
    if (index !== -1) {
      setTodayIndex(index)
    }

    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Fetch menus when week changes
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setLoading(true)
        fetchUserLocationAndMenus()
      }
    }, 100)

    return () => {
      clearTimeout(timer)
    }
  }, [fetchUserLocationAndMenus])

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
                fetchUserLocationAndMenus()
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

  if (!locationName && !loading) {
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
            {locationName && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {locationName}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={goToPreviousWeek}
              className="h-8 w-8 bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[180px] text-center">
              {formatWeekRange(currentWeekMonday)}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={goToNextWeek}
              className="h-8 w-8 bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentWeek && (
              <Button
                variant="ghost"
                size="sm"
                onClick={goToCurrentWeek}
                className="text-xs bg-transparent"
              >
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
