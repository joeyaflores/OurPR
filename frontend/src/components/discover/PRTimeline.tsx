"use client"; // Revert back to Client Component

import React, { useState, useEffect } from 'react'; // Import hooks
import { createClient } from '@/lib/supabase/client'; // Use BROWSER client
// Remove server-only imports: import { cookies } from 'next/headers'; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react"; // Removed PlusCircle as it's not used
import type { UserPr } from '@/types/user_pr';

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

// Revert to standard functional component
export function PRTimeline() {
  // State for data, loading, error, auth
  const [prs, setPrs] = useState<UserPr[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start loading
  const supabase = createClient(); // Initialize browser client

  useEffect(() => {
    const fetchPrs = async () => {
      setIsLoading(true);
      setFetchError(null);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("PRTimeline: Error getting session:", sessionError);
        setFetchError("Could not check authentication status.");
        setIsLoggedIn(false);
        setIsLoading(false);
        return;
      }

      if (session) {
        setIsLoggedIn(true);
        const accessToken = session.access_token;
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
        const url = `${apiUrl}/api/users/me/prs`;

        try {
          console.log("PRTimeline (Client): Fetching PRs from", url);
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
            // Client-side fetch doesn't need cache option like server
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
        setPrs([]); // Clear PRs if not logged in
      }
      setIsLoading(false);
    };

    fetchPrs();

    // Optional: Listen to auth changes to refetch if needed, similar to AuthButton
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // Re-fetch PRs when user logs in or out
        fetchPrs(); 
      }
    });

    return () => {
      // Cleanup listener
      authListener?.subscription.unsubscribe();
    };

  }, [supabase]); // Depend on supabase client instance


  return (
    <section className="w-full max-w-7xl mx-auto mt-8 p-4 border rounded-lg shadow-sm bg-background">
      <h3 className="text-lg font-semibold mb-4">Your PR Timeline</h3>
      <div className="flex space-x-4 overflow-x-auto pb-4">
        {isLoading ? (
           <p className="text-muted-foreground text-sm pl-2">Loading PRs...</p>
        ) : !isLoggedIn ? (
          <p className="text-muted-foreground text-sm pl-2">Log in to see your personal records.</p>
        ) : fetchError ? (
          <div className="flex items-center text-destructive text-sm pl-2">
             <AlertCircle className="mr-2 h-4 w-4" /> Error loading PRs: {fetchError}
          </div>
        ) : prs.length === 0 ? (
          <p className="text-muted-foreground text-sm pl-2">No personal records found.</p>
        ) : (
          // Map over fetched PRs (same rendering logic)
          (prs.map((pr) => (
            <Card key={pr.id} className="min-w-[200px] flex-shrink-0"> 
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{pr.distance} PR</CardTitle>
                <CardDescription>Time: {formatTime(pr.time_in_seconds)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">Date: {pr.date}</p>
                <Button variant="ghost" size="sm" className="w-full justify-start pl-0 text-muted-foreground" disabled>
                  View Details...
                </Button>
              </CardContent>
            </Card>
          )))
        )}
      </div>
    </section>
  );
} 