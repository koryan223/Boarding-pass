"use client"

import type React from "react"
import { RefreshCw } from "lucide-react"
import { CheckCircle, XCircle, Clock, MapPin, CreditCard } from "lucide-react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Student } from "@/lib/types/student"
import { useSession } from "@/contexts/session-context"
import { StudentPhoto } from "@/components/student-photo"
import { processCardInput } from "@/lib/card-decoder"
import { MenuDisplay } from "@/components/menu-display"

export function MealSwipeInterface() {
  const { currentSession, sessionSwipeCount, incrementSwipeCount } = useSession()
  const [uin, setUin] = useState("")
  const [student, setStudent] = useState<Student | null>(null)
  const [weeklySwipes, setWeeklySwipes] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error" | "reentry"; text: string } | null>(null)
  const [recentSwipes, setRecentSwipes] = useState<Student[]>([])
  const [showRecent, setShowRecent] = useState(false)
  const [lastSubmissionTime, setLastSubmissionTime] = useState(0)
  const [isProcessingCardSwipe, setIsProcessingCardSwipe] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const studentInfoTimerRef = useRef<NodeJS.Timeout | null>(null)
  const cardInputBufferRef = useRef<string>("")
  const cardInputTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isAccumulatingCardDataRef = useRef<boolean>(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowMenu(true)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (studentInfoTimerRef.current) {
      clearTimeout(studentInfoTimerRef.current)
      studentInfoTimerRef.current = null
    }

    if (student) {
      studentInfoTimerRef.current = setTimeout(() => {
        setStudent(null)
        setMessage(null)
      }, 3000)
    }

    return () => {
      if (studentInfoTimerRef.current) {
        clearTimeout(studentInfoTimerRef.current)
      }
    }
  }, [student])

  useEffect(() => {
    if (!currentSession && student) {
      setStudent(null)
      setMessage(null)
    }
  }, [currentSession, student])

  useEffect(() => {
    if (!currentSession) {
      setShowRecent(false)
    }
  }, [currentSession])

  useEffect(() => {
    if (currentSession?.id && !isLoading && !isSubmitting) {
      const focusInput = () => {
        if (document.activeElement !== inputRef.current) {
          inputRef.current?.focus()
        }
      }

      focusInput()

      const timers = [
        setTimeout(focusInput, 50),
        setTimeout(focusInput, 150),
        setTimeout(focusInput, 300),
        setTimeout(focusInput, 500),
      ]

      return () => timers.forEach((t) => clearTimeout(t))
    }
  }, [currentSession?.id, isLoading, isSubmitting])

  useEffect(() => {
    return () => {
      if (cardInputTimerRef.current) {
        clearTimeout(cardInputTimerRef.current)
      }
    }
  }, [])

  const handleInputChange = (value: string) => {
    console.log("[v0] Input change:", value.substring(0, 50))

    const looksLikeMagStripe = value.includes("%") || value.includes(";") || value.includes("^") || value.includes("?")
    const looksLikeQRCode = /^\d+=$/.test(value) || /^\d+=\d+$/.test(value) // Format: digits = digits
    const isCardData = looksLikeMagStripe || looksLikeQRCode

    const mightBeCardData = /^\d{10,}$/.test(value) // 10+ digits might be card/QR code

    if (isCardData || mightBeCardData || isAccumulatingCardDataRef.current) {
      if (!isAccumulatingCardDataRef.current) {
        isAccumulatingCardDataRef.current = true
        setIsProcessingCardSwipe(true)
        cardInputBufferRef.current = ""
      }

      cardInputBufferRef.current = value
      setUin(value) // Show the accumulated value in the input field
      console.log("[v0] Card data detected, buffer:", cardInputBufferRef.current.substring(0, 100))

      if (cardInputTimerRef.current) {
        clearTimeout(cardInputTimerRef.current)
      }

      const debounceTime = looksLikeQRCode ? 300 : 500

      cardInputTimerRef.current = setTimeout(() => {
        console.log("[v0] Card input complete, processing buffer:", cardInputBufferRef.current.substring(0, 100))
        processCardSwipe(cardInputBufferRef.current)
        cardInputBufferRef.current = ""
        isAccumulatingCardDataRef.current = false
      }, debounceTime)
    } else {
      setIsProcessingCardSwipe(false)
      isAccumulatingCardDataRef.current = false

      if (/^\d+$/.test(value) && value.length <= 9) {
        setUin(value)
      } else if (/^\d+$/.test(value) && value.length > 9) {
        setUin(value)
      } else {
        setUin(value)
      }
    }
  }

  const processCardSwipe = async (rawData: string) => {
    console.log("[v0] Processing card swipe data")

    const result = processCardInput(rawData)

    if (result.uin) {
      console.log("[v0] Card decoded successfully, UIN:", result.uin)
      setUin(result.uin)
      setIsProcessingCardSwipe(false)

      setTimeout(() => {
        handleUinSubmit(undefined, result.uin)
      }, 100)
    } else {
      console.error("[v0] Failed to decode card data")
      setMessage({ type: "error", text: "Failed to read card. Please try again or enter UIN manually." })
      setUin("")
      setIsProcessingCardSwipe(false)
    }
  }

  const handleUinSubmit = async (e?: React.FormEvent, providedUin?: string) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    const now = Date.now()
    if (now - lastSubmissionTime < 1000) {
      console.log("[v0] Form submission blocked - too soon after last submission")
      return
    }

    if (isSubmitting || isLoading) {
      console.log("[v0] Form submission blocked - already processing")
      return
    }

    setLastSubmissionTime(now)

    const uinToSubmit = providedUin || uin

    console.log("[v0] Form submitted with UIN:", uinToSubmit)
    console.log("[v0] Current session ID:", currentSession?.id || null)

    if (!uinToSubmit.trim() || uinToSubmit.length < 2 || uinToSubmit.length > 9) {
      setMessage({ type: "error", text: "Please enter a valid UIN (2-9 digits)" })
      return
    }

    if (!currentSession?.id) {
      setMessage({ type: "error", text: "Please start a session before processing swipes" })
      return
    }

    setIsLoading(true)
    setIsSubmitting(true)
    setMessage(null)

    if (studentInfoTimerRef.current) {
      clearTimeout(studentInfoTimerRef.current)
      studentInfoTimerRef.current = null
    }

    try {
      console.log("[v0] Making API request to /api/meal-swipe")
      const response = await fetch("/api/meal-swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentUin: uinToSubmit,
          sessionId: currentSession.id,
        }),
      })

      console.log("[v0] API response status:", response.status)
      console.log("[v0] API response ok:", response.ok)

      if (!response.ok) {
        console.log("[v0] Response not ok, throwing error")
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      console.log("[v0] About to parse JSON response")
      let result
      try {
        const responseText = await response.text()
        console.log("[v0] Raw response text:", responseText)
        result = JSON.parse(responseText)
        console.log("[v0] Parsed JSON successfully:", result)
      } catch (jsonError) {
        console.error("[v0] JSON parsing failed:", jsonError)
        throw new Error("Invalid JSON response from server")
      }

      if (result.success) {
        setStudent(result.student)
        setWeeklySwipes(result.weeklySwipes ?? null)
        setMessage({ type: result.isReentry ? "reentry" : "success", text: result.message })
        setUin("")
        incrementSwipeCount()

        if (showRecent && currentSession?.id) {
          try {
            await loadRecentSwipes()
          } catch (swipeError) {
            console.error("[v0] Failed to load recent swipes:", swipeError)
          }
        }
      } else {
        console.error("[v0] API returned failure:", {
          success: result.success,
          message: result.message,
          student: result.student,
          fullResult: result,
        })
        setStudent(result.student || null)
        setWeeklySwipes(null)
        setMessage({ type: "error", text: result.message })
      }
    } catch (error) {
      console.error("[v0] API request failed:", error)
      if (error instanceof TypeError && error.message.includes("fetch")) {
        setMessage({ type: "error", text: "Network error - please check your connection" })
      } else if (error.message.includes("JSON")) {
        setMessage({ type: "error", text: "Server response error - please try again" })
      } else {
        setMessage({ type: "error", text: `Failed to process swipe: ${error.message}` })
      }
    } finally {
      setIsLoading(false)
      setIsSubmitting(false)
    }
  }

  const loadRecentSwipes = async () => {
    if (!currentSession?.id) return

    try {
      const response = await fetch(`/api/session-swipes?sessionId=${currentSession.id}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch recent swipes: ${response.status}`)
      }

      const data = await response.json()
      setRecentSwipes(data.swipes || [])
    } catch (error) {
      console.error("[v0] Failed to load recent swipes:", error)
    }
  }

  const toggleRecentSwipes = async () => {
    if (isSubmitting || isLoading) return

    setShowRecent(!showRecent)
    if (!showRecent && currentSession?.id) {
      try {
        await loadRecentSwipes()
      } catch (error) {
        console.error("[v0] Failed to toggle recent swipes:", error)
      }
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-accent" />
      case "reentry":
        return <RefreshCw className="h-4 w-4 text-blue-500" />
      case "insufficient_credits":
        return <XCircle className="h-4 w-4 text-destructive" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getCreditsBadgeVariant = (student: Student) => {
    const isCountPlan =
      student.meal_plan_type === "count" || (student.meal_plan_type == null && student.meal_plan === 0)

    if (!isCountPlan) {
      if (student.weekly_credits === 1) {
        return "destructive" // Light red for 1 credit
      }
      if (student.weekly_credits === 2) {
        return "warning" // Yellow for 2 credits
      }
    }
    return "secondary"
  }

  const getCreditsDisplay = (student: Student) => {
    const isCountPlan =
      student.meal_plan_type === "count" || (student.meal_plan_type == null && student.meal_plan === 0)

    if (isCountPlan) {
      return weeklySwipes !== null ? `${weeklySwipes} swipes this week` : "Loading..."
    } else {
      return `${student.weekly_credits} credits left`
    }
  }

  const getMealPlanDisplay = (student: Student) => {
    const isCountPlan =
      student.meal_plan_type === "count" || (student.meal_plan_type == null && student.meal_plan === 0)
    if (isCountPlan) {
      return "Count Only"
    }
    return `${student.meal_plan} swipes/week`
  }

  const handleCardClick = () => {
    if (currentSession?.id) {
      inputRef.current?.focus()
      console.log("[v0] Card area clicked, focusing input")
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {showMenu && <MenuDisplay />}

      <Card className="border-2" onClick={handleCardClick}>
        <CardHeader className="text-center relative">
          {/* Session info badges - positioned absolutely at top-right */}
          {currentSession && (
            <div className="absolute top-4 right-4 flex gap-2 items-center">
              {/* Re-entry status badge */}
              <Badge variant={currentSession.reentry_enabled ? "default" : "secondary"} className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />
                {currentSession.reentry_enabled ? "Re-entry" : "No Re-entry"}
              </Badge>
              {/* Location badge */}
              {currentSession.location_name && (
                <Badge variant="outline" className="text-xs">
                  <MapPin className="h-3 w-3 mr-1" />
                  {currentSession.location_name}
                </Badge>
              )}
            </div>
          )}

          <CardTitle className="text-2xl font-bold">Meal Swipe Station</CardTitle>
          <CardDescription>Swipe student ID card or enter UIN manually</CardDescription>
          {currentSession && (
            <div className="mt-2">
              <Badge variant="outline" className="font-bold text-lg">
                Session Swipes: {sessionSwipeCount}
              </Badge>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Swipe card or enter UIN (2-9 digits)"
                  value={uin}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className="text-lg h-12"
                  disabled={isLoading || isSubmitting}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      e.stopPropagation()
                      if (!isLoading && !isSubmitting && uin.length >= 2 && uin.length <= 9 && !isProcessingCardSwipe) {
                        handleUinSubmit()
                      }
                    }
                  }}
                />
                {currentSession?.id && !isLoading && !isSubmitting && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    Ready to scan
                  </div>
                )}
              </div>
              <Button
                type="button"
                size="lg"
                disabled={isLoading || isSubmitting || uin.length < 2 || uin.length > 9 || isProcessingCardSwipe}
                className="px-8"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleUinSubmit()
                }}
              >
                {isLoading ? "Processing..." : "Swipe"}
              </Button>
            </div>
          </div>

          {isProcessingCardSwipe && (
            <Alert className="border-primary">
              <AlertDescription className="text-primary">Reading card data...</AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert
              className={
                message.type === "error"
                  ? "border-destructive"
                  : message.type === "reentry"
                    ? "border-blue-500"
                    : "border-accent"
              }
            >
              <AlertDescription
                className={
                  message.type === "error"
                    ? "text-destructive"
                    : message.type === "reentry"
                      ? "text-blue-500"
                      : "text-accent"
                }
              >
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          {student && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <StudentPhoto
                    photoFilename={student.photo_url}
                    firstName={student.first_name}
                    lastName={student.last_name}
                    size="xl"
                  />

                  <div className="flex-1 space-y-2">
                    <div>
                      <h3 className="text-xl font-semibold">
                        {student.first_name} {student.last_name}
                      </h3>
                      <p className="text-muted-foreground">UIN: {student.uin}</p>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>Room {student.room_number}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-4 w-4" />
                        <span>{getMealPlanDisplay(student)}</span>
                      </div>
                    </div>

                    <div>
                      <Badge
                        className={`text-2xl ${
                          getCreditsBadgeVariant(student) === "warning"
                            ? "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100"
                            : ""
                        }`}
                        variant={
                          getCreditsBadgeVariant(student) === "warning" ? "outline" : getCreditsBadgeVariant(student)
                        }
                      >
                        {getCreditsDisplay(student)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Session Activity</CardTitle>
              <CardDescription>Recent swipes from current session</CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={toggleRecentSwipes}
              disabled={!currentSession?.id || isSubmitting || isLoading}
            >
              {showRecent ? "Hide" : "Show"} Recent Swipes
            </Button>
          </div>
        </CardHeader>

        {showRecent && (
          <CardContent>
            {recentSwipes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No swipes recorded in this session yet</p>
            ) : (
              <div className="space-y-3">
                {recentSwipes.map((swipe, index) => (
                  <div key={swipe.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    {getStatusIcon(swipe.status)}
                    <StudentPhoto
                      photoFilename={swipe.students?.photo_url || swipe.photo_url}
                      firstName={swipe.students?.first_name || swipe.first_name || ""}
                      lastName={swipe.students?.last_name || swipe.last_name || ""}
                      size="sm"
                    />

                    <div className="flex-1">
                      <p className="font-medium">
                        {swipe.students?.first_name || swipe.first_name} {swipe.students?.last_name || swipe.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">UIN: {swipe.student_uin || swipe.uin}</p>
                      <p className="text-sm text-muted-foreground">{new Date(swipe.swiped_at).toLocaleTimeString()}</p>
                    </div>
                    <div className="text-right">
                      {(() => {
                        const studentData = swipe.students
                        const isCountPlan =
                          studentData?.meal_plan_type === "count" ||
                          (studentData?.meal_plan_type == null && studentData?.meal_plan === 0)

                        if (isCountPlan) {
                          const studentUin = swipe.student_uin || swipe.uin
                          const swipesForStudent = recentSwipes.filter(
                            (s) => (s.student_uin || s.uin) === studentUin && s.status === "success",
                          )
                          const swipeIndex = swipesForStudent.findIndex((s) => s.id === swipe.id)
                          const swipeNumber = swipesForStudent.length - swipeIndex

                          return (
                            <Badge variant="secondary" className="mb-1">
                              Swipe #{swipeNumber}
                            </Badge>
                          )
                        } else {
                          const creditsLeft = studentData?.weekly_credits ?? 0
                          const badgeVariant =
                            creditsLeft === 1 ? "destructive" : creditsLeft === 2 ? "outline" : "secondary"
                          const badgeClassName =
                            creditsLeft === 2 ? "bg-yellow-100 text-yellow-800 border-yellow-300" : ""

                          return (
                            <Badge variant={badgeVariant} className={`mb-1 ${badgeClassName}`}>
                              {`${creditsLeft} credits left`}
                            </Badge>
                          )
                        }
                      })()}
                    </div>
                    <Badge variant={swipe.status === "success" ? "default" : "destructive"}>
                      {swipe.status.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
