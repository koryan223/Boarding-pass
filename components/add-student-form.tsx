"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { UserPlus, Loader2, Upload, X, Users } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useEffect } from "react"

interface Group {
  id: string
  name: string
}

interface AddStudentFormProps {
  onStudentAdded: () => void
}

export function AddStudentForm({ onStudentAdded }: AddStudentFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    uin: "",
    firstName: "",
    lastName: "",
    roomNumber: "",
    mealPlan: "",
    mealPlanType: "standard" as "standard" | "count" | "prepaid",
    groupId: "" as string,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)

  useEffect(() => {
    if (isOpen && groups.length === 0) {
      fetchGroups()
    }
  }, [isOpen])

  const fetchGroups = async () => {
    try {
      setLoadingGroups(true)
      const response = await fetch("/api/groups")
      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups || [])
      }
    } catch (error) {
      console.error("[v0] Failed to fetch groups:", error)
    } finally {
      setLoadingGroups(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    console.log("[v0] AddStudentForm dialog open state changed:", open)
    setIsOpen(open)
    if (!open && !isSubmitting) {
      setFormData({
        uin: "",
        firstName: "",
        lastName: "",
        roomNumber: "",
        mealPlan: "",
        mealPlanType: "standard",
        groupId: "",
      })
      setErrors({})
      setSelectedPhoto(null)
      setPhotoPreview(null)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      setErrors((prev) => ({ ...prev, photo: "Invalid file type. Only JPEG, PNG, and WebP are allowed." }))
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, photo: "File size too large. Maximum 5MB allowed." }))
      return
    }

    setErrors((prev) => ({ ...prev, photo: "" }))
    setSelectedPhoto(file)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handlePhotoRemove = () => {
    setSelectedPhoto(null)
    setPhotoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.uin.trim()) {
      newErrors.uin = "UIN is required"
    } else if (!/^\d{2,9}$/.test(formData.uin.trim())) {
      newErrors.uin = "UIN must be 2-9 digits"
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required"
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required"
    }

    if (formData.mealPlanType === "standard" || formData.mealPlanType === "prepaid") {
      if (!formData.mealPlan.trim()) {
        newErrors.mealPlan = formData.mealPlanType === "prepaid" 
          ? "Number of prepaid meals is required" 
          : "Meal plan is required for standard plans"
      } else if (!/^\d+$/.test(formData.mealPlan.trim()) || Number.parseInt(formData.mealPlan) <= 0) {
        newErrors.mealPlan = "Must be a positive number"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      setIsSubmitting(true)

      const response = await fetch("/api/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uin: formData.uin.trim(),
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          room_number: formData.roomNumber.trim(),
          meal_plan: formData.mealPlanType === "count" ? 0 : Number.parseInt(formData.mealPlan.trim()),
          weekly_credits: formData.mealPlanType === "prepaid" ? Number.parseInt(formData.mealPlan.trim()) : undefined,
          meal_plan_type: formData.mealPlanType,
          group_id: formData.groupId || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to add student")
      }

      console.log("[v0] Student added successfully")

      if (selectedPhoto) {
        try {
          const photoFormData = new FormData()
          photoFormData.append("photo", selectedPhoto)

          const photoResponse = await fetch(`/api/students/${formData.uin.trim()}/photo`, {
            method: "POST",
            body: photoFormData,
          })

          if (!photoResponse.ok) {
            console.error("[v0] Failed to upload photo, but student was created")
          } else {
            console.log("[v0] Photo uploaded successfully")
          }
        } catch (photoError) {
          console.error("[v0] Error uploading photo:", photoError)
        }
      }

      // Reset form
      setFormData({
        uin: "",
        firstName: "",
        lastName: "",
        roomNumber: "",
        mealPlan: "",
        mealPlanType: "standard",
        groupId: "",
      })
      setErrors({})
      setSelectedPhoto(null)
      setPhotoPreview(null)
      setIsOpen(false)
      onStudentAdded()
    } catch (error) {
      console.error("[v0] Error adding student:", error)
      setErrors({ submit: error instanceof Error ? error.message : "Failed to add student" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleButtonClick = () => {
    console.log("[v0] Add Student button clicked")
    setIsOpen(true)
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setIsOpen(false)
      setFormData({
        uin: "",
        firstName: "",
        lastName: "",
        roomNumber: "",
        mealPlan: "",
        mealPlanType: "standard",
        groupId: "",
      })
      setErrors({})
      setSelectedPhoto(null)
      setPhotoPreview(null)
    }
  }

  const initials =
    formData.firstName && formData.lastName ? `${formData.firstName[0]}${formData.lastName[0]}`.toUpperCase() : "?"

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" onClick={handleButtonClick}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Student
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
          <DialogDescription>Enter the student's information to add them to the system.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={photoPreview || undefined} alt="Student photo preview" />
              <AvatarFallback className="text-lg font-semibold bg-muted">{initials}</AvatarFallback>
            </Avatar>

            <div className="flex gap-2">
              {!selectedPhoto ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-transparent"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Add Photo
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-transparent"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePhotoRemove}
                    className="bg-transparent"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {errors.photo && <p className="text-sm text-destructive text-center">{errors.photo}</p>}

            <div className="text-xs text-muted-foreground text-center">Optional • JPEG, PNG, or WebP • Max 5MB</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="uin">UIN (2-9 digits)</Label>
            <Input
              id="uin"
              type="text"
              value={formData.uin}
              onChange={(e) => handleInputChange("uin", e.target.value)}
              maxLength={9}
              className={errors.uin ? "border-destructive" : ""}
            />
            {errors.uin && <p className="text-sm text-destructive">{errors.uin}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                className={errors.firstName ? "border-destructive" : ""}
              />
              {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                className={errors.lastName ? "border-destructive" : ""}
              />
              {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="roomNumber">Room Number (Optional)</Label>
            <Input
              id="roomNumber"
              type="text"
              value={formData.roomNumber}
              onChange={(e) => handleInputChange("roomNumber", e.target.value)}
              placeholder="Leave empty for N/A"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="group">Group (Optional)</Label>
            <Select
              value={formData.groupId}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, groupId: value === "none" ? "" : value }))
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingGroups ? "Loading groups..." : "Select a group"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Group</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      {group.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Assign the student to a group for easier management
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mealPlanType">Meal Plan Type</Label>
            <Select
              value={formData.mealPlanType}
              onValueChange={(value: "standard" | "count" | "prepaid") => {
                setFormData((prev) => ({ ...prev, mealPlanType: value }))
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
            <p className="text-xs text-muted-foreground">
              {formData.mealPlanType === "standard"
                ? "Deducts from weekly allowance, resets every week"
                : formData.mealPlanType === "prepaid"
                  ? "Fixed number of meals, does not reset weekly"
                  : "Just counts swipes, no credit limit"}
            </p>
          </div>

          {(formData.mealPlanType === "standard" || formData.mealPlanType === "prepaid") && (
            <div className="space-y-2">
              <Label htmlFor="mealPlan">
                {formData.mealPlanType === "prepaid" ? "Total Prepaid Meals" : "Weekly Swipes Allowance"}
              </Label>
              <Input
                id="mealPlan"
                type="number"
                min="1"
                value={formData.mealPlan}
                onChange={(e) => handleInputChange("mealPlan", e.target.value)}
                className={errors.mealPlan ? "border-destructive" : ""}
              />
              {errors.mealPlan && <p className="text-sm text-destructive">{errors.mealPlan}</p>}
              {formData.mealPlanType === "prepaid" && (
                <p className="text-xs text-muted-foreground">
                  This is the total number of meals the student purchased. It will not reset.
                </p>
              )}
            </div>
          )}

          {errors.submit && (
            <div className="rounded-md bg-destructive/15 p-3">
              <p className="text-sm text-destructive">{errors.submit}</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Student"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
