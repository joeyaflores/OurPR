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
import UserDashboard from '@/components/home/UserDashboard'; // Import the new component
import type { Metadata } from 'next'; // Import Metadata type

// Add Metadata Export
export const metadata: Metadata = {
  // Title will use default from layout template
  description: 'Your personal running dashboard on Our PR. View recent activity, PRs, upcoming races, and weekly goals.',
  // Add specific OpenGraph details for the home/dashboard page if desired
  openGraph: {
      // title: 'Your Running Dashboard | Our PR', // Example if you want to override layout default
      description: 'View your running progress, upcoming races, and goals on Our PR.',
    },
}

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

  // Get user server-side
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 lg:p-24 bg-gradient-to-b from-background to-muted/50">
      <div className="w-full max-w-4xl">
        {/* --- Conditional Rendering --- */}
        {user ? (
          // Render UserDashboard if logged in, pass user object
          <UserDashboard user={user} />
        ) : (
          /* --- Logged Out View (Keep existing) --- */
          <div className="flex flex-col items-center text-center">
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
                 <Link href="/login" passHref>
                   <Button>Log In</Button>
                 </Link>
                  <Link href="/sign-up" passHref>
                    <Button variant="outline">Sign Up</Button>
                  </Link>
               </CardFooter>
             </Card>
             {/* Feature Highlights (Keep existing) */} 
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
           </div>
        )}
      </div>
    </main>
  );
}
