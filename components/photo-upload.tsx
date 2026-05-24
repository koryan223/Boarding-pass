"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Upload, X, Camera, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface PhotoUploadProps {
  studentId: string
  currentPhotoUrl?: string | null // This is now the full signed URL
  studentName?: string
  onPhotoUpdate?: (photoUrl: string | null) => void
  className?: string
}

export function PhotoUpload({ studentId, currentPhotoUrl, studentName, onPhotoUpdate, className }: PhotoUploadProps) {
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
      onPhotoUpdate?.(data.photoUrl) // Use the new signed URL from the response
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
      onPhotoUpdate?.(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete photo")
    } finally {
      setIsDeleting(false)
    }
  }

  const displayPhotoUrl = previewUrl || currentPhotoUrl
  const initials = studentName ? studentName.split(" ").map((n) => n[0]).join("").toUpperCase() : "?"

  return (
    <Card className={cn("w-full max-w-sm text-center mx-auto my-auto ml-auto mb-5", className)}>
      <CardContent className="p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Avatar className="h-32 w-32">
              <AvatarImage src={displayPhotoUrl || undefined} alt={studentName || "Student photo"} />
              <AvatarFallback className="text-2xl font-semibold bg-muted">
                {displayPhotoUrl ? <Camera className="h-8 w-8" /> : initials}
              </AvatarFallback>
            </Avatar>
            {(isUploading || isDeleting) && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            )}
          </div>
          {error && <div className="text-sm text-destructive text-center bg-destructive/10 p-2 rounded-md w-full">{error}</div>}
          <div className="flex gap-2 w-full">
            {currentPhotoUrl ? (
              <>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isDeleting} className="flex-1 bg-transparent">
                  <Upload className="h-4 w-4 mr-2" /> Replace
                </Button>
                <Button variant="outline" size="sm" onClick={deletePhoto} disabled={isUploading || isDeleting} className="flex-1 bg-transparent">
                  <X className="h-4 w-4 mr-2" /> Remove
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isDeleting} className="w-full bg-transparent">
                <Upload className="h-4 w-4 mr-2" /> Upload Photo
              </Button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />
          <div className="text-xs text-muted-foreground text-center">JPEG, PNG, or WebP • Max 5MB</div>
        </div>
      </CardContent>
    </Card>
  )
}
