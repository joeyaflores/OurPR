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

// Types for data - Keep consistent with page.tsx initially
type PlannedRace = {
  id: string;
  races: {
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

export default function UserDashboard({ user }: UserDashboardProps) {
  const [plannedRaces, setPlannedRaces] = useState<PlannedRace[]>([]);
  const [recentPrs, setRecentPrs] = useState<RecentPr[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // --- Dialog State ---
  const [isPrDialogOpen, setIsPrDialogOpen] = useState(false);
  const [editingPr, setEditingPr] = useState<RecentPr | null>(null); // Use RecentPr type here
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Fetch Data Logic ---
  const fetchData = useCallback(async () => {
    console.log("UserDashboard: Fetching data...");
    setIsLoading(true);
    setFetchError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== user.id) {
          throw new Error("Session mismatch or user not found.");
      }
       const accessToken = session.access_token; // Needed for API calls

      // Fetch upcoming planned races
       const { data: racesData, error: racesError } = await supabase
        .from('user_race_plans')
        .select('id, races ( id, name, date )')
        .eq('user_id', user.id)
        .order('date', { ascending: true, foreignTable: 'races' })
        .limit(3);

      if (racesError) throw new Error(`Failed to load planned races: ${racesError.message}`);
      setPlannedRaces((racesData as unknown as PlannedRace[]) || []);

      // Fetch recent PRs
      const { data: prsData, error: prsError } = await supabase
        .from('user_prs')
        .select('id, distance, time_in_seconds, date')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(3);

      if (prsError) throw new Error(`Failed to load recent PRs: ${prsError.message}`);
      setRecentPrs(prsData || []);

    } catch (error: any) {
      console.error("UserDashboard: Error fetching data:", error);
      setFetchError(error.message || "Failed to load your dashboard data.");
      setPlannedRaces([]);
      setRecentPrs([]);
    } finally {
      setIsLoading(false);
    }
  }, [user.id, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  // --- Dialog Handlers ---
   const handleOpenPrDialog = (pr: RecentPr | null = null) => {
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

     // Construct payload - Note: user_id comes from session for security
     const prPayload = {
       user_id: session.user.id,
       distance: values.distance,
       date: format(values.date, 'yyyy-MM-dd'),
       time_in_seconds: timeInSeconds,
     };

     const url = prId
       ? `${API_BASE_URL}/api/users/me/prs/${prId}`
       : `${API_BASE_URL}/api/users/me/prs`;
     const method = prId ? 'PUT' : 'POST';

     console.log(`Submitting PR from Dashboard (${method}) to ${url}`, method === 'PUT' ? values : prPayload);

     // --- Construct Body --- 
     let requestBody;
     if (method === 'PUT') {
         // Only include fields allowed by UserPrUpdate model
         const putPayload: { date?: string; time_in_seconds?: number } = {};
         if (values.date) {
             putPayload.date = format(values.date, 'yyyy-MM-dd');
         }
         if (timeInSeconds !== undefined && !isNaN(timeInSeconds)) {
             putPayload.time_in_seconds = timeInSeconds;
         }
         // TODO: Add race_id here if implemented in the form

         // Prevent sending empty update request if no relevant fields changed
         if (Object.keys(putPayload).length === 0) {
            toast.info("No changes detected to save.");
            setIsSubmitting(false);
            return;
         }
         requestBody = JSON.stringify(putPayload);
     } else {
         // POST uses the full prPayload (includes user_id)
         requestBody = JSON.stringify(prPayload);
     }

     try {
       const response = await fetch(url, {
         method: method,
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${session.access_token}`,
         },
         body: requestBody, // Use the constructed body
       });

       if (!response.ok) {
         const errorData = await response.json();
         // Remove the complex retry logic as the payload should now be correct
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

  // --- Delete Handler (Optional for Dashboard) ---
  // We can reuse handleDeletePr from PRTimeline if needed, passing required props
  const handleDeletePr = async (prId: string) => {
    // Implementation similar to PRTimeline's handleDeletePr
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


  // --- Render Logic ---
  if (isLoading) {
    // Optional: Add a loading skeleton or spinner for the dashboard
    return <div className="text-center p-10">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8 w-full">
       {/* --- PR Dialog --- */}
        <Dialog open={isPrDialogOpen} onOpenChange={setIsPrDialogOpen}>
            <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => { if (isSubmitting) e.preventDefault(); }}>
            <DialogHeader>
                <DialogTitle>{editingPr ? 'Edit PR' : 'Log New PR'}</DialogTitle>
                <DialogDescription>
                 {editingPr ? 'Update your personal record.' : 'Add a new personal best to your timeline.'}
                </DialogDescription>
            </DialogHeader>
            <AddEditPrForm
                // Use RecentPr type for prToEdit, map if needed or adjust form type
                key={editingPr?.id || 'add-home'}
                // Pass editingPr directly, as its fields match PrEditData
                prToEdit={editingPr}
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
        {/* Upcoming Races Card */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Planned Races</CardTitle>
            <CardDescription>Your next few races on the calendar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 min-h-[100px]">
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
              <div className="text-center text-muted-foreground text-sm space-y-2 pt-4">
                <p>Ready to find your next challenge? 🏁</p>
                <p>Explore races and add them to your plan!</p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Link href="/discover" passHref>
              <Button size="sm">Discover More Races</Button>
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
          <CardContent className="space-y-3 min-h-[100px]">
            {recentPrs.length > 0 ? (
              recentPrs.map((pr) => (
                <div key={pr.id} className="flex justify-between items-center text-sm">
                  <span>{pr.distance}</span>
                  <Badge variant="secondary">{formatTime(pr.time_in_seconds)}</Badge>
                  {/* Optionally add edit button here */}
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
              <div className="text-center text-muted-foreground text-sm space-y-2 pt-4">
                <p>Log your first Personal Record ⏱️</p>
                <p>Track your progress and celebrate achievements!</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-2 justify-start">
             {/* Connect this button to the dialog */}
             <Button
                variant="secondary"
                size="sm"
                onClick={() => handleOpenPrDialog()} // Open dialog in Add mode
            >
                Log New PR
             </Button>
             {/* Keep View All PRs disabled for now */}
             <Button variant="outline" size="sm" disabled>View All PRs</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 