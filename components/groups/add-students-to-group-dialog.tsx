"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { assignStudentToGroupClient } from "@/lib/group-management-client"
import { Loader2, UserPlus, Search, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface Student {
  uin: string
  first_name: string
  last_name: string
  group_id: string | null
}

interface AddStudentsToGroupDialogProps {
  groupId: string
  onStudentsAdded?: () => void
}

export function AddStudentsToGroupDialog({ groupId, onStudentsAdded }: AddStudentsToGroupDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const hasFetched = useRef(false)

  useEffect(() => {
    if (!open) {
      hasFetched.current = false
      return
    }

    if (hasFetched.current) return
    hasFetched.current = true

    const fetchStudents = async () => {
      setIsLoadingStudents(true)
      try {
        const response = await fetch("/api/students")
        if (response.ok) {
          const data = await response.json()
          setStudents(data.students || [])
        }
      } catch (error) {
        console.error("Error fetching students:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load students",
        })
      } finally {
        setIsLoadingStudents(false)
      }
    }

    fetchStudents()
    setSelectedStudents(new Set())
    setSearchQuery("")
  }, [open, toast])

  const handleStudentToggle = (uin: string) => {
    setSelectedStudents((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(uin)) {
        newSet.delete(uin)
      } else {
        newSet.add(uin)
      }
      return newSet
    })
  }

  const availableStudents = students.filter((s: Student) => s.group_id !== groupId)

  const getFilteredStudents = () => {
    if (!searchQuery.trim()) return availableStudents
    const query = searchQuery.toLowerCase()
    return availableStudents.filter(
      (s) =>
        s.first_name.toLowerCase().includes(query) ||
        s.last_name.toLowerCase().includes(query) ||
        s.uin.includes(query),
    )
  }

  const handleSelectAll = () => {
    const filteredStudents = getFilteredStudents()
    const allFilteredUins = filteredStudents.map((s) => s.uin)
    const allSelected = allFilteredUins.every((uin) => selectedStudents.has(uin))

    if (allSelected) {
      setSelectedStudents((prev) => {
        const newSet = new Set(prev)
        allFilteredUins.forEach((uin) => newSet.delete(uin))
        return newSet
      })
    } else {
      setSelectedStudents((prev) => {
        const newSet = new Set(prev)
        allFilteredUins.forEach((uin) => newSet.add(uin))
        return newSet
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const selectedArray = Array.from(selectedStudents)

    if (selectedArray.length === 0) {
      toast({
        variant: "destructive",
        title: "No students selected",
        description: "Please select at least one student to add.",
      })
      return
    }

    setIsLoading(true)

    try {
      await Promise.all(selectedArray.map((uin) => assignStudentToGroupClient(uin, groupId)))

      toast({
        title: "Students added",
        description: `Successfully added ${selectedArray.length} student(s) to the group.`,
      })

      setOpen(false)

      setTimeout(() => {
        if (onStudentsAdded) {
          onStudentsAdded()
        } else {
          router.refresh()
        }
      }, 100)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add students",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filteredStudents = getFilteredStudents()
  const selectedCount = selectedStudents.size

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" /> Add Students
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Students to Group</DialogTitle>
            <DialogDescription>Select students to add to this group.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{selectedCount} selected</Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={filteredStudents.length === 0}
              >
                {filteredStudents.every((s) => selectedStudents.has(s.uin)) && filteredStudents.length > 0
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or UIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[300px] rounded-md border p-3">
              {isLoadingStudents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  {searchQuery ? "No students found" : "No available students"}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredStudents.map((student) => {
                    const isSelected = selectedStudents.has(student.uin)
                    return (
                      <div
                        key={student.uin}
                        role="button"
                        tabIndex={0}
                        className={`flex items-center space-x-3 rounded-md p-2 cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                        }`}
                        onClick={() => handleStudentToggle(student.uin)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            handleStudentToggle(student.uin)
                          }
                        }}
                      >
                        {/* Custom checkbox visual */}
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center ${
                            isSelected ? "bg-primary border-primary text-primary-foreground" : "border-input"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            UIN: {student.uin}
                            {student.group_id && student.group_id !== groupId && " • In another group"}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || selectedCount === 0}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add {selectedCount > 0 && `(${selectedCount})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
