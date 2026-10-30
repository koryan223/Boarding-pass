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
import { Upload, FolderOpen, CheckCircle, XCircle, AlertCircle, Users, Clock, FileCheck, Download } from "lucide-react"
import { toCsv, downloadFile } from "@/lib/csv"
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
  originalName?: string
}

// Vercel rejects request bodies over 4.5MB, so photos are sent in batches below that limit.
// The student-photos bucket only accepts JPEG/PNG up to 2MB, so larger or WebP photos are
// resized and re-encoded as JPEG in the browser before upload.
const MAX_SOURCE_BYTES = 25 * 1024 * 1024
const STORAGE_MAX_BYTES = 2 * 1024 * 1024
const TARGET_BYTES = 1.8 * 1024 * 1024
const MAX_DIMENSION = 1200
const MAX_BATCH_BYTES = 3.5 * 1024 * 1024
const MAX_BATCH_FILES = 15

async function prepareForUpload(file: File): Promise<File> {
  const acceptedAsIs = file.type === "image/jpeg" || file.type === "image/png"
  if (acceptedAsIs && file.size <= TARGET_BYTES) return file

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not process image")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const baseName = file.name.replace(/\.[^.]+$/, "")
  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
    if (blob && blob.size <= TARGET_BYTES) return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" })
  }
  throw new Error("Could not shrink photo below 2MB")
}

function exportFailures(results: PhotoProcessingResult[]) {
  const failures = results.filter((r) => r.status !== "success")
  const csv = toCsv(
    ["Filename", "UIN", "Status", "Reason"],
    failures.map((r) => [r.filename, r.uin, r.status === "no-student" ? "No matching student" : "Failed", r.message]),
  )
  downloadFile(`photo-upload-errors_${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

function buildBatches(files: FilePreview[]): FilePreview[][] {
  const batches: FilePreview[][] = []
  let current: FilePreview[] = []
  let currentBytes = 0

  for (const entry of files) {
    const size = entry.file.size
    if (current.length > 0 && (currentBytes + size > MAX_BATCH_BYTES || current.length >= MAX_BATCH_FILES)) {
      batches.push(current)
      current = []
      currentBytes = 0
    }
    current.push(entry)
    currentBytes += size
  }
  if (current.length > 0) batches.push(current)
  return batches
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
      const results: PhotoProcessingResult[] = []
      const uploadable: FilePreview[] = []

      for (const entry of selectedFiles) {
        if (!entry.validation.isValid) {
          results.push({
            filename: entry.file.name,
            uin: entry.uin,
            status: "failed",
            message: entry.validation.issues.join(", ") || "Invalid filename",
          })
        } else if (entry.file.size > MAX_SOURCE_BYTES) {
          results.push({
            filename: entry.file.name,
            uin: entry.uin,
            status: "failed",
            message: "File too large (max 25MB)",
          })
        } else {
          setCurrentFile(`Preparing ${entry.file.name}`)
          try {
            const prepared = await prepareForUpload(entry.file)
            if (prepared.size > STORAGE_MAX_BYTES) throw new Error("Could not shrink photo below 2MB")
            uploadable.push({ ...entry, file: prepared, originalName: entry.file.name })
          } catch (prepError) {
            results.push({
              filename: entry.file.name,
              uin: entry.uin,
              status: "failed",
              message: prepError instanceof Error ? prepError.message : "Could not read image",
            })
          }
        }
      }

      const batches = buildBatches(uploadable)
      let done = 0

      for (const batch of batches) {
        const originalNames = new Map(batch.map((entry) => [entry.file.name, entry.originalName ?? entry.file.name]))
        setCurrentFile(`${originalNames.get(batch[0].file.name)}${batch.length > 1 ? ` and ${batch.length - 1} more` : ""}`)
        const formData = new FormData()
        batch.forEach(({ file }) => formData.append("photos", file))

        try {
          const response = await fetch("/api/photos/mass-upload", { method: "POST", body: formData })
          const text = await response.text()
          let body: Partial<MassUploadResult> & { error?: string } = {}
          try {
            body = JSON.parse(text)
          } catch {
            throw new Error(
              response.status === 413 ? "Batch too large for the server" : text.slice(0, 80) || `HTTP ${response.status}`,
            )
          }
          if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
          results.push(
            ...(body.results ?? []).map((r) => ({ ...r, filename: originalNames.get(r.filename) ?? r.filename })),
          )
        } catch (batchError) {
          const message = batchError instanceof Error ? batchError.message : "Upload failed"
          batch.forEach(({ file, uin, originalName }) =>
            results.push({ filename: originalName ?? file.name, uin, status: "failed", message }),
          )
        }

        done += batch.length
        setProgress(Math.round((done / uploadable.length) * 100))
      }

      setProgress(100)

      const successful = results.filter((r) => r.status === "success").length
      const failed = results.length - successful

      setUploadResult({
        success: successful > 0,
        message:
          successful > 0
            ? `Successfully uploaded ${successful} photos${failed > 0 ? ` (${failed} not uploaded)` : ""}`
            : "No photos were uploaded successfully",
        processed: results.length,
        successful,
        failed,
        results: [...results].sort((a, b) => Number(a.status === "success") - Number(b.status === "success")),
      })
      setActiveTab("results")

      if (successful > 0) {
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
                  <li>• Photos over 2MB or in WebP format are resized automatically before upload</li>
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

                <div className="flex flex-wrap justify-center gap-2">
                  {uploadResult.failed > 0 && (
                    <Button onClick={() => exportFailures(uploadResult.results)} variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export Error List ({uploadResult.failed})
                    </Button>
                  )}
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
