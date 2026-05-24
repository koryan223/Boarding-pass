"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, MapPin, Loader2, Pencil, Trash2, Users } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { getAllGroupsClient, getAllLocationsClient } from "@/lib/location-management"
import { toast } from "@/components/ui/use-toast"
import type { Group, Location, GroupAssignment } from "@/lib/location-management"

export function BaseLocationManager() {
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [locationAssignments, setLocationAssignments] = useState<Record<string, GroupAssignment[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingLocation, setIsAddingLocation] = useState(false)
  const [isEditingLocation, setIsEditingLocation] = useState(false)
  const [isDeletingLocation, setIsDeletingLocation] = useState(false)
  const [isAssigningGroup, setIsAssigningGroup] = useState(false)
  const [newLocationName, setNewLocationName] = useState("")
  const [editLocationName, setEditLocationName] = useState("")
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string>("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isAssignGroupDialogOpen, setIsAssignGroupDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const groupsData = await getAllGroupsClient()
        setGroups(groupsData)
        console.log("[v0] Groups loaded:", groupsData.length)

        const locs = await getAllLocationsClient()
        setLocations(locs)

        await fetchLocationAssignments(locs, groupsData)
      } catch (error) {
        console.error("[v0] Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const fetchLocationAssignments = async (locs: Location[], groupsList: Group[]) => {
    try {
      console.log("[v0] Fetching location assignments with", groupsList.length, "groups")
      const assignments: Record<string, GroupAssignment[]> = {}

      for (const location of locs) {
        const response = await fetch(`/api/students?base_location_id=${location.id}`)
        if (response.ok) {
          const data = await response.json()
          const students = data.students || []

          const groupMap = new Map<string, { group_name: string; student_count: number }>()

          for (const student of students) {
            if (student.group_id) {
              const existing = groupMap.get(student.group_id)
              if (existing) {
                existing.student_count++
              } else {
                const group = groupsList.find((g) => g.id === student.group_id)
                console.log("[v0] Looking for group", student.group_id, "found:", group?.name || "not found")
                groupMap.set(student.group_id, {
                  group_name: group?.name || "Unknown",
                  student_count: 1,
                })
              }
            }
          }

          assignments[location.id] = Array.from(groupMap.entries()).map(([group_id, data]) => ({
            group_id,
            group_name: data.group_name,
            student_count: data.student_count,
          }))
        }
      }

      console.log("[v0] Location assignments:", assignments)
      setLocationAssignments(assignments)
    } catch (error) {
      console.error("[v0] Error fetching location assignments:", error)
    }
  }

  const handleAddLocation = async () => {
    if (!newLocationName.trim()) {
      setError("Location name is required")
      return
    }

    try {
      setIsAddingLocation(true)
      setError(null)
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLocationName.trim() }),
      })

      if (response.ok) {
        const newLocation = await response.json()
        setLocations([...locations, newLocation])
        setNewLocationName("")
        setIsAddDialogOpen(false)
        router.refresh()
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to add location")
      }
    } catch (error) {
      console.error("[v0] Error adding location:", error)
      setError("Failed to add location")
    } finally {
      setIsAddingLocation(false)
    }
  }

  const handleEditLocation = async () => {
    if (!editLocationName.trim() || !selectedLocation) {
      setError("Location name is required")
      return
    }

    try {
      setIsEditingLocation(true)
      setError(null)
      const response = await fetch(`/api/locations/${selectedLocation}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editLocationName.trim() }),
      })

      if (response.ok) {
        const updatedLocation = await response.json()
        setLocations(locations.map((loc) => (loc.id === updatedLocation.id ? updatedLocation : loc)))
        setIsEditDialogOpen(false)
        setSelectedLocation(null)
        setEditLocationName("")
        router.refresh()
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to update location")
      }
    } catch (error) {
      console.error("[v0] Error updating location:", error)
      setError("Failed to update location")
    } finally {
      setIsEditingLocation(false)
    }
  }

  const handleDeleteLocation = async () => {
    if (!selectedLocation) return

    try {
      setIsDeletingLocation(true)
      setError(null)
      const response = await fetch(`/api/locations/${selectedLocation}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setLocations(locations.filter((loc) => loc.id !== selectedLocation))
        setIsDeleteDialogOpen(false)
        setSelectedLocation(null)
        router.refresh()
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to delete location")
        setIsDeleteDialogOpen(false)
      }
    } catch (error) {
      console.error("[v0] Error deleting location:", error)
      setError("Failed to delete location")
      setIsDeleteDialogOpen(false)
    } finally {
      setIsDeletingLocation(false)
    }
  }

  const handleAssignToGroup = async () => {
    if (!selectedLocation || !selectedGroup) return

    setIsLoading(true)
    try {
      if (selectedGroup === "none") {
        const response = await fetch(`/api/locations/${selectedLocation}/assign-group`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId: null }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to unassign location")
        }

        const result = await response.json()
        toast({
          title: "Location unassigned",
          description: `Removed location from ${result.studentsUpdated} student(s)`,
        })
      } else {
        const response = await fetch(`/api/locations/${selectedLocation}/assign-group`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId: selectedGroup }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to assign location")
        }

        const result = await response.json()
        const group = groups.find((g) => g.id === selectedGroup)
        toast({
          title: "Location assigned",
          description: `Assigned ${result.studentsUpdated} student(s) from ${group?.name || "group"} to this location`,
        })
      }

      setIsAssignGroupDialogOpen(false)
      setSelectedLocation(null)
      setSelectedGroup("")
      const locs = await getAllLocationsClient()
      setLocations(locs)
      await fetchLocationAssignments(locs, groups)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign location to group",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const openEditDialog = (location: Location) => {
    setSelectedLocation(location.id)
    setEditLocationName(location.name)
    setError(null)
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (location: Location) => {
    setSelectedLocation(location.id)
    setError(null)
    setIsDeleteDialogOpen(true)
  }

  const openAssignGroupDialog = (location: Location) => {
    setSelectedLocation(location.id)
    setSelectedGroup("")
    setError(null)
    setSuccessMessage(null)
    setIsAssignGroupDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {locations.length} location{locations.length !== 1 ? "s" : ""} available
        </p>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Location</DialogTitle>
              <DialogDescription>Create a new dining location for student assignments</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="locationName">Location Name</Label>
                <Input
                  id="locationName"
                  value={newLocationName}
                  onChange={(e) => {
                    setNewLocationName(e.target.value)
                    setError(null)
                  }}
                  placeholder="e.g., Newman Dining Hall"
                  className="mt-2"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isAddingLocation}>
                Cancel
              </Button>
              <Button onClick={handleAddLocation} disabled={isAddingLocation}>
                {isAddingLocation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Location
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && !isAddDialogOpen && !isEditDialogOpen && !isAssignGroupDialogOpen && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {successMessage && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <div className="rounded-md border">
        <div className="divide-y">
          {locations.length === 0 ? (
            <div className="p-8 text-center">
              <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">No locations added yet</p>
              <p className="text-xs text-muted-foreground">Add a location to get started</p>
            </div>
          ) : (
            locations.map((location) => (
              <div key={location.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{location.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(location.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Active</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openAssignGroupDialog(location)}
                      title="Assign to Group"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(location)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(location)} title="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {locationAssignments[location.id] && locationAssignments[location.id].length > 0 && (
                  <div className="mt-3 pl-8">
                    <p className="text-xs text-muted-foreground mb-2">Assigned Groups:</p>
                    <div className="flex flex-wrap gap-2">
                      {locationAssignments[location.id].map((assignment) => (
                        <Badge key={assignment.group_id} variant="secondary" className="text-xs">
                          {assignment.group_name} ({assignment.student_count} student
                          {assignment.student_count !== 1 ? "s" : ""})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
            <DialogDescription>Update the location name</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="editLocationName">Location Name</Label>
              <Input
                id="editLocationName"
                value={editLocationName}
                onChange={(e) => {
                  setEditLocationName(e.target.value)
                  setError(null)
                }}
                placeholder="e.g., Newman Dining Hall"
                className="mt-2"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                setSelectedLocation(null)
                setEditLocationName("")
              }}
              disabled={isEditingLocation}
            >
              Cancel
            </Button>
            <Button onClick={handleEditLocation} disabled={isEditingLocation}>
              {isEditingLocation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{locations.find((loc) => loc.id === selectedLocation)?.name}"? This
              action cannot be undone. This location cannot be deleted if it has assigned students or users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setSelectedLocation(null)
              }}
              disabled={isDeletingLocation}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLocation}
              disabled={isDeletingLocation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingLocation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isAssignGroupDialogOpen} onOpenChange={setIsAssignGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Location to Group</DialogTitle>
            <DialogDescription>
              Select a group to assign all its students to "{locations.find((loc) => loc.id === selectedLocation)?.name}
              ", or select "None" to unassign all students from this location
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedLocation &&
              locationAssignments[selectedLocation] &&
              locationAssignments[selectedLocation].length > 0 && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm font-medium mb-2">Currently Assigned:</p>
                  <div className="flex flex-wrap gap-2">
                    {locationAssignments[selectedLocation].map((assignment) => (
                      <Badge key={assignment.group_id} variant="secondary">
                        {assignment.group_name} ({assignment.student_count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            <div>
              <Label htmlFor="groupSelect">Select Group</Label>
              <Select
                value={selectedGroup}
                onValueChange={(value) => {
                  setSelectedGroup(value)
                  setError(null)
                }}
              >
                <SelectTrigger id="groupSelect" className="mt-2">
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">None (Unassign all)</span>
                  </SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.student_count} student{group.student_count !== 1 ? "s" : ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAssignGroupDialogOpen(false)
                setSelectedLocation(null)
                setSelectedGroup("")
              }}
              disabled={isAssigningGroup}
            >
              Cancel
            </Button>
            <Button onClick={handleAssignToGroup} disabled={isAssigningGroup || !selectedGroup}>
              {isAssigningGroup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedGroup === "none" ? "Unassign" : "Assign to Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
