"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getAllGroupsClient, type GroupWithStats } from "@/lib/group-management-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Loader2, ArrowLeft } from "lucide-react"
import { CreateGroupDialog } from "@/components/groups/create-group-dialog"
import { Badge } from "@/components/ui/badge"

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadGroups()
  }, [])

  const loadGroups = async () => {
    try {
      setIsLoading(true)
      const data = await getAllGroupsClient()
      setGroups(data)
    } catch (error) {
      console.error("Error loading groups:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Group Management</h1>
            <p className="text-muted-foreground">Organize students into groups and track their meal swipe statistics</p>
          </div>
        </div>
        <CreateGroupDialog onGroupCreated={loadGroups} />
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
            <p className="text-muted-foreground mb-4">Create your first group to get started</p>
            <CreateGroupDialog onGroupCreated={loadGroups} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="line-clamp-1">{group.name}</CardTitle>
                    <CardDescription className="line-clamp-2 mt-1">
                      {group.description || "No description"}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    <Users className="h-3 w-3 mr-1" />
                    {group.student_count || 0}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {group.student_count === 1 ? "1 student" : `${group.student_count || 0} students`}
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/groups/${group.id}`}>View Details</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
