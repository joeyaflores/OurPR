'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { RaceCard } from '@/components/onboarding/RaceCard'; // Assuming RaceCard is here or adjust path
import type { Race } from '@/lib/apiClient'; // Or your correct Race type path
import type { PlannedRaceDetail } from '@/types/planned_race'; // <-- Import the new type
import type { UserPr } from '@/types/user_pr'; // <-- Import UserPr type
import type { TrainingPlanOutline, DetailedTrainingPlan } from '@/types/training_plan'; // <-- Import TrainingPlanOutline type
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { AlertCircle, Loader2, Save, Info, Trash2, Link as LinkIcon, CalendarPlus, CalendarMinus } from 'lucide-react'; // For error state & Save icon & Google Icons
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
import { motion, AnimatePresence } from 'framer-motion'; // <-- Import framer-motion
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
import { useSearchParams } from 'next/navigation';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input"; // <-- Import Input
import { Label } from "@/components/ui/label"; // <-- Import Label
import { DialogFooter } from "@/components/ui/dialog";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select"; // <-- Import Select components

// Add API Base URL (consider moving to a config file or env var)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// --- Loading Messages for Plan Generation ---
const LOADING_MESSAGES = [
    "Analyzing race details...",
    "Considering your PR...",
    "Mapping out weekly mileage...",
    "Scheduling key workouts...",
    "Adding rest and recovery...",
    "Tailoring progressions...",
    "Finalizing your plan...",
];
const MESSAGE_INTERVAL = 2500; // ms between messages
// ------------------------------------------

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

// Define the actual content as a separate client component
function PlanPageContent() {
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
    const [currentPlanOutline, setCurrentPlanOutline] = useState<DetailedTrainingPlan | null>(null);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [planWasJustGenerated, setPlanWasJustGenerated] = useState(false); // <-- Track if plan in modal is new
    const [isViewingPlan, setIsViewingPlan] = useState(false); // <-- Track view loading state
    const [isSavingPlan, setIsSavingPlan] = useState(false); // <-- Track save loading state
    const [isDeletingPlan, setIsDeletingPlan] = useState(false); // <-- Track delete loading state
    const [raceIdBeingDeleted, setRaceIdBeingDeleted] = useState<string | number | null>(null); // <-- Track which plan is deleting
    const [isOldPlanFormatError, setIsOldPlanFormatError] = useState(false); // <-- State for old format error
    const [isServerErrorOnView, setIsServerErrorOnView] = useState(false); // <-- NEW State for server error on view
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0); // State for animated message
    // --- State for Google Connection ---
    const [isGoogleConnected, setIsGoogleConnected] = useState(false); // Assume not connected initially
    // --- Enhanced Generation Modal State ---
    const [isGenerationModalOpen, setIsGenerationModalOpen] = useState(false);
    const [goalTimeInput, setGoalTimeInput] = useState<string>("");
    const [currentMileageInput, setCurrentMileageInput] = useState<string>("");
    const [peakMileageInput, setPeakMileageInput] = useState<string>("");
    const [runningDaysInput, setRunningDaysInput] = useState<string>(""); // Use string for Select value
    const [longRunDayInput, setLongRunDayInput] = useState<string>(""); // Use string for Select value
    const [raceIdForGeneration, setRaceIdForGeneration] = useState<string | number | null>(null);
    const goalTimeInputRef = useRef<HTMLInputElement>(null); // Ref for focusing first input
    // -------------------------------------
    // --- Get search params ---
    const searchParams = useSearchParams();
    // --------------------------

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
        // --- Check for Google Connection Success on Load ---
        const googleConnectedParam = searchParams.get('google_connected');
        if (googleConnectedParam === 'true') {
            toast.success("Successfully connected Google Account!");
            setIsGoogleConnected(true); // Update state based on param
            // Optionally remove the query param from URL without reload
            // window.history.replaceState(null, '', window.location.pathname); 
        }
        // ----------------------------------------------------

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
                // --- Call server status check AFTER fetching user data --- 
                if (currentUser) { // Only check if user is logged in
                    checkGoogleConnectionStatus();
                }
                // ---------------------------------------------------------
            }
        };

        fetchUserAndPlanAndPrs();
    }, [supabase, searchParams]); // Re-run if supabase client or search params change

    // Effect for cycling loading messages
    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;

        if (isPlanGenerating) {
            // Start cycling messages
            intervalId = setInterval(() => {
                setLoadingMessageIndex(prevIndex => 
                    (prevIndex + 1) % LOADING_MESSAGES.length
                );
            }, MESSAGE_INTERVAL);
        } else {
            // Reset index when not generating
            setLoadingMessageIndex(0);
        }

        // Cleanup function to clear interval
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isPlanGenerating]); // Dependency: run when generation state changes

    // --- Function to OPEN the Enhanced Generation Modal --- 
    const openGenerationModal = (raceId: string | number) => {
        // console.log(`Opening generation modal for race ID: ${raceId}`);
        setRaceIdForGeneration(raceId); // Store the race ID we'll generate for
        // Reset all input fields
        setGoalTimeInput(""); 
        setCurrentMileageInput("");
        setPeakMileageInput("");
        setRunningDaysInput(""); // Reset select
        setLongRunDayInput(""); // Reset select
        setIsGenerationModalOpen(true); // Open the modal
        // Reset other plan generation states just in case
        setPlanGenerationError(null);
        setCurrentPlanOutline(null);
        setPlanWasJustGenerated(false);
        setIsPlanGenerating(false);
        setIsViewingPlan(false);
        // Focus the goal time input shortly after the modal opens
        setTimeout(() => goalTimeInputRef.current?.focus(), 100); 
    };

    // --- Function to handle the actual plan generation request (CALLED BY ENHANCED MODAL) ---
    const handleGeneratePlan = async () => {
        const raceId = raceIdForGeneration; // Get the stored race ID
        // console.log(`Requesting plan generation for race ID: ${raceId} with inputs:`, 
        //    { goalTimeInput, currentMileageInput, peakMileageInput, runningDaysInput, longRunDayInput });

        if (!raceId) {
            console.error("Generation Modal Error: Race ID is missing.");
            toast.error("An error occurred. Could not determine the race.");
            setIsGenerationModalOpen(false); // Close generation modal
            return;
        }

        // Close the generation input modal first
        setIsGenerationModalOpen(false);

        // Prepare data for the API request body
        const requestBody: Record<string, any> = {};
        if (goalTimeInput.trim()) requestBody.goal_time = goalTimeInput.trim();
        if (currentMileageInput.trim()) requestBody.current_weekly_mileage = parseInt(currentMileageInput, 10);
        if (peakMileageInput.trim()) requestBody.peak_weekly_mileage = parseInt(peakMileageInput, 10);
        if (runningDaysInput) requestBody.preferred_running_days = parseInt(runningDaysInput, 10);
        if (longRunDayInput) requestBody.preferred_long_run_day = longRunDayInput;

        // Validate numeric inputs (simple check)
        if (isNaN(requestBody.current_weekly_mileage)) delete requestBody.current_weekly_mileage;
        if (isNaN(requestBody.peak_weekly_mileage)) delete requestBody.peak_weekly_mileage;
        if (isNaN(requestBody.preferred_running_days)) delete requestBody.preferred_running_days;

        // console.log("Prepared request body:", requestBody);

        // Now proceed with the original generation logic
        setIsPlanGenerating(true);
        setPlanGenerationError(null);
        setCurrentPlanOutline(null);
        setSelectedRaceIdForPlan(raceId); // Track which card shows loading (in main plan list)
        setIsPlanModalOpen(true); // Open the *main* plan display modal to show loading/results
        setPlanWasJustGenerated(false); // Reset flag
        setIsViewingPlan(false); // Ensure view state is off

        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
            setPlanGenerationError("Authentication error: Cannot generate plan.");
            setIsPlanGenerating(false);
            setSelectedRaceIdForPlan(null);
            setIsPlanModalOpen(false); // Close main modal too on auth error
            return;
        }

        const url = `${API_BASE_URL}/api/users/me/generate-plan/${raceId}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json' // <-- Add Content-Type
                 },
                body: JSON.stringify(requestBody) // <-- Send enhanced body
            });

            if (!response.ok) {
                let errorDetail = `API error: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.detail || errorDetail;
                } catch { /* Ignore if error body is not JSON */ }
                 // Handle specific 400 from backend (e.g., too long duration)
                if (response.status === 400 && errorDetail.includes("Training plans cannot be generated")) {
                     toast.error("Plan Duration Too Long", { description: errorDetail });
                     // Keep main modal closed if duration error happens before generation starts
                     setIsPlanModalOpen(false);
                } else if (response.status === 400 && errorDetail.includes("Race date is in the past")) {
                    toast.error("Cannot Generate Plan", { description: errorDetail });
                    setIsPlanModalOpen(false);
                }
                throw new Error(errorDetail);
            }

            const planData: DetailedTrainingPlan = await response.json();
            setCurrentPlanOutline(planData);
            setPlanWasJustGenerated(true); // Set flag indicating this plan is new
            // console.log("Successfully generated plan:", planData);

        } catch (e: any) {
            console.error("Failed to generate training plan:", e);
            // Only set the generation error if it wasn't one of the specific toasts above
            if (!(e.message.includes("Training plans cannot be generated") || e.message.includes("Race date is in the past"))) {
                 setPlanGenerationError(e.message || "An unexpected error occurred during plan generation.");
            }
            setCurrentPlanOutline(null); // Ensure no stale plan shown on error
            // Don't automatically close the main modal here, let the error display show
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
        setIsOldPlanFormatError(false); // <-- Reset old format error state
        setIsServerErrorOnView(false); // <-- Reset server error state
        setCurrentPlanOutline(null);
        setSelectedRaceIdForPlan(raceId);
        setIsPlanModalOpen(true);
        setPlanWasJustGenerated(false);
        setIsPlanGenerating(false);

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
            const response = await fetch(url, { method: 'GET', headers: { 'Authorization': `Bearer ${accessToken}` } });

            if (!response.ok) {
                 let errorDetail = `API error: ${response.status}`;
                 let isOldFormat = false;
                 const isServerError = false; // Track if it's a general server error (like 500)
                 if (response.status === 409) { // <-- Check for our specific status code
                     isOldFormat = true;
                 }
                 // Try to get detail message regardless
                 try {
                     const errorData = await response.json();
                     errorDetail = errorData.detail || errorDetail;
                 } catch { /* Ignore */ }
                 
                  // If it's the old format, set specific state
                  if (isOldFormat) {
                      setIsOldPlanFormatError(true);
                      setPlanGenerationError(errorDetail); // Use the message from API
                  } else if (response.status === 404) {
                      // Handle 404 specifically
                      errorDetail = "No saved plan found for this race. You can generate one!";
                      setPlanGenerationError(errorDetail);
                  } else {
                      // For other errors (e.g., 500), mark as server error
                      setIsServerErrorOnView(true);
                      setPlanGenerationError(errorDetail); // Use the message from API
                  }

                 setCurrentPlanOutline(null); // Ensure no plan is displayed on error
                 setIsViewingPlan(false); // Stop loading indicator
                 return; // Stop further processing
            }

            // If response.ok (meaning 200 OK)
            const planData: DetailedTrainingPlan = await response.json();
            setCurrentPlanOutline(planData);
            setIsOldPlanFormatError(false); // Ensure old format state is false on success
             // console.log("Successfully fetched saved plan:", planData);

        } catch (e: any) {
            // Only set general error if it wasn't the old format error handled above
            if (!isOldPlanFormatError) { 
                console.error("Failed to fetch saved training plan:", e);
                setPlanGenerationError(e.message || "An unexpected error occurred while fetching the saved plan.");
                setCurrentPlanOutline(null);
            }
        } finally {
            // Only stop loading if it wasn't the old format error (already stopped loading there)
            if (!isOldPlanFormatError) {
                setIsViewingPlan(false);
            }
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

    // --- Function to trigger refetch of a specific plan (used by display component) ---
    const handlePlanRefetch = (raceIdToRefetch: string | number) => {
        console.log(`[PlanPage] Refetch triggered for race ID: ${raceIdToRefetch}`);
        // Reuse the existing view function to reload the plan data
        handleViewPlanRequest(raceIdToRefetch);
    };
    // -------------------------------------------------------------------------------

    // --- Function to handle deleting a saved plan --- 
    const handleDeletePlanRequest = async (raceId: string | number) => {
        setRaceIdBeingDeleted(raceId); // Show loading state indicator (optional, add to RaceCard if needed)
        setIsDeletingPlan(true);
        // console.log(`Attempting to delete plan for race ID: ${raceId}`);

        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
            toast.error("Authentication error: Cannot delete plan.");
            setIsDeletingPlan(false);
            setRaceIdBeingDeleted(null);
            return;
        }

        const url = `${API_BASE_URL}/api/users/me/races/${raceId}/generated-plan`;

        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` },
            });

            // Check for non-204 success codes or error codes
            if (!response.ok && response.status !== 204) {
                 let errorDetail = `API error: ${response.status}`;
                 try {
                     const errorData = await response.json();
                     errorDetail = errorData.detail || errorDetail;
                 } catch { /* Ignore if error body is not JSON */ }
                 throw new Error(errorDetail);
            }

            // If successful (204 No Content or potentially other 2xx)
            toast.success("Training plan deleted successfully!");

            // Update local state: set has_generated_plan to false for this race
            setPlannedRaces(currentRaces => 
                currentRaces.map(race => 
                    race.id === raceId 
                        ? { ...race, has_generated_plan: false } 
                        : race
                )
            );

        } catch (e: any) {
            console.error("Failed to delete training plan:", e);
            toast.error("Failed to delete plan", { description: e.message });
        } finally {
            setIsDeletingPlan(false);
            setRaceIdBeingDeleted(null);
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

    // --- Function to handle initiating Google OAuth flow ---
    const handleConnectGoogle = async () => {
        // Redirect the browser to the backend login endpoint
        // window.location.href = `${API_BASE_URL}/api/auth/google/login`;

        // --- New Fetch Logic --- 
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
            toast.error("Authentication error. Please log in again.");
            return;
        }

        // Indicate loading state if needed (optional)
        // setIsGoogleConnectLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/google/login`, {
                method: 'GET', // Or POST if you change the backend
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                let errorDetail = `API error: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.detail || errorDetail;
                } catch { /* Ignore */ }
                throw new Error(errorDetail);
            }

            const data = await response.json();
            if (data.authorization_url) {
                // Redirect the user using the URL from the backend
                window.location.href = data.authorization_url;
            } else {
                throw new Error("Could not get Google authorization URL from backend.");
            }

        } catch (e: any) {
            console.error("Failed to initiate Google Connect:", e);
            toast.error("Failed to connect Google Account", { description: e.message });
        } finally {
            // Reset loading state if needed
            // setIsGoogleConnectLoading(false);
        }
        // ----------------------
    };
    // ------------------------------------------------------

    // --- Function to check Google Connection Status (Server-Side) --- 
    const checkGoogleConnectionStatus = async () => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        let connected = false; // Default to false

        if (accessToken) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/users/me/google-calendar/status`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                if (response.ok) {
                    const data = await response.json();
                    connected = data.isConnected;
                } else {
                    // Log error but assume not connected
                    console.error("API error checking Google status:", response.status);
                }
            } catch (e) {
                console.error("Network error checking Google connection status:", e);
            }
        }
        
        // Update state based on server check
        setIsGoogleConnected(connected); 
        console.log("[PlanPage] Google Connection Status from server:", connected);
    };
    // ------------------------------------------------------------------

    // --- Function to handle DISCONNECTING Google Account --- 
    const handleDisconnectGoogle = async () => {
        // Add loading state maybe? setIsDisconnecting(true)
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
            toast.error("Authentication error.");
            // setIsDisconnecting(false)
            return;
        }

        const url = `${API_BASE_URL}/api/users/me/google-calendar/connection`;

        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` },
            });

            if (!response.ok && response.status !== 204) {
                let errorDetail = `API error: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.detail || errorDetail;
                } catch { /* Ignore */ }
                throw new Error(errorDetail);
            }

            // Success!
            toast.success("Google Account disconnected.");
            setIsGoogleConnected(false); // Update frontend state

        } catch (e: any) {
            console.error("Failed to disconnect Google Account:", e);
            toast.error("Disconnect Failed", { description: e.message });
        } finally {
            // Reset loading state if needed
            // setIsDisconnecting(false);
        }
    };
    // ----------------------------------------------------------

    // --- Render component --- 
    return (
        <motion.div 
            className="container mx-auto p-4 md:p-8 max-w-6xl" // Constrain width
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <h1 className="text-2xl font-bold mb-6">My Training Plan</h1>

            {/* --- Add PR Logging Tip --- */}
            <div className="mb-6 p-3 border rounded-md bg-blue-50 border-blue-200 text-blue-800 text-sm flex items-start">
                <Info className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>Tip: Log your PRs on the Home page for a more personalized plan!</span>
            </div>
            {/* --- End PR Logging Tip --- */}

            {/* --- Google Connection Button Area (Moved Here) --- */}
            {!isLoading && !error && (
                <div className="mb-6 p-4 border rounded-md flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
                    {isGoogleConnected ? (
                        <>
                            {/* Status Text */}
                            <div className="flex items-center justify-center text-green-600 font-medium">
                                <CalendarPlus className="h-5 w-5 mr-2" />
                                <span>Google Calendar Connected</span>
                            </div>
                            {/* Button + Info Icon Group - Add wrapper div */}
                            <div className="flex items-center justify-center gap-2">
                                <Button onClick={handleDisconnectGoogle} variant="outline" size="sm">
                                    <LinkIcon className="mr-2 h-4 w-4" />
                                    Disconnect
                                </Button>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                                            <Info className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent side="bottom" className="w-auto max-w-xs p-3">
                                        <p className="font-semibold mb-1 text-sm">Google Calendar Sync</p>
                                        <p className="text-xs text-muted-foreground">
                                            Your account is connected. Add/Remove plans from your calendar using the buttons in the plan details modal.
                                        </p>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center gap-2">
                            <Button onClick={handleConnectGoogle} variant="outline">
                                <LinkIcon className="mr-2 h-4 w-4" />
                                Connect Google Calendar
                            </Button>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                        <Info className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent side="bottom" className="w-auto max-w-xs p-3">
                                    <p className="font-semibold mb-1 text-sm">Sync with Google Calendar!</p>
                                    <ul className="list-disc list-outside pl-4 text-xs text-muted-foreground space-y-1">
                                        <li>View OurPR workouts in your main calendar.</li>
                                        <li>Connect to add/remove your current plan easily.</li>
                                        <li>Sync changes after editing or regenerating plans.</li>
                                    </ul>
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}
                </div>
            )}
            {/* ------------------------------------------------ */}

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
                            onGeneratePlanRequest={openGenerationModal} // <-- Pass the function to open the ENHANCED modal
                            onViewPlanRequest={handleViewPlanRequest}
                            onDeletePlanRequest={handleDeletePlanRequest} // <-- Pass delete handler
                            isGeneratingPlan={selectedRaceIdForPlan === raceWithDetails.id && isPlanGenerating}
                            isViewingPlan={selectedRaceIdForPlan === raceWithDetails.id && isViewingPlan}
                            isGoogleConnected={isGoogleConnected}
                        />
                    ))}
                </div>
            )}

            {/* -- UPDATED: Enhanced Generation Modal -- */}
            <Dialog open={isGenerationModalOpen} onOpenChange={setIsGenerationModalOpen}>
                <DialogContent className="sm:max-w-lg"> {/* Increased width slightly */} 
                    <DialogHeader>
                        <DialogTitle>Customize Your Training Plan</DialogTitle>
                        <DialogDescription>
                            Provide optional details to tailor the plan to your current fitness and preferences.
                            Leave fields blank if unsure.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {/* Goal Time */}
                        <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="goal-time" className="text-right">
                                Goal Time (Optional)
                            </Label>
                            <Input
                                id="goal-time"
                                ref={goalTimeInputRef} // Ref for initial focus
                                value={goalTimeInput}
                                onChange={(e) => setGoalTimeInput(e.target.value)}
                                placeholder="HH:MM:SS or MM:SS" 
                                className="col-span-2"
                            />
                        </div>
                        {/* Current Mileage */}
                        <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="current-mileage" className="text-right">
                                Current Miles/Week
                            </Label>
                            <Input
                                id="current-mileage"
                                type="number"
                                value={currentMileageInput}
                                onChange={(e) => setCurrentMileageInput(e.target.value)}
                                placeholder="e.g., 15" 
                                className="col-span-2"
                                min="0"
                            />
                        </div>
                        {/* Peak Mileage */}
                        <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="peak-mileage" className="text-right">
                                Target Peak Miles/Week (Optional)
                            </Label>
                            <Input
                                id="peak-mileage"
                                type="number"
                                value={peakMileageInput}
                                onChange={(e) => setPeakMileageInput(e.target.value)}
                                placeholder="e.g., 40" 
                                className="col-span-2"
                                min="0"
                            />
                        </div>
                         {/* Running Days/Week */}
                         <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="running-days" className="text-right">
                                Running Days/Week (Optional)
                            </Label>
                            <Select value={runningDaysInput} onValueChange={setRunningDaysInput}> 
                                <SelectTrigger id="running-days" className="col-span-2">
                                    <SelectValue placeholder="Select days..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="3">3 days</SelectItem>
                                    <SelectItem value="4">4 days</SelectItem>
                                    <SelectItem value="5">5 days</SelectItem>
                                    <SelectItem value="6">6 days</SelectItem>
                                    {/* <SelectItem value="7">7 days</SelectItem> */}
                                </SelectContent>
                            </Select>
                        </div>
                         {/* Preferred Long Run Day */}
                         <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="long-run-day" className="text-right">
                                Long Run Day (Optional)
                            </Label>
                            <Select value={longRunDayInput} onValueChange={setLongRunDayInput}> 
                                <SelectTrigger id="long-run-day" className="col-span-2">
                                    <SelectValue placeholder="Select day..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Saturday">Saturday</SelectItem>
                                    <SelectItem value="Sunday">Sunday</SelectItem>
                                    {/* <SelectItem value="Flexible">Flexible</SelectItem> */}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsGenerationModalOpen(false)}>Cancel</Button>
                        {/* Button now calls the unified handleGeneratePlan */}
                        <Button onClick={handleGeneratePlan}>Generate Plan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* -- End Enhanced Generation Modal -- */}

            {/* Plan Generation/View Modal (Main Display Modal) */}
            <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>
                            {planWasJustGenerated ? "Generated Training Plan" : "Training Plan"}
                        </DialogTitle>
                        <DialogDescription>
                            {/* Simplify description */}
                            {currentPlanOutline ? 
                                `Review your personalized training outline below.` 
                                : "Loading plan details..."}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Modal Content Area - Reduce max height */}
                    <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
                        {/* Loading Indicator */}
                        {(isPlanGenerating || isViewingPlan) && !planGenerationError && !isOldPlanFormatError && !isServerErrorOnView && (
                            <div className="flex items-center justify-center p-8 min-h-[80px]"> {/* Added min-h for layout consistency */}
                                <Loader2 className="h-8 w-8 animate-spin text-primary flex-shrink-0" />
                                {isPlanGenerating ? (
                                    <AnimatePresence mode="wait">
                                        <motion.span
                                            key={loadingMessageIndex} // Change key to trigger animation
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            transition={{ duration: 0.3 }}
                                            className="ml-3 text-center"
                                        >
                                            {LOADING_MESSAGES[loadingMessageIndex]}
                                        </motion.span>
                                    </AnimatePresence>
                                ) : (
                                    <span className="ml-3">Loading your plan...</span> // Keep static for viewing
                                )}
                            </div>
                        )}
                        
                        {/* Error Display (Includes Old Format Message & Server Error) */} 
                        {(planGenerationError || isOldPlanFormatError || isServerErrorOnView) && (
                            <div className="text-destructive bg-destructive/10 p-4 rounded-md text-center space-y-2">
                                <p className="font-medium">
                                    {isOldPlanFormatError ? "Outdated Plan Format" : 
                                    isServerErrorOnView ? "Error Loading Plan" : 
                                    planGenerationError?.includes("No saved plan found") ? "Plan Not Found" : // Specific view error
                                    planGenerationError ? "Generation Failed" : "Error"} // General generation error
                                </p>
                                <p className="text-sm">{planGenerationError || "An unexpected error occurred."}</p>
                                {/* Show Delete/Regenerate button for old format OR server error (VIEWING errors) */} 
                                {(isOldPlanFormatError || isServerErrorOnView) && selectedRaceIdForPlan && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="mt-3"
                                        onClick={async () => {
                                            await handleDeletePlanRequest(selectedRaceIdForPlan);
                                            setIsOldPlanFormatError(false);
                                            setIsServerErrorOnView(false);
                                            openGenerationModal(selectedRaceIdForPlan);
                                        }}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete and Regenerate Plan
                                    </Button>
                                )}
                                {/* Link to generate if 404 on VIEW */} 
                                {planGenerationError?.includes("No saved plan found") && !isOldPlanFormatError && !isServerErrorOnView && (
                                    <Button 
                                        variant="link" 
                                        className="mt-2 h-auto p-0 text-destructive" 
                                        onClick={() => {
                                            if(selectedRaceIdForPlan) {
                                                setIsPlanModalOpen(false);
                                                openGenerationModal(selectedRaceIdForPlan);
                                            }
                                        }}
                                    >
                                        Generate a new plan?
                                    </Button>
                                )}
                                {/* --- NEW: Button to try GENERATION again --- */} 
                                {planGenerationError && !planGenerationError.includes("No saved plan found") && !isOldPlanFormatError && !isServerErrorOnView && selectedRaceIdForPlan && (
                                     <Button
                                         variant="outline"
                                         size="sm"
                                         className="mt-3"
                                         onClick={() => {
                                             setIsPlanModalOpen(false); // Close current error modal
                                             openGenerationModal(selectedRaceIdForPlan); // Re-open generation options modal
                                         }}
                                     >
                                         Try Generating Again?
                                    </Button>
                                )}
                                {/* ------------------------------------------ */} 
                            </div>
                        )}

                        {currentPlanOutline && !planGenerationError && !isOldPlanFormatError && !isServerErrorOnView && (
                            // Find the selected race to pass its date and PR
                            (() => {
                                const selectedRace = racesWithDetails.find(r => r.id === selectedRaceIdForPlan);
                                if (selectedRace) {
                                    return (
                                        <TrainingPlanDisplay 
                                            plan={currentPlanOutline} 
                                            raceId={selectedRace.id}
                                            userPrString={selectedRace.userPr}
                                            isGoogleConnected={isGoogleConnected}
                                            onPlanRefetchRequired={handlePlanRefetch}
                                        />
                                    );
                                }
                                // Handle case where race or date isn't found (should not happen if plan exists)
                                return <p className="text-destructive text-center">Error: Could not find selected race details.</p>; 
                            })()
                        )}
                    </div>

                    {/* Modal Footer Actions */}
                     {currentPlanOutline && !planGenerationError && !isOldPlanFormatError && !isServerErrorOnView && (planWasJustGenerated || true /* Allow re-saving? */) && (
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
        </motion.div>
    );
}

// Default export is now a simple Server Component that wraps the client component in Suspense
export default function MyPlanPage() {
    return (
        <Suspense fallback={<PlanPageSkeleton />}> {/* Or any other suitable fallback */}
            <PlanPageContent />
        </Suspense>
    );
}

// --- Skeleton Component for Suspense Fallback ---
const PlanPageSkeleton = () => (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl animate-pulse">
        <h1 className="text-3xl font-bold mb-6"><Skeleton className="h-8 w-1/3" /></h1>
        
        {/* Skeleton for PR Section */}
        <div className="mb-8 p-6 bg-card rounded-lg shadow">
            <h2 className="text-2xl font-semibold mb-4 flex items-center">
                <Skeleton className="h-6 w-1/4 mr-2" /> <Info className="h-4 w-4 text-muted-foreground" />
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-3 bg-muted rounded">
                        <Skeleton className="h-5 w-1/2 mb-1" />
                        <Skeleton className="h-5 w-3/4" />
                    </div>
                ))}
            </div>
             <Skeleton className="h-10 w-32 mt-4" /> {/* Skeleton for Add PR button */}
        </div>

        {/* Skeleton for Google Connection Section */}
         <div className="mb-8 p-6 bg-card rounded-lg shadow">
             <h2 className="text-2xl font-semibold mb-4"><Skeleton className="h-6 w-1/4" /></h2>
             <Skeleton className="h-10 w-40" />
         </div>


        {/* Skeleton for Planned Races Section */}
        <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4"><Skeleton className="h-6 w-1/4" /></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {[...Array(2)].map((_, i) => (
                    <div key={i} className="bg-card rounded-lg shadow overflow-hidden p-4 border border-border">
                        <Skeleton className="h-6 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-1/2 mb-1" />
                        <Skeleton className="h-4 w-1/3 mb-3" />
                        <div className="flex space-x-2 mt-4">
                            <Skeleton className="h-9 w-24" />
                            <Skeleton className="h-9 w-24" />
                             <Skeleton className="h-9 w-9 rounded-full" />
                        </div>
                    </div>
                 ))}
            </div>
        </div>
    </div>
);
// --- End Skeleton Component ---