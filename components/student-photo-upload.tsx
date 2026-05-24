"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Upload, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface StudentPhotoUploadProps {
  studentId: string
  currentPhotoUrl?: string | null
  studentName?: string
  onPhotoUpdate?: (photoUrl: string) => void
  className?: string
}

export function StudentPhotoUpload({
  studentId,
  currentPhotoUrl,
  studentName,
  onPhotoUpdate,
  className,
}: StudentPhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Only JPEG, PNG, and WebP are allowed.")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File size too large. Maximum 5MB allowed.")
      return
    }

    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => setPreviewUrl(e.target?.result as string)
    reader.readAsDataURL(file)
    uploadPhoto(file)
  }

  const uploadPhoto = async (file: File) => {
    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("photo", file)
      const response = await fetch(`/api/students/${studentId}/photo`, {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to upload photo")
      onPhotoUpdate?.(data.photoUrl)
      setPreviewUrl(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo")
      setPreviewUrl(null)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const deletePhoto = async () => {
    setIsDeleting(true)
    setError(null)
    try {
      const response = await fetch(`/api/students/${studentId}/photo`, { method: "DELETE" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to delete photo")
      onPhotoUpdate?.(data.photoUrl || "/placeholder.svg") // Fallback URL after deletion
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete photo")
    } finally {
      setIsDeleting(false)
    }
  }

  // Determine what to show: preview, current URL, or placeholder
  // Note: currentPhotoUrl is now a signed URL from the server
  const displayUrl = previewUrl || currentPhotoUrl
  const initials = studentName
    ? studentName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?"

  return (
    <Card className={cn("w-full overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <Avatar className="h-32 w-32 border-2 border-border">
              <AvatarImage
                src={displayUrl || undefined}
                alt={studentName || "Student photo"}
                className="object-cover"
              />
              <AvatarFallback className="text-2xl font-semibold bg-muted">{initials}</AvatarFallback>
            </Avatar>

            {(isUploading || isDeleting) && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-destructive text-center bg-destructive/10 p-2 rounded-md w-full">{error}</div>
          )}

          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isDeleting}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-2" />
              {currentPhotoUrl && !currentPhotoUrl.includes("placeholder") ? "Replace" : "Upload"}
            </Button>

            {currentPhotoUrl && !currentPhotoUrl.includes("placeholder") && (
              <Button
                variant="outline"
                size="sm"
                onClick={deletePhoto}
                disabled={isUploading || isDeleting}
                className="flex-1 bg-transparent"
              >
                <X className="h-4 w-4 mr-2" /> Remove
              </Button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="text-xs text-muted-foreground text-center">JPEG, PNG, or WebP • Max 5MB</div>
        </div>
      </CardContent>
    </Card>
  )
}
