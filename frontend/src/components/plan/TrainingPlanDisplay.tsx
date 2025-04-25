'use client';

import type { TrainingPlanOutline, WeeklySummary } from '@/types/training_plan';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CalendarIcon, Info } from "lucide-react";
import { 
    parseISO, 
    differenceInWeeks, 
    startOfWeek, 
    subWeeks, 
    isPast, 
    isToday,
    endOfWeek,
    addDays
} from 'date-fns';

interface TrainingPlanDisplayProps {
  plan: TrainingPlanOutline;
  raceDate: string;
}

// Helper to determine week status relative to today
const getWeekStatus = (weekNumber: number, totalWeeks: number, raceDateString: string): 'past' | 'current' | 'future' => {
    try {
        const raceDate = parseISO(raceDateString);
        const today = new Date();

        // Calculate the start date of the target week number relative to the race week
        // Week 1 starts totalWeeks before race week, Week N starts totalWeeks - N + 1 before race week
        const weeksBeforeRace = totalWeeks - weekNumber + 1;
        const weekStartDate = startOfWeek(subWeeks(raceDate, weeksBeforeRace), { weekStartsOn: 1 }); // Start week on Mon
        const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 }); // End week on Sun

        // Check if today falls within this week
        if (today >= weekStartDate && today <= weekEndDate) {
            return 'current';
        }
        // Check if the week is entirely in the past
        if (today > weekEndDate) {
            return 'past';
        }
        // Otherwise, the week is in the future
        return 'future';

    } catch (error) {
        console.error("Error calculating week status:", error);
        return 'future'; // Default to future if calculation fails
    }
};

export function TrainingPlanDisplay({ plan, raceDate }: TrainingPlanDisplayProps) {
  if (!plan) return null;

  let defaultAccordionValue: string | undefined;
  // Use the updated getWeekStatus logic to find the current week for default open
  for (const week of plan.weeks) {
      const status = getWeekStatus(week.week_number, plan.total_weeks, raceDate);
      if (status === 'current') {
          defaultAccordionValue = `week-${week.week_number}`;
          break; // Found the current week
      }
  }
  // NOTE: The defaultAccordionValue calculation below this loop was removed as redundant
  // It's now handled by the getWeekStatus call within the loop itself.
  // We keep the error handling for the initial parse though.
  try {
     const raceDateObj = parseISO(raceDate); // Still need to parse for basic checks if needed
     // Example basic check (optional): Ensure race date is valid if other logic depends on it
  } catch (error) {
      console.error("Error parsing race date for default open calculation:", error);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Training Outline: {plan.race_name} ({plan.race_distance})</h3>
      <p className="text-sm text-muted-foreground">Total Weeks: {plan.total_weeks}</p>

      <Accordion type="single" collapsible defaultValue={defaultAccordionValue} className="w-full">
        {plan.weeks.map((week) => {
            const status = getWeekStatus(week.week_number, plan.total_weeks, raceDate);
            const isPastWeek = status === 'past';
            const isCurrentWeek = status === 'current';

            return (
                <AccordionItem 
                    value={`week-${week.week_number}`} 
                    key={week.week_number}
                    className={cn(
                        "border rounded-md mb-2 overflow-hidden transition-all", // Base item style
                        isPastWeek && "opacity-60 bg-muted/50 border-transparent",
                        isCurrentWeek && "border-primary border-2 shadow-md",
                        !isCurrentWeek && "border"
                    )}
                >
                    <AccordionTrigger 
                        className={cn(
                            "px-4 py-3 text-base font-semibold hover:no-underline",
                            isPastWeek && "line-through"
                        )}
                    >
                        <div className="flex justify-between items-center w-full">
                           <span>Week {week.week_number}</span>
                           {isCurrentWeek && (
                                <Badge variant="default" className="text-xs mr-4">Current Week</Badge> // Added margin
                           )}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className={cn("px-4 pb-3 pt-1 text-sm", isPastWeek && "line-through")}>
                        <p>{week.summary}</p>
                        {week.estimated_weekly_mileage && (
                            <p className="text-xs text-muted-foreground mt-1">
                                ~{week.estimated_weekly_mileage}
                            </p>
                        )}
                    </AccordionContent>
                </AccordionItem>
            );
        })}
      </Accordion>

      {plan.notes && plan.notes.length > 0 && (
          <div className="mt-6 p-3 border rounded-md bg-muted/50 text-muted-foreground">
              <h4 className="font-semibold text-sm mb-2 flex items-center">
                  <Info className="h-4 w-4 mr-2" /> Coach Notes
              </h4>
              <ul className="list-disc list-inside space-y-1 text-xs">
                  {plan.notes.map((note, index) => (
                      <li key={index}>{note}</li>
                  ))}
              </ul>
          </div>
      )}
    </div>
  );
} 