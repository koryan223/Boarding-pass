"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import {
  getGroupByIdClient,
  assignStudentToGroupClient,
  deleteGroupClient,
  type GroupWithStats,
} from "@/lib/group-management-client"
import type { Student } from "@/lib/types/student"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Users, Trash2, UserMinus, Loader2, AlertTriangle } from "lucide-react"
import { EditGroupDialog } from "@/components/groups/edit-group-dialog"
import { GroupAnalyticsCard } from "@/components/groups/group-analytics-card"
import { Badge } from "@/components/ui/badge"
import { StudentPhoto } from "@/components/student-photo"
import { AddStudentsToGroupDialog } from "@/components/groups/add-students-to-group-dialog"
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
import { useToast } from "@/hooks/use-toast"

export default function GroupDetailPage() {
  const params = useParams()
  // Safely extract ID and handle potential undefined/null values
  const rawId = params?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId

  const router = useRouter()
  const { toast } = useToast()
  const [group, setGroup] = useState<GroupWithStats | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadGroupData = useCallback(async () => {
    if (!id || id === "undefined") return

    try {
      setIsLoading(true)
      const groupData = await getGroupByIdClient(id)

      if (!groupData) {
        // Handle 404 - Group not found
        setGroup(null)
        setIsLoading(false)
        return
      }

      setGroup(groupData)

      // Fetch students for this group
      const response = await fetch(`/api/students?group_id=${id}`)
      if (response.ok) {
        const data = await response.json()
        setStudents(data.students || [])
      }
    } catch (error) {
      console.error("[v0] Error loading group:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load group details",
      })
    } finally {
      setIsLoading(false)
    }
  }, [id, toast])

  useEffect(() => {
    // Prevent API calls if ID is invalid or literally "undefined"
    if (!id || id === "undefined" || id === "null") {
      console.warn("[v0] Invalid group ID detected:", id)
      setIsLoading(false)
      return
    }

    loadGroupData()
  }, [id, loadGroupData])

  const handleDeleteGroup = async () => {
    if (!id || !group) return

    try {
      setIsDeleting(true)
      await deleteGroupClient(id)
      toast({
        title: "Group deleted",
        description: "The group has been deleted successfully",
      })
      router.push("/admin/groups")
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete group",
      })
      setIsDeleting(false)
    }
  }

  const handleRemoveStudent = async (uin: string) => {
    try {
      await assignStudentToGroupClient(uin, null)
      toast({
        title: "Student removed",
        description: "The student has been removed from the group",
      })
      loadGroupData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove student",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Robust check for missing data or invalid ID
  if (!id || !group || id === "undefined") {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto text-center py-12">
          <CardContent className="flex flex-col items-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Group Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The group you are looking for does not exist or the link was invalid.
            </p>
            <Button asChild>
              <Link href="/admin/groups">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Groups
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/groups">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{group.name}</h1>
            <p className="text-muted-foreground">{group.description || "No description provided"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EditGroupDialog group={group} onGroupUpdated={loadGroupData} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Group</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this group? Students will be unassigned but not deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteGroup}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Group
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="mb-6">
        <GroupAnalyticsCard groupId={id} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Students in Group</CardTitle>
              <CardDescription>{students.length} students assigned</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {students.length}
              </Badge>
              <AddStudentsToGroupDialog groupId={id} onStudentsAdded={loadGroupData} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="mb-2 font-medium">No students assigned yet</p>
              <p className="text-sm mb-4">Add students to this group to see them listed here.</p>
              <AddStudentsToGroupDialog groupId={id} onStudentsAdded={loadGroupData} />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {students.map((student) => (
                <Card key={student.uin} className="overflow-hidden hover:border-primary/20 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <StudentPhoto
                        photoFilename={student.photo_url}
                        firstName={student.first_name}
                        lastName={student.last_name}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">
                          {student.first_name} {student.last_name}
                        </CardTitle>
                        <CardDescription className="text-xs font-mono">UIN: {student.uin}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-1 text-sm mb-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Room:</span>
                        <span className="font-medium">{student.room_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Credits:</span>
                        <Badge
                          variant={student.weekly_credits > 0 ? "secondary" : "destructive"}
                          className="text-xs h-5"
                        >
                          {student.weekly_credits}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline" className="flex-1 bg-transparent hover:bg-muted">
                        <Link href={`/manage-students/${student.uin}`}>View Profile</Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove from Group</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove{" "}
                              <strong>
                                {student.first_name} {student.last_name}
                              </strong>{" "}
                              from this group?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRemoveStudent(student.uin)}>
                              Remove Student
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
