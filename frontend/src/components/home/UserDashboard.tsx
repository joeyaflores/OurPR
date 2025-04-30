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
import { format, parseISO } from 'date-fns';
import { motion } from "framer-motion"; // Import motion
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { Separator } from "@/components/ui/separator"; // Import Separator
import { EarnedAchievementDetail } from '@/types/achievement'; // Import new type
import AchievementIcon from '@/components/icons/AchievementIcon'; // Import icon component
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // For showing date
import { PlusCircle, Activity, Goal as GoalIcon } from 'lucide-react'; // Icon for Log Workout button, Activity, GoalIcon
import { AddEditWorkoutForm } from '@/components/log/AddEditWorkoutForm'; // Import the new form
import type { Workout } from '@/types/workout'; // Import Workout type
import type { PlannedRaceDetail } from '@/types/planned_race'; // Assuming this type exists and is correct
import type { UserPr } from '@/types/user_pr'; // Use the existing UserPr type
import type { WeeklyGoal } from '@/types/weekly_goal'; // <-- NEW: Import WeeklyGoal type
import { SetEditWeeklyGoalForm } from '@/components/goals/SetEditWeeklyGoalForm'; // <-- NEW: Import goal form

// --- Gamification Helper Imports ---
import {
  differenceInWeeks,
  formatDistanceToNowStrict,
  isFuture,
  compareAsc,
  startOfWeek,
  subWeeks,
  formatRelative, // For formatting earned_at date
  endOfWeek, // <-- NEW: For weekly goal calculation
  isWithinInterval // <-- NEW: For weekly goal calculation
} from 'date-fns';
import { Progress } from "@/components/ui/progress"; // Import Progress component
import { Target, CalendarClock, Trophy, Sparkles, Award as AwardIcon } from 'lucide-react'; // Icons for new card

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

// Helper function to format distance (NEW)
function formatDistance(meters?: number | null): string {
  if (meters === null || meters === undefined || isNaN(meters) || meters <= 0) {
    return "-"; // Or return empty string?
  }
  const kilometers = meters / 1000;
  if (kilometers >= 1) {
    return `${kilometers.toFixed(2)} km`;
  } else {
    return `${meters.toFixed(0)} m`;
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// --- Animation Variants ---
const cardVariants = {
  hidden: { opacity: 0, y: 30 }, // Start hidden and slightly below
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut",
    }
  }
};

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
    <div className="flex justify-end mb-4">
      <Skeleton className="h-10 w-32 rounded-md" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"> {/* Changed to 3 columns */}
      {/* Races Card Skeleton */}
      <Card className="lg:col-span-1 bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
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
      <Card className="lg:col-span-1">
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

      {/* Achievements Card Skeleton */}
       <Card className="lg:col-span-1">
        <CardHeader>
          <Skeleton className="h-6 w-1/2 rounded-md" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-3 min-h-[150px]">
           {/* Simulate a few achievement rows */}
           <div className="flex items-center gap-3">
             <Skeleton className="h-6 w-6 rounded-full" /> {/* Icon */}
             <Skeleton className="h-4 w-4/5 rounded-md" /> {/* Text */}
           </div>
            <div className="flex items-center gap-3">
             <Skeleton className="h-6 w-6 rounded-full" />
             <Skeleton className="h-4 w-3/4 rounded-md" />
           </div>
            <div className="flex items-center gap-3">
             <Skeleton className="h-6 w-6 rounded-full" />
             <Skeleton className="h-4 w-4/6 rounded-md" />
           </div>
        </CardContent>
         <CardFooter>
           <Skeleton className="h-9 w-28 rounded-md" /> {/* View All button */}
         </CardFooter>
       </Card>

      {/* Workouts Card Skeleton (NEW) */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <Skeleton className="h-6 w-1/2 rounded-md" /> {/* Title */}
          <Skeleton className="h-4 w-3/4 rounded-md" /> {/* Description */}
        </CardHeader>
        <CardContent className="space-y-3 min-h-[150px]">
          {/* Simulate a few workout rows */}
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-5/6 rounded-md" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-9 w-28 rounded-md" /> {/* View All button */}
        </CardFooter>
      </Card>

      {/* Weekly Goal Card Skeleton (NEW) */}
       <Card className="lg:col-span-1">
         <CardHeader>
           <Skeleton className="h-6 w-2/3 rounded-md" /> {/* Title */}
           <Skeleton className="h-4 w-1/2 rounded-md" /> {/* Description */}
         </CardHeader>
         <CardContent className="space-y-4 min-h-[150px]">
           {/* Simulate a few progress bars */}
           <div className="space-y-2">
                <Skeleton className="h-4 w-1/3 rounded-md" /> {/* Label */}
                <Skeleton className="h-4 w-full rounded-full" /> {/* Progress Bar */}
           </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-1/4 rounded-md" />
                <Skeleton className="h-4 w-full rounded-full" />
           </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-1/3 rounded-md" />
                <Skeleton className="h-4 w-full rounded-full" />
           </div>
         </CardContent>
         <CardFooter>
           <Skeleton className="h-9 w-32 rounded-md" /> {/* Set Goal button */}
         </CardFooter>
       </Card>

    </div>
  </motion.div>
);

// Interface for progress tracking (NEW)
interface WeeklyProgress {
    distance: number; // meters
    duration: number; // seconds
    workouts: number;
}

export default function UserDashboard({ user }: UserDashboardProps) {
  // --- State ---
  const [allPlannedRaces, setAllPlannedRaces] = useState<PlannedRaceDetail[]>([]);
  const [nextUpcomingRace, setNextUpcomingRace] = useState<PlannedRaceDetail | null>(null);
  const [allUserPrs, setAllUserPrs] = useState<UserPr[]>([]);
  const [recentPrs, setRecentPrs] = useState<UserPr[]>([]);
  const [relevantPr, setRelevantPr] = useState<UserPr | null>(null);
  const [earnedAchievements, setEarnedAchievements] = useState<EarnedAchievementDetail[]>([]); // Add state for achievements
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]); // <-- State for recent workouts
  const [currentWeeklyGoal, setCurrentWeeklyGoal] = useState<WeeklyGoal | null>(null); // <-- NEW: State for weekly goal
  const [weeklyGoalProgress, setWeeklyGoalProgress] = useState<WeeklyProgress>({ distance: 0, duration: 0, workouts: 0 }); // <-- NEW: State for progress
  const [fetchError, setFetchError] = useState<string | null>(null); // General fetch error
  const [fetchWorkoutsError, setFetchWorkoutsError] = useState<string | null>(null); // Specific error for workouts
  const [fetchGoalError, setFetchGoalError] = useState<string | null>(null); // <-- NEW: Specific error for goal
  const [isLoading, setIsLoading] = useState(true); // Overall loading
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(true); // Specific loading for workouts
  const [isLoadingGoal, setIsLoadingGoal] = useState(true); // <-- NEW: Specific loading for goal
  const supabase = createClient();

  // --- Dialog State ---
  const [isPrDialogOpen, setIsPrDialogOpen] = useState(false);
  const [editingPr, setEditingPr] = useState<UserPr | null>(null);
  const [isPrSubmitting, setIsPrSubmitting] = useState(false);

  // --- Dialog State (Workouts) ---
  const [isWorkoutDialogOpen, setIsWorkoutDialogOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null); // State for workout being edited
  const [isWorkoutSubmitting, setIsWorkoutSubmitting] = useState(false); // Separate submitting state

  // --- Dialog State (Weekly Goal) ---
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false); // <-- NEW: Goal dialog state
  const [isGoalSubmitting, setIsGoalSubmitting] = useState(false); // <-- NEW: Goal submitting state

  // --- Fetch Data Logic (Updated) ---
  const fetchData = useCallback(async () => {
    console.log("UserDashboard: Fetching data (Enhanced)...");
    setIsLoading(true);
    setFetchError(null);
    setNextUpcomingRace(null); // Reset derived state
    setRelevantPr(null);     // Reset derived state
    setEarnedAchievements([]); // Reset achievements
    setRecentWorkouts([]); // Reset workouts
    setFetchWorkoutsError(null); // Reset workout error
    setCurrentWeeklyGoal(null); // <-- NEW: Reset weekly goal
    setFetchGoalError(null); // <-- NEW: Reset goal error
    setWeeklyGoalProgress({ distance: 0, duration: 0, workouts: 0 }); // <-- NEW: Reset progress
    setIsLoadingWorkouts(true); // Set workout loading true
    setIsLoadingGoal(true); // <-- NEW: Set goal loading true

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== user.id) {
        throw new Error("Session mismatch or user not found.");
      }
      const accessToken = session.access_token;
      const headers = { 'Authorization': `Bearer ${accessToken}` };

      // --- Define API URLs ---
      const planUrl = `${API_BASE_URL}/api/users/me/plan/`;
      const achievementsUrl = `${API_BASE_URL}/api/users/me/achievements?limit=5`; // Limit initial fetch
      const workoutsUrl = `${API_BASE_URL}/api/users/me/workouts?limit=30`; // Fetch more workouts for weekly calc (adjust limit later maybe)
      const weeklyGoalUrl = `${API_BASE_URL}/api/users/me/weekly-goal`; // <-- NEW: Weekly Goal URL (fetches current week by default)

      // --- Setup Promises ---
      const prsPromise = supabase
        .from('user_prs')
        .select('id, user_id, race_id, distance, date, time_in_seconds, created_at, updated_at, is_official, race_name')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      const planPromise = fetch(planUrl, { headers });
      const achievementsPromise = fetch(achievementsUrl, { headers });
      const workoutsPromise = fetch(workoutsUrl, { headers });
      const weeklyGoalPromise = fetch(weeklyGoalUrl, { headers }); // <-- NEW: Add goal fetch promise

      // --- Await Promises ---
      const [prsResponse, planHttpResponse, achievementsHttpResponse, workoutsHttpResponse, weeklyGoalHttpResponse] = await Promise.all([ // <-- Add weeklyGoalHttpResponse
          prsPromise,
          planPromise,
          achievementsPromise,
          workoutsPromise,
          weeklyGoalPromise // <-- NEW: Await goal promise
      ]);

      // --- Process PRs --- //
      if (prsResponse.error) {
          throw new Error(`Failed to load user PRs: ${prsResponse.error.message}`);
      }
      const allFetchedPrs: UserPr[] = prsResponse.data || [];
      setAllUserPrs(allFetchedPrs);
      setRecentPrs(allFetchedPrs.slice(0, 3));

      // --- Process Plan --- //
      let fetchedPlannedRaces: PlannedRaceDetail[] = [];
      if (!planHttpResponse.ok) {
          if (planHttpResponse.status !== 404) {
              const planErrorData = await planHttpResponse.json().catch(() => ({ detail: 'Failed to fetch plan data.' }));
              // Log error but maybe don't throw, depends on desired behavior if plan fails
              console.error(`Plan Fetch Error: ${planErrorData.detail || planHttpResponse.statusText}`);
          } // 404 is okay, means empty plan, fetchedPlannedRaces remains []
      } else {
          fetchedPlannedRaces = await planHttpResponse.json();
      }
      setAllPlannedRaces(fetchedPlannedRaces); // Set state regardless of success/404

      // --- Process Achievements --- //
      if (!achievementsHttpResponse.ok) {
          const achErrorData = await achievementsHttpResponse.json().catch(() => ({ detail: 'Failed to fetch achievements.' }));
          console.error(`Achievements Fetch Error: ${achErrorData.detail || achievementsHttpResponse.statusText}`);
          // Don't throw, just log. Empty achievements array is fine.
      } else {
          const achievementsData: EarnedAchievementDetail[] = await achievementsHttpResponse.json();
          setEarnedAchievements(achievementsData);
          console.log("Fetched achievements:", achievementsData);
      }

      // --- Process Workouts --- // <-- NEW: Process Workouts Section
      if (!workoutsHttpResponse.ok) {
          const workoutErrorData = await workoutsHttpResponse.json().catch(() => ({ detail: 'Failed to fetch workouts.' }));
          console.error(`Workouts Fetch Error: ${workoutErrorData.detail || workoutsHttpResponse.statusText}`);
          setFetchWorkoutsError(workoutErrorData.detail || workoutsHttpResponse.statusText || "Failed to load recent workouts.");
          // Don't throw, just log and set error state. Empty workouts array is fine.
      } else {
          const workoutsData: Workout[] = await workoutsHttpResponse.json();
          // Sort workouts by date descending client-side just in case API doesn't guarantee order
          workoutsData.sort((a, b) => compareAsc(parseISO(b.date), parseISO(a.date)));
          setRecentWorkouts(workoutsData);
          console.log("Fetched workouts:", workoutsData);
          setFetchWorkoutsError(null); // Clear error on success
      }
      setIsLoadingWorkouts(false); // <-- NEW: Set workout loading false

      // --- Process Weekly Goal --- // <-- NEW: Process Weekly Goal Section
      if (!weeklyGoalHttpResponse.ok) {
           // 404 Not Found is okay, means no goal is set for the week
          if (weeklyGoalHttpResponse.status !== 404) {
              const goalErrorData = await weeklyGoalHttpResponse.json().catch(() => ({ detail: 'Failed to fetch weekly goal.' }));
              console.error(`Weekly Goal Fetch Error: ${goalErrorData.detail || weeklyGoalHttpResponse.statusText}`);
              setFetchGoalError(goalErrorData.detail || weeklyGoalHttpResponse.statusText || "Failed to load weekly goal.");
          }
          setCurrentWeeklyGoal(null); // Ensure goal is null if not found or error
      } else {
          const goalData: WeeklyGoal | null = await weeklyGoalHttpResponse.json(); // API returns null if not found, or the goal object
          setCurrentWeeklyGoal(goalData);
          console.log("Fetched weekly goal:", goalData);
          setFetchGoalError(null); // Clear error on success
      }
      setIsLoadingGoal(false); // <-- NEW: Set goal loading false

      // --- Process Next Race / Relevant PR --- //
      if (fetchedPlannedRaces.length > 0) {
          const futureRaces = fetchedPlannedRaces
              .filter(race => race.date && isFuture(parseISO(race.date)))
              .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)));

          if (futureRaces.length > 0) {
              const nextRace = futureRaces[0];
              setNextUpcomingRace(nextRace);
              // Find the relevant PR
              const matchingPr = allFetchedPrs.find(pr => pr.distance === nextRace.distance);
              setRelevantPr(matchingPr || null);
          }
      }

    } catch (error: any) {
      console.error("UserDashboard: Error fetching data:", error);
      // Handle critical errors like PR fetch failure or auth issues
      setFetchError(error.message || "Failed to load critical dashboard data.");
      // Ensure state is reset
      setAllPlannedRaces([]);
      setNextUpcomingRace(null);
      setAllUserPrs([]);
      setRecentPrs([]);
      setRelevantPr(null);
      setEarnedAchievements([]);
      setRecentWorkouts([]); // <-- NEW: Reset in catch
      setFetchWorkoutsError(error.message || "Failed to load dashboard data."); // Could set specific workout error too
      setCurrentWeeklyGoal(null); // <-- NEW: Reset in catch
      setFetchGoalError(error.message || "Failed to load dashboard data."); // <-- NEW: Set goal error in catch
    } finally {
      setIsLoading(false); // Overall loading
      setIsLoadingWorkouts(false); // Ensure workout loading is false in finally
      setIsLoadingGoal(false); // <-- NEW: Ensure goal loading is false in finally
    }
  }, [user.id, supabase]);

  // --- Calculate Weekly Progress Effect (NEW) ---
  useEffect(() => {
    // Only calculate if workouts are loaded and goal *might* exist (or we know it doesn't)
    if (isLoadingWorkouts || isLoadingGoal) return;

    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday start
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    const workoutsThisWeek = recentWorkouts.filter(workout => {
        try {
            const workoutDate = parseISO(workout.date);
            return isWithinInterval(workoutDate, { start: weekStart, end: weekEnd });
        } catch (e) {
            console.error("Error parsing workout date:", workout.date, e);
            return false;
        }
    });

    const progress: WeeklyProgress = workoutsThisWeek.reduce((acc, workout) => {
        acc.distance += workout.distance_meters ?? 0;
        acc.duration += workout.duration_seconds ?? 0;
        acc.workouts += 1;
        return acc;
    }, { distance: 0, duration: 0, workouts: 0 });

    setWeeklyGoalProgress(progress);

  }, [recentWorkouts, isLoadingWorkouts, isLoadingGoal]); // Rerun when workouts or goal loading state changes

  // --- useEffect Hook ---
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Dialog Handlers (handleOpenPrDialog, handleClosePrDialog) --- //
  const handleOpenPrDialog = (pr: UserPr | null = null) => {
    setEditingPr(pr);
    setIsPrDialogOpen(true);
  };

  const handleClosePrDialog = () => {
    setIsPrDialogOpen(false);
    setEditingPr(null);
  };

  // --- Submit Handler (handlePrFormSubmit) --- //
  const handlePrFormSubmit = async (values: any, prId?: string) => {
     setIsPrSubmitting(true);
     const { data: { session } } = await supabase.auth.getSession();
     if (!session) {
       toast.error("Authentication error. Please log in again.");
       setIsPrSubmitting(false);
       return;
     }

     let timeInSeconds;
     try {
         timeInSeconds = parseTimeToSeconds(values.time);
     } catch (error: any) {
         toast.error(error.message || "Invalid time format.");
         setIsPrSubmitting(false);
         return;
     }

     const prPayload = {
       user_id: session.user.id,
       distance: values.distance,
       date: format(values.date, 'yyyy-MM-dd'),
       time_in_seconds: timeInSeconds,
       is_official: values.is_official,
       race_name: values.race_name || null,
     };

     const url = prId
       ? `${API_BASE_URL}/api/users/me/prs/${prId}`
       : `${API_BASE_URL}/api/users/me/prs`;
     const method = prId ? 'PUT' : 'POST';

     let requestBody;
     if (method === 'PUT') {
         const putPayload: Record<string, any> = {};
         if (values.distance) putPayload.distance = values.distance;
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
         if (Object.keys(putPayload).length === 0) {
            toast.info("No changes detected to save.");
            setIsPrSubmitting(false);
            return;
         }
         requestBody = JSON.stringify(putPayload);
     } else {
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
       // Re-fetch *all* data after successful PR submit to update achievements etc.
       fetchData();

     } catch (error: any) {
       console.error(`Error ${prId ? 'updating' : 'creating'} PR:`, error);
       toast.error(error.message || `An error occurred while ${prId ? 'updating' : 'creating'} the PR.`);
     } finally {
       setIsPrSubmitting(false);
     }
   };

  // --- Delete Handler (handleDeletePr) --- //
  const handleDeletePr = async (prId: string) => {
     setIsPrSubmitting(true);
     const { data: { session } } = await supabase.auth.getSession();
     if (!session) {
         toast.error("Authentication error.");
         setIsPrSubmitting(false);
         return;
      }

     const url = `${API_BASE_URL}/api/users/me/prs/${prId}`;
     try {
         const response = await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session.access_token}` }});
         if (response.status === 204) {
             toast.success("PR successfully deleted!");
             handleClosePrDialog();
             // Re-fetch *all* data after successful delete
             fetchData();
         } else {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.detail || `Failed to delete PR (Status: ${response.status}).`);
          }
     } catch (error: any) {
          console.error("Error deleting PR:", error);
          toast.error(error.message || "An error occurred while deleting the PR.");
      } finally {
         setIsPrSubmitting(false);
      }
  };

  // --- Workout Dialog Handlers ---
  const handleOpenWorkoutDialog = (workout: Workout | null = null) => {
    setEditingWorkout(workout); // Set workout to edit (or null for new)
    setIsWorkoutDialogOpen(true);
  };
  const handleCloseWorkoutDialog = () => {
    setIsWorkoutDialogOpen(false);
    setEditingWorkout(null);
  };
  const handleWorkoutFormSubmit = async (values: any, workoutId?: string) => {
    setIsWorkoutSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        toast.error("Authentication error.");
        setIsWorkoutSubmitting(false);
        return;
    }

    const url = workoutId
       ? `${API_BASE_URL}/api/users/me/workouts/${workoutId}`
       : `${API_BASE_URL}/api/users/me/workouts`;
    const method = workoutId ? 'PUT' : 'POST';

     // Payload constructed in AddEditWorkoutForm is passed in 'values'
     // Ensure date is formatted correctly if not already done in form
     const payload = {
         ...values,
         date: format(new Date(values.date), 'yyyy-MM-dd'), // Ensure correct format
     };

    try {
         const response = await fetch(url, {
             method: method,
             headers: {
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${session.access_token}`,
             },
             body: JSON.stringify(payload),
         });

         if (!response.ok) {
             const errorData = await response.json();
             throw new Error(errorData.detail || `Failed to ${workoutId ? 'update' : 'log'} workout.`);
         }

         toast.success(`Workout successfully ${workoutId ? 'updated' : 'logged'}!`);
         handleCloseWorkoutDialog();
         fetchData(); // Re-fetch data to potentially update recent workouts display later

     } catch (error: any) {
         console.error(`Error ${workoutId ? 'updating' : 'creating'} workout:`, error);
         toast.error(error.message || `An error occurred while ${workoutId ? 'updating' : 'logging'} the workout.`);
     } finally {
         setIsWorkoutSubmitting(false);
     }
  };
 const handleDeleteWorkout = async (workoutId: string) => {
        setIsWorkoutSubmitting(true); // Reuse submitting state
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { toast.error("Auth error"); setIsWorkoutSubmitting(false); return; }

        const url = `${API_BASE_URL}/api/users/me/workouts/${workoutId}`;
        try {
            const response = await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session.access_token}` }});
            if (response.status === 204) {
                toast.success("Workout successfully deleted!");
                handleCloseWorkoutDialog(); // Close workout dialog
                fetchData(); // Re-fetch data
            } else {
                 const errorData = await response.json().catch(() => ({}));
                 throw new Error(errorData.detail || `Failed to delete workout (Status: ${response.status}).`);
             }
        } catch (error: any) {
             console.error("Error deleting workout:", error);
             toast.error(error.message || "An error occurred while deleting the workout.");
         } finally {
            setIsWorkoutSubmitting(false);
        }
    };

  // --- Dialog Handlers (Weekly Goal) ---
  const handleOpenGoalDialog = () => {
      setIsGoalDialogOpen(true);
  };
  const handleCloseGoalDialog = () => {
      if (isGoalSubmitting) return; // Prevent closing while submitting
      setIsGoalDialogOpen(false);
  };

  const handleGoalFormSubmit = async (values: any) => {
      setIsGoalSubmitting(true);
      console.log("Submitting weekly goal:", values);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
          toast.error("Authentication error. Please log in again.");
          setIsGoalSubmitting(false);
          return;
      }

      const url = `${API_BASE_URL}/api/users/me/weekly-goal`; // POST endpoint handles upsert

      try {
           const response = await fetch(url, {
               method: 'POST',
               headers: {
                   'Content-Type': 'application/json',
                   'Authorization': `Bearer ${session.access_token}`,
               },
               body: JSON.stringify(values),
           });

           if (!response.ok) {
               const errorData = await response.json();
               throw new Error(errorData.detail || `Failed to save weekly goal.`);
           }

           toast.success(`Weekly goal successfully saved!`);
           handleCloseGoalDialog();
           fetchData(); // Re-fetch dashboard data to show updated goal/progress

       } catch (error: any) {
           console.error(`Error saving weekly goal:`, error);
           toast.error(error.message || `An error occurred while saving the goal.`);
       } finally {
           setIsGoalSubmitting(false);
       }
    };

  // --- Calculate Progress Logic --- //
  let progressPercent: number | null = null;
  let currentWeekNumber: number | null = null;
  let totalPlanWeeks: number | null = null;
  let timeUntilRaceString: string | null = null;

  if (nextUpcomingRace?.date && nextUpcomingRace.total_weeks && nextUpcomingRace.total_weeks > 0) {
    const raceDate = parseISO(nextUpcomingRace.date);
    totalPlanWeeks = nextUpcomingRace.total_weeks;
    const startDate = startOfWeek(subWeeks(raceDate, totalPlanWeeks), { weekStartsOn: 1 });
    const weeksPassed = differenceInWeeks(new Date(), startDate, { roundingMethod: 'floor' });
    const boundedWeeksPassed = Math.max(0, Math.min(weeksPassed, totalPlanWeeks));
    currentWeekNumber = Math.min(boundedWeeksPassed + 1, totalPlanWeeks);
    progressPercent = (boundedWeeksPassed / totalPlanWeeks) * 100;
    timeUntilRaceString = formatDistanceToNowStrict(raceDate, { addSuffix: true });

  } else if (nextUpcomingRace?.date) {
     timeUntilRaceString = formatDistanceToNowStrict(parseISO(nextUpcomingRace.date), { addSuffix: true });
  }


  // --- Render Logic --- //
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Calculate current week start

  return (
    <TooltipProvider>
        <div className="space-y-8 w-full">
            {/* --- Workout Dialog --- */}
            <Dialog open={isWorkoutDialogOpen} onOpenChange={setIsWorkoutDialogOpen}>
                <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => { if (isWorkoutSubmitting) e.preventDefault(); }}>
                <DialogHeader>
                    <DialogTitle>{editingWorkout ? 'Edit Workout' : 'Log New Workout'}</DialogTitle>
                    <DialogDescription>
                     {editingWorkout ? 'Update the details of your workout.' : 'Add a completed workout to your log.'}
                    </DialogDescription>
                </DialogHeader>
                <AddEditWorkoutForm
                    key={editingWorkout?.id || 'add-workout-home'}
                    workoutToEdit={editingWorkout}
                    onSubmit={handleWorkoutFormSubmit}
                    onCancel={handleCloseWorkoutDialog}
                    onDelete={handleDeleteWorkout} // Pass delete handler
                    isSubmitting={isWorkoutSubmitting}
                />
                </DialogContent>
            </Dialog>

            {/* --- PR Dialog --- */}
             <Dialog open={isPrDialogOpen} onOpenChange={setIsPrDialogOpen}>
               <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => { if (isPrSubmitting) e.preventDefault(); }}>
                 <DialogHeader>
                   <DialogTitle>{editingPr ? 'Edit PR' : 'Log New PR'}</DialogTitle>
                   <DialogDescription>
                    {editingPr ? 'Update your personal record.' : 'Add a new personal best to your timeline.'}
                   </DialogDescription>
                 </DialogHeader>
                 <AddEditPrForm
                   key={editingPr?.id || 'add-home'}
                   prToEdit={editingPr}
                   onSubmit={handlePrFormSubmit}
                   onCancel={handleClosePrDialog}
                   onDelete={handleDeletePr}
                   isSubmitting={isPrSubmitting}
                 />
               </DialogContent>
             </Dialog>

            {/* --- Weekly Goal Dialog --- */}
            <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
               <DialogContent className="sm:max-w-md" onInteractOutside={(e) => { if (isGoalSubmitting) e.preventDefault(); }}>
                 <DialogHeader>
                   <DialogTitle>{currentWeeklyGoal ? 'Edit Weekly Goal' : 'Set Weekly Goal'}</DialogTitle>
                   <DialogDescription>
                     Define your targets for the week starting {format(currentWeekStart, 'MMM do')}.
                   </DialogDescription>
                 </DialogHeader>
                 <SetEditWeeklyGoalForm
                    key={currentWeeklyGoal?.id || `set-${format(currentWeekStart, 'yyyy-MM-dd')}`}
                    goalToEdit={currentWeeklyGoal}
                    weekStartDate={currentWeekStart} // Pass Date object
                    onSubmit={handleGoalFormSubmit}
                    onCancel={handleCloseGoalDialog}
                    isSubmitting={isGoalSubmitting}
                 />
               </DialogContent>
             </Dialog>

            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">
                   Welcome back, {user.email?.split('@')[0] || 'Runner'}!
                </h1>
                 {/* --- Log Workout Button --- */}
                 <Button onClick={() => handleOpenWorkoutDialog()}>
                     <PlusCircle className="mr-2 h-4 w-4" /> Log Workout
                 </Button>
            </div>

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

            {/* --- Grid Layout --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* --- Next Upcoming Race Focus Card --- */}
                 <motion.div
                     variants={cardVariants}
                     initial="hidden"
                     whileInView="visible"
                     viewport={{ once: true, amount: 0.2 }}
                     className="lg:col-span-1" // Apply grid span to motion div
                 >
                     <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20 h-full"> {/* Added h-full */}
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
                           {/* Plan Progress */}
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
                 </motion.div>

                {/* --- Weekly Goal Progress Card --- */}
                <motion.div
                    variants={cardVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    className="lg:col-span-1" // Apply grid span to motion div
                >
                    <Card className="lg:col-span-1 h-full"> {/* Added h-full, removed redundant col-span */}
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <GoalIcon className="w-5 h-5 text-green-600" />
                           This Week's Goal
                        </CardTitle>
                        <CardDescription>
                           Track your progress towards your weekly targets.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 min-h-[150px]">
                        {isLoadingGoal ? (
                            <div className="space-y-4">
                               <div className="space-y-2">
                                   <Skeleton className="h-4 w-1/3 rounded-md" />
                                   <Skeleton className="h-4 w-full rounded-full" />
                               </div>
                               <div className="space-y-2">
                                   <Skeleton className="h-4 w-1/4 rounded-md" />
                                   <Skeleton className="h-4 w-full rounded-full" />
                               </div>
                               <div className="space-y-2">
                                   <Skeleton className="h-4 w-1/3 rounded-md" />
                                   <Skeleton className="h-4 w-full rounded-full" />
                               </div>
                            </div>
                        ) : fetchGoalError ? (
                            <p className="text-destructive text-sm">Error loading goal: {fetchGoalError}</p>
                        ) : !currentWeeklyGoal ? (
                            <div className="text-center text-muted-foreground text-sm space-y-2 pt-6">
                               <p>Set a goal for this week to stay motivated!</p>
                               <Button
                                   variant="secondary"
                                   size="sm"
                                   onClick={handleOpenGoalDialog}
                                >
                                   Set Weekly Goal
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Distance Progress */}
                                {currentWeeklyGoal.target_distance_meters != null && (
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-baseline text-sm">
                                            <span className="font-medium">Distance</span>
                                            <span className="text-muted-foreground text-xs">
                                               {formatDistance(weeklyGoalProgress.distance)} / {formatDistance(currentWeeklyGoal.target_distance_meters)}
                                            </span>
                                        </div>
                                        <Progress
                                            value={(weeklyGoalProgress.distance / (currentWeeklyGoal.target_distance_meters || 1)) * 100}
                                            aria-label="Weekly distance goal progress"
                                        />
                                    </div>
                                )}
                                {/* Duration Progress */}
                                {currentWeeklyGoal.target_duration_seconds != null && (
                                     <div className="space-y-1.5">
                                        <div className="flex justify-between items-baseline text-sm">
                                            <span className="font-medium">Time</span>
                                            <span className="text-muted-foreground text-xs">
                                                {formatTime(weeklyGoalProgress.duration)} / {formatTime(currentWeeklyGoal.target_duration_seconds === undefined ? null : currentWeeklyGoal.target_duration_seconds)}
                                            </span>
                                        </div>
                                        <Progress
                                            value={(weeklyGoalProgress.duration / (currentWeeklyGoal.target_duration_seconds || 1)) * 100}
                                            aria-label="Weekly time goal progress"
                                        />
                                    </div>
                                )}
                                {/* Workouts Progress */}
                                {currentWeeklyGoal.target_workouts != null && (
                                     <div className="space-y-1.5">
                                        <div className="flex justify-between items-baseline text-sm">
                                            <span className="font-medium">Workouts</span>
                                            <span className="text-muted-foreground text-xs">
                                                {weeklyGoalProgress.workouts} / {currentWeeklyGoal.target_workouts}
                                            </span>
                                        </div>
                                        <Progress
                                            value={(weeklyGoalProgress.workouts / (currentWeeklyGoal.target_workouts || 1)) * 100}
                                            aria-label="Weekly workout count goal progress"
                                        />
                                    </div>
                                )}
                                {!currentWeeklyGoal.target_distance_meters && !currentWeeklyGoal.target_duration_seconds && !currentWeeklyGoal.target_workouts && (
                                     <p className="text-sm text-muted-foreground text-center pt-4">No specific targets set for this week's goal.</p>
                                )}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter>
                       <Button
                           variant="outline"
                           size="sm"
                           onClick={handleOpenGoalDialog}
                           disabled={isLoadingGoal}
                        >
                           {currentWeeklyGoal ? "Edit Goal" : "Set Goal"}
                        </Button>
                    </CardFooter>
                </Card>
                </motion.div>

                {/* --- Recent Activity Card (Workout Log) --- */}
                <motion.div
                    variants={cardVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    className="lg:col-span-1" // Apply grid span to motion div
                >
                     <Card className="lg:col-span-1 h-full"> {/* Added h-full, removed redundant col-span */}
                       <CardHeader>
                         <CardTitle>Recent Activity</CardTitle>
                         <CardDescription>Your latest logged workouts.</CardDescription>
                       </CardHeader>
                       <CardContent className="space-y-3 min-h-[150px]">
                         {isLoadingWorkouts ? (
                           <>
                             {/* Reuse skeleton elements or create specific ones */}
                             <Skeleton className="h-10 w-full rounded-md" />
                             <Skeleton className="h-10 w-full rounded-md" />
                             <Skeleton className="h-10 w-5/6 rounded-md" />
                           </>
                         ) : fetchWorkoutsError ? (
                             <p className="text-destructive text-sm">{fetchWorkoutsError}</p>
                         ) : recentWorkouts.length > 0 ? (
                           recentWorkouts.map((workout) => (
                             <div key={`recent-workout-${workout.id}`} className="flex items-center justify-between text-sm p-2 hover:bg-muted/50 rounded-md transition-colors">
                                <div className="flex flex-col flex-grow mr-2">
                                    <span className="font-medium capitalize">
                                        {workout.activity_type}
                                        <span className="text-muted-foreground font-normal text-xs ml-1.5">
                                            ({formatRelative(parseISO(workout.date), new Date())})
                                        </span>
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                        {formatDistance(workout.distance_meters)}
                                        {(workout.distance_meters && workout.duration_seconds) ? ' / ' : ''}
                                        {formatTime(workout.duration_seconds === undefined ? null : workout.duration_seconds)}
                                        {workout.effort_level && ` (Effort: ${workout.effort_level}/5)`}
                                    </span>
                                    {workout.notes && <p className="text-xs text-foreground/80 italic mt-0.5 truncate">{workout.notes}</p>}
                               </div>
                                {/* Optional: Add Edit button if needed later */}
                                 {/* <Button
                                       variant="ghost"
                                       size="sm"
                                       className="text-xs h-6 px-1.5 text-muted-foreground flex-shrink-0"
                                       onClick={() => handleOpenWorkoutDialog(workout)} // Assuming this handler exists
                                    >
                                       Edit
                                    </Button> */}
                               </div>
                             ))
                           ) : (
                               <div className="text-center text-muted-foreground text-sm space-y-2 pt-6">
                                 <p>No recent workouts logged.</p>
                                 <p>Use the "Log Workout" button to add one!</p>
                               </div>
                           )}
                         </CardContent>
                         <CardFooter>
                            {/* Placeholder for future "View All Workouts" button */}
                            <Button variant="outline" size="sm" disabled>View Full Log</Button>
                         </CardFooter>
                       </Card>
                 </motion.div>

            </div> {/* End First Row Grid */}

            {/* --- Second Row Grid (Accomplishments) --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* --- Recent PRs Card --- */}
                 <motion.div
                    variants={cardVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    className="lg:col-span-1" // Apply grid span to motion div
                >
                    <Card className="lg:col-span-1 h-full"> {/* Added h-full, removed redundant col-span */}
                         <CardHeader>
                           <CardTitle>Recent PRs</CardTitle>
                           <CardDescription>Your latest personal records.</CardDescription>
                         </CardHeader>
                         <CardContent className="space-y-3 min-h-[150px]">
                           {recentPrs.length > 0 ? (
                             recentPrs.map((pr) => (
                               <div key={`recent-pr-${pr.id}`} className="flex justify-between items-center text-sm">
                                   <div className="flex-1 truncate mr-2">
                                      <span className="font-medium">{pr.distance}</span>
                                      {pr.race_name && <span className="text-muted-foreground text-xs ml-1">({pr.race_name})</span>}
                                   </div>
                                   <Badge variant="secondary" className="mx-2 whitespace-nowrap">{formatTime(pr.time_in_seconds)}</Badge>
                                    <Button
                                       variant="ghost"
                                       size="sm"
                                       className="text-xs h-6 px-1.5 text-muted-foreground"
                                       onClick={() => handleOpenPrDialog(pr)}
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
                                onClick={() => handleOpenPrDialog()}
                             >
                                Log New PR
                             </Button>
                             <Link href="/pr-timeline" passHref>
                                <Button variant="outline" size="sm">
                                   View All PRs
                                </Button>
                             </Link>
                          </CardFooter>
                    </Card>
                </motion.div>

                {/* --- Achievements Card --- */}
                 <motion.div
                     variants={cardVariants}
                     initial="hidden"
                     whileInView="visible"
                     viewport={{ once: true, amount: 0.2 }}
                     className="lg:col-span-1" // Apply grid span to motion div
                 >
                     <Card className="lg:col-span-1 h-full"> {/* Added h-full, removed redundant col-span */}
                         <CardHeader>
                             <CardTitle className="flex items-center gap-2">
                                 <AwardIcon className="w-5 h-5 text-amber-500" />
                                 Recent Milestones
                             </CardTitle>
                             <CardDescription>Achievements you've unlocked.</CardDescription>
                         </CardHeader>
                         <CardContent className="space-y-3 min-h-[150px]">
                             {earnedAchievements.length > 0 ? (
                                 earnedAchievements.map((ach) => (
                                     <Tooltip key={ach.achievement_id} delayDuration={150}>
                                         <TooltipTrigger asChild>
                                            <div className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md transition-colors cursor-default">
                                                <AchievementIcon iconName={ach.icon_name} className="w-5 h-5 flex-shrink-0" />
                                                <div className="flex-grow">
                                                    <p className="text-sm font-medium leading-tight">{ach.name}</p>
                                                    <p className="text-xs text-muted-foreground leading-tight hidden sm:block">{ach.description}</p>
                                                </div>
                                                 <span className="text-xs text-muted-foreground flex-shrink-0 ml-auto pl-2">
                                                    {formatRelative(parseISO(ach.earned_at), new Date())}
                                                </span>
                                            </div>
                                         </TooltipTrigger>
                                         <TooltipContent side="top" align="start">
                                            <p>{ach.description}</p>
                                            <p className="text-xs text-muted-foreground mt-1">Earned: {new Date(ach.earned_at).toLocaleDateString()}</p>
                                        </TooltipContent>
                                     </Tooltip>
                                 ))
                             ) : (
                                 <div className="text-center text-muted-foreground text-sm space-y-2 pt-6">
                                     <p>Keep running and logging PRs!</p>
                                     <p>Your achievements will appear here.</p>
                                 </div>
                             )}
                         </CardContent>
                          <CardFooter>
                               <Button variant="outline" size="sm" disabled>View All Achievements</Button>
                           </CardFooter>
                     </Card>
                 </motion.div>

            </div> {/* End Second Row Grid */}

        </div> {/* End Wrapper Div */}
    </TooltipProvider>
  );
} 