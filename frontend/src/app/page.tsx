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
// --- Remove lucide-react and framer-motion imports, moved to LandingPage ---
// import { Activity, Search, Trophy, CalendarClock, Sparkles } from 'lucide-react';
// import { motion } from 'framer-motion';
// --- Import the new LandingPage component ---
import { LandingPage } from '@/components/home/LandingPage';

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
    <main className="flex min-h-screen flex-col items-center">
        {user ? (
        // --- Logged In View ---
        // Add padding back for dashboard
        <div className="w-full max-w-6xl p-6 md:p-12 lg:p-24">
          <UserDashboard user={user} />
        </div>
      ) : (
        // Render the new LandingPage component for logged-out users
        <LandingPage />
        )}
    </main>
  );
}
