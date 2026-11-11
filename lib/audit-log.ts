export const AUDIT_ACTION_LABELS = {
  INSERT: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  TRUNCATE: "Cleared",
  SIGN_IN: "Signed in",
  SIGN_OUT: "Session ended",
  SIGN_UP: "Account created",
  PASSWORD_CHANGE: "Password changed",
  EMAIL_CHANGE: "Email changed",
  ACCOUNT_DELETED: "Account deleted",
  EXPORT: "Exported data",
} as const

export const AUDIT_AREA_LABELS = {
  students: "Student",
  meal_swipes: "Meal swipe",
  sessions: "Session",
  session_resumes: "Session join",
  menus: "Menu",
  groups: "Group",
  locations: "Location",
  user_roles: "User role",
  user_location_access: "Location access",
  student_pins: "Student PIN",
  meal_credit_reset_log: "Credit reset",
  student_deletion_log: "Deletion record",
  "auth.users": "Account",
  "auth.sessions": "Sign-in",
} as const

const FIELD_LABELS: Record<string, string> = {
  uin: "UIN",
  student_uin: "Student UIN",
  base_location_id: "Base location",
  ip: "IP address",
  db_role: "Database role",
  from: "From",
  to: "To",
}

export interface AuditEntry {
  id: number
  occurred_at: string
  actor_type: "user" | "anonymous" | "system" | "database"
  actor_id: string | null
  actor_email: string | null
  actor_role: string | null
  action: string
  table_name: string | null
  record_id: string | null
  record_label: string | null
  changed_fields: string[] | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

export interface AuditLogPage {
  entries: AuditEntry[]
  nextCursor: number | null
  /** Display names for the group, location and session ids that appear in the entries. */
  names: Record<string, string>
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

export function actionLabel(action: string): string {
  return (AUDIT_ACTION_LABELS as Record<string, string>)[action] ?? action
}

export function areaLabel(tableName: string | null): string | null {
  if (!tableName) return null
  return (AUDIT_AREA_LABELS as Record<string, string>)[tableName] ?? tableName
}

export function actorLabel(entry: AuditEntry): string {
  if (entry.actor_type === "user") return entry.actor_email ?? "Deleted user"
  if (entry.actor_type === "anonymous") return "Not signed in"
  if (entry.actor_type === "database") return "Direct database access"
  const source = entry.metadata?.source
  if (source === "scheduled job") return "Scheduled job"
  if (source === "auth service") return "Sign-in service"
  return "App server"
}

export function fieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field]
  const words = field.replace(/_id$/, "").replace(/_/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function formatAuditTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(iso))
}

export function isEmptyAuditValue(value: unknown): boolean {
  return value === null || value === undefined || value === ""
}

export function formatAuditValue(value: unknown, names: Record<string, string> = {}): string {
  if (isEmptyAuditValue(value)) return "empty"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") {
    if (names[value]) return names[value]
    if (ISO_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value))) return formatAuditTime(value)
    return value
  }
  if (Array.isArray(value)) return value.map((item) => formatAuditValue(item, names)).join(", ")
  return JSON.stringify(value)
}

/** The fields an entry is about: only the changed ones for an update, every field otherwise. */
export function entryFields(entry: AuditEntry): string[] {
  if (entry.changed_fields?.length) return entry.changed_fields
  return Object.keys(entry.new_data ?? entry.old_data ?? {})
}

export function isFieldChange(entry: AuditEntry): boolean {
  return entry.old_data !== null && entry.new_data !== null
}
