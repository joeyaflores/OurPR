"use client"; // Revert back to Client Component

import React, { useState, useEffect, useCallback } from 'react'; // Import useCallback
import { createClient } from '@/lib/supabase/client'; // Use BROWSER client
// Remove server-only imports: import { cookies } from 'next/headers'; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, PlusCircle } from "lucide-react"; // Removed PlusCircle as it's not used
import type { UserPr } from '@/types/user_pr';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter, // Import DialogFooter
  DialogClose, // Import DialogClose
} from "@/components/ui/dialog";
import { AddEditPrForm } from './AddEditPrForm'; // Import the form component
import { toast } from "sonner"; // Import toast
import { format, parse } from 'date-fns'; // Import parse

// Helper function to format seconds into HH:MM:SS or MM:SS
function formatTime(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) {
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

// --- Helper function to parse HH:MM:SS or MM:SS string to seconds ---
function parseTimeToSeconds(timeString: string): number {
  if (!timeString || !/^(\d{1,2}:)?([0-5]?\d):([0-5]?\d)$/.test(timeString)) {
    throw new Error("Invalid time format. Use HH:MM:SS or MM:SS.");
  }
  const parts = timeString.split(':').map(Number);
  let hours = 0, minutes = 0, seconds = 0;
  if (parts.length === 3) {
    [hours, minutes, seconds] = parts;
  } else {
    [minutes, seconds] = parts;
  }
  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || minutes >= 60 || seconds >= 60) {
      throw new Error("Invalid time values.");
  }
  return hours * 3600 + minutes * 60 + seconds;
}

// --- API Call Base URL --- Moved outside component
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// Revert to standard functional component
export function PRTimeline() {
  // State for data, loading, error, auth
  const [prs, setPrs] = useState<UserPr[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start loading
  const supabase = createClient(); // Initialize browser client

  // --- State for Dialog and Form ---
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPr, setEditingPr] = useState<UserPr | null>(null); // null for Add, UserPr object for Edit
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Fetch PRs Logic (using useCallback) ---
  const fetchPrs = useCallback(async () => {
    console.log("PRTimeline: Fetching PRs...");
    setIsLoading(true);
    setFetchError(null);

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("PRTimeline: Error getting session:", sessionError);
      setFetchError("Could not check authentication status.");
      setIsLoggedIn(false);
      setIsLoading(false);
      setPrs([]); // Clear PRs on session error
      return;
    }

    if (session) {
      setIsLoggedIn(true);
      const accessToken = session.access_token;
      const url = `${API_BASE_URL}/api/users/me/prs`;

      try {
        console.log("PRTimeline (Client): Fetching PRs from", url);
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: UserPr[] = await response.json();
        setPrs(data);
        console.log(`PRTimeline (Client): Fetched ${data.length} PRs`);

      } catch (e: any) {
        console.error("PRTimeline (Client): Failed to fetch PRs:", e);
        setFetchError(e.message || "Failed to load personal records.");
        setPrs([]);
      }
    } else {
      console.log("PRTimeline (Client): No active session found.");
      setIsLoggedIn(false);
      setPrs([]);
    }
    setIsLoading(false);
  }, [supabase]); // Dependency on supabase client instance

  // --- Initial Fetch and Auth Listener ---
  useEffect(() => {
    fetchPrs(); // Fetch on initial mount

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("PRTimeline: Auth state changed:", event);
      // Refetch PRs on SIGNED_IN or SIGNED_OUT
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          // Small delay to ensure session is fully established/cleared before fetching
          setTimeout(fetchPrs, 100);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };

  }, [fetchPrs, supabase]); // Include fetchPrs in dependency array

  // --- Dialog Open/Close Handlers ---
  const handleOpenDialog = (pr: UserPr | null = null) => {
    setEditingPr(pr); // Set the PR to edit (null for adding)
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPr(null); // Reset editing state on close
    // No need to reset form here, form component handles its own state
  };

  // --- API Call Handlers ---

  // Handle Form Submission (Create or Update)
  const handleFormSubmit = async (values: any, prId?: string) => {
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

    const prData = {
      user_id: session.user.id, // Get user ID from session
      distance: values.distance,
      date: format(values.date, 'yyyy-MM-dd'), // Format date for API
      time_in_seconds: timeInSeconds,
      // race_id: null // TODO: Add if linking to races
    };

    const url = prId
      ? `${API_BASE_URL}/api/users/me/prs/${prId}`
      : `${API_BASE_URL}/api/users/me/prs`;
    const method = prId ? 'PUT' : 'POST';

    console.log(`Submitting PR (${method}) to ${url}`, prData);

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(prData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to ${prId ? 'update' : 'create'} PR.`);
      }

      toast.success(`PR successfully ${prId ? 'updated' : 'added'}!`);
      handleCloseDialog();
      fetchPrs(); // Re-fetch PRs to update the list

    } catch (error: any) {
      console.error(`Error ${prId ? 'updating' : 'creating'} PR:`, error);
      toast.error(error.message || `An error occurred while ${prId ? 'updating' : 'creating'} the PR.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Deletion
  const handleDeletePr = async (prId: string) => {
    setIsSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Authentication error. Please log in again.");
      setIsSubmitting(false);
      return;
    }

    const url = `${API_BASE_URL}/api/users/me/prs/${prId}`;
    console.log(`Deleting PR from ${url}`);

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      // DELETE returns 204 No Content on success
      if (response.status === 204) {
         toast.success("PR successfully deleted!");
         handleCloseDialog();
         fetchPrs(); // Re-fetch PRs
      } else if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Failed to delete PR.' })); // Try to parse error, provide default
          throw new Error(errorData.detail || `Failed to delete PR (Status: ${response.status}).`);
      }
      // Handle potential non-204 success codes if needed, though 204 is standard

    } catch (error: any) {
      console.error("Error deleting PR:", error);
      toast.error(error.message || "An error occurred while deleting the PR.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render Logic ---
  return (
    <section className="w-full max-w-7xl mx-auto mt-8 p-4 border rounded-lg shadow-sm bg-background">
      <h3 className="text-lg font-semibold mb-4">Your PR Timeline</h3>

      {/* --- Dialog for Adding/Editing PRs --- */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {/* Trigger is handled programmatically, so no DialogTrigger needed here */}
        <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e: Event) => { 
            // Prevent closing if submitting
            if (isSubmitting) e.preventDefault(); 
        }}>
          <DialogHeader>
            <DialogTitle>{editingPr ? 'Edit Personal Record' : 'Add New Personal Record'}</DialogTitle>
            <DialogDescription>
              {editingPr ? 'Update the details of your PR.' : 'Log a new personal best.'}
            </DialogDescription>
          </DialogHeader>
          {/* Render the form inside the dialog */} 
          <AddEditPrForm
             key={editingPr?.id || 'add'} // Re-mount form on PR change
             prToEdit={editingPr}
             onSubmit={handleFormSubmit}
             onCancel={handleCloseDialog}
             onDelete={handleDeletePr} // Pass delete handler
             isSubmitting={isSubmitting}
          />
           {/* No explicit footer needed as form includes buttons */}
        </DialogContent>
      </Dialog>

      {/* --- PR Display Area --- */} 
      <div className="flex space-x-4 overflow-x-auto pb-4">
        {isLoading ? (
           <p className="text-muted-foreground text-sm pl-2">Loading PRs...</p>
        ) : !isLoggedIn ? (
          <p className="text-muted-foreground text-sm pl-2">Log in to see your personal records.</p>
        ) : fetchError ? (
          <div className="flex items-center text-destructive text-sm pl-2">
             <AlertCircle className="mr-2 h-4 w-4" /> Error loading PRs: {fetchError}
          </div>
        ) : (
          <>
            {/* --- Add PR Button Card --- */} 
            <Card className="min-w-[200px] flex-shrink-0 flex items-center justify-center border-dashed border-2 hover:border-primary hover:bg-muted transition-colors">
              <Button
                variant="ghost"
                className="flex flex-col items-center justify-center h-full w-full text-muted-foreground hover:text-primary"
                onClick={() => handleOpenDialog()} // Open dialog in Add mode
              >
                <PlusCircle className="h-8 w-8 mb-2" />
                <span>Add New PR</span>
              </Button>
            </Card>

            {/* --- Existing PR Cards --- */} 
            {prs.length === 0 && !fetchError && (
                 <p className="text-muted-foreground text-sm pl-2 self-center">No personal records found. Add your first one!</p>
            )}
            {prs.map((pr) => (
              <Card key={pr.id} className="min-w-[200px] flex-shrink-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{pr.distance} PR</CardTitle>
                  <CardDescription>Time: {formatTime(pr.time_in_seconds)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">Date: {format(new Date(pr.date), 'PPP')}</p> {/* Format date */} 
                  <Button
                     variant="ghost"
                     size="sm"
                     className="w-full justify-start pl-0 text-muted-foreground"
                     onClick={() => handleOpenDialog(pr)} // Open dialog in Edit mode
                   >
                    View/Edit Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>
    </section>
  );
} 