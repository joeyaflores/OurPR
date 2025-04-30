"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { WeeklyGoal } from "@/types/weekly_goal";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { format, parseISO } from 'date-fns';

// Helper to parse time string (HH:MM:SS or MM:SS) to seconds
function parseTimeToSecondsOptional(timeString: string | undefined | null): number | null {
    if (!timeString) return null;
    if (!/^(\d{1,2}:)?([0-5]?\d):([0-5]?\d)$/.test(timeString)) {
        throw new Error("Invalid time format. Use HH:MM:SS or MM:SS.");
    }
    const parts = timeString.split(':').map(Number);
    let hours = 0, minutes = 0, seconds = 0;
    if (parts.length === 3) { [hours, minutes, seconds] = parts; }
    else { [minutes, seconds] = parts; }
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || minutes >= 60 || seconds >= 60 || hours < 0 || minutes < 0 || seconds < 0) {
        throw new Error("Invalid time values.");
    }
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return totalSeconds > 0 ? totalSeconds : null;
}

// Helper to format seconds to time string (MM:SS or HH:MM:SS)
function formatSecondsToTimeInput(totalSeconds: number | null | undefined): string {
    if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds) || totalSeconds <= 0) {
        return "";
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(seconds).padStart(2, '0');
    if (hours > 0) {
        const paddedHours = String(hours).padStart(2, '0');
        return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
    } else if (minutes > 0 || seconds > 0) {
         return `${paddedMinutes}:${paddedSeconds}`;
    } else {
        return "";
    }
}

// Define interface for form values AFTER preprocessing
interface WeeklyGoalFormValues {
  target_distance_km?: string | null; // Input as string initially
  target_duration_str?: string | null;
  target_workouts?: string | null; // Input as string initially
}

// Zod schema for validation - treat numbers as strings initially
const formSchema = z.object({
  target_distance_km: z.string().optional().nullable().refine(
      (val) => !val || /^\d*\.?\d*$/.test(val) && (val === "" || parseFloat(val) > 0), // Allow empty or positive number format
      { message: "Must be a positive number" }
  ),
  target_duration_str: z.string().optional().nullable().refine(
      (val) => !val || /^(\d{1,2}:)?([0-5]?\d):([0-5]?\d)$/.test(val),
      { message: "Use HH:MM:SS or MM:SS format" }
    ).refine(
        (val) => {
            try {
                const seconds = parseTimeToSecondsOptional(val);
                return seconds === null || seconds > 0;
            } catch { return false; }
        }, { message: "Time must be positive"}
    ),
  target_workouts: z.string().optional().nullable().refine(
      (val) => !val || /^\d+$/.test(val) && (val === "" || parseInt(val) > 0), // Allow empty or positive integer format
      { message: "Must be a positive whole number" }
  ),
}).refine(data => {
    // Ensure at least one target is provided (as non-empty string)
    return (data.target_distance_km != null && data.target_distance_km !== "") ||
           (data.target_duration_str != null && data.target_duration_str !== "") ||
           (data.target_workouts != null && data.target_workouts !== "");
}, {
    message: "Set at least one goal (distance, time, or number of workouts).",
    path: ["target_distance_km"],
});

// Component Props
interface SetEditWeeklyGoalFormProps {
  goalToEdit?: WeeklyGoal | null;
  weekStartDate: Date; // Pass the actual Date object for the Monday
  onSubmit: (values: {
    week_start_date: string; // ISO string
    target_distance_meters?: number | null;
    target_duration_seconds?: number | null;
    target_workouts?: number | null;
  }) => Promise<void>; // Make async to handle submission state
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function SetEditWeeklyGoalForm({
  goalToEdit,
  weekStartDate,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: SetEditWeeklyGoalFormProps) {

  const form = useForm<WeeklyGoalFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      // Keep defaults as strings or null
      target_distance_km: goalToEdit?.target_distance_meters ? (goalToEdit.target_distance_meters / 1000).toString() : null,
      target_duration_str: formatSecondsToTimeInput(goalToEdit?.target_duration_seconds) || null,
      target_workouts: goalToEdit?.target_workouts?.toString() ?? null,
    },
  });

  // Form submission handler - Convert strings to numbers here
  async function handleFormSubmit(values: WeeklyGoalFormValues) {
    console.log("Form values (raw string):", values);
    let durationSeconds: number | null = null;
    try {
        durationSeconds = parseTimeToSecondsOptional(values.target_duration_str);
    } catch (error: any) {
        form.setError("target_duration_str", { type: "manual", message: error.message });
        return;
    }

    // Convert numbers, ensuring they are positive
    const distanceKm = values.target_distance_km ? parseFloat(values.target_distance_km) : null;
    const workouts = values.target_workouts ? parseInt(values.target_workouts) : null;

    // Ensure at least one target is set
    if (!distanceKm && !durationSeconds && !workouts) {
        form.setError("target_distance_km", { type: "manual", message: "Set at least one goal (distance, time, or number of workouts)." });
        return;
    }

    const submitData = {
        week_start_date: format(weekStartDate, 'yyyy-MM-dd'),
        target_distance_meters: distanceKm ? Math.round(distanceKm * 1000) : null,
        target_duration_seconds: durationSeconds,
        target_workouts: workouts,
    };

    console.log("Submitting data:", submitData);
    await onSubmit(submitData);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Fields now expect string values initially */}
        <FormField
          control={form.control}
          name="target_distance_km"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Target Distance (km)</FormLabel>
              <FormControl>
                 {/* Keep type="number" for browser input hints, but handle as string */}
                 <Input
                    type="number"
                    placeholder="e.g., 50"
                    step="0.1"
                    min="0"
                    {...field}
                    value={field.value ?? ""} // Handle undefined/null for controlled component
                    disabled={isSubmitting}
                 />
              </FormControl>
              <FormDescription>Total kilometers you aim to cover this week.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Target Duration */}
         <FormField
           control={form.control}
           name="target_duration_str"
           render={({ field }) => (
             <FormItem>
               <FormLabel>Target Time</FormLabel>
               <FormControl>
                 <Input
                    placeholder="HH:MM:SS or MM:SS (e.g., 05:00:00 or 45:00)"
                    {...field}
                    value={field.value ?? ""}
                    disabled={isSubmitting}
                 />
               </FormControl>
               <FormDescription>Total time you aim to spend working out this week.</FormDescription>
               <FormMessage />
             </FormItem>
           )}
         />

        {/* Target Workouts */}
        <FormField
          control={form.control}
          name="target_workouts"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Target Workouts</FormLabel>
              <FormControl>
                 {/* Keep type="number" for browser input hints */}
                 <Input
                    type="number"
                    placeholder="e.g., 5"
                    step="1"
                    min="0"
                    {...field}
                    value={field.value ?? ""} // Handle undefined/null
                    disabled={isSubmitting}
                 />
              </FormControl>
              <FormDescription>Number of workout sessions you aim to complete.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Saving..." : (goalToEdit ? "Update Goal" : "Set Goal")}
          </Button>
        </div>
      </form>
    </Form>
  );
} 