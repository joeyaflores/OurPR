"use client";

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User } from '@supabase/supabase-js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddEditPrForm } from '@/components/discover/AddEditPrForm'; // Reuse the form
import { toast } from "sonner";
import { format } from 'date-fns';
import { motion } from "framer-motion"; // Import motion
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { Separator } from "@/components/ui/separator"; // Import Separator

// Assuming API returns PlannedRaceDetail similar to plan/page.tsx
// Define it here or import if centralized
import type { PlannedRaceDetail } from '@/types/planned_race'; // Assuming this type exists and is correct
import type { UserPr } from '@/types/user_pr'; // Use the existing UserPr type

// --- Gamification Helper Imports ---
import {
  differenceInWeeks,
  formatDistanceToNowStrict,
  isFuture,
  parseISO,
  compareAsc,
  startOfWeek,
  subWeeks,
} from 'date-fns';
import { Progress } from "@/components/ui/progress"; // Import Progress component
import { Target, CalendarClock, Trophy, Sparkles } from 'lucide-react'; // Icons for new card

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

// Helper function to parse HH:MM:SS or MM:SS string to seconds
function parseTimeToSeconds(timeString: string): number {
  if (!timeString || !/^(\d{1,2}:)?([0-5]?\d):([0-5]?\d)$/.test(timeString)) {
    throw new Error("Invalid time format. Use HH:MM:SS or MM:SS.");
  }
  const parts = timeString.split(':').map(Number);
  let hours = 0, minutes = 0, seconds = 0;
  if (parts.length === 3) { [hours, minutes, seconds] = parts; }
  else { [minutes, seconds] = parts; }
  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || minutes >= 60 || seconds >= 60) {
    throw new Error("Invalid time values.");
  }
  return hours * 3600 + minutes * 60 + seconds;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

interface UserDashboardProps {
  user: User;
}

// --- Loading Skeleton Component ---
const DashboardSkeleton = () => (
  <motion.div
    initial={{ opacity: 0.5 }}
    animate={{ opacity: [0.5, 1, 0.5] }} // Pulse animation
    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    className="space-y-8 w-full"
  >
    <Skeleton className="h-8 w-3/4 rounded-md" /> {/* Welcome message */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Races Card Skeleton (Updated style for focus card) */}
      <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
        <CardHeader>
          <Skeleton className="h-6 w-1/2 rounded-md" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-4 min-h-[150px]">
          <Skeleton className="h-6 w-full rounded-md" /> {/* Race Name + Countdown */}
          <Skeleton className="h-4 w-5/6 rounded-md" /> {/* Date/Location */}
          <Skeleton className="h-px w-full rounded-full" /> {/* Separator */}
          <div className="grid grid-cols-2 gap-4">
             <Skeleton className="h-10 w-full rounded-md" /> {/* Distance */}
             <Skeleton className="h-10 w-full rounded-md" /> {/* PR */}
          </div>
          <Skeleton className="h-6 w-full rounded-md" /> {/* Progress Bar Area */}
        </CardContent>
        <CardFooter>
          <Skeleton className="h-9 w-32 rounded-md" />
        </CardFooter>
      </Card>
      {/* PRs Card Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/2 rounded-md" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-3 min-h-[150px]"> {/* Adjusted min-height */}
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-5/6 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
        </CardContent>
        <CardFooter className="flex gap-2 justify-start">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </CardFooter>
      </Card>
    </div>
  </motion.div>
);


export default function UserDashboard({ user }: UserDashboardProps) {
  // --- State ---
  const [allPlannedRaces, setAllPlannedRaces] = useState<PlannedRaceDetail[]>([]); // All races from API
  const [nextUpcomingRace, setNextUpcomingRace] = useState<PlannedRaceDetail | null>(null); // The single next race
  const [allUserPrs, setAllUserPrs] = useState<UserPr[]>([]); // All user PRs
  const [recentPrs, setRecentPrs] = useState<UserPr[]>([]); // For the recent PRs card
  const [relevantPr, setRelevantPr] = useState<UserPr | null>(null); // PR matching the next race distance
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // --- Dialog State (remains the same) ---
  const [isPrDialogOpen, setIsPrDialogOpen] = useState(false);
  const [editingPr, setEditingPr] = useState<UserPr | null>(null); // Use UserPr type
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Fetch Data Logic (Updated) ---
  const fetchData = useCallback(async () => {
    console.log("UserDashboard: Fetching data (Enhanced)...");
    setIsLoading(true);
    setFetchError(null);
    setNextUpcomingRace(null); // Reset derived state
    setRelevantPr(null);     // Reset derived state

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== user.id) {
        throw new Error("Session mismatch or user not found.");
      }
      const accessToken = session.access_token;

      // --- Fetch Plan and PRs Concurrently ---
      const planUrl = `${API_BASE_URL}/api/users/me/plan/`;
      const headers = { 'Authorization': `Bearer ${accessToken}` };

      // Fetch all PRs using Supabase client
      const prsPromise = supabase
        .from('user_prs')
        .select('id, user_id, race_id, distance, date, time_in_seconds, created_at, updated_at, is_official, race_name') // Use UserPr fields
        .eq('user_id', user.id)
        .order('date', { ascending: false }); // Order by date desc

      // Fetch full plan details using API
      const planPromise = fetch(planUrl, { headers });

      // Await both promises
      const [prsResponse, planHttpResponse] = await Promise.all([prsPromise, planPromise]);

      // --- Process PRs Response ---
      if (prsResponse.error) {
        throw new Error(`Failed to load user PRs: ${prsResponse.error.message}`);
      }
      const allFetchedPrs: UserPr[] = prsResponse.data || [];
      setAllUserPrs(allFetchedPrs);
      setRecentPrs(allFetchedPrs.slice(0, 3)); // Update recent PRs slice

      // --- Process Plan Response ---
      let fetchedPlannedRaces: PlannedRaceDetail[] = [];
      if (!planHttpResponse.ok) {
        // Handle 404 for plan specifically (no races added yet)
        if (planHttpResponse.status !== 404) {
          const planErrorData = await planHttpResponse.json().catch(() => ({ detail: 'Failed to fetch plan data.' }));
          throw new Error(`Plan Fetch Error: ${planErrorData.detail || planHttpResponse.statusText}`);
        } else {
          // 404 is okay, means empty plan
          setAllPlannedRaces([]); // Set to empty array
        }
      } else {
        fetchedPlannedRaces = await planHttpResponse.json();
        setAllPlannedRaces(fetchedPlannedRaces);
      }

      // --- Process and Find Next Race + Relevant PR ---
      if (fetchedPlannedRaces.length > 0) {
        const futureRaces = fetchedPlannedRaces
          .filter(race => race.date && isFuture(parseISO(race.date)))
          .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date))); // Sort ascending by date

        if (futureRaces.length > 0) {
          const nextRace = futureRaces[0];
          setNextUpcomingRace(nextRace);
          console.log("Next upcoming race:", nextRace);

          // Find the relevant PR
          const matchingPr = allFetchedPrs.find(pr => pr.distance === nextRace.distance);
          setRelevantPr(matchingPr || null);
           console.log("Relevant PR for next race:", matchingPr);
        }
      }

    } catch (error: any) {
      console.error("UserDashboard: Error fetching data:", error);
      setFetchError(error.message || "Failed to load your dashboard data.");
      // Reset states on error
      setAllPlannedRaces([]);
      setNextUpcomingRace(null);
      setAllUserPrs([]);
      setRecentPrs([]);
      setRelevantPr(null);
    } finally {
      setIsLoading(false);
    }
  }, [user.id, supabase]); // Dependencies remain the same

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  // --- Dialog Handlers (remain the same) ---
  const handleOpenPrDialog = (pr: UserPr | null = null) => {
    setEditingPr(pr);
    setIsPrDialogOpen(true);
  };

  const handleClosePrDialog = () => {
    setIsPrDialogOpen(false);
    setEditingPr(null);
  };

   // --- Submit Handler (Create/Update PR) ---
   const handlePrFormSubmit = async (values: any, prId?: string) => {
     setIsSubmitting(true);
     const { data: { session } } = await supabase.auth.getSession();
     if (!session) {
       toast.error("Authentication error. Please log in again.");
       setIsSubmitting(false);
       return;
     }

     let timeInSeconds;
     try {
         timeInSeconds = parseTimeToSeconds(values.time);
     } catch (error: any) {
         toast.error(error.message || "Invalid time format.");
         setIsSubmitting(false);
         return;
     }

     // Construct payload - Use UserPr fields
     const prPayload = {
       user_id: session.user.id, // This comes from session
       distance: values.distance,
       date: format(values.date, 'yyyy-MM-dd'), // Ensure date is formatted correctly
       time_in_seconds: timeInSeconds,
       is_official: values.is_official,
       race_name: values.race_name || null,
       // race_id: values.race_id || null, // Include if your form collects this
     };

     const url = prId
       ? `${API_BASE_URL}/api/users/me/prs/${prId}`
       : `${API_BASE_URL}/api/users/me/prs`;
     const method = prId ? 'PUT' : 'POST';

     // --- Construct Body (Adapt based on UserPrUpdate model) ---
     let requestBody;
     if (method === 'PUT') {
         const putPayload: Record<string, any> = {};
         // Check which fields are present in the form values and add them
         if (values.distance) putPayload.distance = values.distance; // Note: distance might not be updatable typically
         if (values.date) putPayload.date = format(values.date, 'yyyy-MM-dd');
         if (timeInSeconds !== undefined && !isNaN(timeInSeconds)) {
             putPayload.time_in_seconds = timeInSeconds;
         }
         if (values.is_official !== undefined) {
             putPayload.is_official = values.is_official;
         }
         if (values.race_name !== undefined) {
             putPayload.race_name = values.race_name || null;
         }
        // Add other updatable fields from UserPrUpdate if necessary

         if (Object.keys(putPayload).length === 0) {
            toast.info("No changes detected to save.");
            setIsSubmitting(false);
            return;
         }
         requestBody = JSON.stringify(putPayload);
     } else {
         // POST uses the full prPayload
         requestBody = JSON.stringify(prPayload);
     }

     try {
       const response = await fetch(url, {
         method: method,
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${session.access_token}`,
         },
         body: requestBody,
       });

       if (!response.ok) {
         const errorData = await response.json();
         throw new Error(errorData.detail || `Failed to ${prId ? 'update' : 'create'} PR.`);
       }

       toast.success(`PR successfully ${prId ? 'updated' : 'added'}!`);
       handleClosePrDialog();
       fetchData(); // Re-fetch data to update dashboard

     } catch (error: any) {
       console.error(`Error ${prId ? 'updating' : 'creating'} PR:`, error);
       toast.error(error.message || `An error occurred while ${prId ? 'updating' : 'creating'} the PR.`);
     } finally {
       setIsSubmitting(false);
     }
   };

  // --- Delete Handler (remain the same) ---
  const handleDeletePr = async (prId: string) => {
    // ... (keep existing handleDeletePr logic)
     setIsSubmitting(true);
     const { data: { session } } = await supabase.auth.getSession();
     if (!session) { /* ... error handling ... */ return; }

     const url = `${API_BASE_URL}/api/users/me/prs/${prId}`;
     console.log(`Deleting PR from Dashboard: ${url}`);
     try {
         const response = await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session.access_token}` }});
         if (response.status === 204) {
             toast.success("PR successfully deleted!");
             handleClosePrDialog();
             fetchData(); // Refresh dashboard
         } else {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.detail || `Failed to delete PR (Status: ${response.status}).`);
          }
     } catch (error: any) {
          console.error("Error deleting PR:", error);
          toast.error(error.message || "An error occurred while deleting the PR.");
      } finally {
         setIsSubmitting(false);
      }
  };


  // --- Calculate Progress Logic ---
  let progressPercent: number | null = null;
  let currentWeekNumber: number | null = null;
  let totalPlanWeeks: number | null = null;
  let timeUntilRaceString: string | null = null;

  if (nextUpcomingRace?.date && nextUpcomingRace.total_weeks && nextUpcomingRace.total_weeks > 0) {
    const raceDate = parseISO(nextUpcomingRace.date);
    totalPlanWeeks = nextUpcomingRace.total_weeks;
    const startDate = startOfWeek(subWeeks(raceDate, totalPlanWeeks), { weekStartsOn: 1 }); // Assuming week starts Monday
    const weeksPassed = differenceInWeeks(new Date(), startDate, { roundingMethod: 'floor' });
    const boundedWeeksPassed = Math.max(0, Math.min(weeksPassed, totalPlanWeeks));
    currentWeekNumber = Math.min(boundedWeeksPassed + 1, totalPlanWeeks);
    progressPercent = (boundedWeeksPassed / totalPlanWeeks) * 100;
    // Calculate countdown
    timeUntilRaceString = formatDistanceToNowStrict(raceDate, { addSuffix: true });

  } else if (nextUpcomingRace?.date) {
     // Still show countdown even if no plan details
     timeUntilRaceString = formatDistanceToNowStrict(parseISO(nextUpcomingRace.date), { addSuffix: true });
  }


  // --- Render Logic ---
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 w-full">
       {/* --- PR Dialog (remains the same) --- */}
        <Dialog open={isPrDialogOpen} onOpenChange={setIsPrDialogOpen}>
            <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => { if (isSubmitting) e.preventDefault(); }}>
            <DialogHeader>
                <DialogTitle>{editingPr ? 'Edit PR' : 'Log New PR'}</DialogTitle>
                <DialogDescription>
                 {editingPr ? 'Update your personal record.' : 'Add a new personal best to your timeline.'}
                </DialogDescription>
            </DialogHeader>
            <AddEditPrForm
                key={editingPr?.id || 'add-home'}
                prToEdit={editingPr} // Pass UserPr directly
                onSubmit={handlePrFormSubmit}
                onCancel={handleClosePrDialog}
                onDelete={handleDeletePr}
                isSubmitting={isSubmitting}
            />
            </DialogContent>
        </Dialog>


      <h1 className="text-3xl font-bold tracking-tight">
        Welcome back, {user.email?.split('@')[0] || 'Runner'}!
      </h1>

      {fetchError && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive text-lg">Error Loading Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{fetchError}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* --- NEW: Next Upcoming Race Focus Card --- */}
        <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Your Next Race Focus
            </CardTitle>
            {nextUpcomingRace ? (
                 <CardDescription>Get ready for the {nextUpcomingRace.name}!</CardDescription>
            ) : (
                <CardDescription>Plan your next race to unlock training insights.</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4 min-h-[150px]">
            {nextUpcomingRace ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-lg">{nextUpcomingRace.name}</span>
                   {timeUntilRaceString && (
                        <Badge variant="default" className="text-sm whitespace-nowrap">
                            <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
                            {timeUntilRaceString}
                        </Badge>
                   )}
                </div>
                 <div className="text-sm text-muted-foreground">
                   {new Date(nextUpcomingRace.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                   {nextUpcomingRace.city && `, ${nextUpcomingRace.city}`}
                   {nextUpcomingRace.state && `, ${nextUpcomingRace.state}`}
                 </div>

                <Separator />

                 <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground mb-1">Distance</p>
                        <p className="font-medium">{nextUpcomingRace.distance}</p>
                    </div>
                     <div>
                        <p className="text-muted-foreground mb-1">Your PR ({nextUpcomingRace.distance})</p>
                        <p className="font-medium flex items-center gap-1.5">
                           <Trophy className={`w-4 h-4 ${relevantPr ? 'text-amber-500' : 'text-muted-foreground/50'}`} />
                           {relevantPr ? formatTime(relevantPr.time_in_seconds) : "Not Logged"}
                         </p>
                    </div>
                 </div>

                {/* --- Plan Progress --- */}
                 {totalPlanWeeks !== null && currentWeekNumber !== null && progressPercent !== null && nextUpcomingRace.has_generated_plan && (
                   <div className="space-y-2 pt-2">
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-muted-foreground">Training Plan Progress</span>
                       <span className="font-medium">Week {currentWeekNumber} of {totalPlanWeeks}</span>
                     </div>
                     <Progress value={progressPercent} aria-label={`Training plan progress ${progressPercent}%`} />
                   </div>
                 )}
                 {totalPlanWeeks !== null && !nextUpcomingRace.has_generated_plan && (
                    <div className="text-center text-xs text-muted-foreground pt-2 flex items-center justify-center gap-2">
                         <Sparkles className="w-3.5 h-3.5 text-primary/80" />
                         Generate a plan on the 'My Plan' page for weekly guidance!
                     </div>
                 )}

              </>
            ) : (
              <div className="text-center text-muted-foreground text-sm space-y-2 pt-6">
                 <p>No upcoming races found in your plan.</p>
                 <p>Add your next goal race to stay focused!</p>
               </div>
            )}
          </CardContent>
          <CardFooter>
            <Link href="/plan" passHref>
              <Button size="sm" variant="default">
                  View My Plan
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* --- Existing Recent PRs Card (Adjusted) --- */}
        <Card>
          <CardHeader>
            <CardTitle>Recent PRs</CardTitle>
            <CardDescription>Your latest personal records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 min-h-[150px]"> {/* Adjusted min-height */}
            {recentPrs.length > 0 ? (
              recentPrs.map((pr) => ( // Use recentPrs state (slice of allUserPrs)
                <div key={pr.id} className="flex justify-between items-center text-sm">
                  <div className="flex-1 truncate mr-2">
                     <span className="font-medium">{pr.distance}</span>
                     {pr.race_name && <span className="text-muted-foreground text-xs ml-1">({pr.race_name})</span>}
                  </div>
                  <Badge variant="secondary" className="mx-2 whitespace-nowrap">{formatTime(pr.time_in_seconds)}</Badge>
                   <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-6 px-1.5 text-muted-foreground"
                      onClick={() => handleOpenPrDialog(pr)} // Pass UserPr
                   >
                      Edit
                   </Button>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground text-sm space-y-2 pt-6">
                <p>Log your first Personal Record ⏱️</p>
                <p>Track your progress and celebrate achievements!</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-2 justify-start">
             <Button
                variant="secondary"
                size="sm"
                onClick={() => handleOpenPrDialog()} // Open dialog in Add mode
            >
                Log New PR
             </Button>
             {/* TODO: Link to a full PR timeline page */}
             <Link href="/pr-timeline" passHref>
                <Button variant="outline" size="sm" /* disabled={allUserPrs.length === 0} */>
                   View All PRs
                </Button>
             </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 