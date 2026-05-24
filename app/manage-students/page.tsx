"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Search, Users, ArrowLeft, Upload, Trash2, CheckSquare, Square, Camera } from "lucide-react"
import { getAllStudentsClient, searchStudentsClient, type Student } from "@/lib/student-management"
import { useAuth } from "@/lib/auth"
import { CsvImport } from "@/components/csv-import"
import { MassPhotoUpload } from "@/components/mass-photo-upload"
import { AddStudentForm } from "@/components/add-student-form"
import { StudentPhoto } from "@/components/student-photo"

export default function ManageStudentsPage() {
  const router = useRouter()
  const { user, userRole } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showMassPhotoUpload, setShowMassPhotoUpload] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  const handleBackClick = () => {
    const backUrl = userRole === "admin" ? "/admin" : "/dashboard"
    router.push(backUrl)
  }

  const handleImportComplete = () => {
    loadStudents()
  }

  const handleStudentAdded = () => {
    loadStudents()
  }

  const handleMassPhotoUploadComplete = () => {
    loadStudents()
  }

  useEffect(() => {
    if (userRole && !["admin", "staff"].includes(userRole)) {
      router.push("/dashboard")
      return
    }
  }, [userRole, router])

  useEffect(() => {
    loadStudents()
  }, [])

  const loadStudents = async () => {
    try {
      setIsLoading(true)
      const data = await getAllStudentsClient()
      setStudents(data)
    } catch (error) {
      console.error("[v0] Error loading students:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)

    if (!query.trim()) {
      loadStudents()
      return
    }

    try {
      setIsSearching(true)
      const data = await searchStudentsClient(query)
      setStudents(data)
    } catch (error) {
      console.error("[v0] Error searching students:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleStudentClick = (studentUin: string, event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest("[data-checkbox]")) {
      return
    }
    router.push(`/manage-students/${studentUin}`)
  }

  const handleSelectAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set())
    } else {
      setSelectedStudents(new Set(students.map((s) => s.uin)))
    }
  }

  const handleSelectStudent = (uin: string) => {
    const newSelected = new Set(selectedStudents)
    if (newSelected.has(uin)) {
      newSelected.delete(uin)
    } else {
      newSelected.add(uin)
    }
    setSelectedStudents(newSelected)
  }

  const handleDeleteSelected = async () => {
    if (selectedStudents.size === 0) return

    try {
      setIsDeleting(true)
      const response = await fetch("/api/students/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uins: Array.from(selectedStudents),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to delete students")
      }

      const result = await response.json()
      console.log(`[v0] Deleted ${result.deletedCount} students`)

      setSelectedStudents(new Set())
      loadStudents()
    } catch (error) {
      console.error("[v0] Error deleting students:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteAll = async () => {
    try {
      setIsDeleting(true)
      const response = await fetch("/api/students/delete-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to delete all students")
      }

      const result = await response.json()
      console.log(`[v0] Deleted all ${result.deletedCount} students`)

      setSelectedStudents(new Set())
      loadStudents()
    } catch (error) {
      console.error("[v0] Error deleting all students:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!userRole || !["admin", "staff"].includes(userRole)) {
    return null
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={handleBackClick}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Manage Students</h1>
              <p className="text-muted-foreground">View and manage student records</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <AddStudentForm onStudentAdded={handleStudentAdded} />
            <Button variant={showImport ? "default" : "outline"} size="sm" onClick={() => setShowImport(!showImport)}>
              <Upload className="h-4 w-4 mr-2" />
              {showImport ? "Hide Import" : "Import CSV"}
            </Button>
            <Button
              variant={showMassPhotoUpload ? "default" : "outline"}
              size="sm"
              onClick={() => setShowMassPhotoUpload(!showMassPhotoUpload)}
            >
              <Camera className="h-4 w-4 mr-2" />
              {showMassPhotoUpload ? "Hide Photos" : "Upload Photos"}
            </Button>
            <Badge variant="secondary" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {students.length} Students
            </Badge>
          </div>
        </div>

        {showImport && (
          <div className="mb-6">
            <CsvImport onImportComplete={handleImportComplete} />
          </div>
        )}

        {showMassPhotoUpload && (
          <div className="mb-6">
            <MassPhotoUpload onUploadComplete={handleMassPhotoUploadComplete} />
          </div>
        )}

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by UIN, first name, or last name..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {students.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="flex items-center gap-2 bg-transparent"
                  >
                    {selectedStudents.size === students.length ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    {selectedStudents.size === students.length ? "Deselect All" : "Select All"}
                  </Button>
                  {selectedStudents.size > 0 && <Badge variant="secondary">{selectedStudents.size} selected</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {selectedStudents.size > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isDeleting}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Selected ({selectedStudents.size})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Selected Students</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {selectedStudents.size} selected student
                            {selectedStudents.size > 1 ? "s" : ""}? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteSelected}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Students
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={isDeleting}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete All
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete All Students</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete ALL {students.length} students? This action cannot be undone
                          and will remove all student records from the system.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAll}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete All Students
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading students...</p>
            </div>
          </div>
        ) : students.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No students found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? "Try adjusting your search terms." : "No students are currently registered."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {students.map((student) => (
              <Card
                key={student.uin}
                className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] relative"
                onClick={(e) => handleStudentClick(student.uin, e)}
              >
                <div className="absolute top-3 right-3 z-10" data-checkbox>
                  <Checkbox
                    checked={selectedStudents.has(student.uin)}
                    onCheckedChange={() => handleSelectStudent(student.uin)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <StudentPhoto
                      photoFilename={student.photo_url}
                      firstName={student.first_name}
                      lastName={student.last_name}
                      size="md"
                    />

                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">
                        {student.first_name} {student.last_name}
                      </CardTitle>
                      <CardDescription>UIN: {student.uin}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Room:</span>
                      <span className="font-medium">{student.room_number || "N/A"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Meal Plan:</span>
                      <span className="font-medium">
                        {student.meal_plan_type === "count" || student.meal_plan === 0
                          ? "Count Only"
                          : `${student.meal_plan} swipes/week`}
                      </span>
                    </div>
                    {student.meal_plan_type !== "count" && student.meal_plan > 0 && (
                      <div className="flex justify-between text-sm">
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
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
