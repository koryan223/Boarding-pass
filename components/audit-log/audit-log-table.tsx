"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  actionLabel,
  actorLabel,
  areaLabel,
  entryFields,
  fieldLabel,
  formatAuditTime,
  formatAuditValue,
  isEmptyAuditValue,
  isFieldChange,
  type AuditEntry,
} from "@/lib/audit-log"

const SUMMARY_FIELD_LIMIT = 2
const DESTRUCTIVE_ACTIONS = new Set(["DELETE", "TRUNCATE", "ACCOUNT_DELETED"])
const CREATIVE_ACTIONS = new Set(["INSERT", "SIGN_UP"])

type Names = Record<string, string>

function badgeVariant(action: string) {
  if (DESTRUCTIVE_ACTIONS.has(action)) return "destructive" as const
  if (CREATIVE_ACTIONS.has(action)) return "default" as const
  if (action === "UPDATE") return "secondary" as const
  return "outline" as const
}

function entrySubject(entry: AuditEntry) {
  if (entry.record_label) return entry.record_label
  // A sign-in's record id is an internal session id, which means nothing to a reader.
  return entry.table_name?.startsWith("auth.") ? null : entry.record_id
}

function AuditValue({ value, names }: { value: unknown; names: Names }) {
  if (isEmptyAuditValue(value)) return <span className="italic text-muted-foreground">empty</span>
  return <span className="break-words">{formatAuditValue(value, names)}</span>
}

function AuditEntryDetails({ entry, names }: { entry: AuditEntry; names: Names }) {
  const fields = entryFields(entry)
  const showsChange = isFieldChange(entry)
  const context: [string, unknown][] = [
    ["Entry", `#${entry.id}`],
    ...(entry.record_id ? ([["Record ID", entry.record_id]] as [string, unknown][]) : []),
    ...Object.entries(entry.metadata ?? {}).map(([key, value]) => [fieldLabel(key), value] as [string, unknown]),
  ]

  return (
    <div className="flex flex-col gap-4 py-2 whitespace-normal">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        {context.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>
              <AuditValue value={value} names={names} />
            </dd>
          </div>
        ))}
      </dl>

      {fields.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              {showsChange ? (
                <>
                  <TableHead>Before</TableHead>
                  <TableHead>After</TableHead>
                </>
              ) : (
                <TableHead>Value</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field) => (
              <TableRow key={field}>
                <TableCell className="font-medium align-top">{fieldLabel(field)}</TableCell>
                {showsChange ? (
                  <>
                    <TableCell className="whitespace-normal align-top">
                      <AuditValue value={entry.old_data?.[field]} names={names} />
                    </TableCell>
                    <TableCell className="whitespace-normal align-top">
                      <AuditValue value={entry.new_data?.[field]} names={names} />
                    </TableCell>
                  </>
                ) : (
                  <TableCell className="whitespace-normal align-top">
                    <AuditValue value={(entry.new_data ?? entry.old_data)?.[field]} names={names} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function AuditEntryRow({ entry, names }: { entry: AuditEntry; names: Names }) {
  const [open, setOpen] = useState(false)
  const detailsId = `audit-entry-${entry.id}`
  const area = areaLabel(entry.table_name)
  const subject = entrySubject(entry)
  const changedFields = isFieldChange(entry) ? entryFields(entry) : []
  const hiddenFieldCount = changedFields.length - SUMMARY_FIELD_LIMIT

  return (
    <>
      <TableRow>
        <TableCell className="align-top whitespace-nowrap">{formatAuditTime(entry.occurred_at)}</TableCell>
        <TableCell className="align-top">
          <div className="font-medium">{actorLabel(entry)}</div>
          {entry.actor_role && (
            <div className="text-xs text-muted-foreground capitalize">{entry.actor_role.replace(/_/g, " ")}</div>
          )}
        </TableCell>
        <TableCell className="align-top">
          <Badge variant={badgeVariant(entry.action)}>{actionLabel(entry.action)}</Badge>
        </TableCell>
        <TableCell className="align-top whitespace-normal min-w-64">
          <div>
            {area && <span className="font-medium">{area}</span>}
            {area && subject && <span className="text-muted-foreground">{" \u00b7 "}</span>}
            {subject && <span className="break-words">{subject}</span>}
          </div>
          {changedFields.length > 0 && (
            <ul className="text-xs text-muted-foreground">
              {changedFields.slice(0, SUMMARY_FIELD_LIMIT).map((field) => (
                <li key={field} className="break-words">
                  {fieldLabel(field)}: {formatAuditValue(entry.old_data?.[field], names)}
                  {" \u2192 "}
                  {formatAuditValue(entry.new_data?.[field], names)}
                </li>
              ))}
              {hiddenFieldCount > 0 && (
                <li>
                  +{hiddenFieldCount} more {hiddenFieldCount === 1 ? "field" : "fields"}
                </li>
              )}
            </ul>
          )}
        </TableCell>
        <TableCell className="align-top text-right">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            aria-controls={open ? detailsId : undefined}
            onClick={() => setOpen(!open)}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            <span className="sr-only">
              {open ? "Hide" : "Show"} details for entry {entry.id}
            </span>
          </Button>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow id={detailsId} className="bg-muted/50 hover:bg-muted/50">
          <TableCell colSpan={5}>
            <AuditEntryDetails entry={entry} names={names} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function AuditLogTable({ entries, names }: { entries: AuditEntry[]; names: Names }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Who</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>What</TableHead>
          <TableHead>
            <span className="sr-only">Details</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <AuditEntryRow key={entry.id} entry={entry} names={names} />
        ))}
      </TableBody>
    </Table>
  )
}
