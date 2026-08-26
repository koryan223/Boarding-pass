"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Square, Clock, Users, RefreshCw, AlertTriangle, MapPin } from "lucide-react"
import {
  startSession,
  endSession,
  getAllOpenSessions,
  joinSession,
  getSessionSwipeCount,
  type Session,
} from "@/lib/sessions"
import { useToast } from "@/hooks/use-toast"
import { useSession } from "@/contexts/session-context"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export function SessionManager() {
  const { currentSession, setCurrentSession, sessionSwipeCount, resetSwipeCount, setSwipeCount } = useSession()
  const [isOpenSessionsDialogOpen, setIsOpenSessionsDialogOpen] = useState(false)
  const [openSessions, setOpenSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(false)
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false)
  const [sessionTitle, setSessionTitle] = useState("")
  const [sessionDescription, setSessionDescription] = useState("")
  const [reentryEnabled, setReentryEnabled] = useState<"enabled" | "disabled">("enabled") // Updated default value to "enabled"
  const [selectedLocationId, setSelectedLocationId] = useState<string>("")
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sessionDuration, setSessionDuration] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    // Placeholder for checking current session logic
    // This should ideally be replaced with logic that fetches the current session from the context or API
  }, [])

  useEffect(() => {
    if (!currentSession) return

    const updateDuration = () => {
      const startTime = new Date(currentSession.started_at)
      const now = new Date()
      const diffMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60))
      const hours = Math.floor(diffMinutes / 60)
      const minutes = diffMinutes % 60
      setSessionDuration(hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`)
    }

    updateDuration()
    const interval = setInterval(updateDuration, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [currentSession])

  useEffect(() => {
    if (isStartDialogOpen) {
      fetchLocations()
    }
  }, [isStartDialogOpen])

  const fetchLocations = async () => {
    try {
      console.log("[v0] Fetching locations...")
      const response = await fetch("/api/locations")
      const result = await response.json()
      console.log("[v0] Locations response:", result)
      if (result.success) {
        setLocations(result.locations || [])
        console.log("[v0] Loaded locations:", result.locations?.length || 0)
      } else {
        console.error("[v0] Failed to fetch locations:", result.error)
      }
    } catch (error) {
      console.error("[v0] Error fetching locations:", error)
    }
  }

  const handleStartButtonClick = async () => {
    console.log("[v0] handleStartButtonClick called")
    setIsLoading(true)
    const { data, error } = await getAllOpenSessions()
    console.log("[v0] getAllOpenSessions result:", { data, error })
    setIsLoading(false)

    if (error) {
      console.log("[v0] Error fetching open sessions:", error)
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      })
      return
    }

    if (data && data.length > 0) {
      console.log("[v0] Found open sessions, showing dialog")
      setOpenSessions(data)
      setSelectedSessionId(null)
      setIsOpenSessionsDialogOpen(true)
    } else {
      console.log("[v0] No open sessions, showing start dialog")
      setIsStartDialogOpen(true)
    }
  }

  const handleJoinSession = async () => {
    if (!selectedSessionId) {
      toast({
        title: "Error",
        description: "Please select a session to join",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    const { data, error } = await joinSession(selectedSessionId)

    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      })
      setIsLoading(false)
    } else {
      setCurrentSession(data)
      if (data?.id) {
        const { count } = await getSessionSwipeCount(data.id)
        setSwipeCount(count)
      } else {
        resetSwipeCount()
      }
      setIsLoading(false)
      setIsOpenSessionsDialogOpen(false)
      setSelectedSessionId(null)
      toast({
        title: "Session Joined",
        description: `Joined session: ${data?.title}`,
      })
    }
  }

  const handleStartNewSession = () => {
    setIsOpenSessionsDialogOpen(false)
    setIsStartDialogOpen(true)
  }

  const formatSessionDuration = (startedAt: string) => {
    const startTime = new Date(startedAt)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60))
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  const handleStartSession = async () => {
    console.log("[v0] handleStartSession called with:", { sessionTitle, reentryEnabled, selectedLocationId })
    if (!sessionTitle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a session title",
        variant: "destructive",
      })
      return
    }

    if (!selectedLocationId) {
      toast({
        title: "Error",
        description: "Please select a location for this session",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    const { data, error } = await startSession(sessionTitle.trim(), reentryEnabled === "enabled", selectedLocationId)
    console.log("[v0] startSession result:", { data, error })

    if (error) {
      console.log("[v0] startSession error:", error)
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    if (data) {
      console.log("[v0] Session started successfully:", data)
      setCurrentSession(data)
      resetSwipeCount()
      setIsStartDialogOpen(false)
      setSessionTitle("")
      setReentryEnabled("enabled") // Reset reentry to "enabled" after starting session
      setSelectedLocationId("")
      toast({
        title: "Session Started",
        description: `Started session: ${sessionTitle}${reentryEnabled === "enabled" ? " (Re-entry enabled)" : ""}`,
      })
    }
    setIsLoading(false)
  }

  const handleEndSession = async () => {
    if (!currentSession) return

    setIsLoading(true)
    const { error } = await endSession(currentSession.id, sessionDescription.trim() || undefined)

    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      })
    } else {
      setCurrentSession(null)
      resetSwipeCount()
      setIsEndDialogOpen(false)
      setSessionDescription("")
      toast({
        title: "Session Ended",
        description: "Your session has been saved successfully",
      })
    }
    setIsLoading(false)
  }

  return (
    <div className="flex items-center gap-2">
      {currentSession ? (
        <>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {sessionDuration}
          </Badge>

          <Button
            onClick={() => setIsEndDialogOpen(true)}
            variant="destructive"
            size="sm"
            className="flex items-center gap-1"
          >
            <Square className="h-3 w-3" />
            End Session
          </Button>
        </>
      ) : (
        <Button
          onClick={handleStartButtonClick}
          variant="default"
          size="sm"
          className="flex items-center gap-1"
          disabled={isLoading}
        >
          <Play className="h-3 w-3" />
          {isLoading ? "Checking..." : "Start Session"}
        </Button>
      )}

      <Dialog open={isOpenSessionsDialogOpen} onOpenChange={setIsOpenSessionsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Open Sessions Found
            </DialogTitle>
            <DialogDescription>
              There {openSessions.length === 1 ? "is" : "are"} {openSessions.length} open session
              {openSessions.length !== 1 ? "s" : ""}. Would you like to join an existing session or start a new one?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <RadioGroup value={selectedSessionId || ""} onValueChange={setSelectedSessionId}>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {openSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSessionId === session.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    <RadioGroupItem value={session.id} id={session.id} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={session.id} className="font-medium cursor-pointer">
                        {session.title}
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatSessionDuration(session.started_at)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Started {new Date(session.started_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleStartNewSession} className="w-full sm:w-auto bg-transparent">
              Start New Session
            </Button>
            <Button onClick={handleJoinSession} disabled={!selectedSessionId || isLoading} className="w-full sm:w-auto">
              {isLoading ? "Joining..." : "Join Selected Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Session</DialogTitle>
            <DialogDescription>Enter a title for your work session to begin tracking your time.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="session-title">Session Title</Label>
              <Input
                id="session-title"
                placeholder="e.g., Morning shift, Data entry, Student support"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleStartSession()
                  }
                }}
              />
            </div>
            <div
              className={`p-4 rounded-lg border-2 transition-all ${
                reentryEnabled === "enabled"
                  ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                  : "border-red-500 bg-red-50 dark:bg-red-950/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {reentryEnabled === "enabled" ? (
                  <RefreshCw className="h-5 w-5 text-green-600 dark:text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500" />
                )}
                <Label htmlFor="reentry-select" className="text-base font-semibold">
                  Re-entry Function
                </Label>
              </div>
              <Select
                value={reentryEnabled}
                onValueChange={(value: "enabled" | "disabled") => setReentryEnabled(value)}
              >
                <SelectTrigger
                  id="reentry-select"
                  className={`w-full ${
                    reentryEnabled === "enabled"
                      ? "border-green-500 focus:ring-green-500"
                      : "border-red-500 focus:ring-red-500"
                  }`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="font-medium">Disabled</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="enabled">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-green-600" />
                      <span className="font-medium">Enabled</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-2">
                {reentryEnabled === "enabled"
                  ? "Students can re-enter within 1 hour without using additional credits"
                  : "Students will use credits for every entry"}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location-select" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger id="location-select">
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">Every session must be assigned to a location</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStartDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartSession} disabled={isLoading}>
              {isLoading ? "Starting..." : "Start Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEndDialogOpen} onOpenChange={setIsEndDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Session</DialogTitle>
            <DialogDescription>Add an optional description for your session before ending it.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="session-description">Description (Optional)</Label>
              <Textarea
                id="session-description"
                placeholder="What did you accomplish during this session?"
                value={sessionDescription}
                onChange={(e) => setSessionDescription(e.target.value)}
                rows={3}
              />
            </div>
            {currentSession && (
              <div className="text-sm text-muted-foreground">
                Session: {currentSession.title} • Duration: {sessionDuration} • Swipes: {sessionSwipeCount}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEndDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEndSession} disabled={isLoading}>
              {isLoading ? "Ending..." : "End Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
