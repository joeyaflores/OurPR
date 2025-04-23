import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Define Supabase URL and anon key from environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Basic validation
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase URL or Anon Key in environment variables.");
  }

  // Create and return the browser client
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
} 