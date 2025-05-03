'use client';

import type { DetailedTrainingPlan, DetailedWeek, DailyWorkout } from '@/types/training_plan';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
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
    Dumbbell,      // Strength (New)
    Play,          // Warm-up (Placeholder)
    Pause,         // Cool-down (Placeholder)
    Flag,          // Race Pace (Placeholder)
    HelpCircle,    // Other/Unknown
    Sparkles,       // Personalization indicator
    CheckCircle2,  // Completed
    XCircle,       // Skipped
    Circle,        // Pending (or use default)
    Loader2,       // Loading state for update
    Target,        // Target icon
    CheckCheck,    // CheckCheck icon
} from "lucide-react";
import {
    parseISO,
    isPast,
    isToday,
    startOfDay,
    endOfDay,
    format
} from 'date-fns';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import React from 'react';

// API Base URL (Consider moving to config)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// --- Workout Type Definitions for Icons and Tooltips ---
const workoutTypeMap: Record<DailyWorkout['workout_type'], { icon: React.ElementType, tooltip: string }> = {
    "Easy Run": { icon: Footprints, tooltip: "Run at a comfortable, conversational pace to build aerobic base." },
    "Tempo Run": { icon: Gauge, tooltip: "Run at a 'comfortably hard' pace, sustainable for a significant duration, to improve lactate threshold." },
    "Intervals": { icon: Zap, tooltip: "Short, high-intensity bursts followed by recovery periods, designed to improve speed and efficiency." },
    "Speed Work": { icon: Zap, tooltip: "High-intensity running (like intervals or hill repeats) aimed at improving pace and running economy." },
    "Long Run": { icon: TrendingUp, tooltip: "The longest run of the week, done at an easy pace, crucial for endurance and mental toughness." },
    "Rest": { icon: Bed, tooltip: "Crucial for recovery and adaptation. No running or strenuous activity planned." },
    "Cross-Training": { icon: Bike, tooltip: "Activities other than running (e.g., cycling, swimming) to improve overall fitness and reduce injury risk." },
    "Strength": { icon: Dumbbell, tooltip: "Strength training exercises to support running and prevent injuries." },
    "Race Pace": { icon: Flag, tooltip: "Running sections or the entire workout at your target race pace." },
    "Warm-up": { icon: Play, tooltip: "Preparation before a main workout, typically including light cardio and dynamic stretches." },
    "Cool-down": { icon: Pause, tooltip: "Gradual reduction in activity after a workout, often involving easy jogging/walking and static stretching." },
    "Other": { icon: HelpCircle, tooltip: "Activity type not specifically categorized." },
    // Add more specific types as needed in DailyWorkout interface
};

// --- Helper Function to get Workout Icon ---
const getWorkoutIcon = (workoutType: DailyWorkout['workout_type']): React.ElementType => {
    return workoutTypeMap[workoutType]?.icon || HelpCircle; // Fallback icon
};
// ----------------------------------------


interface TrainingPlanDisplayProps {
  plan: DetailedTrainingPlan;
  raceId: string | number;
  onPlanUpdate?: (updatedPlan: DetailedTrainingPlan) => void;
  userPrString?: string | null; // Keep for displaying personalization note if available
}

// Helper to determine week status relative to today using week start/end dates
const getWeekStatus = (weekStartDateStr: string, weekEndDateStr: string): 'past' | 'current' | 'future' => {
    try {
        const today = startOfDay(new Date()); // Use startOfDay for consistent comparison
        const weekStartDate = parseISO(weekStartDateStr);
        const weekEndDate = endOfDay(parseISO(weekEndDateStr)); // Use endOfDay to include the full Sunday

        // Check if today falls within this week
        if (today >= weekStartDate && today <= weekEndDate) {
            return 'current';
        }
        // Check if the week is entirely in the past (week end date is before today)
        if (today > weekEndDate) {
            return 'past';
        }
        // Otherwise, the week is in the future
        return 'future';

    } catch (error) {
        console.error("Error calculating week status from dates:", error);
        return 'future'; // Default to future if calculation fails
    }
};

// Helper to determine day status
const getDayStatus = (dayDateStr: string): 'past' | 'today' | 'future' => {
    try {
        const today = startOfDay(new Date());
        const dayDate = parseISO(dayDateStr);

        if (isToday(dayDate)) {
            return 'today';
        }
        if (isPast(dayDate) && !isToday(dayDate)) {
            return 'past';
        }
        return 'future';
    } catch (error) {
        console.error("Error calculating day status:", error);
        return 'future';
    }
};


export function TrainingPlanDisplay({ plan: initialPlan, raceId, onPlanUpdate, userPrString }: TrainingPlanDisplayProps) {
    // Local state to manage the plan, allowing updates without full page reload
    const [plan, setPlan] = useState<DetailedTrainingPlan>(initialPlan);
    // State to track which day is currently being updated
    const [updatingDayDate, setUpdatingDayDate] = useState<string | null>(null);

    // Update local state if the initial plan prop changes
    // This is important if the parent component refetches the plan
    useEffect(() => {
        setPlan(initialPlan);
    }, [initialPlan]);

  if (!plan || !plan.weeks || plan.weeks.length === 0) {
      console.warn("TrainingPlanDisplay: Plan data is missing or empty.");
      return <Card><CardHeader><CardTitle>Training Plan Unavailable</CardTitle><CardDescription>Could not load the training plan details.</CardDescription></CardHeader></Card>;
  }

  let defaultAccordionValue: string | undefined;
  // Find the current week based on its start and end dates for default open
  for (const week of plan.weeks) {
      const status = getWeekStatus(week.start_date, week.end_date);
      if (status === 'current') {
          defaultAccordionValue = `week-${week.week_number}`;
          break; // Found the current week
      }
  }
   // If no current week found (e.g., plan is entirely future/past), open the first week
   if (!defaultAccordionValue && plan.weeks.length > 0) {
        defaultAccordionValue = `week-${plan.weeks[0].week_number}`;
   }


  // --- Date and Countdown Calculation (using plan.race_date) ---
  let formattedRaceDate: string | null = null;
  let raceDateObj : Date | null = null;
  try {
    raceDateObj = parseISO(plan.race_date);
    formattedRaceDate = format(raceDateObj, 'PPPP'); // e.g., "Tuesday, June 6th, 2023"
  } catch (error) {
    console.error("Error formatting race date:", error);
    formattedRaceDate = "Invalid Date";
  }
  // --- End Calculation ---

  // --- Calculate Overall Adherence --- 
  const calculateOverallAdherence = (): number | null => {
      if (!plan || !plan.weeks) return null;
      
      let totalPastPlanned = 0;
      let totalCompleted = 0;
      const today = startOfDay(new Date());

      plan.weeks.forEach(week => {
          week.days.forEach(day => {
              try {
                  const dayDate = parseISO(day.date);
                  // Consider only days up to and including today
                  if (dayDate <= today) {
                      // Count non-rest days as planned
                      if (day.workout_type !== 'Rest') {
                          totalPastPlanned++;
                          // Count completed days
                          if (day.status === 'completed') {
                              totalCompleted++;
                          }
                      }
                  }
              } catch (e) {
                  console.error("Error parsing day date during adherence calculation:", e);
              }
          });
      });

      if (totalPastPlanned === 0) {
          return null; // Avoid division by zero, return null if no past planned days
      }

      return Math.round((totalCompleted / totalPastPlanned) * 100);
  };

  const overallAdherence = calculateOverallAdherence();
  // -------------------------------------

  // --- Function to handle status update API call --- 
  const handleUpdateStatus = async (dayDate: string, newStatus: DailyWorkout['status']) => {
      setUpdatingDayDate(dayDate); // Set loading state for this specific day
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) {
          toast.error("Authentication error. Please log in again.");
          setUpdatingDayDate(null); // Clear loading state
          return;
      }

      if (!raceId) {
          toast.error("Error: Could not identify the race for this plan.");
          setUpdatingDayDate(null);
          return;
      }

      const url = `${API_BASE_URL}/api/users/me/races/${raceId}/plan/days/${dayDate}`;

      // --- Optimistic UI Update --- 
      // Temporarily update the local state before the API call completes
      const originalPlan = JSON.parse(JSON.stringify(plan)); // Deep copy for potential rollback
      const updatedPlanOptimistic = JSON.parse(JSON.stringify(plan)); // Deep copy to modify
      let dayUpdatedOptimistic = false;
      for (const week of updatedPlanOptimistic.weeks) {
          for (const day of week.days) {
              if (day.date === dayDate) {
                  day.status = newStatus;
                  dayUpdatedOptimistic = true;
                  break;
              }
          }
          if (dayUpdatedOptimistic) break;
      }
      if(dayUpdatedOptimistic) {
          setPlan(updatedPlanOptimistic);
      }
      // -----------------------------

      try {
          const response = await fetch(url, {
              method: 'PATCH',
              headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({ status: newStatus }),
          });

          if (!response.ok) {
              let errorDetail = `API error: ${response.status}`;
              try {
                  const errorData = await response.json();
                  errorDetail = errorData.detail || errorDetail;
              } catch { /* Ignore */ }
              throw new Error(errorDetail);
          }

          // API call successful, the optimistic update is now confirmed.
          // We could potentially update the local state with the response data if needed,
          // but the optimistic update already did it.
          const updatedDay: DailyWorkout = await response.json(); 
          // console.log("Successfully updated status for", dayDate, "to", updatedDay.status);
          
          // Optional: Call the onPlanUpdate callback if provided, passing the *optimistically* updated plan
          // This allows the parent component to know the state has changed.
          if (onPlanUpdate && dayUpdatedOptimistic) {
              onPlanUpdate(updatedPlanOptimistic);
          }

      } catch (e: any) {
          console.error("Failed to update workout status:", e);
          toast.error("Update failed", { description: e.message });
          // Rollback the optimistic update on error
          setPlan(originalPlan);
          if (onPlanUpdate) {
              onPlanUpdate(originalPlan); // Also notify parent of rollback
          }
      } finally {
          setUpdatingDayDate(null); // Clear loading state regardless of outcome
      }
  };


  return (
    <TooltipProvider delayDuration={150}>
        <div className="space-y-4">
          {/* --- Header Info --- */}
          {/* Use background based on race date? */}
          <div className={cn(
              "p-4 rounded-t-md space-y-1.5",
              raceDateObj && isPast(raceDateObj) ? "bg-muted/60" : "bg-primary/5"
          )}>
              <h3 className="text-lg font-semibold">{plan.race_name} ({plan.race_distance})</h3>
              <p className="text-sm text-muted-foreground">Total Weeks: {plan.total_weeks}</p>
              {/* --- Race Date --- */}
              {formattedRaceDate && (
                  <div className="flex items-center text-sm text-muted-foreground">
                      <CalendarIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span>Race Date: {formattedRaceDate}</span>
                      {raceDateObj && isPast(raceDateObj) && (
                         <Badge variant="secondary" className="ml-2 text-xs">Completed</Badge>
                      )}
                  </div>
              )}
               {/* --- Overall Adherence --- */}
               {overallAdherence !== null && (
                    <div className="flex items-center text-sm text-muted-foreground pt-1">
                        <CheckCheck className="h-4 w-4 mr-2 flex-shrink-0 text-green-600" />
                        <span>Training Consistency: <strong>{overallAdherence}%</strong></span>
                    </div>
               )}
               {/* ----------------------- */}
               {/* --- Personalization Info --- */}
               {/* Use plan.personalization_details if available */}
               {plan.personalization_details?.pr_used && (
                 <p className="text-xs flex items-center text-muted-foreground">
                   <Sparkles className="h-4 w-4 mr-1.5 text-primary flex-shrink-0" />
                   <span>
                     Personalized using {plan.personalization_details.pr_used}
                   </span>
                 </p>
               )}
               {/* Display provided userPrString as fallback/override if needed? */}
               {/* For now, prioritize plan.personalization_details */}
               {/* {userPrString && !plan.personalization_details?.pr_used && ( ... )} */}

          </div>
          {/* --- End Header --- */}

          {/* Accordion for Weeks */}
          <div className="pb-4">
              <Accordion type="single" collapsible defaultValue={defaultAccordionValue} className="w-full space-y-2">
                {plan.weeks.map((week) => {
                    const weekStatus = getWeekStatus(week.start_date, week.end_date);
                    const isPastWeek = weekStatus === 'past';
                    const isCurrentWeek = weekStatus === 'current';

                    return (
                        <AccordionItem
                            value={`week-${week.week_number}`}
                            key={week.week_number}
                            className={cn(
                                "border rounded-md overflow-hidden transition-all duration-300",
                                isPastWeek && "bg-muted/50 border-muted/60",
                                isCurrentWeek && "border-primary border-2 shadow-md bg-primary/5",
                                !isCurrentWeek && !isPastWeek && "border bg-card" // Future week default
                            )}
                        >
                            <AccordionTrigger
                                className={cn(
                                    "px-4 py-3 text-base font-medium hover:no-underline", // Adjusted font weight
                                    isPastWeek && "text-muted-foreground",
                                )}
                            >
                                <div className="flex justify-between items-center w-full">
                                   <div className="flex flex-col items-start">
                                        <span className="font-semibold">Week {week.week_number}</span>
                                        <span className="text-xs text-muted-foreground font-normal">
                                            {format(parseISO(week.start_date), 'MMM d')} - {format(parseISO(week.end_date), 'MMM d, yyyy')}
                                        </span>
                                   </div>
                                   <div className="flex items-center space-x-2">
                                       {week.estimated_weekly_mileage && (
                                            <Badge variant="outline" className="text-xs font-normal mr-2 hidden sm:inline-flex">
                                                ~{week.estimated_weekly_mileage}
                                            </Badge>
                                       )}
                                       {isCurrentWeek && (
                                            <Badge variant="default" className="text-xs">Current</Badge>
                                       )}
                                       {isPastWeek && (
                                             <Badge variant="secondary" className="text-xs">Done</Badge>
                                       )}
                                   </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className={cn("px-4 pb-3 pt-1 border-t", isPastWeek ? "border-muted/60" : isCurrentWeek ? "border-primary/40" : "border-border")}>
                                {week.weekly_focus && (
                                     <p className="text-sm font-semibold mb-3 mt-1">{week.weekly_focus}</p>
                                )}
                                <ul className="space-y-2">
                                   {week.days.map((day) => {
                                        const DayIcon = getWorkoutIcon(day.workout_type);
                                        const dayStatus = getDayStatus(day.date);
                                        const isPastDay = dayStatus === 'past';
                                        const isTodayDay = dayStatus === 'today';
                                        const isLoading = updatingDayDate === day.date;

                                        return (
                                            <li key={day.date} className={cn(
                                                "flex items-start space-x-3 p-2 rounded-md transition-colors",
                                                isPastDay && !isTodayDay && "opacity-60",
                                                isTodayDay && "bg-secondary/50 ring-1 ring-primary/50",
                                            )}>
                                                {/* --- Status Update Buttons --- */}
                                                <div className="flex flex-col items-center pt-1 space-y-1 w-6">
                                                    {isLoading ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                    ) : (
                                                        <>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button
                                                                        onClick={() => handleUpdateStatus(day.date, 'completed')}
                                                                        disabled={isLoading}
                                                                        className={cn(
                                                                            "rounded-full disabled:opacity-50",
                                                                            day.status === 'completed' ? "text-green-600" : "text-muted-foreground hover:text-green-500"
                                                                        )}
                                                                    >
                                                                        <CheckCircle2 className="h-4 w-4" />
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="left"><p>Mark as Completed</p></TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button
                                                                        onClick={() => handleUpdateStatus(day.date, 'skipped')}
                                                                        disabled={isLoading}
                                                                        className={cn(
                                                                            "rounded-full disabled:opacity-50",
                                                                            day.status === 'skipped' ? "text-red-600" : "text-muted-foreground hover:text-red-500"
                                                                        )}
                                                                    >
                                                                        <XCircle className="h-4 w-4" />
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="left"><p>Mark as Skipped</p></TooltipContent>
                                                            </Tooltip>
                                                             {/* Optional: Button to reset to pending? */}
                                                             {(day.status === 'completed' || day.status === 'skipped') && (
                                                                 <Tooltip>
                                                                     <TooltipTrigger asChild>
                                                                         <button
                                                                             onClick={() => handleUpdateStatus(day.date, 'pending')}
                                                                             disabled={isLoading}
                                                                             className="rounded-full text-muted-foreground/60 hover:text-muted-foreground disabled:opacity-50"
                                                                         >
                                                                             <Circle className="h-3 w-3" /> {/* Smaller icon for pending */} 
                                                                         </button>
                                                                     </TooltipTrigger>
                                                                     <TooltipContent side="left"><p>Reset to Pending</p></TooltipContent>
                                                                 </Tooltip>
                                                             )}
                                                        </>
                                                    )}
                                                </div>
                                                {/* ------------------------- */}

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        {/* Icon and Day */}
                                                        <div className={cn("mt-1 flex-shrink-0 flex flex-col items-center w-12", isTodayDay && "font-semibold")}>
                                                            <DayIcon className={cn("h-5 w-5", workoutTypeMap[day.workout_type]?.tooltip ? "cursor-help" : "")} />
                                                             <span className="text-xs mt-0.5 text-muted-foreground">{day.day_of_week.substring(0,3)}</span>
                                                             {/* Add checkmark placeholder */}
                                                             {/* <Checkbox className="mt-1 h-4 w-4" disabled={isPastDay || isTodayDay} checked={day.status === 'completed'} /> */}
                                                        </div>
                                                    </TooltipTrigger>
                                                    {workoutTypeMap[day.workout_type]?.tooltip && (
                                                        <TooltipContent side="top" className="max-w-xs">
                                                            <p><strong>{day.workout_type}:</strong> {workoutTypeMap[day.workout_type].tooltip}</p>
                                                        </TooltipContent>
                                                    )}
                                                </Tooltip>

                                                {/* Workout Details */}
                                                <div className="flex-grow">
                                                    <p className={cn("text-sm font-medium leading-snug", isTodayDay && "font-semibold")}>
                                                        {day.description}
                                                    </p>
                                                    <div className="text-xs text-muted-foreground space-x-2 mt-0.5">
                                                        {day.distance && <span>{day.distance}</span>}
                                                        {day.duration && <span>{day.duration}</span>}
                                                        {day.intensity && <Badge variant="outline" className="text-xs font-normal">{day.intensity}</Badge>}
                                                    </div>
                                                     {day.notes && day.notes.length > 0 && (
                                                        <ul className="list-disc list-inside text-xs text-muted-foreground/80 mt-1 pl-1">
                                                            {day.notes.map((note, idx) => <li key={idx}>{note}</li>)}
                                                        </ul>
                                                     )}
                                                </div>
                                            </li>
                                        );
                                   })}
                                </ul>
                            </AccordionContent>
                        </AccordionItem>
                    );
                })}
              </Accordion>

              {/* Overall Coach Notes */}
              {plan.overall_notes && plan.overall_notes.length > 0 && (
                  <div className="mt-6 p-3 border rounded-md bg-muted/80 text-muted-foreground">
                      <h4 className="font-semibold text-sm mb-2 flex items-center">
                          <Info className="h-4 w-4 mr-2 flex-shrink-0" /> Coach Notes
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                          {plan.overall_notes.map((note, index) => (
                              <li key={index}>{note}</li>
                          ))} 
                      </ul>
                  </div>
              )}
          </div> {/* End padding div for accordion/notes */}
        </div>
    </TooltipProvider>
  );
} 