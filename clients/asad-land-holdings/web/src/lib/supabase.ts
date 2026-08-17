import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-safe instance — uses the anon key, respects Row Level Security.
// Use this in client components and anywhere reading public-safe data
// (e.g. the `public_properties` view).
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-only instance — uses the service role key, BYPASSES Row Level Security.
// Only import this inside API routes / server components, never in client code,
// since the service role key must never reach the browser.
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey)
}