import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let clientInstance: SupabaseClient | null = null

export function createBrowserClient(): SupabaseClient {
  // Return existing instance if available
  if (clientInstance) {
    return clientInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

  if (!supabaseUrl || !supabaseKey) {
    console.warn(
      "[v0] Supabase environment variables not available in preview. Deploy to Vercel for full functionality.",
    )
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        signInWithPassword: async () => ({
          data: { user: null, session: null },
          error: { message: "Supabase not available in preview" },
        }),
        signUp: async () => ({
          data: { user: null, session: null },
          error: { message: "Supabase not available in preview" },
        }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        resetPasswordForEmail: async () => ({ data: {}, error: null }),
        updateUser: async () => ({ data: { user: null }, error: null }),
        setSession: async () => ({ data: { session: null, user: null }, error: null }),
      },
      from: () => ({
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => Promise.resolve({ data: null, error: { message: "Supabase not available in preview" } }),
        update: () => Promise.resolve({ data: null, error: { message: "Supabase not available in preview" } }),
        delete: () => Promise.resolve({ data: null, error: { message: "Supabase not available in preview" } }),
        upsert: () => Promise.resolve({ data: null, error: { message: "Supabase not available in preview" } }),
        eq: function () {
          return this
        },
        single: function () {
          return this
        },
        maybeSingle: function () {
          return this
        },
        order: function () {
          return this
        },
        limit: function () {
          return this
        },
      }),
    } as unknown as SupabaseClient
  }

  clientInstance = createSupabaseBrowserClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Handle auth errors gracefully - redirect to login on session expiry
      onAuthError: (error) => {
        console.log("[v0] Supabase auth error:", error.message)
        const msg = (error.message || "").toLowerCase()
        if (msg.includes("expired") || msg.includes("invalid") || msg.includes("jwt") || msg.includes("refresh")) {
          // Clear any stale auth cookies
          if (typeof document !== "undefined") {
            document.cookie.split(";").forEach((c) => {
              const name = c.trim().split("=")[0]
              if (name.includes("sb-") || name.includes("auth")) {
                document.cookie = `${name}=; Max-Age=-1; path=/`
              }
            })
          }
          // Redirect to login
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth/")) {
            window.location.href = "/auth/login"
          }
        }
      },
    },
    cookies: {
      get(name: string) {
        if (typeof document === "undefined") return undefined
        const value = `; ${document.cookie}`
        const parts = value.split(`; ${name}=`)
        if (parts.length === 2) return parts.pop()?.split(";").shift()
      },
      set(
        name: string,
        value: string,
        options: { maxAge?: number; path?: string; domain?: string; secure?: boolean; sameSite?: string },
      ) {
        if (typeof document === "undefined") return
        let cookie = `${name}=${value}`
        if (options?.maxAge) cookie += `; Max-Age=${options.maxAge}`
        if (options?.path) cookie += `; Path=${options.path}`
        if (options?.domain) cookie += `; Domain=${options.domain}`
        if (options?.secure) cookie += "; Secure"
        if (options?.sameSite) cookie += `; SameSite=${options.sameSite}`
        document.cookie = cookie
      },
      remove(
        name: string,
        options: { maxAge?: number; path?: string; domain?: string; secure?: boolean; sameSite?: string },
      ) {
        if (typeof document === "undefined") return
        this.set(name, "", { ...options, maxAge: -1 })
      },
    },
  })

  return clientInstance
}

export const createClient = createBrowserClient
export const initSupabase = async () => createBrowserClient()
