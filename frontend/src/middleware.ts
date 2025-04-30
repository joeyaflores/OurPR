import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Define Supabase URL and anon key from environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Basic validation
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Middleware Error: Missing Supabase URL or Anon Key.");
    // Allow request to proceed but log error, or redirect to an error page
    return NextResponse.next({ request }); 
  }

  // Initialize response object using request
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Create Supabase client for middleware
  const supabase = createServerClient(
    supabaseUrl, supabaseAnonKey,
    {
      cookies: {
        getAll() {
          // Get cookies from the incoming request
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Set cookies on the outgoing request and response
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          // Clone the response to be able to set cookies on it
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid running code between createServerClient and supabase.auth.getUser()

  // Refresh session if expired - **IMPORTANT!**
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect to login if user is not logged in and not on auth pages
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') // Assuming /auth/callback is used
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    console.log('Redirecting to login page...');
    return NextResponse.redirect(url)
  }

  // IMPORTANT: Return the potentially modified supabaseResponse
  return supabaseResponse
}

// Configure the middleware matcher
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt (robots file)
     * - sitemap.xml (sitemap file)
     * - api (API routes, handled by backend)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
} 