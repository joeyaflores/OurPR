'use client';

import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Race } from '@/lib/apiClient'; // Import the Race type
import { ExternalLink, CalendarDays, Thermometer, BarChart, Mountain } from 'lucide-react'; // Icons

interface RaceCardProps {
  race: Race;
  onAddToPlan?: (raceId: string) => void; // Optional action
}

export function RaceCard({ race, onAddToPlan }: RaceCardProps) {

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

  return (
    <Card key={race.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">{race.name}</CardTitle>
            <CardDescription className="flex items-center text-sm">
                 <CalendarDays className="mr-1.5 h-4 w-4" />
                 {race.date ? format(new Date(race.date), "PPP") : "Date TBD"}
                 {race.distance ? <span className="ml-2 font-medium">({race.distance})</span> : ''}
            </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2 pt-0 pb-4">
             {renderStat(BarChart, "Flatness", renderStars(race.flatness_score))}
             {renderStat(Mountain, "Elevation Gain", race.total_elevation_gain, " ft")}
             {renderStat(BarChart, "PR Potential", renderStars(race.pr_potential_score))}
             {renderStat(Thermometer, "Avg Temp", race.average_temp_fahrenheit, "°F")}
            
             {race.flatness_score === null && race.pr_potential_score === null && race.average_temp_fahrenheit === null &&
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
        {/* Optional Footer for actions like "Add to Plan" */}
        {/* {onAddToPlan && (
            <CardFooter className="pt-0 pb-3">
                <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onAddToPlan(race.id)}
                >
                    Add to Plan
                </Button> 
            </CardFooter>
        )} */}
    </Card>
  );
} 