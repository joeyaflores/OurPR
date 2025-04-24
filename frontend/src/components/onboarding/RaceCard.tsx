'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Race } from '@/lib/apiClient'; // Import the Race type
import { ExternalLink, CalendarDays, Thermometer, BarChart, Mountain, PlusCircle, CheckCircle, AlertCircle, Trash2 } from 'lucide-react'; // Icons
import { createClient } from '@/lib/supabase/client'; // Import Supabase client
import type { User } from '@supabase/supabase-js';
import { toast } from "sonner"; // Import toast

// Action States for the button
type ActionState = 'idle' | 'loading' | 'success' | 'error';

interface RaceCardProps {
  race: Race;
}

// Add API Base URL (consider moving to a config file)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export function RaceCard({ race }: RaceCardProps) {
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
                if (!response.ok) throw new Error('Failed to fetch plan');
                const data: string[] = await response.json(); 
                setPlannedRaceIds(new Set(data));
                console.log(`RaceCard (${race.id}): Fetched planned race IDs:`, data);
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
    const buttonAction = isInPlan ? handleRemoveRaceFromPlan : handleAddRaceToPlan;
    const buttonText = isInPlan ? "Remove from Plan" : "Add to Plan";
    const ButtonIcon = isInPlan ? Trash2 : PlusCircle;

  return (
    <Card key={race.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col">
        <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">{race.name}</CardTitle>
            <CardDescription className="flex items-center text-sm">
                 <CalendarDays className="mr-1.5 h-4 w-4" />
                 {race.date ? format(new Date(race.date), "PPP") : "Date TBD"}
                 {race.distance ? <span className="ml-2 font-medium">({race.distance})</span> : ''}
            </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2 pt-0 pb-4 flex-grow">
             {renderStat(BarChart, "Flatness", renderStars(race.flatness_score))}
             {renderStat(Mountain, "Elevation Gain", race.total_elevation_gain, " ft")}
             {renderStat(BarChart, "PR Potential", race.pr_potential_score != null ? `${race.pr_potential_score}/10` : "N/A")}
             {renderStat(Thermometer, "Avg Temp", race.average_temp_fahrenheit, "°F")}
            
             {race.flatness_score == null && race.pr_potential_score == null && race.average_temp_fahrenheit == null && race.total_elevation_gain == null &&
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
            <Button 
                variant={buttonState === 'success' ? 'outline' : (isInPlan ? 'destructive' : 'outline')} 
                size="sm" 
                className="w-full"
                disabled={isButtonDisabled}
                onClick={(e) => { 
                    e.stopPropagation(); // Prevent card click if needed
                    buttonAction(); 
                }}
            >
                {buttonState === 'loading' ? (
                    <>
                      Processing...
                    </>
                ) : buttonState === 'success' ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> {isInPlan ? 'Added!' : 'Removed!'}
                    </>
                ) : buttonState === 'error' ? (
                    <>
                      <AlertCircle className="mr-2 h-4 w-4 text-destructive" /> Error
                    </>
                ) : (
                    <>
                      <ButtonIcon className="mr-2 h-4 w-4" /> {buttonText}
                    </>
                )}
            </Button> 
        </CardFooter>
    </Card>
  );
} 