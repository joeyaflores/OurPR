'use client';

import type { DetailedTrainingPlan, DetailedWeek, DailyWorkout } from '@/types/training_plan';
import React, { useState, useEffect } from 'react';
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
    ChevronUp,     // <-- Add Up Arrow
    ChevronDown,   // <-- Add Down Arrow
    CalendarMinus,
    CalendarPlus,
    Pencil,        // <-- Add Pencil Icon
} from "lucide-react";
import { 
    parseISO, 
    isPast, 
    isToday,
    startOfDay,
    endOfDay,
    differenceInDays,
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
import { workoutTypeMap, getWorkoutIcon } from './planUtils';
import { WorkoutDetailModal } from './WorkoutDetailModal';
import { EditWorkoutModal } from './EditWorkoutModal';
import Confetti from 'react-confetti';
import { AddNoteModal } from './AddNoteModal';
import { motion } from 'framer-motion';

// API Base URL (Consider moving to config)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

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

// --- Define Shiftable Workout Types --- 
// const SHIFTABLE_WORKOUT_TYPES: Set<DailyWorkout['workout_type']> = new Set([...]);
// Define types considered "hard" that flexible types shouldn't be moved next to
// const HARD_WORKOUT_TYPES: Set<DailyWorkout['workout_type']> = new Set([...]);
// -------------------------------------

interface TrainingPlanDisplayProps {
  plan: DetailedTrainingPlan;
  raceId: string | number;
  onPlanUpdate?: (updatedPlan: DetailedTrainingPlan) => void;
  userPrString?: string | null; // Keep for displaying personalization note if available
  isGoogleConnected: boolean;
  onPlanRefetchRequired: (raceId: string | number) => void;
}

export function TrainingPlanDisplay({ plan: initialPlan, raceId, onPlanUpdate, userPrString, isGoogleConnected, onPlanRefetchRequired }: TrainingPlanDisplayProps) {
    // Local state to manage the plan, allowing updates without full page reload
    const [plan, setPlan] = useState<DetailedTrainingPlan>(initialPlan);
    // State to track which day is currently being updated
    const [updatingDayDate, setUpdatingDayDate] = useState<string | null>(null);
    // State for managing the detail modal
    const [selectedWorkout, setSelectedWorkout] = useState<DailyWorkout | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    // --- State for Calendar Sync/Remove Loading ---
    const [isSyncing, setIsSyncing] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    // --- State for Editing Workout ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [workoutToEdit, setWorkoutToEdit] = useState<DailyWorkout | null>(null);
    // --- State for Confetti ---
    const [confettiPieces, setConfettiPieces] = useState(0);
    // --- State for Add Note Modal ---
    const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
    const [dayDateForNote, setDayDateForNote] = useState<string | null>(null);
    // -------------------------------------------

    // Update local state if the initial plan prop changes
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

  // --- Calculate Weekly Adherence --- 
  const calculateWeeklyConsistency = (week: DetailedWeek): number | null => {
      let plannedInWeek = 0;
      let completedInWeek = 0;
      const today = startOfDay(new Date());
      const weekStatus = getWeekStatus(week.start_date, week.end_date);

      // Only calculate for past or current weeks
      if (weekStatus === 'future') return null;

      week.days.forEach(day => {
          try {
              const dayDate = parseISO(day.date);
              // If it's a past week, consider all days.
              // If it's the current week, only consider days up to today.
              const considerDay = weekStatus === 'past' || (weekStatus === 'current' && dayDate <= today);

              if (considerDay && day.workout_type !== 'Rest') {
                  plannedInWeek++;
                  if (day.status === 'completed') {
                      completedInWeek++;
                  }
              }
          } catch (e) {
              console.error("Error parsing day date during weekly consistency calculation:", e);
          }
      });

      if (plannedInWeek === 0) {
          // If no non-rest workouts were planned in the relevant period, consistency is not applicable
          return null; 
      }

      return Math.round((completedInWeek / plannedInWeek) * 100);
  };
  // -------------------------------------

  // --- Determine if plan is already synced ---
  const isPlanSyncedToGoogle = plan.weeks.some(week => 
      week.days.some(day => !!day.google_event_id)
  );
  // -----------------------------------------

  // --- Function to handle status update API call --- 
  const handleUpdateStatus = async (dayDate: string, newStatus: DailyWorkout['status']) => {
      setUpdatingDayDate(dayDate); // Set loading state *before* any async/modal logic
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) {
          toast.error("Authentication error. Please log in again.");
          return;
      }

      if (!raceId) {
          toast.error("Error: Could not identify the race for this plan.");
          return;
      }

      const url = `${API_BASE_URL}/api/users/me/races/${raceId}/plan/days/${dayDate}`;

      const originalPlan = JSON.parse(JSON.stringify(plan)); // Deep copy for potential rollback

      const updatedPlanOptimistic = JSON.parse(JSON.stringify(plan)); // Deep copy to modify
      let dayUpdatedOptimistic = false;
      for (const week of updatedPlanOptimistic.weeks) {
          for (const day of week.days) {
              if (day.date === dayDate) {
                  day.status = newStatus;
                  dayUpdatedOptimistic = true;

                  // --- Trigger Confetti & Note Modal (if completing) --- 
                  if (newStatus === 'completed') {
                      setConfettiPieces(400); // More pieces!
                      setTimeout(() => setConfettiPieces(0), 2000); // Stop after 2 seconds
                      setDayDateForNote(dayDate); // Store date for the note modal
                      setIsAddNoteModalOpen(true); // Open the note modal
                  }
                  // --------------------------------------------------

                  // --- Trigger Weekly Summary if Sunday is completed --- 
                  const completedWorkout = updatedPlanOptimistic.weeks
                      .flatMap((w: DetailedWeek) => w.days)
                      .find((d: DailyWorkout) => d.date === dayDate);
                  
                  if (newStatus === 'completed' && completedWorkout?.day_of_week === 'Sunday') {
                      const completedWeekNumber = updatedPlanOptimistic.weeks.find((w: DetailedWeek) => w.days.some((d: DailyWorkout) => d.date === dayDate))?.week_number;
                      if (completedWeekNumber) {
                          // Find the actual week data to pass to the toast function
                          const weekData = updatedPlanOptimistic.weeks.find((w: DetailedWeek) => w.week_number === completedWeekNumber);
                          if (weekData) {
                             showWeeklySummaryToast(weekData); // Call summary function
                          }
                      }
                  }
                  // -----------------------------------------------------

                  break;
              }
          }
          if (dayUpdatedOptimistic) break;
      }
      if(dayUpdatedOptimistic) {
          setPlan(updatedPlanOptimistic);
      }

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
          
          // Optional: Call the onPlanUpdate callback if provided, passing the *optimistically* updated plan
          // This is now handled within saveUpdatedPlanToBackend to ensure it reflects the final saved state
          // if (onPlanUpdate && dayUpdatedOptimistic) {
          //     onPlanUpdate(updatedPlanOptimistic); 
          // }

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

  // --- Function to calculate weekly summary stats ---
  const calculateWeeklySummaryStats = (week: DetailedWeek) => {
    let plannedCount = 0;
    let completedCount = 0;

    week.days.forEach(day => {
      if (day.workout_type !== 'Rest') {
        plannedCount++;
        if (day.status === 'completed') {
          completedCount++;
        }
      }
    });

    const consistency = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : null;
    return { plannedCount, completedCount, consistency };
  };

  // --- Function to display the weekly summary toast ---
  const showWeeklySummaryToast = (week: DetailedWeek) => {
    const stats = calculateWeeklySummaryStats(week);
    const title = `🎉 Week ${week.week_number} Complete!`;
    let description = `You completed ${stats.completedCount} out of ${stats.plannedCount} planned workouts.`;
    if (stats.consistency !== null) {
      description += ` (${stats.consistency}% consistency)`;
    }
    // Add more stats here if needed in the future

    toast.success(title, { 
        description: description, 
        duration: 5000 // Longer duration for reading
    });
  };

  // --- Function to handle opening the detail modal --- 
  const handleViewDetails = (workout: DailyWorkout) => {
      setSelectedWorkout(workout);
      setIsDetailModalOpen(true);
  };

  // --- Function to handle shifting workouts --- 
  const handleShiftWorkout = (weekIndex: number, dayIndex: number, direction: 'up' | 'down') => {
      const targetDayIndex = direction === 'up' ? dayIndex - 1 : dayIndex + 1;

      // Basic boundary check
      if (targetDayIndex < 0 || targetDayIndex > 6) {
          // Keep boundary check
          toast.error("Cannot shift past the beginning or end of the week.");
          return;
      }

      const currentWeek = plan.weeks[weekIndex];
      const dayToMove = currentWeek.days[dayIndex];
      const targetDay = currentWeek.days[targetDayIndex];

      // --- REMOVE Validation Logic --- 
      // No more checks based on workout type or proximity
      // --- End Removed Validation ---

      // Swap only the workout details, keep date/day_of_week
      setPlan(prevPlan => {
          const newWeeks = [...prevPlan.weeks];
          const newDays = [...newWeeks[weekIndex].days];
          
          // Extract details to swap (including status)
          const detailsToMove = {
              workout_type: dayToMove.workout_type,
              description: dayToMove.description,
              distance: dayToMove.distance,
              duration: dayToMove.duration,
              intensity: dayToMove.intensity,
              notes: dayToMove.notes,
              status: dayToMove.status,
          };
          const detailsToReceive = {
              workout_type: targetDay.workout_type,
              description: targetDay.description,
              distance: targetDay.distance,
              duration: targetDay.duration,
              intensity: targetDay.intensity,
              notes: targetDay.notes,
              status: targetDay.status,
          };

          // Create new day objects with swapped details
          newDays[dayIndex] = {
              ...newDays[dayIndex], // Keep original date, day_of_week, etc.
              ...detailsToReceive // Apply details from target
          };
          newDays[targetDayIndex] = {
              ...newDays[targetDayIndex], // Keep original date, day_of_week, etc.
              ...detailsToMove // Apply details from source
          };

          newWeeks[weekIndex] = { ...newWeeks[weekIndex], days: newDays };
          const updatedPlan = { ...prevPlan, weeks: newWeeks };

          // --- Call API to persist the change --- 
          // Use an async IIFE (Immediately Invoked Function Expression) to handle the async call
          (async () => {
              const supabase = createClient();
              const { data: { session } } = await supabase.auth.getSession();
              const accessToken = session?.access_token;
              
              if (!accessToken) {
                  toast.error("Authentication error. Cannot save plan changes.");
                  // Consider rolling back the optimistic update here?
                  // setPlan(prevPlan); // Rollback
                  return; 
              }

              const saveUrl = `${API_BASE_URL}/api/users/me/races/${raceId}/generated-plan`;
              try {
                  const response = await fetch(saveUrl, {
                      method: 'PATCH',
                      headers: {
                          'Authorization': `Bearer ${accessToken}`,
                          'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(updatedPlan), // Send the whole updated plan
                  });

                  if (!response.ok) {
                      let errorDetail = `API error: ${response.status}`;
                      try {
                          const errorData = await response.json();
                          errorDetail = errorData.detail || errorDetail;
                      } catch { /* Ignore */ }
                      throw new Error(errorDetail);
                  }

                  // Success!
                  toast.success("Plan updated successfully!");
                  // The state is already updated optimistically.
                  // Optionally, update state with response if backend modifies it:
                  // const savedPlan = await response.json();
                  // setPlan(savedPlan); 

              } catch (error: any) {
                  console.error("Failed to save plan structure update:", error);
                  toast.error("Failed to save changes", { description: error.message });
                  // Rollback optimistic update on save failure
                  setPlan(prevPlan); // Revert to the state before this shift
              }
          })();
          // -----------------------------------------

          // Notify parent if needed (using the optimistically updated plan)
          if (onPlanUpdate) {
              onPlanUpdate(updatedPlan);
          }

          return updatedPlan; // Return optimistically updated plan for immediate UI change
      });
  };

  // --- Calendar Sync/Remove Handlers (Internal state management) ---
  const handleSyncPlan = async () => {
      setIsSyncing(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
          toast.error("Authentication error.");
          setIsSyncing(false);
          return;
      }
      
      const url = `${API_BASE_URL}/api/users/me/google-calendar/sync-plan/${raceId}`;
      try {
          const response = await fetch(url, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          const result = await response.json(); // Get JSON response
          if (!response.ok) {
              throw new Error(result.detail || `API error: ${response.status}`);
          }
          toast.success(result.message || "Plan synced to Google Calendar!");
          // TODO: Refetch the plan to get updated google_event_ids
          // For now, manually update the flag (less accurate)
          // A better approach would be to trigger a refetch via onPlanUpdate callback
          onPlanRefetchRequired(raceId);
          // --- Remove Simulation ---
          // Simulate sync state change until refetch is implemented
          // setPlan(prev => ({ ...prev, weeks: prev.weeks.map(w => ({ ...w, days: w.days.map(d => ({ ...d, google_event_id: d.google_event_id || (d.workout_type !== 'Rest' ? 'synced_placeholder' : null) })) })) }));

      } catch (e: any) {
          console.error("Failed to sync plan:", e);
          toast.error("Sync Failed", { description: e.message });
      } finally {
          setIsSyncing(false);
      }
  };

  const handleRemovePlan = async () => {
      setIsRemoving(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
          toast.error("Authentication error.");
          setIsRemoving(false);
          return;
      }

      const url = `${API_BASE_URL}/api/users/me/google-calendar/sync-plan/${raceId}`;
      try {
          const response = await fetch(url, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          // DELETE success is 204 No Content, or could be 200/202
          if (!response.ok && response.status !== 204) {
              let errorDetail = `API error: ${response.status}`;
              try {
                  const errorData = await response.json();
                  errorDetail = errorData.detail || errorDetail;
              } catch { /* Ignore */ }
              throw new Error(errorDetail);
          }
          toast.success("Plan removed from Google Calendar.");
          // TODO: Refetch the plan to clear google_event_ids
          onPlanRefetchRequired(raceId);
          // --- Remove Simulation ---
           // Simulate removal state change until refetch is implemented
          // setPlan(prev => ({ ...prev, weeks: prev.weeks.map(w => ({ ...w, days: w.days.map(d => ({ ...d, google_event_id: null })) })) }));

      } catch (e: any) {
          console.error("Failed to remove plan from calendar:", e);
          toast.error("Removal Failed", { description: e.message });
      } finally {
          setIsRemoving(false);
      }
  };
  // ---------------------------------------------------------------

  // --- Workout Editing Handlers (Placeholders for now) ---
  const handleOpenEditModal = (workout: DailyWorkout) => {
    console.log("Opening edit modal for:", workout);
    setWorkoutToEdit(workout);
    setIsEditModalOpen(true);
  };

  const handleUpdateWorkout = (updatedWorkout: DailyWorkout) => {
    console.log("Workout updated in modal (handler called):", updatedWorkout);
    // Find the week and day index
    let weekIndex = -1;
    let dayIndex = -1;
    const originalPlanForRollback = JSON.parse(JSON.stringify(plan)); // Deep copy for rollback

    for (let i = 0; i < plan.weeks.length; i++) {
        const foundDayIndex = plan.weeks[i].days.findIndex(d => d.date === updatedWorkout.date);
        if (foundDayIndex !== -1) {
            weekIndex = i;
            dayIndex = foundDayIndex;
            break;
        }
    }

    if (weekIndex === -1 || dayIndex === -1) {
        console.error("Could not find workout to update in local state.");
        toast.error("Update Error", { description: "Could not locate the workout to update." });
        setIsEditModalOpen(false); // Close modal even if error
        return;
    }

    // Create a new plan object with the updated workout (Optimistic Update)
    const updatedPlanOptimistic = JSON.parse(JSON.stringify(plan)); // Deep copy to modify
    updatedPlanOptimistic.weeks[weekIndex].days[dayIndex] = updatedWorkout;
    setPlan(updatedPlanOptimistic);

    setIsEditModalOpen(false); // Close the modal

    // Call the function to save to backend
    saveUpdatedPlanToBackend(updatedPlanOptimistic, originalPlanForRollback);
  };

  const saveUpdatedPlanToBackend = async (updatedPlan: DetailedTrainingPlan, originalPlan: DetailedTrainingPlan) => {
    console.log("Attempting to save updated plan to backend:", updatedPlan);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
        toast.error("Authentication error. Cannot save plan changes.");
        setPlan(originalPlan); // Rollback optimistic update
        return; 
    }

    const saveUrl = `${API_BASE_URL}/api/users/me/races/${raceId}/generated-plan`;
    try {
        const response = await fetch(saveUrl, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedPlan), // Send the whole updated plan
        });

        if (!response.ok) {
            let errorDetail = `API error: ${response.status}`;
            try {
                const errorData = await response.json();
                errorDetail = errorData.detail || errorDetail;
            } catch { /* Ignore */ }
            throw new Error(errorDetail);
        }

        // Success!
        toast.success("Workout updated successfully!");
        // The state is already updated optimistically.
        // Optionally update state with response if backend modifies it:
        // const savedPlan = await response.json();
        // setPlan(savedPlan);
        if(onPlanUpdate) onPlanUpdate(updatedPlan); // Notify parent of successful update 

    } catch (error: any) {
        console.error("Failed to save plan structure update after edit:", error);
        toast.error("Failed to save changes", { description: error.message });
        // Rollback optimistic update on save failure
        setPlan(originalPlan); 
        if(onPlanUpdate) onPlanUpdate(originalPlan); // Notify parent of rollback
    }    
  };

  // --- Function to handle saving the note from the modal ---
  const handleSaveNote = (targetDayDate: string, note: string) => {
    console.log(`Saving note for ${targetDayDate}:`, note);
    const originalPlanForRollback = JSON.parse(JSON.stringify(plan)); // Deep copy for rollback
    let noteAdded = false;

    const updatedPlanWithNote = JSON.parse(JSON.stringify(plan));
    // Find the day again and add the note
    for (const week of updatedPlanWithNote.weeks) {
        const day = week.days.find((d: DailyWorkout) => d.date === targetDayDate);
        if (day) {
            const existingNotes = day.notes || [];
            day.notes = [note, ...existingNotes]; // Prepend new note (no prefix)
            noteAdded = true;
            break;
        }
    }

    if (noteAdded) {
        setPlan(updatedPlanWithNote); // Optimistic UI update for the note
        // Now save the *entire* plan with the added note
        saveUpdatedPlanToBackend(updatedPlanWithNote, originalPlanForRollback);
    } else {
        console.error("Could not find day to add note to after modal save.");
        toast.error("Note Error", { description: "Could not save note to the plan." });
    }
  };
  // -----------------------------------------------------------

  return (
    <TooltipProvider delayDuration={150}>
        {/* Render Confetti conditionally based on state */} 
        <Confetti 
            numberOfPieces={confettiPieces} 
            recycle={false} 
            // Optional: Set width/height to cover viewport if needed 
            // width={window.innerWidth} 
            // height={window.innerHeight} 
        /> 
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
              {/* --- Goal Time --- */}
              {plan.goal_time && (
                  <div className="flex items-center text-sm text-primary font-medium">
                      <Target className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span>Goal: {plan.goal_time}</span>
                  </div>
              )}
              {/* --- Google Calendar Buttons --- */}
              {/* Logic moved slightly: Button shown conditionally based on sync status, 
                   enabled/disabled based on connection status */}
              <div className="mt-2 flex gap-2">
                  {isPlanSyncedToGoogle ? (
                      // --- Remove Button (Only shown if synced, implies connection exists) ---
                      <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleRemovePlan}
                          disabled={isRemoving || isSyncing} // Disable during any operation
                      >
                          {isRemoving ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                              <CalendarMinus className="mr-2 h-4 w-4" />
                          )}
                          Remove from Calendar
                      </Button>
                  ) : (
                      // --- Add Button (Always shown if not synced) ---
                      isGoogleConnected ? (
                         // --- Enabled Add Button ---
                         <Button 
                             variant="outline" 
                             size="sm" 
                             onClick={handleSyncPlan}
                             disabled={isSyncing || isRemoving} // Disable during any operation
                         >
                             {isSyncing ? (
                                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                             ) : (
                                 <CalendarPlus className="mr-2 h-4 w-4" />
                             )}
                             Add to Google Calendar
                         </Button>
                      ) : (
                          // --- Disabled Add Button with Tooltip ---
                          <Tooltip>
                             <TooltipTrigger asChild>
                                 {/* Span needed for Tooltip to work on disabled button */}
                                 <span tabIndex={0}> 
                                     <Button 
                                         variant="outline" 
                                         size="sm" 
                                         disabled // Always disabled if not connected
                                         className="cursor-not-allowed"
                                     >
                                         <CalendarPlus className="mr-2 h-4 w-4" />
                                         Add to Google Calendar
                                     </Button>
                                 </span>
                             </TooltipTrigger>
                             <TooltipContent>
                                 <p>Please connect your Google Calendar first.</p>
                             </TooltipContent>
                         </Tooltip>
                      )
                  )}
              </div>
              {/* ----------------------------- */}
               {/* --- Overall Adherence --- */}
               {overallAdherence !== null && (
                    <div className="flex items-center text-sm text-muted-foreground pt-1">
                        <CheckCheck className="h-4 w-4 mr-2 flex-shrink-0 text-green-600" />
;                        <span>Consistency: <strong>{overallAdherence}%</strong></span>
                    </div>
               )}
               {/* ----------------------- */}
               {/* --- Personalization Info --- */}
               {plan.personalization_details && Object.keys(plan.personalization_details).length > 0 && ( 
                 <div className="pt-2 text-xs text-muted-foreground space-y-0.5"> 
                     <p className="flex items-center font-medium"> 
                         <Sparkles className="h-4 w-4 mr-1.5 text-primary flex-shrink-0" /> 
                         <span>Plan Personalized With:</span> 
                     </p> 
                     <ul className="list-disc list-outside pl-6"> 
                         {plan.personalization_details.pr_used && ( 
                             <li>PR Used: {plan.personalization_details.pr_used}</li> 
                         )} 
                         {plan.personalization_details.goal_time_set && ( 
                             <li>Goal Time Input: {plan.personalization_details.goal_time_set}</li> 
                         )} 
                         {plan.personalization_details.current_mileage_input && ( 
                             <li>Current Mileage Input: {plan.personalization_details.current_mileage_input} miles/week</li> 
                         )} 
                         {plan.personalization_details.peak_mileage_input && ( 
                             <li>Peak Mileage Input: {plan.personalization_details.peak_mileage_input} miles/week</li> 
                         )} 
                         {plan.personalization_details.running_days_input && ( 
                             <li>Running Days Input: {plan.personalization_details.running_days_input} days/week</li> 
                         )} 
                         {plan.personalization_details.long_run_day_input && ( 
                             <li>Long Run Day Input: {plan.personalization_details.long_run_day_input}</li> 
                         )} 
                     </ul> 
                 </div> 
               )}

          </div>
          {/* --- End Header --- */}

          {/* Accordion for Weeks */}
          <div className="pb-4"> 
              <Accordion type="single" collapsible defaultValue={defaultAccordionValue} className="w-full space-y-2">
                {plan.weeks.map((week, weekIndex) => {
                    const dayIds = week.days.map(d => d.date);
                    const weekStatus = getWeekStatus(week.start_date, week.end_date);
                    const isPastWeek = weekStatus === 'past';
                    const isCurrentWeek = weekStatus === 'current';

                    // --- Check if all non-Rest workouts are completed --- 
                    const nonRestWorkouts = week.days.filter(d => d.workout_type !== 'Rest');
                    const isWeekFullyCompleted = nonRestWorkouts.length > 0 && nonRestWorkouts.every(d => d.status === 'completed');
                    // ----------------------------------------------------

                    return (
                        <AccordionItem 
                            key={week.week_number} 
                            value={`week-${week.week_number}`} 
                            className={cn(
                                "border rounded-md transition-all duration-300", // Base classes
                                isWeekFullyCompleted && "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700", // Persistent highlight
                                isPastWeek && !isWeekFullyCompleted && "bg-muted/50 border-muted/60", // Don't apply if completed
                                isCurrentWeek && !isWeekFullyCompleted && "border-primary border-2 shadow-md bg-primary/5", // Don't apply if completed
                                !isCurrentWeek && !isPastWeek && !isWeekFullyCompleted && "border bg-card" // Future week default 
                            )}
                        >
                            <AccordionTrigger 
                                className={cn(
                                    "px-4 py-3 text-base font-medium hover:no-underline", 
                                    isPastWeek && !isWeekFullyCompleted && "text-muted-foreground", // Mute if past but not fully done
                                )}
                            >
                                <div className="flex justify-between items-center w-full">
                                   <div className="flex flex-col items-start">
                                        <span className="font-semibold">Week {week.week_number}</span>
                                        <span className="text-xs text-muted-foreground font-normal">
                                            {format(parseISO(week.start_date), 'MMM d')} - {format(parseISO(week.end_date), 'MMM d, yyyy')}
                                        </span>
                                   </div>
                                   {/* Temporary Completion Badge - Will be replaced by persistent logic below */} 
                                   {/* {highlightedWeek === week.week_number && ( 
                                       <motion.div 
                                           initial={{ opacity: 0, scale: 0.5 }} 
                                           animate={{ opacity: 1, scale: 1 }} 
                                           exit={{ opacity: 0, scale: 0.5 }} 
                                           transition={{ duration: 0.3 }} 
                                       > 
                                            
                                           <Badge variant="default" className={cn(
                                               "ml-2 text-xs",
                                               "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-300 dark:border-green-700"
                                               )}>Week Complete!</Badge> 
                                       </motion.div> 
                                   )} */}
                                   {/* Persistent Completion Badge */} 
                                   {isWeekFullyCompleted && ( 
                                       <Badge variant="default" className={cn( 
                                           "ml-2 text-xs", 
                                           "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-300 dark:border-green-700" 
                                       )}> 
                                           🏆 Complete! 
                                       </Badge> 
                                   )} 
                                   <div className="flex items-center space-x-2">
                                       {week.estimated_weekly_mileage && (
                                            <Badge variant="outline" className="text-xs font-normal mr-2 hidden sm:inline-flex">
                                                ~{week.estimated_weekly_mileage}
                                            </Badge>
                                       )}
                                       {/* Display Weekly Consistency */}
                                       {(() => {
                                           const weeklyConsistency = calculateWeeklyConsistency(week);
                                           let label = "Progress:";

                                           if (isCurrentWeek) {
                                               try {
                                                   const daysPassed = differenceInDays(startOfDay(new Date()), parseISO(week.start_date)) + 1;
                                                   if (daysPassed < 4) {
                                                       label = "Progress (so far):";
                                                   }
                                               } catch (e) {
                                                   console.error("Error calculating days passed in week:", e);
                                               }
                                           }

                                           if (weeklyConsistency !== null) {
                                               return (
                                                   <Badge variant="secondary" className="text-xs font-normal hidden md:inline-flex">
                                                       {label} {weeklyConsistency}%
                                                   </Badge>
                                               );
                                           }
                                           return null;
                                       })()}
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
                                    {week.days.map((day, dayIndex) => {
                                        const dayStatus = getDayStatus(day.date);
                                        const isPastDay = dayStatus === 'past';
                                        const isTodayDay = dayStatus === 'today';
                                        const isLoading = updatingDayDate === day.date;
                                        const DayIcon = getWorkoutIcon(day.workout_type);

                                        return (
                                            <li key={day.date} className={cn(
                                                "flex items-start space-x-3 p-2 rounded-md transition-colors bg-card",
                                                isPastDay && !isTodayDay && "opacity-60",
                                                isTodayDay && "bg-secondary/50 ring-1 ring-primary/50",
                                                isLoading ? "shadow-lg" : "",
                                                "hover:bg-muted/40"
                                            )}>
                                                {/* Status Buttons */}
                                                <div 
                                                    className="flex flex-col items-center pt-1 space-y-1 w-6 flex-shrink-0"
                                                    onClick={(e) => e.stopPropagation()}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onTouchStart={(e) => e.stopPropagation()}
                                                >
                                                    {isLoading ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                    ) : (
                                                        <>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button
                                                                        onClick={(e) => {e.stopPropagation(); handleUpdateStatus(day.date, 'completed');}}
                                                                        disabled={isLoading}
                                                                        className={cn("rounded-full disabled:opacity-50", day.status === 'completed' ? "text-green-600" : "text-muted-foreground hover:text-green-500")}
                                                                    >
                                                                        <CheckCircle2 className="h-4 w-4" />
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="left"><p>Mark as Completed</p></TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button
                                                                        onClick={(e) => {e.stopPropagation(); handleUpdateStatus(day.date, 'skipped');}}
                                                                        disabled={isLoading}
                                                                        className={cn("rounded-full disabled:opacity-50", day.status === 'skipped' ? "text-red-600" : "text-muted-foreground hover:text-red-500")}
                                                                    >
                                                                        <XCircle className="h-4 w-4" />
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="left"><p>Mark as Skipped</p></TooltipContent>
                                                            </Tooltip>
                                                            {(day.status === 'completed' || day.status === 'skipped') && (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <button
                                                                            onClick={(e) => {e.stopPropagation(); handleUpdateStatus(day.date, 'pending');}}
                                                                            disabled={isLoading}
                                                                            className="rounded-full text-muted-foreground/60 hover:text-muted-foreground disabled:opacity-50"
                                                                        >
                                                                            <Circle className="h-3 w-3" />
                                                                        </button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="left"><p>Reset to Pending</p></TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                        </>
                                                    )}
                                                </div>

                                                {/* Main Content Area (Icon, Day, Details) - Takes up remaining space */} 
                                                <div 
                                                    className="flex-grow flex items-start space-x-3 cursor-pointer" 
                                                    onClick={() => handleViewDetails(day)}
                                                >
                                                    {/* Icon and Day of Week */}
                                                    <div className={cn("mt-1 flex-shrink-0 flex flex-col items-center w-12", isTodayDay && "font-semibold")}>
                                                        <DayIcon className={cn("h-5 w-5")} />
                                                        <span className="text-xs mt-0.5 text-muted-foreground">{day.day_of_week.substring(0,3)}</span>
                                                    </div>

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
                                                </div>

                                                {/* Shift Buttons Area (Aligned to the right) */} 
                                                <div className="flex flex-col space-y-0.5 flex-shrink-0 ml-2 items-center"> {/* Vertical column for buttons + Edit */} 
                                                                        {/* Shift Up Button */}
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-40"
                                                                            onClick={(e) => {e.stopPropagation(); handleShiftWorkout(weekIndex, dayIndex, 'up');}}
                                                                            disabled={dayIndex === 0} // Only disable based on position
                                                                            aria-label="Shift workout up"
                                                                        >
                                                                            <ChevronUp className="h-4 w-4" />
                                                                        </Button>
                                                                        {/* Shift Down Button */}
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-40"
                                                                            onClick={(e) => {e.stopPropagation(); handleShiftWorkout(weekIndex, dayIndex, 'down');}}
                                                                            disabled={dayIndex === 6} // Only disable based on position
                                                                            aria-label="Shift workout down"
                                                                        >
                                                                            <ChevronDown className="h-4 w-4" />
                                                                        </Button>
                                                                        {/* Add Edit Button */} 
                                                                        <Tooltip> 
                                                                            <TooltipTrigger asChild> 
                                                                                <Button 
                                                                                    variant="ghost" 
                                                                                    size="icon" 
                                                                                    className="h-6 w-6 text-muted-foreground hover:text-primary disabled:opacity-40" 
                                                                                    onClick={(e) => { e.stopPropagation(); handleOpenEditModal(day); }} 
                                                                                    disabled={isLoading} // Disable if status is updating 
                                                                                    aria-label="Edit workout" 
                                                                                > 
                                                                                    <Pencil className="h-4 w-4" /> 
                                                                                </Button> 
                                                                            </TooltipTrigger> 
                                                                            <TooltipContent side="top"> 
                                                                                <p>Edit Workout</p> 
                                                                            </TooltipContent> 
                                                                        </Tooltip> 
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

          {/* Render the Detail Modal */}
          <WorkoutDetailModal 
              isOpen={isDetailModalOpen} 
              onOpenChange={setIsDetailModalOpen} 
              workout={selectedWorkout} 
          />

          {/* Render the Edit Modal */} 
          <EditWorkoutModal 
              isOpen={isEditModalOpen} 
              onOpenChange={setIsEditModalOpen} 
              workout={workoutToEdit} 
              onSave={handleUpdateWorkout} 
          /> 

          {/* Render the Add Note Modal */} 
          <AddNoteModal 
              isOpen={isAddNoteModalOpen} 
              onOpenChange={setIsAddNoteModalOpen} 
              dayDate={dayDateForNote} 
              onSaveNote={handleSaveNote} 
          /> 
        </div>
    </TooltipProvider>
  );
} ;