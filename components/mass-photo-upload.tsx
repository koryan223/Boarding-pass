"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Upload, FolderOpen, CheckCircle, XCircle, AlertCircle, Users, Clock, FileCheck } from "lucide-react"
import { validatePhotoFilename, extractUINFromFilename, extractNameFromFilename } from "@/lib/photo-matching"

interface PhotoProcessingResult {
  filename: string
  uin: string
  status: "success" | "failed" | "no-student"
  message: string
}

interface MassUploadResult {
  success: boolean
  message: string
  processed: number
  successful: number
  failed: number
  results: PhotoProcessingResult[]
}

interface MassPhotoUploadProps {
  onUploadComplete: () => void
}

interface FilePreview {
  file: File
  uin: string
  validation: ReturnType<typeof validatePhotoFilename>
  preview?: string
}

export function MassPhotoUpload({ onUploadComplete }: MassPhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<MassUploadResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState<string>("")
  const [selectedFiles, setSelectedFiles] = useState<FilePreview[]>([])
  const [activeTab, setActiveTab] = useState("select")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])

    const filePreviews: FilePreview[] = []

    for (const file of files) {
      if (file.type.startsWith("image/") && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        const uin = extractUINFromFilename(file.name) || "unknown"
        const validation = validatePhotoFilename(file.name)

        let preview: string | undefined
        try {
          preview = URL.createObjectURL(file)
        } catch (error) {
          console.warn("Could not create preview for", file.name)
        }

        filePreviews.push({
          file,
          uin,
          validation,
          preview,
        })
      }
    }

    setSelectedFiles(filePreviews)
    setUploadResult(null)

    if (filePreviews.length > 0) {
      setActiveTab("preview")
    }
  }

  const processFiles = async () => {
    if (selectedFiles.length === 0) return

    setIsUploading(true)
    setProgress(0)
    setUploadResult(null)
    setActiveTab("progress")

    try {
      const formData = new FormData()
      selectedFiles.forEach(({ file }) => {
        formData.append("photos", file)
      })

      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + Math.random() * 10, 90))
      }, 200)

      const response = await fetch("/api/photos/mass-upload", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Mass upload failed")
      }

      setUploadResult(result)
      setActiveTab("results")

      if (result.success && result.successful > 0) {
        onUploadComplete()
      }
    } catch (error) {
      console.error("[v0] Mass upload error:", error)
      setUploadResult({
        success: false,
        message: error instanceof Error ? error.message : "Mass upload failed",
        processed: selectedFiles.length,
        successful: 0,
        failed: selectedFiles.length,
        results: selectedFiles.map(({ file, uin }) => ({
          filename: file.name,
          uin,
          status: "failed",
          message: "Upload failed",
        })),
      })
      setActiveTab("results")
    } finally {
      setIsUploading(false)
      setCurrentFile("")
      selectedFiles.forEach(({ preview }) => {
        if (preview) URL.revokeObjectURL(preview)
      })
      setSelectedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const resetUpload = () => {
    selectedFiles.forEach(({ preview }) => {
      if (preview) URL.revokeObjectURL(preview)
    })
    setSelectedFiles([])
    setUploadResult(null)
    setActiveTab("select")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const validFiles = selectedFiles.filter((f) => f.validation.isValid)
  const invalidFiles = selectedFiles.filter((f) => !f.validation.isValid)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Mass Photo Upload
        </CardTitle>
        <CardDescription>
          Upload multiple student photos at once. Photos should be named with the student's UIN (e.g., "12345.jpg" or
          "12.jpg")
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="select" className="flex items-center gap-1">
              <FolderOpen className="h-3 w-3" />
              Select
            </TabsTrigger>
            <TabsTrigger value="preview" disabled={selectedFiles.length === 0} className="flex items-center gap-1">
              <FileCheck className="h-3 w-3" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="progress" disabled={!isUploading} className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Progress
            </TabsTrigger>
            <TabsTrigger value="results" disabled={!uploadResult} className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="space-y-4">
            <Button
              onClick={handleUploadClick}
              disabled={isUploading}
              className="w-full bg-transparent"
              variant="outline"
              size="lg"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Select Photo Files
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-1">Photo Upload Guidelines:</div>
                <ul className="text-sm space-y-1">
                  <li>• Name photos with the student's UIN (e.g., "12345.jpg" or "12.jpg")</li>
                  <li>• Supported formats: JPEG, PNG, WebP</li>
                  <li>• Maximum file size: 5MB per photo</li>
                  <li>• Existing photos will be replaced automatically</li>
                  <li>• Photos for non-existent students will be skipped</li>
                </ul>
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium">{selectedFiles.length} files selected</div>
                <div className="text-xs text-muted-foreground">
                  {validFiles.length} valid • {invalidFiles.length} invalid
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={resetUpload} variant="outline" size="sm">
                  Cancel
                </Button>
                <Button onClick={processFiles} size="sm" disabled={validFiles.length === 0}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {validFiles.length} Photos
                </Button>
              </div>
            </div>

            <ScrollArea className="h-64 w-full border rounded-md p-4">
              <div className="space-y-2">
                {selectedFiles.map((filePreview, index) => {
                  const { firstName, lastName } = extractNameFromFilename(filePreview.file.name)
                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        filePreview.validation.isValid ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                      }`}
                    >
                      {filePreview.preview && (
                        <img
                          src={filePreview.preview || "/placeholder.svg"}
                          alt="Preview"
                          className="w-12 h-12 object-cover rounded border"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium truncate">{filePreview.file.name}</span>
                          <Badge
                            variant={filePreview.validation.isValid ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {filePreview.validation.isValid ? "Valid" : "Invalid"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>UIN: {filePreview.uin}</span>
                          {firstName && (
                            <span>
                              • {firstName} {lastName || ""}
                            </span>
                          )}
                          <span>• {(filePreview.file.size / 1024 / 1024).toFixed(1)}MB</span>
                        </div>
                        {!filePreview.validation.isValid && (
                          <div className="text-xs text-red-600 mt-1">{filePreview.validation.issues.join(", ")}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="progress" className="space-y-4">
            <div className="text-center space-y-4">
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground">
                  {progress < 100 ? `Processing ${selectedFiles.length} photos...` : "Upload complete!"}
                </p>
                {currentFile && <p className="text-xs text-muted-foreground">Current: {currentFile}</p>}
              </div>

              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {uploadResult && (
              <>
                <Alert className={uploadResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  <div className="flex items-start gap-2">
                    {uploadResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <AlertDescription>
                        <div className="font-medium mb-2">{uploadResult.message}</div>

                        <div className="flex gap-4 text-sm mb-3">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>Processed: {uploadResult.processed}</span>
                          </div>
                          {uploadResult.successful > 0 && (
                            <div className="text-green-700">✓ Successful: {uploadResult.successful}</div>
                          )}
                          {uploadResult.failed > 0 && (
                            <div className="text-red-700">✗ Failed: {uploadResult.failed}</div>
                          )}
                        </div>
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>

                {uploadResult.results.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Detailed Results:</div>
                    <ScrollArea className="h-48 w-full border rounded-md p-4">
                      <div className="space-y-2">
                        {uploadResult.results.map((result, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between text-sm p-2 bg-background rounded border"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  result.status === "success"
                                    ? "bg-green-500"
                                    : result.status === "no-student"
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                }`}
                              />
                              <span className="truncate font-mono text-xs">{result.filename}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {result.uin}
                              </Badge>
                              <span className="text-muted-foreground text-xs">{result.message}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <div className="flex justify-center">
                  <Button onClick={resetUpload} variant="outline">
                    Upload More Photos
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
