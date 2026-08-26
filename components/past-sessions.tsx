"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Clock, Users, Calendar, Eye, Trash2, MapPin, AlertTriangle, Undo2, RefreshCw } from "lucide-react"
import {
  getUserSessions,
  getSessionAffectedStudents,
  deleteSessionWithOptions,
  type AffectedStudent,
  calculateDuration,
} from "@/lib/sessions"
import type { MealSwipe } from "@/lib/meal-swipes"
import type { SessionResume } from "@/lib/sessions"
import type { Session } from "@/lib/sessions"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

function PastSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [sessionSwipes, setSessionSwipes] = useState<MealSwipe[]>([])
  const [sessionResumes, setSessionResumes] = useState<SessionResume[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSwipesLoading, setIsSwipesLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<{
    id: string
    title: string
    swipeCount: number
  } | null>(null)
  const [affectedStudents, setAffectedStudents] = useState<AffectedStudent[]>([])
  const [totalCreditsToRestore, setTotalCreditsToRestore] = useState(0)
  const [totalCountSwipes, setTotalCountSwipes] = useState(0)
  const [canRestoreCredits, setCanRestoreCredits] = useState(false)
  const [isLoadingAffected, setIsLoadingAffected] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadSessions()
  }, [])

  useEffect(() => {
    const handleFocus = () => {
      loadSessions()
    }

    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [])

  const loadSessions = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await getUserSessions()
      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        })
        return
      }

      if (data) {
        const completedSessions = data.filter((session) => session.ended_at)
        setSessions(completedSessions)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load sessions",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadSessionSwipes = async (session: Session) => {
    setSelectedSession(session)
    setIsDialogOpen(true)
    setIsSwipesLoading(true)

    try {
      const response = await fetch(`/api/session-swipes?sessionId=${session.id}`)
      const result = await response.json()

      if (result.success) {
        setSessionSwipes(result.swipes)
        setSessionResumes(result.resumes || [])
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to load session swipes",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load session swipes",
        variant: "destructive",
      })
    } finally {
      setIsSwipesLoading(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "MM/dd/yyyy HH:mm")
  }

  const formatDuration = (startedAt: string, endedAt?: string | null) => {
    if (!endedAt) return "In Progress"
    const minutes = calculateDuration(startedAt, endedAt)
    if (!minutes) return "N/A"
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h === 0) return `${m}m`
    return `${h}h ${m}m`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge variant="default" className="bg-green-500">
            Success
          </Badge>
        )
      case "reentry":
        return (
          <Badge variant="default" className="bg-blue-500">
            Re-entry
          </Badge>
        )
      case "insufficient_credits":
        return <Badge variant="destructive">No Credits</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const createTimeline = () => {
    const timeline: Array<
      { type: "swipe"; data: MealSwipe; timestamp: string } | { type: "resume"; data: SessionResume; timestamp: string }
    > = []

    sessionSwipes.forEach((swipe) => {
      timeline.push({ type: "swipe", data: swipe, timestamp: swipe.swiped_at })
    })

    sessionResumes.forEach((resume) => {
      timeline.push({ type: "resume", data: resume, timestamp: resume.resumed_at })
    })

    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return timeline
  }

  const openDeleteDialog = async (sessionId: string, sessionTitle: string, swipeCount: number) => {
    setSessionToDelete({ id: sessionId, title: sessionTitle, swipeCount })
    setDeleteDialogOpen(true)
    setIsLoadingAffected(true)
    setAffectedStudents([])
    setTotalCreditsToRestore(0)
    setTotalCountSwipes(0)
    setCanRestoreCredits(false)

    const {
      data,
      totalCredits,
      totalCountSwipes: countSwipes,
      canRestoreCredits: canRestore,
      error,
    } = await getSessionAffectedStudents(sessionId)

    if (!error && data) {
      setAffectedStudents(data)
      setTotalCreditsToRestore(totalCredits)
      setTotalCountSwipes(countSwipes)
      setCanRestoreCredits(canRestore)
    }

    setIsLoadingAffected(false)
  }

  const handleDeleteSession = async (restoreCredits: boolean) => {
    if (!sessionToDelete) return

    setIsDeleting(true)

    console.log("[v0] handleDeleteSession: About to delete session", sessionToDelete.id)

    const { error } = await deleteSessionWithOptions(sessionToDelete.id, restoreCredits)

    if (error) {
      toast({
        title: "Error",
        description: `Failed to delete session: ${error}`,
        variant: "destructive",
      })
      setIsDeleting(false)
      return
    }

    console.log("[v0] handleDeleteSession: Updating local state, sessions before:", sessions.length)
    setSessions(sessions.filter((s) => s.id !== sessionToDelete.id))
    console.log(
      "[v0] handleDeleteSession: Sessions after filter:",
      sessions.filter((s) => s.id !== sessionToDelete.id).length,
    )

    if (selectedSession?.id === sessionToDelete.id) {
      setSelectedSession(null)
      setSessionSwipes([])
      setSessionResumes([])
      setIsDialogOpen(false)
    }

    let successMessage = "Session deleted successfully"
    if (restoreCredits) {
      const parts = []
      if (totalCreditsToRestore > 0) parts.push(`${totalCreditsToRestore} credits restored`)
      if (totalCountSwipes > 0) parts.push(`${totalCountSwipes} count swipes deducted`)
      successMessage = `Session deleted. ${parts.join(", ")}`
    }

    toast({
      title: "Success",
      description: successMessage,
    })

    setDeleteDialogOpen(false)
    setSessionToDelete(null)
    setIsDeleting(false)

    console.log("[v0] handleDeleteSession: Waiting 500ms before reload...")
    await new Promise((resolve) => setTimeout(resolve, 500))
    console.log("[v0] handleDeleteSession: Reloading sessions...")
    await loadSessions()
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Past Sessions
          </CardTitle>
          <CardDescription>Loading your session history...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Past Sessions
          </CardTitle>
          <CardDescription>View your completed work sessions and their meal swipe history</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No completed sessions found</p>
              <p className="text-sm">Start a session to begin tracking your work</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Session Name</TableHead>
                    <TableHead className="w-[180px]">Date & Time</TableHead>
                    <TableHead className="w-[100px]">Duration</TableHead>
                    <TableHead className="w-[100px]">Re-Entry</TableHead>
                    <TableHead className="w-[100px]">Total Swipes</TableHead>
                    <TableHead className="w-[150px]">Location</TableHead>
                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id} className="hover:bg-muted/50">
                      {/* Session Name */}
                      <TableCell className="font-medium" title={session.title}>
                        <div className="truncate max-w-[240px]">{session.title}</div>
                      </TableCell>

                      {/* Date/Time */}
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{formatDateTime(session.started_at)}</span>
                        </div>
                      </TableCell>

                      {/* Duration */}
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{formatDuration(session.started_at, session.ended_at)}</span>
                        </div>
                      </TableCell>

                      {/* Re-Entry Status */}
                      <TableCell>
                        <Badge
                          variant={session.reentry_enabled ? "default" : "secondary"}
                          className={session.reentry_enabled ? "bg-green-500" : "bg-gray-400"}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          {session.reentry_enabled ? "On" : "Off"}
                        </Badge>
                      </TableCell>

                      {/* Total Swipes */}
                      <TableCell>
                        <Badge variant="secondary">
                          <Users className="h-3 w-3 mr-1" />
                          {session.swipe_count || 0}
                        </Badge>
                      </TableCell>

                      {/* Location */}
                      <TableCell>
                        {session.location_name ? (
                          <Badge variant="outline">
                            <MapPin className="h-3 w-3 mr-1" />
                            {session.location_name}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="outline" size="sm" onClick={() => loadSessionSwipes(session)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 bg-transparent"
                            onClick={() => openDeleteDialog(session.id, session.title, session.swipe_count || 0)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {selectedSession?.title}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              <span>{selectedSession && formatDateTime(selectedSession.started_at)}</span>
              <span>•</span>
              <span>{selectedSession && formatDuration(selectedSession.started_at, selectedSession.ended_at)}</span>
              <span>•</span>
              <Badge
                variant={selectedSession?.reentry_enabled ? "default" : "secondary"}
                className={selectedSession?.reentry_enabled ? "bg-green-500" : ""}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Re-entry {selectedSession?.reentry_enabled ? "On" : "Off"}
              </Badge>
              {selectedSession?.location_name && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {selectedSession.location_name}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedSession?.description && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground break-words">{selectedSession.description}</p>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Meal Swipes ({sessionSwipes.length})
            </h4>

            {isSwipesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : sessionSwipes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No meal swipes recorded for this session</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>UIN</TableHead>
                      <TableHead>Meal Plan</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {createTimeline().map((item, index) => {
                      if (item.type === "resume") {
                        return (
                          <TableRow key={`resume-${item.data.id}`} className="bg-blue-50 dark:bg-blue-950/20">
                            <TableCell colSpan={6} className="text-center">
                              <div className="flex items-center justify-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                                <Clock className="h-4 w-4" />
                                Session Resumed at {format(new Date(item.data.resumed_at), "HH:mm:ss")}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      }

                      const swipe = item.data as MealSwipe
                      return (
                        <TableRow key={swipe.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(swipe.swiped_at), "HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            {swipe.students?.first_name} {swipe.students?.last_name}
                          </TableCell>
                          <TableCell className="font-mono">{swipe.student_uin}</TableCell>
                          <TableCell>
                            {swipe.students?.meal_plan_type === "count" || swipe.students?.meal_plan === 0
                              ? "Count Only"
                              : swipe.students?.meal_plan_type === "prepaid"
                                ? `Prepaid: ${swipe.students?.meal_plan || 0}`
                                : `${swipe.students?.meal_plan || 0}/week`}
                          </TableCell>
                          <TableCell>{swipe.students?.room_number || "N/A"}</TableCell>
                          <TableCell>{getStatusBadge(swipe.status)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Session
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{sessionToDelete?.title}"? This will permanently remove the session and{" "}
              {sessionToDelete?.swipeCount || 0} meal swipe records.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isLoadingAffected ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : affectedStudents.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Students affected:</span>
                  <Badge variant="secondary">{affectedStudents.length} students</Badge>
                </div>
                {totalCreditsToRestore > 0 && (
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Standard plan credits to restore:</span>
                    <Badge variant="default" className="bg-green-500">
                      {totalCreditsToRestore} credits
                    </Badge>
                  </div>
                )}
                {totalCountSwipes > 0 && (
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Count plan swipes to deduct:</span>
                    <Badge variant="default" className="bg-orange-500">
                      {totalCountSwipes} swipes
                    </Badge>
                  </div>
                )}
                {!canRestoreCredits && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4 inline mr-1" />
                      This session is from a previous weekly period. Credits have already been reset and cannot be
                      restored.
                    </p>
                  </div>
                )}
                <ScrollArea className="h-32 rounded-md border p-2">
                  <div className="space-y-1">
                    {affectedStudents.map((student) => (
                      <div key={student.uin} className="flex items-center justify-between text-sm py-1">
                        <span className="text-muted-foreground">
                          {student.name}
                          {student.is_count_plan && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Count
                            </Badge>
                          )}
                        </span>
                        <span className="font-medium">
                          {student.is_count_plan ? (
                            <span className="text-orange-600">
                              -{student.credits_to_restore} swipe{student.credits_to_restore > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-green-600">
                              +{student.credits_to_restore} credit{student.credits_to_restore > 1 ? "s" : ""}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No credits to restore (no successful swipes with credit deduction).
              </p>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {affectedStudents.length > 0 && canRestoreCredits && (
              <Button
                variant="default"
                className="w-full"
                onClick={() => handleDeleteSession(true)}
                disabled={isDeleting}
              >
                <Undo2 className="h-4 w-4 mr-2" />
                {isDeleting ? (
                  "Deleting..."
                ) : (
                  <>
                    Delete & {totalCreditsToRestore > 0 && `Restore ${totalCreditsToRestore} Credits`}
                    {totalCreditsToRestore > 0 && totalCountSwipes > 0 && " / "}
                    {totalCountSwipes > 0 && `Deduct ${totalCountSwipes} Swipes`}
                  </>
                )}
              </Button>
            )}
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => handleDeleteSession(false)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? "Deleting..." : "Delete Only (No Refund)"}
            </Button>
            <Button
              variant="outline"
              className="w-full bg-transparent"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export { PastSessions }
