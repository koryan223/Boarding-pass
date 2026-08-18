"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Upload, FileText, CheckCircle, XCircle, AlertCircle } from "lucide-react"

interface ImportResult {
  success: boolean
  message: string
  imported: number
  failed: number
  groupsAssigned?: number
  errors: string[]
}

interface CsvImportProps {
  onImportComplete: () => void
}

export function CsvImport({ onImportComplete }: CsvImportProps) {
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".csv")) {
      setImportResult({
        success: false,
        message: "Please select a CSV file",
        imported: 0,
        failed: 0,
        errors: ["Invalid file type. Only CSV files are allowed."],
      })
      return
    }

    await processFile(file)
  }

  const processFile = async (file: File) => {
    setIsImporting(true)
    setProgress(0)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/students/import", {
        method: "POST",
        body: formData,
      })

      // Handle empty or non-JSON responses
      const responseText = await response.text()
      let result
      
      try {
        result = responseText ? JSON.parse(responseText) : null
      } catch (parseError) {
        console.error("[v0] Failed to parse response:", responseText?.substring(0, 100))
        throw new Error(response.ok ? "Server returned invalid response" : `Server error: ${response.status}`)
      }

      if (!response.ok) {
        throw new Error(result?.error || `Import failed with status ${response.status}`)
      }

      if (!result) {
        throw new Error("Server returned empty response")
      }

      setImportResult(result)
      setProgress(100)

      if (result.success) {
        onImportComplete()
      }
    } catch (error) {
      console.error("[v0] Import error:", error)
      setImportResult({
        success: false,
        message: error instanceof Error ? error.message : "Import failed",
        imported: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : "Unknown error occurred"],
      })
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import Students from CSV
        </CardTitle>
        <CardDescription>
          Upload a CSV file with columns: UIN, Fname, Lname, room_number, meal_plan, meal_plan_type (optional), group
          (optional)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4">
          <Button onClick={handleUploadClick} disabled={isImporting} className="w-full">
            <FileText className="h-4 w-4 mr-2" />
            {isImporting ? "Importing..." : "Select CSV File"}
          </Button>

          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />

          {isImporting && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">Processing CSV file...</p>
            </div>
          )}

          {importResult && (
            <Alert className={importResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <div className="flex items-start gap-2">
                {importResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <AlertDescription>
                    <div className="font-medium mb-2">{importResult.message}</div>
                    {importResult.imported > 0 && (
                      <div className="text-sm text-green-700">
                        ✓ Successfully imported: {importResult.imported} students
                      </div>
                    )}
                    {importResult.groupsAssigned && importResult.groupsAssigned > 0 && (
                      <div className="text-sm text-blue-700">
                        ✓ Assigned to groups: {importResult.groupsAssigned} students
                      </div>
                    )}
                    {importResult.failed > 0 && (
                      <div className="text-sm text-red-700">✗ Failed to import: {importResult.failed} students</div>
                    )}
                    {importResult.errors.length > 0 && (
                      <div className="mt-2">
                        <div className="text-sm font-medium text-red-700 mb-1">Errors:</div>
                        <ul className="text-xs text-red-600 space-y-1">
                          {importResult.errors.slice(0, 5).map((error, index) => (
                            <li key={index}>• {error}</li>
                          ))}
                          {importResult.errors.length > 5 && (
                            <li>• ... and {importResult.errors.length - 5} more errors</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-1">CSV Format Requirements:</div>
              <ul className="text-sm space-y-1">
                <li>• Header row: UIN, Fname, Lname, room_number, meal_plan, meal_plan_type (optional), group (optional)</li>
                <li>• UIN: 2-9 digit number</li>
                <li>• Room number: any letters and/or numbers, any length (e.g., 123A, A12, 4B217) or leave empty for N/A</li>
                <li>• Meal plan: Number of swipes/credits (positive number). Leave empty or 0 for a count-only plan</li>
                <li>
                  • Meal plan type (optional): standard, count, or prepaid. If omitted, 0 = count and any other number =
                  standard
                </li>
                <li>• Group: Group name to assign student to (optional, leave empty to skip)</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  )
}
