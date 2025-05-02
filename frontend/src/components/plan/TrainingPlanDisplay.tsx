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
import {
    CalendarIcon,
    Info,
    Footprints,    // Easy Run
    Gauge,         // Tempo Run
    Zap,           // Interval/Speed
    TrendingUp,    // Long Run
    Bed,           // Rest
    Bike,          // Cross-Training
    ChevronsDown,  // Taper
    Sparkles       // Personalization indicator
} from "lucide-react";
import { 
    parseISO, 
    differenceInWeeks, 
    startOfWeek, 
    subWeeks, 
    isPast, 
    isToday,
    endOfWeek,
    addDays,
    format,
    formatDistanceToNowStrict
} from 'date-fns';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import React from 'react';

interface TrainingPlanDisplayProps {
  plan: TrainingPlanOutline;
  raceDate: string;
  userPrString?: string | null;
}

// --- Keyword Definitions for Tooltips and Icons ---
const keywordMap: Record<string, { icon: React.ElementType, tooltip: string }> = {
    "Easy Run": { icon: Footprints, tooltip: "Run at a comfortable, conversational pace to build aerobic base." },
    "Tempo Run": { icon: Gauge, tooltip: "Run at a 'comfortably hard' pace, sustainable for a significant duration (e.g., 20-60 min), to improve lactate threshold." },
    "Intervals": { icon: Zap, tooltip: "Short, high-intensity bursts followed by recovery periods, designed to improve speed and efficiency." },
    "Speed Work": { icon: Zap, tooltip: "High-intensity running (like intervals or hill repeats) aimed at improving pace and running economy." },
    "Long Run": { icon: TrendingUp, tooltip: "The longest run of the week, done at an easy pace, crucial for endurance and mental toughness." },
    "Rest Day": { icon: Bed, tooltip: "Crucial for recovery and adaptation. No running or strenuous activity." },
    "Cross-Training": { icon: Bike, tooltip: "Activities other than running (e.g., cycling, swimming, strength training) to improve overall fitness and reduce injury risk." },
    "Taper": { icon: ChevronsDown, tooltip: "Reducing training volume in the final weeks before a race to allow the body to recover and be fresh on race day." },
    // Add more terms as needed
};
// Create a regex to match any of the keywords, case-insensitive, ensuring whole words
const keywordRegex = new RegExp(`\\b(${Object.keys(keywordMap).join('|')})\\b`, 'gi');

// --- Helper Function to Format Summary ---
const formatSummary = (summary: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    summary.replace(keywordRegex, (match, _, offset) => {
        // Add text before the match
        if (offset > lastIndex) {
            parts.push(summary.substring(lastIndex, offset));
        }

        // Find the keyword definition (case-insensitive lookup)
        const keywordInfo = Object.entries(keywordMap).find(([key]) => key.toLowerCase() === match.toLowerCase())?.[1];

        if (keywordInfo) {
            const IconComponent = keywordInfo.icon;
            parts.push(
                <Tooltip key={offset}>
                    <TooltipTrigger asChild>
                        <span className="inline-flex items-center font-semibold whitespace-nowrap mx-1">
                             <IconComponent className="h-4 w-4 mr-1 flex-shrink-0" />
                            {match}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="max-w-xs">{keywordInfo.tooltip}</p>
                    </TooltipContent>
                </Tooltip>
            );
        } else {
             // Should not happen with the regex, but fallback to plain text
            parts.push(match);
        }

        lastIndex = offset + match.length;
        return match; // Required by replace, value isn't used directly here
    });

    // Add any remaining text after the last match
    if (lastIndex < summary.length) {
        parts.push(summary.substring(lastIndex));
    }

    return parts;
};
// ----------------------------------------

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

export function TrainingPlanDisplay({ plan, raceDate, userPrString }: TrainingPlanDisplayProps) {
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

  // --- Add Date and Countdown Calculation ---
  let formattedRaceDate: string | null = null;
  let timeUntilRace: string | null = null;
  try {
    const parsedDate = parseISO(raceDate);
    formattedRaceDate = format(parsedDate, 'MMMM d, yyyy');
    // Only show countdown if the race is in the future
    if (!isPast(parsedDate) || isToday(parsedDate)) {
        timeUntilRace = formatDistanceToNowStrict(parsedDate, { addSuffix: true });
    } else {
        timeUntilRace = "Race Finished"; // Or handle as needed
    }
  } catch (error) {
    console.error("Error formatting race date/countdown:", error);
    formattedRaceDate = "Invalid Date";
  }
  // --- End Calculation ---

  return (
    <TooltipProvider delayDuration={300}>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Training Outline: {plan.race_name} ({plan.race_distance})</h3>
          <p className="text-sm text-muted-foreground">Total Weeks: {plan.total_weeks}</p>
          {userPrString && (
            <p className="text-xs flex items-center mt-1">
              <Sparkles className="h-4 w-4 mr-1.5 text-primary flex-shrink-0" />
              <span>
                Personalized considering your {plan.race_distance} PR: {userPrString}
              </span>
            </p>
          )}
          {formattedRaceDate && (
              <div className="flex items-center text-sm text-muted-foreground mt-1">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  <span>{formattedRaceDate}</span>
                  {timeUntilRace && timeUntilRace !== "Race Finished" && (
                     <span className="ml-2 text-xs">({timeUntilRace})</span>
                  )}
              </div>
          )}

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
                            isCurrentWeek && "border-primary border-2 shadow-md bg-primary/10",
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
                            <p className="leading-relaxed">{formatSummary(week.summary)}</p>
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
    </TooltipProvider>
  );
} 