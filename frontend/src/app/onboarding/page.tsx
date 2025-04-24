import { createClient } from '@/lib/supabase/server'; // Use server client
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import OnboardingFormClient from '@/components/onboarding/OnboardingFormClient'; // Import the client component

export default async function OnboardingPage() {
  // Await cookies() before passing to createClient
  const cookieStore = await cookies(); 
  const supabase = createClient(cookieStore);

  // 1. Get User Session - Use getUser() for server-side verification
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  // Handle potential user fetch error
  if (userError) {
      console.error("Error getting user:", userError.message);
      // Redirect to login or an error page if user cannot be verified
      redirect('/login?error=user_fetch_failed');
  }

  // If no user is returned after checking with the server, redirect to login
  if (!user) {
    console.log("Onboarding Page: No verified user found, redirecting to login.");
    redirect('/login');
  }

  // 2. Check if User Already Has a Goal Record
  const { data: goal, error: goalError } = await supabase
    .from('user_goals') 
    .select('id') // Select minimal field
    .eq('user_id', user.id) // Use user.id from getUser()
    .maybeSingle(); // Fetch one or null

  if (goalError) {
    console.error("Error checking user goal status:", goalError.message);
    // Consider redirecting to an error page or logging significantly
    // Allowing to proceed might be confusing if goal check consistently fails
    // For now, proceed to form, but log prominently
    console.error("Proceeding to onboarding despite error checking goal status.")
  }

  // 3. Redirect if Goal Exists (is truthy)
  if (goal) {
      console.log(`Onboarding Page: User ${user.id} already onboarded. Redirecting.`);
      redirect('/discover'); 
  }

  // 4. Render the Client Component if No Goal Exists
  console.log(`Onboarding Page: User ${user.id} needs onboarding. Rendering form.`);
  return <OnboardingFormClient />;
} 