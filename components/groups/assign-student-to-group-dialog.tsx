"use client"

import type React from "react"

import { useState, useEffect } from "react"
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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { assignStudentToGroupClient, getAllGroupsClient, type GroupWithStats } from "@/lib/group-management"
import { Loader2, UserPlus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Student } from "@/lib/student-management"

interface AssignStudentToGroupDialogProps {
  student: Student
  onAssignmentChanged?: () => void
}

export function AssignStudentToGroupDialog({ student, onAssignmentChanged }: AssignStudentToGroupDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [groups, setGroups] = useState<GroupWithStats[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>(student.group_id || "none")
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      loadGroups()
    }
  }, [open])

  const loadGroups = async () => {
    try {
      const data = await getAllGroupsClient()
      setGroups(data)
    } catch (error) {
      console.error("[v0] Error loading groups:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const groupId = selectedGroupId === "none" ? null : selectedGroupId
      await assignStudentToGroupClient(student.uin, groupId)
      toast({
        title: "Student assigned",
        description: groupId ? "Student has been assigned to the group." : "Student has been removed from the group.",
      })
      setOpen(false)
      router.refresh()
      if (onAssignmentChanged) onAssignmentChanged()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign student",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="mr-2 h-4 w-4" /> Assign to Group
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Assign to Group</DialogTitle>
            <DialogDescription>
              Assign {student.first_name} {student.last_name} to a group
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="group" className="text-right">
                Group
              </Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Group</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.student_count} students)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Student
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
