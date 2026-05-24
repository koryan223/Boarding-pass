"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Plus, MapPin } from "lucide-react"

interface User {
  id: string
  email: string
  role: "admin" | "staff" | "dining_station" | "pending"
  location_id: string | null
  location_name: string | null
  created_at: string
  updated_at: string
}

interface Location {
  id: string
  name: string
}

const roleColors: Record<string, string> = {
  admin: "bg-red-500",
  staff: "bg-blue-500",
  dining_station: "bg-green-500",
  pending: "bg-amber-500",
}

const roleLabels: Record<string, string> = {
  admin: "Admin",
  staff: "Staff",
  dining_station: "Dining Station",
  pending: "Pending Approval",
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [updatingLocationUserId, setUpdatingLocationUserId] = useState<string | null>(null)
  const [showNewLocationDialog, setShowNewLocationDialog] = useState(false)
  const [newLocationName, setNewLocationName] = useState("")
  const [isCreatingLocation, setIsCreatingLocation] = useState(false)
  const [pendingLocationUserId, setPendingLocationUserId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchUsers()
    fetchLocations()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users")
      if (!response.ok) {
        throw new Error("Failed to fetch users")
      }
      const data = await response.json()
      // Sort users: pending users first, then by created_at descending
      const sortedUsers = data.sort((a: User, b: User) => {
        if (a.role === "pending" && b.role !== "pending") return -1
        if (a.role !== "pending" && b.role === "pending") return 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      setUsers(sortedUsers)
    } catch (error) {
      console.error("[v0] Error fetching users:", error)
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/locations")
      if (!response.ok) {
        throw new Error("Failed to fetch locations")
      }
      const data = await response.json()
      const locationsList = data.locations || data || []
      setLocations(locationsList)
    } catch (error) {
      console.error("[v0] Error fetching locations:", error)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId)
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update role")
      }

      setUsers(users.map((user) => (user.id === userId ? { ...user, role: newRole as any } : user)))

      toast({
        title: "Success",
        description: "User role updated successfully",
      })
    } catch (error: any) {
      console.error("[v0] Error updating role:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      })
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleLocationChange = async (userId: string, newLocationId: string) => {
    if (newLocationId === "__new__") {
      setPendingLocationUserId(userId)
      setShowNewLocationDialog(true)
      return
    }

    setUpdatingLocationUserId(userId)
    try {
      const response = await fetch(`/api/admin/users/${userId}/location`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ location_id: newLocationId === "unassigned" ? null : newLocationId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update location")
      }

      const locationName = locations.find((loc) => loc.id === newLocationId)?.name || null
      setUsers(
        users.map((user) =>
          user.id === userId
            ? {
                ...user,
                location_id: newLocationId === "unassigned" ? null : newLocationId,
                location_name: locationName,
              }
            : user,
        ),
      )

      toast({
        title: "Success",
        description: "User location updated successfully",
      })
    } catch (error: any) {
      console.error("[v0] Error updating location:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update user location",
        variant: "destructive",
      })
    } finally {
      setUpdatingLocationUserId(null)
    }
  }

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) return

    setIsCreatingLocation(true)
    try {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newLocationName.trim() }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create location")
      }

      const newLocation = await response.json()
      setLocations([...locations, newLocation].sort((a, b) => a.name.localeCompare(b.name)))

      if (pendingLocationUserId) {
        await handleLocationChange(pendingLocationUserId, newLocation.id)
      }

      toast({
        title: "Success",
        description: "Location created successfully",
      })

      setNewLocationName("")
      setShowNewLocationDialog(false)
      setPendingLocationUserId(null)
    } catch (error: any) {
      console.error("[v0] Error creating location:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create location",
        variant: "destructive",
      })
    } finally {
      setIsCreatingLocation(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>Manage user roles, permissions, and base locations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>Change Role</TableHead>
                  <TableHead>Base Location</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <Badge className={roleColors[user.role]}>{roleLabels[user.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleRoleChange(user.id, value)}
                        disabled={updatingUserId === user.id}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="dining_station">Dining Station</SelectItem>
                          <SelectItem value="pending">Pending Approval</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.location_id || "unassigned"}
                        onValueChange={(value) => handleLocationChange(user.id, value)}
                        disabled={updatingLocationUserId === user.id}
                      >
                        <SelectTrigger className="w-[180px]">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <SelectValue>{user.location_name || "Unassigned"}</SelectValue>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="__new__" className="text-primary">
                            <div className="flex items-center gap-2">
                              <Plus className="h-4 w-4" />
                              Create New Location
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(user.updated_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showNewLocationDialog} onOpenChange={setShowNewLocationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Location</DialogTitle>
            <DialogDescription>Enter a name for the new location</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Location name"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newLocationName.trim()) {
                  handleCreateLocation()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewLocationDialog(false)
                setPendingLocationUserId(null)
                setNewLocationName("")
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateLocation} disabled={!newLocationName.trim() || isCreatingLocation}>
              {isCreatingLocation ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Location"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
