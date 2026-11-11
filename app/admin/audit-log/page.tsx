import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { requireRole } from "@/lib/auth-server"
import { Button } from "@/components/ui/button"
import { AuditLogViewer } from "@/components/audit-log/audit-log-viewer"

export const metadata: Metadata = {
  title: "Audit Log",
  description: "A record of every change and sign-in, visible to administrators only.",
}

export default async function AuditLogPage() {
  await requireRole(["admin"])

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/admin">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">Every change and sign-in, who made it, and when</p>
      </div>

      <AuditLogViewer />
    </div>
  )
}
