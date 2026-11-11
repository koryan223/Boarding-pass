import { createClient } from "@supabase/supabase-js"

// Changes made with the service key carry no user identity, so the database's
// audit triggers cannot tell who made them. This header names the signed-in
// user; the database trusts it only when the request uses the service key.
const AUDIT_ACTOR_HEADER = "x-audit-actor"

async function getSignedInUserId(): Promise<string | null> {
  try {
    const { createServerClient } = await import("@/lib/supabase/server")
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

function isDatabaseWrite(input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
  if (method === "GET" || method === "HEAD") return false
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  return new URL(url).pathname.startsWith("/rest/v1/")
}

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase admin environment variables. Please check your environment configuration.")
  }

  let signedInUserId: Promise<string | null> | undefined

  const fetchWithAuditActor: typeof fetch = async (input, init) => {
    if (!isDatabaseWrite(input, init)) return fetch(input, init)

    signedInUserId ??= getSignedInUserId()
    const userId = await signedInUserId
    if (!userId) return fetch(input, init)

    const headers = new Headers(init?.headers)
    headers.set(AUDIT_ACTOR_HEADER, userId)
    return fetch(input, { ...init, headers })
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: fetchWithAuditActor,
    },
  })
}
