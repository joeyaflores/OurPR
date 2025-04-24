import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // if "next" is in param, use it as the redirect URL (useful for protected routes)
  // const next = searchParams.get('next') ?? '/'; // Original default

  if (code) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Successful login, redirect to the onboarding page 
      // The onboarding page will handle redirecting to /discover if already onboarded
      console.log("Auth successful, redirecting to /onboarding");
      return NextResponse.redirect(`${origin}/onboarding`); 
    } else {
       console.error("Error exchanging code for session:", error.message);
    }
  } else {
     console.error("No code found in callback URL");
  }

  // Default redirect to an error page if something went wrong
  console.log("Auth failed or no code, redirecting to auth error page");
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
} 