'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Race } from '@/lib/apiClient'; // Import the Race type
import { ExternalLink, CalendarDays, Thermometer, BarChart, Mountain, PlusCircle, CheckCircle, AlertCircle, Trash2, Trophy, Clock, Flag, Rocket, Eye, AlertTriangle, CalendarPlus } from 'lucide-react'; // Icons
import { createClient } from '@/lib/supabase/client'; // Import Supabase client
import type { User } from '@supabase/supabase-js';
import { toast } from "sonner"; // Import toast
import { Progress } from "@/components/ui/progress"; // Import Progress
import { cn } from "@/lib/utils"; // Import cn for conditional classes
import { differenceInWeeks, parseISO, isFuture, startOfDay } from 'date-fns'; // <-- Import date functions
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
    AlertDialogTrigger 
} from "@/components/ui/alert-dialog";

// Action States for the button
type ActionState = 'idle' | 'loading' | 'success' | 'error';

// Define a type that includes the base Race and the optional isSelected
// This allows the component to accept both the base Race type and one potentially augmented with isSelected
type RaceWithSelection = Race & { isSelected?: boolean };

interface RaceCardProps {
  race: RaceWithSelection;
  viewMode?: 'discover' | 'plan'; // Add viewMode prop
  onRaceRemoved?: (raceId: string | number) => void; // Callback for successful removal
  userPr?: string | null; // Add optional prop for user's PR time string
  timeUntilRace?: string; // Add optional prop for time until race string
  trainingSuggestion?: string | null; // Add optional prop for training suggestion
  onGeneratePlanRequest?: (raceId: string | number) => void; // Callback to request plan generation - Make optional for discover view
  onViewPlanRequest?: (raceId: string | number) => void; // Callback to request viewing saved plan
  isGeneratingPlan?: boolean; // Prop indicating if plan generation is in progress for this card - Make optional
  isViewingPlan?: boolean; // Prop indicating if plan viewing is in progress
  progressPercent?: number | null; // <-- Add progress prop
  hasSavedPlan?: boolean; // <-- Add flag for saved plan
  currentWeekNumber?: number | null; // <-- Add prop for current week
  totalPlanWeeks?: number | null; // <-- Add prop for total weeks
  isPrOfficial?: boolean | null; // <-- Add prop for PR official status
  onSelect?: (raceId: string | number) => void;
  onRemove?: (raceId: string | number) => void;
  onDeletePlanRequest?: (raceId: string | number) => void; // <-- Add callback prop for delete request
  isGoogleConnected?: boolean; // <-- Add prop for Google status
}

// Add API Base URL (consider moving to a config file)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export function RaceCard({ 
    race, 
    viewMode = 'discover', 
    onRaceRemoved, 
    userPr, 
    timeUntilRace,
    trainingSuggestion,
    onGeneratePlanRequest,
    onViewPlanRequest,
    isGeneratingPlan,
    isViewingPlan,
    progressPercent,
    hasSavedPlan,
    currentWeekNumber,
    totalPlanWeeks,
    isPrOfficial,
    onSelect,
    onRemove,
    onDeletePlanRequest,
    isGoogleConnected
}: RaceCardProps) { 
    const supabase = createClient();
    const [user, setUser] = useState<User | null>(null);
    // State to track individual button states { [raceId]: ActionState }
    const [buttonState, setButtonState] = useState<ActionState>('idle'); 
    // State to hold the IDs of races currently in the user's plan
    const [plannedRaceIds, setPlannedRaceIds] = useState<Set<string | number>>(new Set());
    const [isPlanLoading, setIsPlanLoading] = useState(true); // Loading state for the plan itself
    const [isRemoving, setIsRemoving] = useState(false);

    // Get user session and plan state on mount
    useEffect(() => {
        const getInitialData = async () => {
            setIsPlanLoading(true);
            
            const { data: { session } } = await supabase.auth.getSession();
            const currentUser = session?.user ?? null;
            setUser(currentUser);

            if (!currentUser) {
                setIsPlanLoading(false);
                return; // No need to fetch plan if not logged in
            }

            // Fetch user's plan
            const accessToken = session?.access_token;
            if (!accessToken) { 
                 console.error("RaceCard: No access token found"); 
                 setIsPlanLoading(false);
                 return; 
            }
            const url = `${API_BASE_URL}/api/users/me/plan/`;
            try {
                const response = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                if (!response.ok) {
                     // If backend returns 404 (no plan yet), treat as empty, not error
                    if (response.status === 404) {
                        setPlannedRaceIds(new Set());
                        // console.log(`RaceCard (${race.id}): No initial plan found (404).`);
                    } else {
                        throw new Error(`Failed to fetch plan: ${response.status}`);
                    }
                } else {
                    // Expect an array of Race objects now
                    const data: Race[] = await response.json(); 
                    // Extract the IDs to build the Set
                    setPlannedRaceIds(new Set(data.map(r => r.id)));
                    // console.log(`RaceCard (${race.id}): Fetched planned race objects, extracted IDs:`, data.map(r=>r.id));
                }
            } catch (e) {
                console.error(`RaceCard (${race.id}): Failed to fetch initial plan state:`, e);
                setPlannedRaceIds(new Set());
            }
            setIsPlanLoading(false);
        };

        getInitialData();
    }, [supabase, race.id]); // Depend on supabase and race.id

    // --- Add to Plan Handler ---
    const handleAddRaceToPlan = async () => {
        if (!user) {
            toast.error("Please log in to add races to your plan.");
            return;
        }
        setButtonState('loading');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");
            const accessToken = session.access_token;
            const url = `${API_BASE_URL}/api/users/me/plan/`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ race_id: race.id })
            });
            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 409) { throw new Error(errorData.detail || "Race already in plan."); }
                else { throw new Error(errorData.detail || `API error: ${response.status}`); }
            }
            setButtonState('success');
            setPlannedRaceIds(prev => new Set(prev).add(race.id)); // Update local state
            toast.success("Race added to your plan!"); 
            setTimeout(() => { setButtonState('idle'); }, 2000); 
        } catch (e: any) {
            console.error("Failed to add race to plan:", e);
            setButtonState('error');
            toast.error("Error adding race", { description: e.message }); 
            setTimeout(() => { setButtonState('idle'); }, 3000);
        }
    };

    // --- Remove from Plan Handler ---
    const handleRemoveRaceFromPlan = async () => {
        if (!user) {
            toast.error("Please log in to modify your plan.");
            return;
        }
        setButtonState('loading');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");
            const accessToken = session.access_token;
            const url = `${API_BASE_URL}/api/users/me/plan/${race.id}`;

            const response = await fetch(url, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})); 
                if (response.status === 404) { throw new Error(errorData.detail || "Race not found in plan."); }
                 else { throw new Error(errorData.detail || `API error: ${response.status}`); }
            }

            setButtonState('success');
            setPlannedRaceIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(race.id);
                return newSet;
            }); // Update local state
            toast.success("Race removed from your plan!"); 

            // Call the callback to notify the parent component
            if (onRaceRemoved) {
                onRaceRemoved(race.id);
            }

            setTimeout(() => { setButtonState('idle'); }, 2000); 
        } catch (e: any) {
            console.error("Failed to remove race from plan:", e);
            setButtonState('error');
            toast.error("Error removing race", { description: e.message }); 
            setTimeout(() => { setButtonState('idle'); }, 3000);
        }
    };

    // Handler for the placeholder generate button
    const handleGeneratePlanClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click if needed

        // --- Add Frontend Check for Plan Duration --- 
        const MAX_PLAN_WEEKS = 20;
        if (race.date) {
            try {
                const today = startOfDay(new Date());
                const raceDate = parseISO(race.date);
                if (isFuture(raceDate)) {
                    const weeksUntil = differenceInWeeks(raceDate, today);
                    if (weeksUntil > MAX_PLAN_WEEKS) {
                        toast.error(
                            "Plan Duration Too Long", 
                            { description: `Plans can only be generated for races up to ${MAX_PLAN_WEEKS} weeks away.` }
                        );
                        return; // Stop execution, do not call the parent handler
                    }
                }
                 // Allow past/today races to pass through; backend will handle those errors.
            } catch (error) {
                console.error("Error parsing race date for duration check:", error);
                // If date parsing fails, let the backend handle it
            }
        } 
        // --- End Check ---

        // Call the parent handler, passing the race ID
        if (onGeneratePlanRequest) { // Check if handler exists
            onGeneratePlanRequest(race.id);
        }
        // Parent component (MyPlanPage) will manage loading state & modal display
    };

    // Handler for the view plan button
    const handleViewPlanClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onViewPlanRequest) { // Check if handler exists
            onViewPlanRequest(race.id);
        }
    };

    const renderStat = (IconComponent: React.ElementType, label: string, value: React.ReactNode | undefined | null, unit: string = '') => {
        if (value === undefined || value === null || value === '') return null;
        const displayValue = typeof value === 'string' || typeof value === 'number' ? `${value}${unit}` : value;
        return (
            <div className="flex items-center text-sm text-muted-foreground">
                <IconComponent className="mr-1.5 h-4 w-4 flex-shrink-0" />
                <span>{label}: {displayValue}</span>
            </div>
        );
    };

    const renderStars = (score: number | null | undefined): React.ReactNode => {
        const numericScore = Number(score); 
        if (isNaN(numericScore) || numericScore < 1 || numericScore > 5) {
             return <span className="text-muted-foreground">(N/A)</span>; 
        }
        const roundedScore = Math.round(numericScore);
        return (
             <span title={`${roundedScore}/5`} className="ml-1 inline-flex items-center">
                 <span className="text-yellow-500">{'★'.repeat(roundedScore)}</span>
                 <span>{'☆'.repeat(5 - roundedScore)}</span>
             </span>
        );
     };

    // Determine button state based on plan and loading
    const isInPlan = plannedRaceIds.has(race.id);
    const isButtonDisabled = !user || isPlanLoading || buttonState === 'loading' || buttonState === 'success';
    
    // Adjust button behavior based on viewMode
    let displayButton = true;
    let finalButtonAction = handleAddRaceToPlan;
    let finalButtonText = "Add to Plan";
    let FinalButtonIcon = PlusCircle;
    let buttonVariant: "outline" | "destructive" = "outline";

    if (viewMode === 'plan') {
        // In plan view, always show remove functionality (if user is logged in)
        finalButtonAction = handleRemoveRaceFromPlan;
        finalButtonText = "Remove from Plan";
        FinalButtonIcon = Trash2;
        buttonVariant = 'destructive'; // Always destructive style for remove in plan view
        displayButton = !!user; // Only show button if user is logged in
    } else {
        // Original 'discover' view logic
        if (isInPlan) {
            finalButtonAction = handleRemoveRaceFromPlan;
            finalButtonText = "Remove from Plan";
            FinalButtonIcon = Trash2;
            buttonVariant = 'destructive';
        } else {
            finalButtonAction = handleAddRaceToPlan;
            finalButtonText = "Add to Plan";
            FinalButtonIcon = PlusCircle;
            buttonVariant = 'outline';
        }
    }

    // --- Determine card interaction and appearance based on viewMode --- 
    const isPlanMode = viewMode === 'plan';
    const cardClasses = cn(
        "transition-all duration-200 ease-out",
        isPlanMode 
            ? "bg-gradient-to-br from-blue-100/50 via-blue-50/20 to-background dark:from-blue-900/30 dark:via-blue-950/10 dark:to-background border-blue-200/50 dark:border-blue-800/30" // Apply gradient in plan mode
            : "hover:shadow-md hover:-translate-y-1 bg-card border", // Default hover/bg for discover
        !isPlanMode && race.isSelected && "ring-2 ring-primary shadow-lg" // Selection style in discover mode
    );

  return (
    <Card className={cardClasses}>
        <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">{race.name}</CardTitle>
            <CardDescription className="flex items-center text-sm flex-wrap gap-x-2 gap-y-1">
                 <span className="inline-flex items-center">
                    <CalendarDays className="mr-1.5 h-4 w-4" />
                    {race.date ? format(new Date(race.date), "PPP") : "Date TBD"}
                 </span>
                 {timeUntilRace && timeUntilRace !== "Date TBD" && (
                    <span className="inline-flex items-center font-medium text-primary">
                        <Clock className="mr-1 h-4 w-4" />
                        {timeUntilRace}
                    </span>
                 )}
                 {race.distance ? <span className="font-medium">({race.distance})</span> : ''}
            </CardDescription>
        </CardHeader>

        {/* Optional Progress Bar - Shown below header */} 
        {progressPercent !== null && viewMode === 'plan' && (
            <div className="px-6 pb-3 pt-1"> {/* Add some padding */} 
                 {/* Conditionally render the label */} 
                 {currentWeekNumber && totalPlanWeeks ? (
                     <p className="text-xs text-muted-foreground mb-1">
                         Training Progress (Week {currentWeekNumber} / {totalPlanWeeks})
                     </p>
                 ) : (
                     <p className="text-xs text-muted-foreground mb-1">Training Progress</p>
                 )}
                 <Progress value={progressPercent} className="w-full h-2" /> 
             </div>
         )}

        <CardContent className="text-sm space-y-2 pt-0 pb-4 flex-grow">
             {renderStat(BarChart, "Flatness", renderStars(race.flatness_score))}
             {renderStat(Mountain, "Elevation Gain", race.total_elevation_gain, " ft")}
             {renderStat(BarChart, "PR Potential", race.pr_potential_score != null ? `${race.pr_potential_score}/10` : "N/A")}
             {renderStat(Thermometer, "Avg Temp", race.average_temp_fahrenheit, "°F")}
            
             {/* Display User PR if provided */}
             {userPr && (
                 <div className="flex items-center text-sm text-blue-600 font-medium pt-1">
                     <Trophy className="mr-1.5 h-4 w-4 flex-shrink-0" />
                     <span>Your PR: {userPr}</span>
                     {/* Add Official/Unofficial indicator */} 
                     {isPrOfficial !== null && (
                         <span className="ml-1.5 text-xs text-muted-foreground">
                             ({isPrOfficial ? 'Official' : 'Unofficial'})
                         </span>
                     )}
                 </div>
             )}

             {/* Display Training Suggestion if provided */} 
             {trainingSuggestion && (
                <div className="flex items-center text-sm text-green-700 dark:text-green-400 font-medium pt-1">
                     <Flag className="mr-1.5 h-4 w-4 flex-shrink-0" /> 
                     <span>{trainingSuggestion}</span>
                 </div>
             )}

             {/* Adjust empty state check */}
             {race.flatness_score == null && race.pr_potential_score == null && race.average_temp_fahrenheit == null && race.total_elevation_gain == null && !userPr && !trainingSuggestion &&
                  <p className="text-muted-foreground italic">More details coming soon.</p>}

             {race.website_url && (
                <div className="pt-1">
                    <a 
                        href={race.website_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center text-xs text-blue-600 hover:underline"
                    >
                        Visit Website <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                </div>
             )}
        </CardContent>
        <CardFooter className="pt-0 pb-3 border-t pt-3">
            {/* Discover Mode: Original Button */} 
            {viewMode === 'discover' && displayButton && (
                <Button 
                    variant={buttonState === 'success' ? 'outline' : buttonVariant}
                    size="sm" 
                    className="w-full"
                    disabled={isButtonDisabled}
                    onClick={(e) => { 
                        e.stopPropagation();
                        finalButtonAction(); // Uses add/remove logic based on isInPlan
                    }}
                >
                    {buttonState === 'loading' ? (
                        <>
                          Processing...
                        </>
                    ) : buttonState === 'success' ? (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> 
                          {finalButtonAction === handleAddRaceToPlan ? 'Added!' : 'Removed!'} 
                        </>
                    ) : buttonState === 'error' ? (
                        <>
                          <AlertCircle className="mr-2 h-4 w-4 text-destructive" /> Error
                        </>
                    ) : (
                        <>
                          <FinalButtonIcon className="mr-2 h-4 w-4" /> {finalButtonText}
                        </>
                    )}
                </Button> 
            )}

            {/* Plan Mode: Generate Plan Button + Ghost Remove Button */} 
            {viewMode === 'plan' && user && (
                <div className="flex w-full gap-2"> 
                    {/* View or Generate Plan Button */} 
                    <Button 
                        variant="default" 
                        size="sm" 
                        className="flex-grow"
                        onClick={hasSavedPlan ? handleViewPlanClick : handleGeneratePlanClick}
                        disabled={isGeneratingPlan || isViewingPlan || !user} // Disable if generating, viewing, or not logged in
                    >
                        {isGeneratingPlan ? (
                            <>
                                <span className="mr-2 h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
                                Generating...
                            </>
                         ) : isViewingPlan ? (
                            <>
                                <span className="mr-2 h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
                                Loading Plan...
                            </> 
                        ) : hasSavedPlan ? (
                             <>
                                 <Eye className="mr-2 h-4 w-4" /> View Plan {/* Use Eye icon */} 
                             </>
                        ) : (
                            <>
                                <Rocket className="mr-2 h-4 w-4" /> Generate Plan
                            </>
                        )}
                    </Button>

                    {/* Remove Button (Less prominent) */} 
                    <Button 
                        variant="ghost" // Ghost style for secondary action
                        size="icon" 
                        className="text-destructive hover:bg-destructive/10 flex-shrink-0" // Keep color, prevent grow/shrink
                        // Disable remove button if not logged in, or if any action is loading/successful
                        disabled={!user || buttonState === 'loading' || buttonState === 'success'} 
                        onClick={(e) => {
                             e.stopPropagation();
                             handleRemoveRaceFromPlan(); // Directly call remove handler
                        }}
                    >
                         {buttonState === 'loading' && finalButtonAction === handleRemoveRaceFromPlan ? (
                             <span className="h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
                         ) : buttonState === 'success' && finalButtonAction === handleRemoveRaceFromPlan ? (
                             <CheckCircle className="h-4 w-4 text-green-600" /> 
                         ) : buttonState === 'error' && finalButtonAction === handleRemoveRaceFromPlan ? (
                             <AlertCircle className="h-4 w-4 text-destructive" />
                         ) : (
                             <Trash2 className="h-4 w-4" />
                         )}
                        <span className="sr-only">Remove from Plan</span>
                    </Button>
                 </div>
            )}

            {/* Delete Plan Button (Show only if a plan exists) */}
            {hasSavedPlan && onDeletePlanRequest && (
                 <AlertDialog>
                     <AlertDialogTrigger asChild>
                         <Button 
                             variant="destructive"
                             size="sm"
                             className="col-start-2" // Position in the second column
                             disabled={isGeneratingPlan || isViewingPlan} // Disable if other actions are in progress
                         >
                             <Trash2 className="mr-2 h-4 w-4" /> Delete Plan
                         </Button>
                     </AlertDialogTrigger>
                     <AlertDialogContent>
                         <AlertDialogHeader>
                             <AlertDialogTitle className="flex items-center">
                                 <AlertTriangle className="h-5 w-5 mr-2 text-destructive"/> Are you absolutely sure?
                                </AlertDialogTitle>
                             <AlertDialogDescription>
                                 This action cannot be undone. This will permanently delete the generated training plan associated with the <strong>{race.name}</strong>.
                             </AlertDialogDescription>
                         </AlertDialogHeader>
                         <AlertDialogFooter>
                             <AlertDialogCancel>Cancel</AlertDialogCancel>
                             <AlertDialogAction 
                                 onClick={() => onDeletePlanRequest(race.id)}
                                 className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                             >
                                    Delete Plan
                                </AlertDialogAction>
                         </AlertDialogFooter>
                     </AlertDialogContent>
                 </AlertDialog>
            )}
        </CardFooter>
    </Card>
  );
} 