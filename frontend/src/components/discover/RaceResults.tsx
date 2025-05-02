"use client"; // Needs state for user session and button interaction

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Race } from "@/types/race"; // Import Race type
import { Badge } from "@/components/ui/badge"; // Import Badge
import { Sparkles, Users, Zap, Group, PlusCircle, CheckCircle, AlertCircle, Trash2, Mountain } from "lucide-react"; // Import icons and Mountain icon
import { Button } from "@/components/ui/button"; // Import Button
import { cn } from "@/lib/utils"; // Import cn for conditional classes
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton for loading state
import { useState, useEffect } from 'react'; // Import hooks
import { createClient } from '@/lib/supabase/client'; // Import browser client
import type { User } from '@supabase/supabase-js';
import { toast } from "sonner"; // Import toast from sonner
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip"; // Import Tooltip components
import { motion } from "framer-motion"; // <-- Import motion

// Define props interface
interface RaceResultsProps {
  races: Race[];
  onRaceHover: (id: string | number | null) => void; // Add hover callback prop
  onRaceSelect: (id: string | number | null) => void; // Add select callback prop
  selectedRaceId: string | number | null; // Add selected ID prop
  isLoading: boolean; // Add loading state prop
  error: string | null; // Add error state prop
}

// Action States for the button
type ActionState = 'idle' | 'loading' | 'success' | 'error';

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // Stagger the animation of children
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
    },
  },
};

// Note: This component will likely become a server component fetching data,
// or receive data as props from the main page component.

// Update component to receive and handle new props
export const RaceResults: React.FC<RaceResultsProps> = ({ 
  races, 
  onRaceHover, 
  onRaceSelect, 
  selectedRaceId, 
  isLoading, 
  error 
}) => {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  // State to track individual button states { [raceId]: ActionState }
  const [buttonStates, setButtonStates] = useState<Record<string | number, ActionState>>({}); 
  // State to hold the IDs of races currently in the user's plan
  const [plannedRaceIds, setPlannedRaceIds] = useState<Set<string | number>>(new Set());
  const [isPlanLoading, setIsPlanLoading] = useState(true); // Loading state for the plan itself

  // Get user session on mount
  useEffect(() => {
    const getInitialData = async () => {
      setIsUserLoading(true);
      setIsPlanLoading(true);
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setIsUserLoading(false);

      if (sessionError) {
        console.error("Error getting session:", sessionError);
        // Don't need to show toast here, button will just be disabled/show add
      }

      // If user is logged in, fetch their plan
      if (session) {
        const accessToken = session.access_token;
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
        const url = `${apiUrl}/api/users/me/plan/`;
        try {
          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          // Handle response based on status
          if (!response.ok) {
            // If backend returns 404 (no plan yet), treat as empty, not error
            if (response.status === 404) {
                 setPlannedRaceIds(new Set());
                 // console.log("RaceResults: No initial plan found (404).");
            } else {
                throw new Error(`Failed to fetch plan: ${response.status}`);
            }
          } else {
            // Expect an array of Race objects now
            const data: Race[] = await response.json(); 
            // Extract the IDs to build the Set
            setPlannedRaceIds(new Set(data.map(r => r.id)));
            // console.log("RaceResults: Fetched planned race objects, extracted IDs:", data.map(r=>r.id));
          }
        } catch (e) {
          console.error("Failed to fetch initial plan state:", e);
          setPlannedRaceIds(new Set()); // Reset on error
        }
      }
      setIsPlanLoading(false);
    };

    getInitialData();
    
    // TODO: Listen to auth changes like in AuthButton if needed
  }, [supabase]);

  // --- Add to Plan Handler ---
  const handleAddRaceToPlan = async (raceId: string | number) => {
    if (!user) {
      toast.error("Please log in to add races to your plan.");
      return;
    }
    setButtonStates(prev => ({ ...prev, [raceId]: 'loading' as ActionState }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const accessToken = session.access_token;
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      const url = `${apiUrl}/api/users/me/plan/`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ race_id: raceId })
      });
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) { throw new Error(errorData.detail || "Race already in plan."); }
        else { throw new Error(errorData.detail || `API error: ${response.status}`); }
      }
      setButtonStates(prev => ({ ...prev, [raceId]: 'success' as ActionState }));
      // Update local plan state immediately
      setPlannedRaceIds(prev => new Set(prev).add(raceId)); 
      toast.success("Race added to your plan!"); 
      setTimeout(() => { setButtonStates(prev => ({ ...prev, [raceId]: 'idle' as ActionState })); }, 2000); 
    } catch (e: any) {
      console.error("Failed to add race to plan:", e);
      setButtonStates(prev => ({ ...prev, [raceId]: 'error' as ActionState }));
      toast.error("Error adding race", { description: e.message }); 
      setTimeout(() => { setButtonStates(prev => ({ ...prev, [raceId]: 'idle' as ActionState })); }, 3000);
    }
  };

   // --- Remove from Plan Handler ---
   const handleRemoveRaceFromPlan = async (raceId: string | number) => {
    if (!user) {
      toast.error("Please log in to modify your plan.");
      return;
    }
    setButtonStates(prev => ({ ...prev, [raceId]: 'loading' as ActionState }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const accessToken = session.access_token;
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      // Construct URL with raceId for DELETE
      const url = `${apiUrl}/api/users/me/plan/${raceId}`; 

      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        // 204 No Content is success, so !response.ok handles actual errors
        const errorData = await response.json().catch(() => ({})); // Handle cases where error body might not be JSON
        if (response.status === 404) {
           throw new Error(errorData.detail || "Race not found in plan.");
        } else {
          throw new Error(errorData.detail || `API error: ${response.status}`);
        }
      }

      // Success (status 204)
      setButtonStates(prev => ({ ...prev, [raceId]: 'success' as ActionState }));
      // Update local plan state immediately
      setPlannedRaceIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(raceId);
        return newSet;
      });
      toast.success("Race removed from your plan!"); 
      setTimeout(() => { setButtonStates(prev => ({ ...prev, [raceId]: 'idle' as ActionState })); }, 2000); 

    } catch (e: any) {
      console.error("Failed to remove race from plan:", e);
      setButtonStates(prev => ({ ...prev, [raceId]: 'error' as ActionState }));
      toast.error("Error removing race", { description: e.message }); 
      setTimeout(() => { setButtonStates(prev => ({ ...prev, [raceId]: 'idle' as ActionState })); }, 3000);
    }
  };

  // Skeleton loader for race cards
  const RaceCardSkeleton = () => (
    <Card className="w-full max-w-sm flex flex-col">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-3/4" /> {/* Title */}
        <Skeleton className="h-4 w-1/2 pt-1" /> {/* Location/Date */}
      </CardHeader>
      <CardContent className="flex-grow space-y-3 pt-2">
        <div className="space-y-1">
          <Skeleton className="h-4 w-1/4" /> {/* Distance */}
          <Skeleton className="h-4 w-1/3" /> {/* Elevation */}
        </div>
        <Skeleton className="h-8 w-full" /> {/* AI Summary */}
        <Skeleton className="h-5 w-1/2" /> {/* PR Potential */}
        <div className="space-y-1 pt-1">
          <Skeleton className="h-4 w-3/5" /> {/* Social 1 */}
          <Skeleton className="h-4 w-2/5" /> {/* Social 2 */}
          <Skeleton className="h-4 w-4/6" /> {/* Social 3 */}
        </div>
        <Skeleton className="h-4 w-1/3 pt-2" /> {/* Website Link */}
        <Skeleton className="h-9 w-full mt-3" /> {/* Button */}
      </CardContent>
    </Card>
  );

  return (
    <section className="mt-6 w-full">
      {/* Conditional Rendering based on loading, error, and data */}

      {isLoading ? (
        // --- Loading State --- 
        <>
          <h2 className="text-2xl font-semibold mb-4 text-center text-gray-500">Loading Races...</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <RaceCardSkeleton />
            <RaceCardSkeleton />
            <RaceCardSkeleton />
          </div>
        </>
      ) : error ? (
        // --- Error State --- 
        <div className="text-center py-10 px-4">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="mt-2 text-xl font-semibold text-red-600">Error Loading Races</h2>
          <p className="mt-1 text-sm text-gray-600">{error}</p>
          {/* Optional: Add a retry button here */}
        </div>
      ) : races.length === 0 ? (
        // --- No Results State --- 
        <div className="text-center py-10 px-4">
          <Zap className="mx-auto h-12 w-12 text-gray-400" /> { /* Or another relevant icon */ }
          <h2 className="mt-2 text-xl font-semibold text-gray-700">No Races Found</h2>
          <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or search query.</p>
        </div>
      ) : (
        // --- Results Found State --- 
        <>
          <h2 className="text-2xl font-semibold mb-4 text-center">
             {`${races.length} Race${races.length !== 1 ? 's' : ''} Found`}
          </h2>
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {races.map((race) => {
              const isSelected = race.id === selectedRaceId;
              const currentState = buttonStates[race.id] || 'idle';
              const isInPlan = plannedRaceIds.has(race.id);
              // Disable button if race list is loading, user is loading, plan is loading, or action is in progress/success
              const isButtonDisabled = isLoading || isUserLoading || isPlanLoading || currentState === 'loading' || currentState === 'success';
              const buttonAction = isInPlan ? () => handleRemoveRaceFromPlan(race.id) : () => handleAddRaceToPlan(race.id);
              const buttonText = isInPlan ? "Remove from Plan" : "Add to Plan";
              const ButtonIcon = isInPlan ? Trash2 : PlusCircle;

              // Function to get the appropriate placeholder image
              const getPlaceholderImage = (distance: Race['distance']): string => {
                switch (distance) {
                  case '5K':
                  case '10K':
                    return '/images/generic-track.jpeg'; // Replace with your actual path
                  case 'Half Marathon':
                  case 'Marathon':
                    return '/images/generic-road.jpeg'; // Replace with your actual path
                  case '50K':
                  case '50 Miles':
                  case '100K':
                  case '100 Miles':
                    return '/images/generic-trail.jpeg'; // Replace with your actual path
                  default:
                    return '/images/generic-default.jpeg'; // A default fallback
                }
              };

              return (
                <motion.div 
                  key={race.id}
                  variants={itemVariants}
                  className={cn(
                    "w-full max-w-sm cursor-pointer transition-all duration-200",
                    isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "ring-0"
                  )}
                  onMouseEnter={() => onRaceHover(race.id)}
                  onMouseLeave={() => onRaceHover(null)}
                  onClick={() => onRaceSelect(race.id === selectedRaceId ? null : race.id)}
                >
                  <Card
                    className={cn(
                      "w-full h-full flex flex-col", // Ensure card fills motion div
                    )}
                  >
                    {/* Image Container */}
                    <img 
                      src={race.image_url || getPlaceholderImage(race.distance)} 
                      alt={`${race.name} - ${race.distance} race course`} 
                      className="w-full h-32 object-cover" // Adjust height (h-32) as needed
                      onError={(e) => {
                        // Optional: Handle image load errors, e.g., set to default placeholder
                        const target = e.target as HTMLImageElement;
                        target.onerror = null; // Prevent infinite loop if fallback also fails
                        target.src = '/images/generic-default.jpeg'; // Fallback image
                      }}
                    />
                    <CardHeader className="pb-2 flex-row justify-between items-start">
                      <div>
                        <CardTitle className="text-lg font-semibold leading-tight">
                          {race.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground pt-1">
                          {/* Fix: Add T00:00:00 to parse date string as local time */}
                          {race.city}, {race.state} - {new Date(race.date + 'T00:00:00').toLocaleDateString()}
                        </p>
                      </div>
                       {/* Tooltip for Elevation - Use total_elevation_gain */}
                       {race.total_elevation_gain != null && (
                        <TooltipProvider delayDuration={100}>
                           <Tooltip>
                             <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="flex items-center gap-1 shrink-0"
                                  >
                                  <Mountain className="h-3 w-3" />
                                  {/* Display numeric elevation gain with unit */}
                                  {`${race.total_elevation_gain.toLocaleString()} ft of elevation gain`}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Total Elevation Gain</p>
                              </TooltipContent>
                            </Tooltip>
                         </TooltipProvider>
                       )}
                    </CardHeader>
                    <CardContent className="flex-grow space-y-3 pt-2"> {/* Added flex-grow and space-y */} 
                      {/* Basic Info */}
                      <div className="text-sm space-y-1"> {/* Add space-y-1 for better spacing */}
                        <p>Distance: {race.distance}</p>
                        {/* Display total_elevation_gain if available */}
                        {race.total_elevation_gain != null && (
                           <p className="flex items-center"> {/* Use flex for icon alignment */}
                             <Mountain className="h-4 w-4 mr-1.5 text-muted-foreground"/> {/* Add Mountain icon */}
                             {/* Display numeric elevation gain with unit */}
                             <span>Elevation Gain: {race.total_elevation_gain.toLocaleString()} ft</span>
                           </p>
                        )}
                      </div>

                      {/* AI Summary */}
                      {race.ai_summary && (
                        <div className="text-xs text-muted-foreground border-l-2 border-primary pl-2 italic my-2"> {/* Add margin-y */}
                          <Sparkles className="inline h-3 w-3 mr-1" /> {race.ai_summary}
                        </div>
                      )}

                      {/* PR Potential */}
                      {race.pr_potential_score && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center text-sm cursor-help"> {/* Added cursor-help */} 
                                  <Zap className="h-4 w-4 mr-1 text-yellow-500" />
                                  <span>PR Potential: </span>
                                  <Badge variant="secondary" className="ml-1.5">{race.pr_potential_score}/10</Badge>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs max-w-[200px]"> {/* Limit width */}
                                 Score (1-10) indicating potential for a personal record based on course profile and historical data.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {/* Social Signals */}
                      <div className="text-xs space-y-1 pt-1">
                        {race.similar_runners_count !== undefined && (
                          <div className="flex items-center text-muted-foreground">
                            <Users className="h-3 w-3 mr-1.5" /> {race.similar_runners_count} similar runners PR'd here
                          </div>
                        )}
                          {race.training_groups_count !== undefined && (
                          <div className="flex items-center text-muted-foreground">
                              <Group className="h-3 w-3 mr-1.5" /> {race.training_groups_count} training groups joined
                          </div>
                        )}
                        {race.similar_pace_runners_count !== undefined && (
                            <div className="flex items-center text-muted-foreground">
                              <Users className="h-3 w-3 mr-1.5" /> {race.similar_pace_runners_count} runners at your pace signed up
                          </div>
                        )}
                      </div>

                      {/* Website Link */}
                        {race.website && race.website !== '#' && (
                        <a href={race.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline mt-2 block pt-2 border-t border-dashed" onClick={(e) => e.stopPropagation()}>
                          Visit Website
                        </a>
                        )}
                    </CardContent>
                    <CardFooter>
                      <Button 
                        variant={isInPlan ? "destructive" : "outline"} 
                        size="sm" 
                        className="w-full" 
                        disabled={!user || isButtonDisabled} // Disable if not logged in or during action/loading
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          buttonAction(); // Call the determined action
                        }} 
                      >
                        {currentState === 'loading' ? (
                          <>
                            {/* Loading Spinner? */}
                            Processing...
                          </>
                        ) : currentState === 'success' ? (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> {isInPlan ? 'Added!' : 'Removed!'}
                          </>
                        ) : currentState === 'error' ? (
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
                </motion.div>
              );
            })}
          </motion.div>
        </>
      )}
    </section>
  );
}; 