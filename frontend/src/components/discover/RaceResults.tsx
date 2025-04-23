import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Race } from "@/types/race"; // Import Race type
import { Badge } from "@/components/ui/badge"; // Import Badge
import { Sparkles, Users, Zap, Group, PlusCircle } from "lucide-react"; // Import icons and PlusCircle
import { Button } from "@/components/ui/button"; // Import Button
import { cn } from "@/lib/utils"; // Import cn for conditional classes
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton for loading state

// Define props interface
interface RaceResultsProps {
  races: Race[];
  onRaceHover: (id: string | number | null) => void; // Add hover callback prop
  onRaceSelect: (id: string | number | null) => void; // Add select callback prop
  selectedRaceId: string | number | null; // Add selected ID prop
  isLoading: boolean; // Add loading state prop
  error: string | null; // Add error state prop
}

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
    <section className="mt-6">
      <h2 className="text-xl font-semibold mb-4 text-center">
        {/* Update title based on loading/error state */}
        {isLoading ? 'Loading Races...' : error ? 'Error' : races.length > 0 ? `${races.length} Races Found` : 'No Races Found'}
      </h2>

      {/* Handle Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
          {/* Show multiple skeletons */} 
          {[...Array(3)].map((_, index) => <RaceCardSkeleton key={index} />)}
        </div>
      )}

      {/* Handle Error State */}
      {!isLoading && error && (
        <p className="text-destructive col-span-full text-center py-10">
          Error loading races: {error}
        </p>
      )}

      {/* Handle No Results State (only if not loading and no error) */}
      {!isLoading && !error && races.length === 0 && (
        <p className="text-muted-foreground col-span-full text-center py-10">
          No races match your criteria.
        </p>
      )}

      {/* Display Results (only if not loading, no error, and races exist) */}
      {!isLoading && !error && races.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
          {races.map((race) => {
            const isSelected = race.id === selectedRaceId;
            return (
              <Card 
                key={race.id} 
                className={cn(
                  "w-full max-w-sm cursor-pointer transition-shadow hover:shadow-md flex flex-col",
                  isSelected && "ring-2 ring-primary shadow-md"
                )}
                onMouseEnter={() => onRaceHover(race.id)} // Set hovered ID on enter
                onMouseLeave={() => onRaceHover(null)} // Clear hovered ID on leave
                onClick={() => onRaceSelect(race.id)} // Call select handler on click
              >
                <CardHeader className="pb-2"> {/* Reduced bottom padding */}
                  <CardTitle className="text-lg">{race.name}</CardTitle> {/* Slightly smaller title */} 
                  <p className="text-sm text-muted-foreground pt-1"> {/* Basic info */}
                    {race.city}, {race.state} - {race.date}
                  </p>
                </CardHeader>
                <CardContent className="flex-grow space-y-3 pt-2"> {/* Added flex-grow and space-y */} 
                  {/* Basic Info */}
                  <div className="text-sm">
                    <p>Distance: {race.distance}</p>
                    {race.elevation && <p>Elevation: {race.elevation}</p>}
                  </div>

                  {/* AI Summary */}
                  {race.aiSummary && (
                    <div className="text-xs text-muted-foreground border-l-2 border-primary pl-2 italic">
                      <Sparkles className="inline h-3 w-3 mr-1" /> {race.aiSummary}
                    </div>
                  )}

                  {/* PR Potential */}
                  {race.prPotentialScore && (
                    <div className="flex items-center text-sm">
                        <Zap className="h-4 w-4 mr-1 text-yellow-500" />
                        <span>PR Potential: </span>
                        <Badge variant="secondary" className="ml-1.5">{race.prPotentialScore}/10</Badge>
                    </div>
                  )}

                  {/* Social Signals */}
                  <div className="text-xs space-y-1 pt-1">
                    {race.similarRunnersCount !== undefined && (
                      <div className="flex items-center text-muted-foreground">
                        <Users className="h-3 w-3 mr-1.5" /> {race.similarRunnersCount} similar runners PR'd here
                      </div>
                    )}
                      {race.trainingGroupsCount !== undefined && (
                      <div className="flex items-center text-muted-foreground">
                          <Group className="h-3 w-3 mr-1.5" /> {race.trainingGroupsCount} training groups joined
                      </div>
                    )}
                    {race.similarPaceRunnersCount !== undefined && (
                        <div className="flex items-center text-muted-foreground">
                          <Users className="h-3 w-3 mr-1.5" /> {race.similarPaceRunnersCount} runners at your pace signed up
                      </div>
                    )}
                  </div>

                  {/* Website Link */}
                    {race.website && race.website !== '#' && (
                    <a href={race.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline mt-2 block pt-2 border-t border-dashed">
                      Visit Website
                    </a>
                    )}

                    {/* Add placeholder button */}
                    <Button variant="outline" size="sm" className="w-full mt-3" disabled>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add to Plan
                    </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}; 