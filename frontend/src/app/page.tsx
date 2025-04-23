import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server'; // Corrected import name
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge'; // For potentially showing race dates
import { User } from '@supabase/supabase-js'; // Import User type

// Helper function (can be moved to utils later)
function formatTime(totalSeconds: number | null): string {
  if (totalSeconds === null || isNaN(totalSeconds) || totalSeconds < 0) {
    return "--:--";
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const paddedHours = String(hours).padStart(2, '0');
    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
  } else {
    return `${paddedMinutes}:${paddedSeconds}`;
  }
}

// Define types for fetched data (adjust based on actual Supabase response)
type PlannedRace = {
  id: string; // plan entry id
  races: { // Expecting a single race object or null, matching runtime data
    id: string;
    name: string;
    date: string;
  } | null; 
};

type RecentPr = {
  id: string;
  distance: string;
  time_in_seconds: number;
  date: string;
};

// Main Home component - now async for server-side fetching
export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  let plannedRaces: PlannedRace[] = [];
  let recentPrs: RecentPr[] = [];
  let fetchError: string | null = null;

  // Use getUser() for server-side authentication check
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error("Home Page: Error getting user:", userError);
    // fetchError = "Could not verify authentication status.";
    // Potentially set user to null explicitly if needed, though it should be null from getUser data
  }
  
  if (user) { // Check the user object returned from getUser()
    try {
      // Fetch upcoming planned races (limit 3)
      // Assuming 'races' table has 'id', 'name', 'date'
      // Assuming 'user_race_plans' table has 'id', 'user_id', 'race_id'
      const { data: racesData, error: racesError } = await supabase
        .from('user_race_plans')
        .select(`
          id,
          races ( id, name, date )
        `)
        .eq('user_id', user.id)
        // .gte('races.date', new Date().toISOString()) // Filter for future races
        .order('date', { ascending: true, foreignTable: 'races' })
        .limit(3);

      if (racesError) throw racesError;
      console.log("Raw racesData from Supabase (Homepage):", JSON.stringify(racesData, null, 2)); // Log raw data
      
      // Assign directly, using double type assertion to satisfy strict TS check
      plannedRaces = (racesData as unknown as PlannedRace[]) || []; 
      
      console.log("Final plannedRaces (Homepage):", JSON.stringify(plannedRaces, null, 2)); // Log final data

      // Fetch recent PRs (limit 3)
      const { data: prsData, error: prsError } = await supabase
        .from('user_prs')
        .select('id, distance, time_in_seconds, date')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(3);

      if (prsError) throw prsError;
      recentPrs = prsData || [];

    } catch (error: any) {
      console.error("Home Page: Error fetching user data:", error);
      fetchError = "Failed to load your dashboard data.";
      // Reset data on error
      plannedRaces = [];
      recentPrs = [];
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 lg:p-24 bg-gradient-to-b from-background to-muted/50">
      <div className="w-full max-w-4xl">
        {/* --- Logged In View --- */}
        {user ? (
          <div className="space-y-8">
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back, {user.email?.split('@')[0] || 'Runner'}!
            </h1>
            
            {fetchError && (
              <Card className="border-destructive bg-destructive/10">
                <CardHeader>
                  <CardTitle className="text-destructive text-lg">Error</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{fetchError}</p>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Upcoming Races Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Planned Races</CardTitle>
                  <CardDescription>Your next few races on the calendar.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {plannedRaces.length > 0 ? (
                    plannedRaces.map((plan) => (
                      plan.races && (
                        <div key={plan.id} className="flex justify-between items-center text-sm">
                          <span>{plan.races.name}</span>
                          <Badge variant="outline">{new Date(plan.races.date + 'T00:00:00').toLocaleDateString()}</Badge>
                        </div>
                      )
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No upcoming races planned yet.</p>
                  )}
                </CardContent>
                <CardFooter>
                   <Link href="/discover" passHref legacyBehavior>
                      <Button variant="outline" size="sm">Discover More Races</Button>
                   </Link>
                   {/* Add Link to 'My Plan' page later */}
                </CardFooter>
              </Card>

              {/* Recent PRs Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent PRs</CardTitle>
                  <CardDescription>Your latest personal records.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentPrs.length > 0 ? (
                    recentPrs.map((pr) => (
                      <div key={pr.id} className="flex justify-between items-center text-sm">
                        <span>{pr.distance}</span>
                        <Badge variant="secondary">{formatTime(pr.time_in_seconds)}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No personal records logged yet.</p>
                  )}
                </CardContent>
                <CardFooter>
                   {/* Add Link to 'My PRs' page later */}
                   <Button variant="outline" size="sm" disabled>View All PRs</Button> 
                </CardFooter>
              </Card>
            </div>
          </div>
        ) : (
          /* --- Logged Out View --- */
          (<div className="flex flex-col items-center text-center">
            <Card className="w-full max-w-2xl mb-12">
              <CardHeader>
                <CardTitle className="text-4xl font-bold tracking-tight">
                  🏃‍♂️ OurPR
                </CardTitle>
                <CardDescription className="text-lg">
                  AI-Powered Race Discovery & Training Platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Discover races perfectly matched to your goals, plan your season,
                  track your progress, and connect with fellow runners.
                  Unlock your potential with OurPR.
                </p>
              </CardContent>
              <CardFooter className="flex justify-center gap-4">
                <Link href="/login" passHref legacyBehavior>
                  <Button>Log In</Button>
                </Link>
                 <Link href="/sign-up" passHref legacyBehavior>
                   <Button variant="outline">Sign Up</Button>
                 </Link>
              </CardFooter>
            </Card>
            {/* Feature Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
               <div className="flex flex-col items-center">
                  <h3 className="text-xl font-semibold mb-2">AI Race Finder</h3>
                  <p className="text-muted-foreground text-sm">
                     Tell us what you're looking for in plain language and let our AI find the perfect race.
                  </p>
               </div>
               <div className="flex flex-col items-center">
                  <h3 className="text-xl font-semibold mb-2">Season Planning</h3>
                  <p className="text-muted-foreground text-sm">
                     Add races to your plan, visualize your schedule, and stay organized.
                  </p>
               </div>
               <div className="flex flex-col items-center">
                  <h3 className="text-xl font-semibold mb-2">PR Tracking</h3>
                  <p className="text-muted-foreground text-sm">
                     Log your personal records and monitor your improvement over time.
                  </p>
               </div>
            </div>
          </div>)
        )}
      </div>
    </main>
  );
}
