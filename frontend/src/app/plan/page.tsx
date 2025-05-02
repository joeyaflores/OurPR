'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { RaceCard } from '@/components/onboarding/RaceCard'; // Assuming RaceCard is here or adjust path
import type { Race } from '@/lib/apiClient'; // Or your correct Race type path
import type { PlannedRaceDetail } from '@/types/planned_race'; // <-- Import the new type
import type { UserPr } from '@/types/user_pr'; // <-- Import UserPr type
import type { TrainingPlanOutline } from '@/types/training_plan'; // <-- Import TrainingPlanOutline type
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { AlertCircle, Loader2, Save, Info } from 'lucide-react'; // For error state & Save icon
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogClose, // Import DialogClose
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"; // Import Button
import { TrainingPlanDisplay } from '@/components/plan/TrainingPlanDisplay'; // <-- Import the display component
import { toast } from "sonner"; // <-- Correct toast import
import { 
    differenceInDays, 
    differenceInWeeks, 
    formatDistanceToNowStrict, 
    isToday, 
    isPast, 
    parseISO, 
    subWeeks, // <-- Import subWeeks
    format, // <-- Import format (for peak date)
    startOfWeek,
    addWeeks // <-- Import addWeeks
} from 'date-fns'; // <-- Import date-fns functions

// Add API Base URL (consider moving to a config file or env var)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// Helper function to format seconds into HH:MM:SS or MM:SS
const formatTime = (totalSeconds: number): string => {
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
  };

export default function MyPlanPage() {
    const supabase = createClient();
    const [user, setUser] = useState<User | null>(null);
    const [plannedRaces, setPlannedRaces] = useState<PlannedRaceDetail[]>([]); // <-- Use PlannedRaceDetail[]
    const [userPrs, setUserPrs] = useState<UserPr[]>([]); // <-- State for PRs
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // State for plan generation and modal display
    const [isPlanGenerating, setIsPlanGenerating] = useState(false);
    const [planGenerationError, setPlanGenerationError] = useState<string | null>(null);
    const [selectedRaceIdForPlan, setSelectedRaceIdForPlan] = useState<string | number | null>(null);
    const [currentPlanOutline, setCurrentPlanOutline] = useState<TrainingPlanOutline | null>(null);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [planWasJustGenerated, setPlanWasJustGenerated] = useState(false); // <-- Track if plan in modal is new
    const [isViewingPlan, setIsViewingPlan] = useState(false); // <-- Track view loading state
    const [isSavingPlan, setIsSavingPlan] = useState(false); // <-- Track save loading state

    // Function to handle removal from the page's state
    const handleRaceRemoved = (removedRaceId: string | number) => {
        setPlannedRaces(currentRaces => 
            currentRaces.filter(race => race.id !== removedRaceId)
        );
        // Optional: Show a local confirmation toast if desired, 
        // although RaceCard already shows one.
        // toast.info("Race removed from view."); 
    };

    useEffect(() => {
        const fetchUserAndPlanAndPrs = async () => {
            setIsLoading(true);
            setError(null);
            setPlannedRaces([]); // Reset state
            setUserPrs([]); // Reset state
            setCurrentPlanOutline(null); // Reset plan on page load/user change
            setPlanGenerationError(null);
            setIsPlanModalOpen(false);

            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            const currentUser = session?.user ?? null;
            setUser(currentUser);

            if (sessionError || !currentUser) {
                setError(sessionError?.message || "You must be logged in to view your plan and PRs.");
                setIsLoading(false);
                return;
            }

            const accessToken = session?.access_token;
            if (!accessToken) {
                console.error("MyPlanPage: No access token found");
                setError("Authentication error: Could not get access token.");
                setIsLoading(false);
                return;
            }

            // --- Fetch Plan and PRs Concurrently --- 
            const planUrl = `${API_BASE_URL}/api/users/me/plan/`;
            const prsUrl = `${API_BASE_URL}/api/users/me/prs`;
            const headers = { 'Authorization': `Bearer ${accessToken}` };

            try {
                const [planResponse, prsResponse] = await Promise.all([
                    fetch(planUrl, { headers }),
                    fetch(prsUrl, { headers })
                ]);

                // --- Process Plan Response ---
                if (!planResponse.ok) {
                     // Handle 404 for plan specifically (no races added yet)
                     if (planResponse.status !== 404) {
                        const planErrorData = await planResponse.json().catch(() => ({ detail: 'Failed to fetch plan data.' }));
                        throw new Error(`Plan Fetch Error: ${planErrorData.detail || planResponse.statusText}`);
                     } else {
                        // 404 is okay, means empty plan
                        setPlannedRaces([]);
                     }
                } else {
                    const planData: PlannedRaceDetail[] = await planResponse.json(); // <-- Use PlannedRaceDetail[]
                    // Sort PlannedRaceDetail by date (remains the same)
                    planData.sort((a, b) => {
                        const dateA = a.date ? new Date(a.date).getTime() : Infinity;
                        const dateB = b.date ? new Date(b.date).getTime() : Infinity;
                        return dateA - dateB;
                    });
                    setPlannedRaces(planData);
                    // console.log("Fetched planned races:", planData);
                }

                // --- Process PRs Response ---
                if (!prsResponse.ok) {
                    // Handle 404 for PRs specifically (no PRs entered yet)
                    if (prsResponse.status !== 404) {
                        const prsErrorData = await prsResponse.json().catch(() => ({ detail: 'Failed to fetch PR data.' }));
                        throw new Error(`PR Fetch Error: ${prsErrorData.detail || prsResponse.statusText}`);
                    } else {
                         // 404 is okay, means empty PRs
                        setUserPrs([]);
                    }
                } else {
                    const prsData: UserPr[] = await prsResponse.json();
                    setUserPrs(prsData);
                    // console.log("Fetched user PRs:", prsData);
                }

            } catch (e: any) {
                console.error("MyPlanPage: Failed to fetch plan or PRs:", e);
                setError(e.message || "An unexpected error occurred while fetching your data.");
                // Reset state on error
                setPlannedRaces([]); 
                setUserPrs([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserAndPlanAndPrs();
    }, [supabase]); // Re-run if supabase client instance changes

    // --- Function to handle plan generation request --- 
    const handleGeneratePlanRequest = async (raceId: string | number) => {
        // console.log(`Requesting plan generation for race ID: ${raceId}`);
        setIsPlanGenerating(true);
        setPlanGenerationError(null);
        setCurrentPlanOutline(null);
        setSelectedRaceIdForPlan(raceId); // Track which card is loading
        setIsPlanModalOpen(true); // Open modal immediately to show loading
        setPlanWasJustGenerated(false); // Reset flag
        setIsViewingPlan(false); // Ensure view state is off

        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
            setPlanGenerationError("Authentication error: Cannot generate plan.");
            setIsPlanGenerating(false);
            setSelectedRaceIdForPlan(null);
            return;
        }

        const url = `${API_BASE_URL}/api/users/me/generate-plan/${raceId}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` },
            });

            if (!response.ok) {
                let errorDetail = `API error: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.detail || errorDetail;
                } catch { /* Ignore if error body is not JSON */ }
                throw new Error(errorDetail);
            }

            const planData: TrainingPlanOutline = await response.json();
            setCurrentPlanOutline(planData);
            setPlanWasJustGenerated(true); // Set flag indicating this plan is new
            // console.log("Successfully generated plan:", planData);

        } catch (e: any) {
            console.error("Failed to generate training plan:", e);
            setPlanGenerationError(e.message || "An unexpected error occurred during plan generation.");
            setCurrentPlanOutline(null); // Ensure no stale plan shown on error
        } finally {
            setIsPlanGenerating(false);
             // Don't reset selectedRaceIdForPlan here, RaceCard uses it to stop its spinner
        }
    };

    // --- Function to handle view saved plan request --- 
    const handleViewPlanRequest = async (raceId: string | number) => {
        // console.log(`Requesting view of saved plan for race ID: ${raceId}`);
        setIsViewingPlan(true);
        setPlanGenerationError(null);
        setCurrentPlanOutline(null);
        setSelectedRaceIdForPlan(raceId); // Track which card is loading
        setIsPlanModalOpen(true); // Open modal immediately to show loading
        setPlanWasJustGenerated(false); // This plan is not new
        setIsPlanGenerating(false); // Ensure generate state is off

        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
            setPlanGenerationError("Authentication error: Cannot view plan.");
            setIsViewingPlan(false);
            setSelectedRaceIdForPlan(null);
            return;
        }

        const url = `${API_BASE_URL}/api/users/me/races/${raceId}/generated-plan`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${accessToken}` },
            });

            if (!response.ok) {
                 let errorDetail = `API error: ${response.status}`;
                 if (response.status === 404) {
                     errorDetail = "No saved plan found for this race. You can generate one!";
                 } else {
                     try {
                         const errorData = await response.json();
                         errorDetail = errorData.detail || errorDetail;
                     } catch { /* Ignore */ }
                 }
                 throw new Error(errorDetail);
            }

            const planData: TrainingPlanOutline = await response.json();
            setCurrentPlanOutline(planData);
             // console.log("Successfully fetched saved plan:", planData);

        } catch (e: any) {
            console.error("Failed to fetch saved training plan:", e);
            setPlanGenerationError(e.message || "An unexpected error occurred while fetching the saved plan.");
            setCurrentPlanOutline(null); 
        } finally {
            setIsViewingPlan(false);
        }
    };

    // --- Function to handle saving the generated plan --- 
    const handleSavePlanClick = async () => {
        if (!currentPlanOutline || !selectedRaceIdForPlan) {
            toast.error("No plan data available to save.");
            return;
        }
        setIsSavingPlan(true);
        setPlanGenerationError(null); // Clear previous errors
        // console.log(`Attempting to save plan for race ID: ${selectedRaceIdForPlan}`);

        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
            toast.error("Authentication error: Cannot save plan.");
            setIsSavingPlan(false);
            return;
        }

        const url = `${API_BASE_URL}/api/users/me/races/${selectedRaceIdForPlan}/generated-plan`;

        try {
            const response = await fetch(url, {
                method: 'POST', // Use POST to save/upsert
                headers: {
                     'Authorization': `Bearer ${accessToken}`,
                     'Content-Type': 'application/json',
                 },
                body: JSON.stringify(currentPlanOutline), // Send the full plan outline
            });

            if (!response.ok) {
                 let errorDetail = `API error: ${response.status}`;
                 try {
                     // Attempt to get more detail from the error response body
                     const errorData = await response.json();
                     errorDetail = errorData.detail || errorDetail;
                 } catch (parseError) { 
                     console.warn("Could not parse error response body as JSON", parseError); 
                 } 
                 throw new Error(errorDetail); // Throw after attempting to parse
            }

            // Success!
            await response.json(); // Consume the response body even on success (good practice)
            toast.success("Training plan saved successfully!");
            setPlanWasJustGenerated(false); // Plan is now saved, not just generated

            // Update the local state to reflect the saved plan
            setPlannedRaces(currentRaces => 
                currentRaces.map(race => 
                    race.id === selectedRaceIdForPlan 
                        ? { ...race, has_generated_plan: true } 
                        : race
                )
            );
            // Optionally close the modal after saving?
            setIsPlanModalOpen(false);

        } catch (e: any) { // This catch now correctly belongs to the outer try
            console.error("Failed to save training plan:", e);
            toast.error("Failed to save plan", { description: e.message });
             // Keep modal open to show error or let user retry?
        } finally { // This finally now correctly belongs to the outer try
            setIsSavingPlan(false);
        }
    };

    // --- Calculate PR and Time Until Race for each card --- 
    const racesWithDetails = plannedRaces.map(race => {
        const relevantPr = userPrs.find(pr => pr.distance === race.distance);
        let userPrString: string | null = null;
        let isPrOfficial: boolean | null = null; // <-- Variable for PR status
        if (relevantPr) {
            userPrString = formatTime(relevantPr.time_in_seconds);
            isPrOfficial = relevantPr.is_official ?? null; // <-- Get status (handle null/undefined from older data)
            // --- Add Debug Log ---
            console.log(`[MyPlanPage Debug] Race: ${race.name}, Relevant PR:`, relevantPr, `isPrOfficial set to:`, isPrOfficial);
            // --- End Debug Log ---
        }

        let timeUntilRaceString: string = "Date TBD";
        let progressPercent: number | null = null;
        let currentWeekNumber: number | null = null;
        let totalPlanWeeks: number | null = null;

        if (race.date) {
            const raceDate = parseISO(race.date); // Use parseISO
            if (!isPast(raceDate) || isToday(raceDate)) {
                // Calculate difference in weeks instead of using formatDistanceToNowStrict
                const weeksUntil = differenceInWeeks(raceDate, new Date());
                timeUntilRaceString = `in ${weeksUntil} week${weeksUntil !== 1 ? 's' : ''}`;
                
                // Calculate progress based on the actual plan duration if available
                const actualTotalWeeks = race.total_weeks; // Get total_weeks from the specific race data
                if (actualTotalWeeks && actualTotalWeeks > 0) {
                    totalPlanWeeks = actualTotalWeeks; // Store total weeks
                    const startDate = startOfWeek(subWeeks(raceDate, actualTotalWeeks), { weekStartsOn: 1 });

                    // --- REMOVE TEMPORARY: Simulate being 5 weeks into the plan ---
                    // const realToday = new Date();
                    // const simulatedToday = addWeeks(realToday, 5); // Add 5 weeks to today
                    // const weeksPassed = differenceInWeeks(simulatedToday, startDate, { roundingMethod: 'floor' }); // Use simulatedToday
                    const weeksPassed = differenceInWeeks(new Date(), startDate, { roundingMethod: 'floor' }); // Use real date
                    // --- End REMOVE Temporary ---
                    
                    // Ensure weeksPassed is within the bounds [0, actualTotalWeeks]
                    const boundedWeeksPassed = Math.max(0, Math.min(weeksPassed, actualTotalWeeks));
                    
                    // Calculate current week number (1-based), clamp to total weeks
                    currentWeekNumber = Math.min(boundedWeeksPassed + 1, actualTotalWeeks); 

                    progressPercent = (boundedWeeksPassed / actualTotalWeeks) * 100;
                } else {
                    progressPercent = null; // No progress if total_weeks is unknown or zero
                }
            } else {
                timeUntilRaceString = "Race Finished";
            }
        }
        
        // Placeholder for training suggestion
        const trainingSuggestion = relevantPr ? "Focus on speed work" : "Build endurance base";

        return {
            ...race,
            userPr: userPrString,
            timeUntilRace: timeUntilRaceString,
            trainingSuggestion: trainingSuggestion, // Add suggestion
            progressPercent: progressPercent, // Add progress
            currentWeekNumber: currentWeekNumber, // <-- Add current week
            totalPlanWeeks: totalPlanWeeks, // <-- Add total weeks
            isPrOfficial: isPrOfficial, // <-- Add PR status
            // hasSavedPlan is already part of PlannedRaceDetail
        };
    });

    // --- Render component --- 
    return (
        <div className="container mx-auto p-4 md:p-6">
            <h1 className="text-2xl font-bold mb-6">My Training Plan</h1>

            {/* --- Add PR Logging Tip --- */}
            <div className="mb-6 p-3 border rounded-md bg-blue-50 border-blue-200 text-blue-800 text-sm flex items-start">
                <Info className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>Tip: Log your PRs on the Home page for a more personalized plan!</span>
            </div>
            {/* --- End PR Logging Tip --- */}

            {/* Loading State */}
            {isLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-64 w-full rounded-lg" />
                    ))}
                </div>
            )}

            {/* Error State */}
            {!isLoading && error && (
                <div className="flex items-center justify-center text-destructive bg-destructive/10 p-4 rounded-md">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <span>{error}</span>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && racesWithDetails.length === 0 && (
                <p className="text-center text-muted-foreground mt-8">
                    You haven't added any races to your plan yet. Go to the Discover page to find races!
                </p>
            )}

            {/* Content: Planned Races */}
            {!isLoading && !error && racesWithDetails.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {racesWithDetails.map((raceWithDetails) => (
                        <RaceCard
                            key={raceWithDetails.id}
                            race={raceWithDetails} // Pass the combined object
                            viewMode="plan" // Set view mode to plan
                            onRaceRemoved={handleRaceRemoved} // Pass removal handler
                            userPr={raceWithDetails.userPr}
                            timeUntilRace={raceWithDetails.timeUntilRace}
                            trainingSuggestion={raceWithDetails.trainingSuggestion}
                            progressPercent={raceWithDetails.progressPercent}
                            hasSavedPlan={raceWithDetails.has_generated_plan}
                            currentWeekNumber={raceWithDetails.currentWeekNumber} // <-- Pass current week
                            totalPlanWeeks={raceWithDetails.totalPlanWeeks} // <-- Pass total weeks
                            isPrOfficial={raceWithDetails.isPrOfficial} // <-- Pass PR status
                            onGeneratePlanRequest={handleGeneratePlanRequest}
                            onViewPlanRequest={handleViewPlanRequest}
                            isGeneratingPlan={selectedRaceIdForPlan === raceWithDetails.id && isPlanGenerating}
                            isViewingPlan={selectedRaceIdForPlan === raceWithDetails.id && isViewingPlan}
                        />
                    ))}
                </div>
            )}

            {/* Plan Generation/View Modal */}
            <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
                <DialogContent className="max-w-3xl"> 
                    <DialogHeader>
                        <DialogTitle>
                            {planWasJustGenerated ? "Generated Training Plan" : "Training Plan"}
                        </DialogTitle>
                        <DialogDescription>
                            {currentPlanOutline ? 
                                `Plan for ${currentPlanOutline.race_name} (${currentPlanOutline.race_distance}) - ${currentPlanOutline.total_weeks} weeks` 
                                : "Loading plan details..."}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Modal Content Area */}
                    <div className="mt-4 max-h-[70vh] overflow-y-auto pr-2"> 
                        {(isPlanGenerating || isViewingPlan) && !planGenerationError && (
                            <div className="flex items-center justify-center p-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <span className="ml-3">{isPlanGenerating ? "Generating your plan..." : "Loading your plan..."}</span>
                            </div>
                        )}
                        
                        {planGenerationError && (
                            <div className="text-destructive bg-destructive/10 p-3 rounded-md text-center">
                                <p>Error: {planGenerationError}</p>
                                {planGenerationError.includes("404") && !planWasJustGenerated && (
                                    <Button 
                                        variant="link" 
                                        className="mt-2 h-auto p-0 text-destructive" 
                                        onClick={() => {
                                            if(selectedRaceIdForPlan) {
                                                setIsPlanModalOpen(false); // Close modal first
                                                handleGeneratePlanRequest(selectedRaceIdForPlan); // Trigger generation
                                            }
                                        }}
                                    >
                                        Generate a new plan?
                                    </Button>
                                )}
                            </div>
                        )}

                        {currentPlanOutline && !planGenerationError && (
                            // Find the selected race to pass its date and PR
                            (() => {
                                const selectedRace = racesWithDetails.find(r => r.id === selectedRaceIdForPlan);
                                if (selectedRace?.date) {
                                    return (
                                        <TrainingPlanDisplay 
                                            plan={currentPlanOutline} 
                                            raceDate={selectedRace.date} 
                                            userPrString={selectedRace.userPr} // <-- Pass the PR string
                                        />
                                    );
                                }
                                // Handle case where race or date isn't found (should not happen if plan exists)
                                return <p className="text-destructive text-center">Error: Could not find race date for this plan.</p>; 
                            })()
                        )}
                    </div>

                    {/* Modal Footer Actions */}
                     {currentPlanOutline && !planGenerationError && (planWasJustGenerated || true /* Allow re-saving? */) && (
                         <div className="mt-6 flex justify-end gap-2 border-t pt-4">
                             <DialogClose asChild>
                                 <Button variant="outline">Close</Button>
                             </DialogClose>
                             {planWasJustGenerated && (
                                 <Button 
                                     onClick={handleSavePlanClick} 
                                     disabled={isSavingPlan}
                                 >
                                     {isSavingPlan ? (
                                         <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                                     ) : (
                                         <><Save className="mr-2 h-4 w-4" /> Save Plan</>
                                     )}
                                 </Button>
                             )}
                         </div>
                     )}
                </DialogContent>
            </Dialog>
        </div>
    );
}