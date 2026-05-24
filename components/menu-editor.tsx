"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Coffee, Sun, Moon, Loader2, Save, Trash2, MapPin, Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]
const MEALS = ["Breakfast", "Lunch", "Dinner"]

// Helper function to get the Monday of a given week
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
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

// Format date for API (YYYY-MM-DD)
function formatDateForApi(date: Date): string {
  return date.toISOString().split("T")[0]
}

// Format date as "Mon 1/15"
function formatDateShort(date: Date): string {
  const dayIndex = date.getDay() - 1 // Monday = 0
  if (dayIndex < 0 || dayIndex >= SHORT_DAYS.length) return ""
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${SHORT_DAYS[dayIndex]} ${month}/${day}`
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
      return "bg-amber-50/50"
    case "Lunch":
      return "bg-sky-50/50"
    case "Dinner":
      return "bg-indigo-50/50"
    default:
      return ""
  }
}

export function MenuEditor() {
  const router = useRouter()
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editedMenus, setEditedMenus] = useState<Record<string, string>>({})
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>("")
  const [newLocationName, setNewLocationName] = useState("")
  const [creatingLocation, setCreatingLocation] = useState(false)
  const [newLocationDialogOpen, setNewLocationDialogOpen] = useState(false)
  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(() => getMonday(new Date()))
  const [actualTodayMonday] = useState<Date>(() => getMonday(new Date()))
  const { toast } = useToast()

  // Check if we're viewing the current week
  const isCurrentWeek = currentWeekMonday.getTime() === actualTodayMonday.getTime()

  // Get dates for the current displayed week
  const getWeekDates = () => {
    return DAYS.map((_, index) => {
      const date = new Date(currentWeekMonday)
      date.setDate(currentWeekMonday.getDate() + index)
      return date
    })
  }

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

  useEffect(() => {
    fetchLocations()
  }, [])

  useEffect(() => {
    if (selectedLocationId) {
      fetchMenus(selectedLocationId)
    }
  }, [selectedLocationId, currentWeekMonday])

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/locations")
      if (response.ok) {
        const data = await response.json()
        const locationsList = data.locations || data || []
        const filteredLocations = locationsList.filter((loc: Location) => loc.name.toLowerCase() !== "unassigned")
        setLocations(filteredLocations)
        // Select first location by default
        if (filteredLocations.length > 0) {
          setSelectedLocationId(filteredLocations[0].id)
        } else {
          setLoading(false)
        }
      }
    } catch (error) {
      console.error("Failed to fetch locations:", error)
      setLoading(false)
    }
  }

  const fetchMenus = async (locationId: string) => {
    setLoading(true)
    try {
      const weekDate = formatDateForApi(currentWeekMonday)
      const response = await fetch(`/api/menu?location_id=${locationId}&week_start_date=${weekDate}`)
      if (response.ok) {
        const data = await response.json()
        setMenus(data)
        // Initialize edited menus with current values
        const edited: Record<string, string> = {}
        DAYS.forEach((day) => {
          MEALS.forEach((meal) => {
            const menu = data.find((m: MenuItem) => m.day_of_week === day && m.meal_type === meal)
            edited[`${day}-${meal}`] = menu?.menu_items || ""
          })
        })
        setEditedMenus(edited)
      }
    } catch (error) {
      console.error("Failed to fetch menus:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleMenuChange = (day: string, meal: string, value: string) => {
    const key = `${day}-${meal}`
    setEditedMenus((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveAll = async () => {
    if (!selectedLocationId) {
      toast({
        title: "Error",
        description: "Please select a location first.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)

    try {
      const menusToUpdate = DAYS.flatMap((day) =>
        MEALS.map((meal) => ({
          day_of_week: day,
          meal_type: meal,
          menu_items: editedMenus[`${day}-${meal}`] || "",
        })),
      )

      const weekDate = formatDateForApi(currentWeekMonday)
      const response = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          menus: menusToUpdate, 
          location_id: selectedLocationId,
          week_start_date: weekDate 
        }),
      })

      if (response.ok) {
        toast({
          title: "Menu Saved",
          description: "All menu items have been saved successfully.",
        })
        router.push("/menu")
      } else {
        throw new Error("Failed to save")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save menu. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClearAll = () => {
    const cleared: Record<string, string> = {}
    DAYS.forEach((day) => {
      MEALS.forEach((meal) => {
        cleared[`${day}-${meal}`] = ""
      })
    })
    setEditedMenus(cleared)
    toast({
      title: "Menu Cleared",
      description: "All menu items have been cleared. Click 'Save All' to apply changes.",
    })
  }

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) return

    setCreatingLocation(true)
    try {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLocationName.trim() }),
      })

      if (response.ok) {
        const newLocation = await response.json()
        setLocations((prev) => [...prev, newLocation])
        setSelectedLocationId(newLocation.id)
        setNewLocationName("")
        setNewLocationDialogOpen(false)
        toast({
          title: "Location Created",
          description: `Location "${newLocation.name}" has been created.`,
        })
      } else {
        throw new Error("Failed to create location")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create location. Please try again.",
        variant: "destructive",
      })
    } finally {
      setCreatingLocation(false)
    }
  }

  const getMenuValue = (day: string, meal: string) => {
    return editedMenus[`${day}-${meal}`] || ""
  }

  const selectedLocation = locations.find((l) => l.id === selectedLocationId)

  if (loading && locations.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Edit Weekly Menu
                <Badge variant="secondary" className="ml-2">
                  Admin / Staff
                </Badge>
              </CardTitle>
              <CardDescription>Select a location and update the menu items for each meal.</CardDescription>
            </div>
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={!selectedLocationId}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear All Menu Items?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear all menu items from the form. You will need to click "Save All" to apply the
                      changes to the database.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll}>Clear All</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button onClick={handleSaveAll} disabled={saving || !selectedLocationId}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save All
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Location:</Label>
              </div>
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={newLocationDialogOpen} onOpenChange={setNewLocationDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="bg-transparent">
                    <Plus className="h-4 w-4 mr-1" />
                    New Location
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Location</DialogTitle>
                    <DialogDescription>Add a new dining location for menu management.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="locationName">Location Name</Label>
                      <Input
                        id="locationName"
                        value={newLocationName}
                        onChange={(e) => setNewLocationName(e.target.value)}
                        placeholder="e.g., Main Dining Hall"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewLocationDialogOpen(false)} className="bg-transparent">
                      Cancel
                    </Button>
                    <Button onClick={handleCreateLocation} disabled={creatingLocation || !newLocationName.trim()}>
                      {creatingLocation ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
        </div>
      </CardHeader>
      <CardContent>
        {!selectedLocationId ? (
          <div className="text-center py-12 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Please select a location to edit its menu, or create a new location.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px] font-semibold">Meal</TableHead>
                  {getWeekDates().map((date, index) => (
                    <TableHead key={DAYS[index]} className="text-center font-semibold min-w-[150px]">
                      {formatDateShort(date)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {MEALS.map((meal) => (
                  <TableRow key={meal} className={getMealRowColor(meal)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getMealIcon(meal)}
                        {meal}
                      </div>
                    </TableCell>
                    {DAYS.map((day) => (
                      <TableCell key={`${day}-${meal}`} className="p-2">
                        <Textarea
                          placeholder={`${meal}...`}
                          value={getMenuValue(day, meal)}
                          onChange={(e) => handleMenuChange(day, meal, e.target.value)}
                          className="min-h-[80px] text-sm bg-white resize-none"
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
