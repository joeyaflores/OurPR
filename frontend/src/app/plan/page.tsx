'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { RaceCard } from '@/components/onboarding/RaceCard'; // Assuming RaceCard is here or adjust path
import type { Race } from '@/lib/apiClient'; // Or your correct Race type path
import type { UserPr } from '@/types/user_pr'; // <-- Import UserPr type
import type { TrainingPlanOutline } from '@/types/training_plan'; // <-- Import TrainingPlanOutline type
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { AlertCircle, Loader2 } from 'lucide-react'; // For error state
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
import { 
    differenceInDays, 
    differenceInWeeks, 
    formatDistanceToNowStrict, 
    isToday, 
    isPast, 
    parseISO, 
    subWeeks, // <-- Import subWeeks
    format // <-- Import format (for peak date)
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
    const [plannedRaces, setPlannedRaces] = useState<Race[]>([]);
    const [userPrs, setUserPrs] = useState<UserPr[]>([]); // <-- State for PRs
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // State for plan generation and modal display
    const [isPlanGenerating, setIsPlanGenerating] = useState(false);
    const [planGenerationError, setPlanGenerationError] = useState<string | null>(null);
    const [selectedRaceIdForPlan, setSelectedRaceIdForPlan] = useState<string | number | null>(null);
    const [currentPlanOutline, setCurrentPlanOutline] = useState<TrainingPlanOutline | null>(null);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

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
                    const planData: Race[] = await planResponse.json();
                    planData.sort((a, b) => {
                        const dateA = a.date ? new Date(a.date).getTime() : Infinity;
                        const dateB = b.date ? new Date(b.date).getTime() : Infinity;
                        return dateA - dateB;
                    });
                    setPlannedRaces(planData);
                    console.log("Fetched planned races:", planData);
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
                    console.log("Fetched user PRs:", prsData);
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
        console.log(`Requesting plan generation for race ID: ${raceId}`);
        setIsPlanGenerating(true);
        setPlanGenerationError(null);
        setCurrentPlanOutline(null);
        setSelectedRaceIdForPlan(raceId); // Track which card is loading
        setIsPlanModalOpen(false); // Close modal if it was open for another plan

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
            setIsPlanModalOpen(true); // Open modal on success
            console.log("Successfully generated plan:", planData);

        } catch (e: any) {
            console.error("Failed to generate training plan:", e);
            setPlanGenerationError(e.message || "An unexpected error occurred during plan generation.");
            // Optionally open the modal to show the error? Or show inline?
             setIsPlanModalOpen(true); // Open modal even on error to show message
        } finally {
            setIsPlanGenerating(false);
             // Don't reset selectedRaceIdForPlan here, RaceCard uses it to stop its spinner
        }
    };

    const PlanSkeleton = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, index) => (
                <Card className="w-full flex flex-col" key={index}>
                    <CardHeader className="pb-2">
                        <Skeleton className="h-5 w-3/4" /> {/* Title */}
                        <Skeleton className="h-4 w-1/2 pt-1" /> {/* Location/Date */}
                    </CardHeader>
                    <CardContent className="flex-grow space-y-3 pt-2">
                        <Skeleton className="h-4 w-1/4" /> {/* Distance */}
                        <Skeleton className="h-4 w-1/3" /> {/* Elevation */}
                        <Skeleton className="h-8 w-full" /> {/* Summary/Details */}
                    </CardContent>
                    <CardFooter>
                         <Skeleton className="h-9 w-full" /> {/* Button */}
                    </CardFooter>
                </Card>
            ))}
        </div>
    );

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6 text-center">My Race Plan</h1>

            {isLoading && <PlanSkeleton />}

            {!isLoading && error && (
                <div className="text-center text-red-600 bg-red-100 border border-red-400 p-4 rounded-md flex items-center justify-center">
                     <AlertCircle className="mr-2 h-5 w-5"/> 
                     <span>Error loading plan: {error}</span>
                </div>
            )}

            {!isLoading && !error && plannedRaces.length === 0 && (
                <div className="text-center text-muted-foreground py-10">
                    <p>You haven't added any races to your plan yet.</p>
                    {/* Optional: Add a link/button to the discovery page */}
                    {/* <Button variant="link" asChild> */}
                    {/*   <Link href="/discover">Find Races</Link> */}
                    {/* </Button> */}
                </div>
            )}

            {!isLoading && !error && plannedRaces.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {plannedRaces.map((race) => {
                        // Find the relevant PR for this race's distance
                        const relevantPr = userPrs.find(pr => pr.distance === race.distance);
                        const prTimeString = relevantPr ? formatTime(relevantPr.time_in_seconds) : null;

                        // Calculate time until race
                        let timeUntilRaceString = "Date TBD";
                        let raceDate: Date | null = null;
                        let weeksUntil: number | null = null;
                        if (race.date) {
                            try {
                                raceDate = parseISO(race.date); // Store parsed date
                                const now = new Date();
                                weeksUntil = differenceInWeeks(raceDate, now);
                                
                                if (isToday(raceDate)) {
                                    timeUntilRaceString = "Today!";
                                } else if (isPast(raceDate)) {
                                    timeUntilRaceString = "Past";
                                } else {
                                    const daysUntil = differenceInDays(raceDate, now);
                                    if (daysUntil < 14) {
                                        timeUntilRaceString = `in ${daysUntil + 1} day${daysUntil === 0 ? '' : 's'}`;
                                    } else {
                                        timeUntilRaceString = `in ${weeksUntil} week${weeksUntil === 1 ? '' : 's'}`;
                                    }
                                }
                            } catch (e) {
                                console.error("Error parsing race date:", race.date, e);
                                timeUntilRaceString = "Invalid Date";
                                raceDate = null; // Reset on error
                                weeksUntil = null;
                            }
                        }
                        
                        // Calculate Training Suggestion
                        let trainingSuggestion: string | null = null;
                        const MIN_WEEKS_FOR_SUGGESTION = 6; // Only suggest if race is far enough away

                        if (raceDate && weeksUntil && weeksUntil >= MIN_WEEKS_FOR_SUGGESTION) {
                            let peakDistance = "";
                            let peakWeekOffset = 3; // Default peak 3 weeks out

                            switch (race.distance) {
                                case 'Half Marathon':
                                    peakDistance = "~10-12 mi";
                                    peakWeekOffset = 2; // Peak 2 weeks out for HM
                                    break;
                                case 'Marathon':
                                    peakDistance = "~18-20 mi";
                                    peakWeekOffset = 3; // Peak 3 weeks out for M
                                    break;
                                // Add cases for Ultras if desired
                                // case '50K': ...
                            }

                            if (peakDistance) {
                                try {
                                    const peakDate = subWeeks(raceDate, peakWeekOffset);
                                    // Format date like "Oct 14th"
                                    const formattedPeakDate = format(peakDate, "MMM do"); 
                                    trainingSuggestion = `Peak Run: ${peakDistance} (Week of ${formattedPeakDate})`;
                                } catch(e) {
                                     console.error("Error calculating peak date:", e);
                                     // Don't show suggestion if date math fails
                                }
                            }
                        }

                        return (
                            <RaceCard 
                                key={race.id} 
                                race={race} 
                                viewMode="plan"
                                onRaceRemoved={handleRaceRemoved}
                                userPr={prTimeString}
                                timeUntilRace={timeUntilRaceString}
                                trainingSuggestion={trainingSuggestion}
                                onGeneratePlanRequest={handleGeneratePlanRequest}
                                isGeneratingPlan={isPlanGenerating && selectedRaceIdForPlan === race.id}
                                progressPercent={calculateProgressPercent(race.distance, weeksUntil)}
                            />
                        );
                    })}
                </div>
            )}

            {/* Plan Display Modal */} 
            <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
                 <DialogContent className="max-w-md sm:max-w-lg md:max-w-2xl max-h-[80vh] overflow-y-auto"> 
                    <DialogHeader>
                        <DialogTitle>{planGenerationError ? "Error Generating Plan" : "Generated Training Plan"}</DialogTitle>
                        {currentPlanOutline && !planGenerationError && (
                             <DialogDescription>
                                 Outline for {currentPlanOutline.race_name} ({currentPlanOutline.race_distance}). Adjust based on your experience and how you feel.
                             </DialogDescription>
                        )}
                         {planGenerationError && (
                             <DialogDescription className="text-red-600">
                                 {planGenerationError}
                             </DialogDescription>
                        )}
                    </DialogHeader>
                    
                    {/* Display Loading inside Modal */} 
                    {isPlanGenerating && !currentPlanOutline && !planGenerationError && (
                         <div className="flex justify-center items-center py-10">
                             <Loader2 className="h-8 w-8 animate-spin text-primary" />
                             <span className="ml-2">Generating your plan...</span>
                         </div>
                     )}

                    {/* Display Plan or Error */} 
                    {!isPlanGenerating && currentPlanOutline && !planGenerationError && (
                        <TrainingPlanDisplay plan={currentPlanOutline} />
                    )}

                    {/* Close Button */} 
                    <DialogClose asChild>
                        <Button type="button" variant="outline" className="mt-4">Close</Button>
                    </DialogClose>
                </DialogContent>
            </Dialog>

        </div>
    );
}

// --- Helper Functions ---

// Calculates the progress percentage based on assumed total plan length
const calculateProgressPercent = (distance: Race['distance'], weeksRemaining: number | null): number | null => {
    if (weeksRemaining === null || weeksRemaining < 0) return 100; // Treat past/today as 100% done

    let totalPlanWeeks = 0;
    switch (distance) {
        case 'Marathon': totalPlanWeeks = 16; break;
        case 'Half Marathon': totalPlanWeeks = 12; break;
        case '10K': totalPlanWeeks = 8; break;
        case '5K': totalPlanWeeks = 6; break;
        default: return null; // Don't show progress for unknown/other distances
    }

    if (weeksRemaining >= totalPlanWeeks) return 0; // Not started based on typical duration

    const weeksElapsed = totalPlanWeeks - weeksRemaining;
    const progress = Math.max(0, Math.min(100, Math.round((weeksElapsed / totalPlanWeeks) * 100)));
    return progress;
};

// Helper components needed for Skeleton (if not globally available)
const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={`border bg-card text-card-foreground shadow-sm rounded-lg ${className}`}>{children}</div>;
const CardHeader = ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>;
const CardContent = ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={`p-6 pt-0 ${className}`}>{children}</div>;
const CardFooter = ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={`flex items-center p-6 pt-0 ${className}`}>{children}</div>; 