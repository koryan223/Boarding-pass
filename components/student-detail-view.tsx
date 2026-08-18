"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit2, Trash2, Save, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateStudentClient, deleteStudentClient, type Student } from "@/lib/student-management"
import { StudentSwipeHistory } from "@/components/student-swipe-history"
import { StudentPhotoUpload } from "@/components/student-photo-upload"
import { StudentAnalytics } from "@/components/student-analytics"
import { AssignStudentToGroupDialog } from "@/components/groups/assign-student-to-group-dialog"
import type { User } from "@supabase/supabase-js"

interface StudentDetailViewProps {
  student: Student
  user: User
  userRole: string
}

export function StudentDetailView({ student: initialStudent, user, userRole }: StudentDetailViewProps) {
  const router = useRouter()
  const [student, setStudent] = useState(initialStudent)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteReason, setDeleteReason] = useState("")
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [editedStudent, setEditedStudent] = useState({
    first_name: student.first_name,
    last_name: student.last_name,
    room_number: student.room_number || "",
    meal_plan: student.meal_plan,
    weekly_credits: student.weekly_credits ?? 0,
    meal_plan_type: (student.meal_plan_type || (student.meal_plan === 0 ? "count" : "standard")) as
      | "standard"
      | "count"
      | "prepaid",
    base_location_id: student.base_location_id || null,
  })

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch("/api/locations")
        if (response.ok) {
          const data = await response.json()
          if (data.success && Array.isArray(data.locations)) {
            setLocations(data.locations)
          } else if (Array.isArray(data)) {
            // Fallback for old API format
            setLocations(data)
          }
        }
      } catch (error) {
        console.error("[v0] Error fetching locations:", error)
      }
    }
    fetchLocations()
  }, [])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const updated = await updateStudentClient(student.uin, editedStudent)
      setStudent(updated)
      setIsEditing(false)
      router.refresh()
    } catch (error) {
      console.error("[v0] Error updating student:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await deleteStudentClient(student.uin, user.id, user.email || "", userRole, deleteReason)
      router.push("/manage-students")
    } catch (error) {
      console.error("[v0] Error deleting student:", error)
      setIsDeleting(false)
    }
  }

  const handleCancel = () => {
    setEditedStudent({
      first_name: student.first_name,
      last_name: student.last_name,
      room_number: student.room_number || "",
      meal_plan: student.meal_plan,
      weekly_credits: student.weekly_credits ?? 0,
      meal_plan_type: student.meal_plan_type || "standard",
      base_location_id: student.base_location_id || null,
    })
    setIsEditing(false)
  }

  const handlePhotoUpdate = (photoUrl: string) => {
    setStudent({ ...student, photo_url: photoUrl })
  }

  const isCountPlan = student.meal_plan_type === "count" || (student.meal_plan_type == null && student.meal_plan === 0)
  const isPrepaidPlan = student.meal_plan_type === "prepaid"

  const getLocationName = (locationId: string | null) => {
    if (!locationId) return "Unassigned"
    const location = locations.find((loc) => loc.id === locationId)
    return location?.name || "Unknown"
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => router.push("/manage-students")}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                {student.first_name} {student.last_name}
              </h1>
              <p className="text-muted-foreground">UIN: {student.uin}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <>
                <AssignStudentToGroupDialog student={student} />
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Student</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this student? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                      <Label htmlFor="deleteReason">Reason for deletion (optional)</Label>
                      <Textarea
                        id="deleteReason"
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        placeholder="Enter reason for deletion..."
                        className="mt-2"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? "Deleting..." : "Delete Student"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Student information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <StudentPhotoUpload
                  studentId={student.uin}
                  currentPhotoUrl={student.photo_url}
                  onPhotoUpdate={handlePhotoUpdate}
                />

                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        id="first_name"
                        value={editedStudent.first_name}
                        onChange={(e) => setEditedStudent({ ...editedStudent, first_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        value={editedStudent.last_name}
                        onChange={(e) => setEditedStudent({ ...editedStudent, last_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="room_number">Room Number</Label>
                      <Input
                        id="room_number"
                        value={editedStudent.room_number}
                        onChange={(e) => setEditedStudent({ ...editedStudent, room_number: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="base_location">Base Location</Label>
                      <Select
                        value={editedStudent.base_location_id || "unassigned"}
                        onValueChange={(value) => {
                          setEditedStudent({
                            ...editedStudent,
                            base_location_id: value === "unassigned" ? null : value,
                          })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select base location" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="meal_plan_type">Meal Plan Type</Label>
                      <Select
                        value={editedStudent.meal_plan_type}
                        onValueChange={(value: "standard" | "count" | "prepaid") => {
                          setEditedStudent({ ...editedStudent, meal_plan_type: value })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select meal plan type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard (Weekly Credits)</SelectItem>
                          <SelectItem value="count">Count Only (No Limit)</SelectItem>
                          <SelectItem value="prepaid">Prepaid (Fixed Meals)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {editedStudent.meal_plan_type === "standard"
                          ? "Deducts from weekly allowance, resets every week"
                          : editedStudent.meal_plan_type === "prepaid"
                            ? "Fixed number of meals purchased, does not reset"
                            : "Just counts swipes, no credit limit"}
                      </p>
                    </div>
                    {editedStudent.meal_plan_type === "standard" && (
                      <>
                        <div>
                          <Label htmlFor="meal_plan">Meal Plan (per week)</Label>
                          <Input
                            id="meal_plan"
                            type="number"
                            value={editedStudent.meal_plan}
                            onChange={(e) =>
                              setEditedStudent({ ...editedStudent, meal_plan: Number.parseInt(e.target.value) })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="weekly_credits">Credits Left (this week)</Label>
                          <Input
                            id="weekly_credits"
                            type="number"
                            min="0"
                            value={editedStudent.weekly_credits}
                            onChange={(e) =>
                              setEditedStudent({
                                ...editedStudent,
                                weekly_credits: Number.parseInt(e.target.value) || 0,
                              })
                            }
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Adjust the student's remaining credits for the current week
                          </p>
                        </div>
                      </>
                    )}
                    {editedStudent.meal_plan_type === "prepaid" && (
                      <>
                        <div>
                          <Label htmlFor="meal_plan">Total Prepaid Meals</Label>
                          <Input
                            id="meal_plan"
                            type="number"
                            value={editedStudent.meal_plan}
                            onChange={(e) =>
                              setEditedStudent({ 
                                ...editedStudent, 
                                meal_plan: Number.parseInt(e.target.value),
                                weekly_credits: Number.parseInt(e.target.value) // Sync both values for prepaid
                              })
                            }
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            The total number of meals purchased (used to track original purchase)
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="weekly_credits">Meals Remaining</Label>
                          <Input
                            id="weekly_credits"
                            type="number"
                            min="0"
                            value={editedStudent.weekly_credits}
                            onChange={(e) =>
                              setEditedStudent({
                                ...editedStudent,
                                weekly_credits: Number.parseInt(e.target.value) || 0,
                              })
                            }
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Current remaining meals (adjust to add more meals or correct errors)
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Room:</span>
                      <span className="font-medium">{student.room_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base Location:</span>
                      <Badge variant={student.base_location_id ? "default" : "secondary"}>
                        {getLocationName(student.base_location_id)}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Group:</span>
                      <Badge variant={student.groups?.name ? "default" : "secondary"}>
                        {student.groups?.name || "Unassigned"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Plan Type:</span>
                      <Badge variant={isCountPlan ? "secondary" : isPrepaidPlan ? "outline" : "default"}>
                        {isCountPlan ? "Count Only" : isPrepaidPlan ? "Prepaid" : "Standard"}
                      </Badge>
                    </div>
                    {!isCountPlan && !isPrepaidPlan && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Meal Plan:</span>
                          <span className="font-medium">{student.meal_plan} swipes/week</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Credits Left:</span>
                          <Badge
                            variant={
                              student.weekly_credits > 5
                                ? "default"
                                : student.weekly_credits > 0
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {student.weekly_credits}
                          </Badge>
                        </div>
                      </>
                    )}
                    {isPrepaidPlan && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Purchased:</span>
                          <span className="font-medium">{student.meal_plan} meals</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Meals Remaining:</span>
                          <Badge
                            variant={
                              student.weekly_credits > 5
                                ? "default"
                                : student.weekly_credits > 0
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {student.weekly_credits}
                          </Badge>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2 space-y-6">
            <StudentAnalytics studentId={student.uin} />
            <StudentSwipeHistory studentUin={student.uin} />
          </div>
        </div>
      </div>
    </div>
  )
}
