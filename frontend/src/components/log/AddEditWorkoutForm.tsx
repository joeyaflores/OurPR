'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CalendarIcon, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { Workout, ActivityType, WorkoutPayload } from "@/types/workout";
import { useState, useEffect } from "react";

// Define allowed activity types for the form dropdown
const activityTypes: [ActivityType, ...ActivityType[]] = ['run', 'bike', 'swim', 'walk', 'other'];

// Define the form schema using Zod
const workoutFormSchema = z.object({
  date: z.date({ required_error: "Workout date is required." }),
  activity_type: z.enum(activityTypes, { required_error: "Activity type is required."}),
  distance: z.string().default(""),
  distance_unit: z.enum(['km', 'miles']).default('km'),
  duration_h: z.string().default(""),
  duration_m: z.string().default(""),
  duration_s: z.string().default(""),
  notes: z.string().max(500, "Notes must be 500 characters or less.").default(""),
  effort_level: z.string().optional(),
}).refine(data => {
    const hasDistance = data.distance && parseFloat(data.distance) > 0;
    const hasDuration = (data.duration_h && parseInt(data.duration_h, 10) > 0) ||
                        (data.duration_m && parseInt(data.duration_m, 10) > 0) ||
                        (data.duration_s && parseInt(data.duration_s, 10) > 0);
    return hasDistance || hasDuration;
}, {
    message: "Please enter either distance or duration for the workout.",
    path: ["distance"],
});


type WorkoutFormValues = z.infer<typeof workoutFormSchema>;

// Helper to parse duration fields to seconds
const parseDurationToSeconds = (h?: string, m?: string, s?: string): number | undefined => {
    const hours = parseInt(h || '0', 10) || 0;
    const minutes = parseInt(m || '0', 10) || 0;
    const seconds = parseInt(s || '0', 10) || 0;
    if (hours === 0 && minutes === 0 && seconds === 0) return undefined;
    return (hours * 3600) + (minutes * 60) + seconds;
};

// Helper to format seconds to H, M, S strings
const formatSecondsToDuration = (totalSeconds: number | null | undefined): { h: string, m: string, s: string } => {
    if (totalSeconds === null || totalSeconds === undefined || totalSeconds <= 0) {
        return { h: '', m: '', s: '' };
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {
        h: hours > 0 ? String(hours) : '',
        m: minutes > 0 ? String(minutes) : '',
        s: seconds > 0 ? String(seconds) : '',
    };
};

// Helper to convert distance input to meters
const parseDistanceToMeters = (distance?: string, unit?: 'km' | 'miles'): number | undefined => {
    const distValue = parseFloat(distance || '0');
    if (distValue <= 0) return undefined;
    if (unit === 'miles') {
        return distValue * 1609.34;
    }
    // Default to km
    return distValue * 1000;
};

// Helper to convert meters to display unit (defaults to km)
const formatMetersToDistance = (meters: number | null | undefined, unit: 'km' | 'miles' = 'km'): string => {
    if (meters === null || meters === undefined || meters <= 0) return '';
    if (unit === 'miles') {
        return (meters / 1609.34).toFixed(2); // Keep 2 decimal places for miles
    }
    // Default to km
    return (meters / 1000).toFixed(2); // Keep 2 decimal places for km
};


interface AddEditWorkoutFormProps {
  workoutToEdit?: Workout | null;
  onSubmit: (payload: WorkoutPayload, workoutId?: string) => Promise<void>;
  onCancel: () => void;
  onDelete?: (workoutId: string) => Promise<void>;
  isSubmitting: boolean;
}

export function AddEditWorkoutForm({
  workoutToEdit,
  onSubmit,
  onCancel,
  onDelete,
  isSubmitting,
}: AddEditWorkoutFormProps) {

  // Explicitly set initial unit based on edit or default
  const initialDistanceUnit = 'km'; // Default to km, adjust if needed based on user pref later
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'miles'>(initialDistanceUnit);

  // Initialize form values
  const defaultValues: WorkoutFormValues = {
    date: workoutToEdit ? new Date(workoutToEdit.date + 'T00:00:00') : new Date(),
    activity_type: workoutToEdit?.activity_type || 'run',
    // Initialize distance based on the *initial* unit
    distance: workoutToEdit?.distance_meters ? formatMetersToDistance(workoutToEdit.distance_meters, initialDistanceUnit) : "",
    distance_unit: initialDistanceUnit,
    duration_h: formatSecondsToDuration(workoutToEdit?.duration_seconds).h || "",
    duration_m: formatSecondsToDuration(workoutToEdit?.duration_seconds).m || "",
    duration_s: formatSecondsToDuration(workoutToEdit?.duration_seconds).s || "",
    notes: workoutToEdit?.notes || "",
    effort_level: workoutToEdit?.effort_level ? String(workoutToEdit.effort_level) : undefined,
  };

  const form = useForm<WorkoutFormValues>({
    resolver: zodResolver(workoutFormSchema),
    defaultValues,
    mode: "onChange",
  });

   // Effect to update the displayed distance value when the unit changes *after* initial load
   useEffect(() => {
       const currentDistanceMeters = workoutToEdit?.distance_meters;
       if (currentDistanceMeters) {
           form.setValue('distance', formatMetersToDistance(currentDistanceMeters, distanceUnit), { shouldValidate: true });
       }
       // Update the distance_unit in the form state as well
       form.setValue('distance_unit', distanceUnit);
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [distanceUnit, workoutToEdit?.distance_meters]); // Depend on distanceUnit and initial meters
   // Note: workoutToEdit is intentionally omitted from deps to avoid resetting distance on prop change


  // Handle form submission
  const processSubmit = async (data: WorkoutFormValues) => {
      const durationSeconds = parseDurationToSeconds(data.duration_h, data.duration_m, data.duration_s);
      const distanceMeters = parseDistanceToMeters(data.distance, data.distance_unit);

      // Safely parse effort_level
      let effortLevel: number | null = null;
      if (data.effort_level) {
          const parsedEffort = parseInt(data.effort_level, 10);
          if (!isNaN(parsedEffort) && parsedEffort >= 1 && parsedEffort <= 5) {
              effortLevel = parsedEffort;
          } else {
              console.warn("Invalid effort level input, submitting as null:", data.effort_level);
          }
      }

      // Define the payload with the specific WorkoutPayload type
      const payload: WorkoutPayload = {
          date: format(data.date, 'yyyy-MM-dd'),
          activity_type: data.activity_type,
          distance_meters: distanceMeters ?? null,
          duration_seconds: durationSeconds ?? null,
          notes: data.notes || null, // Convert empty string notes to null
          effort_level: effortLevel, // Already number | null
      };
      console.log("Submitting workout payload:", payload);
      await onSubmit(payload, workoutToEdit?.id);
  };

  const handleDeleteClick = async () => {
      if (workoutToEdit && onDelete) {
          await onDelete(workoutToEdit.id);
      }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(processSubmit)} className="space-y-6">
        {/* Date Field */}
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date > new Date() || date < new Date("1970-01-01")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Activity Type */}
        <FormField
            control={form.control}
            name="activity_type"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Activity Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Select activity type" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    {activityTypes.map(type => (
                        <SelectItem key={type} value={type} className="capitalize">
                        {type}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
       />

        {/* Distance - Use form.watch to react to unit changes */}
        <div className="grid grid-cols-3 gap-2 items-end">
            <FormField
                control={form.control}
                name="distance"
                render={({ field }) => (
                    <FormItem className="col-span-2">
                        <FormLabel>Distance</FormLabel>
                        <FormControl>
                            {/* Pass field.value which is now string */}
                            <Input type="number" step="0.01" placeholder="e.g., 5.2" {...field} />
                        </FormControl>
                         <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="distance_unit"
                 render={({ field }) => (
                    <FormItem>
                         {/* Update local state AND form state on change */}
                         <Select onValueChange={(value: 'km' | 'miles') => { field.onChange(value); setDistanceUnit(value); }} value={field.value}>
                             <FormControl>
                                 <SelectTrigger>
                                     <SelectValue />
                                 </SelectTrigger>
                             </FormControl>
                             <SelectContent>
                                 <SelectItem value="km">km</SelectItem>
                                 <SelectItem value="miles">miles</SelectItem>
                             </SelectContent>
                         </Select>
                     </FormItem>
                 )}
             />
        </div>


        {/* Duration */}
        <FormItem>
            <FormLabel>Duration</FormLabel>
            <div className="grid grid-cols-3 gap-2">
                <FormField
                    control={form.control}
                    name="duration_h"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl><Input type="number" placeholder="H" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="duration_m"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl><Input type="number" placeholder="M" {...field} /></FormControl>
                             <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="duration_s"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl><Input type="number" placeholder="S" {...field} /></FormControl>
                             <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <FormDescription className="text-xs pt-1">Enter hours, minutes, and/or seconds.</FormDescription>
        </FormItem>


        {/* Effort Level */}
         <FormField
            control={form.control}
            name="effort_level"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Perceived Effort (Optional)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Select effort level (1-5)" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="1">1 (Very Easy)</SelectItem>
                        <SelectItem value="2">2 (Easy)</SelectItem>
                        <SelectItem value="3">3 (Moderate)</SelectItem>
                        <SelectItem value="4">4 (Hard)</SelectItem>
                        <SelectItem value="5">5 (Max Effort)</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
       />

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                 {/* Ensure field.value is treated as string | undefined */}
                 <Textarea placeholder="How did it feel? Any specific details?" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-4">
           <div>
             {workoutToEdit && onDelete && (
                 <Button
                     type="button"
                     variant="destructive"
                     size="sm"
                     onClick={handleDeleteClick}
                     disabled={isSubmitting}
                     aria-label="Delete workout"
                 >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                 </Button>
             )}
            </div>
            <div className="flex gap-2">
             <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancel
             </Button>
             <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {workoutToEdit ? "Update Workout" : "Add Workout"}
             </Button>
            </div>
        </div>
      </form>
    </Form>
  );
} 