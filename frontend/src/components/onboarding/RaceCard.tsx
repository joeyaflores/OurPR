'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Race } from '@/lib/apiClient'; // Import the Race type
import { ExternalLink, CalendarDays, Thermometer, BarChart, Mountain, PlusCircle, CheckCircle, AlertCircle, Trash2, Trophy, Clock } from 'lucide-react'; // Icons
import { createClient } from '@/lib/supabase/client'; // Import Supabase client
import type { User } from '@supabase/supabase-js';
import { toast } from "sonner"; // Import toast

// Action States for the button
type ActionState = 'idle' | 'loading' | 'success' | 'error';

interface RaceCardProps {
  race: Race;
  viewMode?: 'discover' | 'plan'; // Add viewMode prop
  onRaceRemoved?: (raceId: string | number) => void; // Callback for successful removal
  userPr?: string | null; // Add optional prop for user's PR time string
  timeUntilRace?: string; // Add optional prop for time until race string
}

// Add API Base URL (consider moving to a config file)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export function RaceCard({ race, viewMode = 'discover', onRaceRemoved, userPr, timeUntilRace }: RaceCardProps) { // Destructure viewMode with default and onRaceRemoved
    const supabase = createClient();
    const [user, setUser] = useState<User | null>(null);
    // State to track individual button states { [raceId]: ActionState }
    const [buttonState, setButtonState] = useState<ActionState>('idle'); 
    // State to hold the IDs of races currently in the user's plan
    const [plannedRaceIds, setPlannedRaceIds] = useState<Set<string | number>>(new Set());
    const [isPlanLoading, setIsPlanLoading] = useState(true); // Loading state for the plan itself

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
                        console.log(`RaceCard (${race.id}): No initial plan found (404).`);
                    } else {
                        throw new Error(`Failed to fetch plan: ${response.status}`);
                    }
                } else {
                    // Expect an array of Race objects now
                    const data: Race[] = await response.json(); 
                    // Extract the IDs to build the Set
                    setPlannedRaceIds(new Set(data.map(r => r.id)));
                    console.log(`RaceCard (${race.id}): Fetched planned race objects, extracted IDs:`, data.map(r=>r.id));
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

  return (
    <Card key={race.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col">
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
                 </div>
             )}

             {race.flatness_score == null && race.pr_potential_score == null && race.average_temp_fahrenheit == null && race.total_elevation_gain == null && !userPr &&
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
            {displayButton && (
                <Button 
                    variant={buttonState === 'success' ? 'outline' : buttonVariant}
                    size="sm" 
                    className="w-full"
                    disabled={isButtonDisabled}
                    onClick={(e) => { 
                        e.stopPropagation();
                        finalButtonAction();
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
        </CardFooter>
    </Card>
  );
} 