import { createClient } from '@/lib/supabase/server'; // Use server client
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import OnboardingFormClient from '@/components/onboarding/OnboardingFormClient'; // Import the client component

export default async function OnboardingPage() {
  // Await cookies() before passing to createClient
  const cookieStore = await cookies(); 
  const supabase = createClient(cookieStore);

  // 1. Get User Session
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) {
      console.error("Onboarding Page: Error getting user:", userError.message);
      redirect('/login?error=user_fetch_failed');
  }
  if (!user) {
    console.log("Onboarding Page: No verified user found, redirecting to login.");
    redirect('/login');
  }

  // <<< Log User ID >>>
  console.log(`Onboarding Page: Checking goal status for user ID: ${user.id}`);

  // 2. Check if User Already Has a Goal Record
  let goal, goalError;
  try {
      const result = await supabase
        .from('user_goals') 
        .select('id') // Select minimal field
        .eq('user_id', user.id) // Use user.id from getUser()
        .maybeSingle(); // Fetch one or null
      goal = result.data;
      goalError = result.error;
      // <<< Log Query Result >>>
      console.log(`Onboarding Page: Goal query result for user ${user.id} - Data:`, goal, "Error:", goalError);
  } catch (queryError) {
       console.error(`Onboarding Page: Exception during goal query for user ${user.id}:`, queryError);
       goal = null; // Assume no goal if query itself fails
       goalError = queryError; // Store the exception
  }

  if (goalError) {
    // Logged above
    console.error("Onboarding Page: Proceeding to onboarding despite error checking goal status.")
  }

  // 3. Redirect if Goal Exists (is truthy)
  // <<< Log Check Outcome >>>
  console.log(`Onboarding Page: Evaluating redirect condition. Does goal exist? ${!!goal}`);
  if (goal) {
      console.log(`Onboarding Page: User ${user.id} has goal data (${JSON.stringify(goal)}). Redirecting to /discover.`);
      redirect('/discover'); 
  }

  // 4. Render the Client Component if No Goal Exists
  console.log(`Onboarding Page: User ${user.id} needs onboarding. Rendering form.`);
  return <OnboardingFormClient />;
} 