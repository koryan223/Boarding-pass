"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface StudentPhotoProps {
  photoFilename?: string | null // This is now the full signed URL from the server
  firstName: string
  lastName: string
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-16 w-16",
  xl: "h-20 w-20",
}

export function StudentPhoto({ photoFilename, firstName, lastName, size = "md", className = "" }: StudentPhotoProps) {
  const fallbackText = `${firstName?.[0]?.toUpperCase() || ""}${lastName?.[0]?.toUpperCase() || ""}`

  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      <AvatarImage 
        src={photoFilename || undefined} 
        alt={`${firstName} ${lastName}`}
      />
      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
        {fallbackText}
      </AvatarFallback>
    </Avatar>
  )
}
