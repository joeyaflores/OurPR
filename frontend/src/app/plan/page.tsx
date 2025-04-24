'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { RaceCard } from '@/components/onboarding/RaceCard'; // Assuming RaceCard is here or adjust path
import type { Race } from '@/lib/apiClient'; // Or your correct Race type path
import type { UserPr } from '@/types/user_pr'; // <-- Import UserPr type
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { AlertCircle } from 'lucide-react'; // For error state
import { differenceInDays, differenceInWeeks, formatDistanceToNowStrict, isToday, isPast, parseISO } from 'date-fns'; // <-- Import date-fns functions

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
                        if (race.date) {
                            try {
                                const raceDate = parseISO(race.date); // Use parseISO for ISO strings
                                const now = new Date();
                                
                                if (isToday(raceDate)) {
                                    timeUntilRaceString = "Today!";
                                } else if (isPast(raceDate)) {
                                    timeUntilRaceString = "Past";
                                } else {
                                    const daysUntil = differenceInDays(raceDate, now);
                                    if (daysUntil < 14) {
                                        // Show days if less than 2 weeks
                                        timeUntilRaceString = `in ${daysUntil + 1} day${daysUntil === 0 ? '' : 's'}`;
                                    } else {
                                        // Show weeks otherwise
                                        const weeksUntil = differenceInWeeks(raceDate, now);
                                        timeUntilRaceString = `in ${weeksUntil} week${weeksUntil === 1 ? '' : 's'}`;
                                    }
                                    // More robust alternative using formatDistanceToNowStrict:
                                    // timeUntilRaceString = `in ${formatDistanceToNowStrict(raceDate)}`; 
                                }
                            } catch (e) {
                                console.error("Error parsing race date:", race.date, e);
                                timeUntilRaceString = "Invalid Date";
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
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// Helper components needed for Skeleton (if not globally available)
const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={`border bg-card text-card-foreground shadow-sm rounded-lg ${className}`}>{children}</div>;
const CardHeader = ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>;
const CardContent = ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={`p-6 pt-0 ${className}`}>{children}</div>;
const CardFooter = ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={`flex items-center p-6 pt-0 ${className}`}>{children}</div>; 