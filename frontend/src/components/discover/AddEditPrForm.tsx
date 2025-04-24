"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, ClockIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { UserPr } from "@/types/user_pr";
import { useState } from "react";

// Define standard distances for the dropdown
// TODO: Potentially fetch this or share with DiscoverPage
const standardDistances = ['5K', '10K', 'Half Marathon', 'Marathon', '50K', '50 Miles', '100K', '100 Miles', 'Other'];

// Validation Schema
const formSchema = z.object({
  distance: z.string().min(1, { message: "Please select a distance." }),
  date: z.date({ required_error: "A date is required." }),
  // Time input as HH:MM:SS string, convert to seconds later
  time: z.string().regex(/^(\d{1,2}:)?([0-5]?\d):([0-5]?\d)$/, {
    message: "Invalid time format (HH:MM:SS or MM:SS)",
  }),
  // Optional: Add race_id later if needed
});

type AddEditPrFormValues = z.infer<typeof formSchema>;

// Define a more specific type for the data needed to edit a PR
// This avoids needing the full UserPr type which might not be available
type PrEditData = {
    id: string;
    distance: string;
    date: string | Date; // Accept string or Date
    time_in_seconds: number;
};

interface AddEditPrFormProps {
  prToEdit?: PrEditData | null; // Use the specific edit type
  onSubmit: (values: AddEditPrFormValues, prId?: string) => Promise<void>; // Async submit handler
  onCancel: () => void;
  onDelete?: (prId: string) => Promise<void>; // Optional delete handler
  isSubmitting: boolean;
}

// Helper to format seconds to HH:MM:SS for input default value
function formatSecondsToHMS(totalSeconds: number): string {
    if (isNaN(totalSeconds) || totalSeconds < 0) return "";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return hours > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function AddEditPrForm({
  prToEdit,
  onSubmit,
  onCancel,
  onDelete,
  isSubmitting,
}: AddEditPrFormProps) {

  const isEditMode = !!prToEdit;

  // Form setup with react-hook-form and zod
  const form = useForm<AddEditPrFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      distance: prToEdit?.distance || "",
      date: prToEdit?.date ? new Date(prToEdit.date) : undefined, // Ensure date is a Date object
      time: prToEdit?.time_in_seconds ? formatSecondsToHMS(prToEdit.time_in_seconds) : "",
    },
  });

  // Wrapper for the onSubmit prop to handle data transformation
  async function handleFormSubmit(values: AddEditPrFormValues) {
    await onSubmit(values, prToEdit?.id); // Pass optional ID for updates
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteClick = async () => {
      if (prToEdit && onDelete) {
          await onDelete(prToEdit.id);
      }
      setShowDeleteConfirm(false); // Hide confirm buttons after action
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Distance */}
        <FormField
          control={form.control}
          name="distance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Distance *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a race distance" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {standardDistances.map((dist) => (
                    <SelectItem key={dist} value={dist}>
                      {dist}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Time */}
        <FormField
          control={form.control}
          name="time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Time *</FormLabel>
              <FormControl>
                <div className="relative">
                   <ClockIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="HH:MM:SS or MM:SS" {...field} className="pl-8"/>
                </div>
              </FormControl>
               <FormDescription>
                 Enter your official finish time.
               </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Date */}
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date *</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full pl-3 text-left font-normal",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    {field.value ? (
                      format(field.value, "PPP") // More readable date format
                    ) : (
                      <span>Pick a date</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date("1900-01-01") // Prevent future dates
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Buttons */}
        <div className="flex justify-between items-center pt-4">
            <div>
                {isEditMode && onDelete && !showDeleteConfirm && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={isSubmitting}
                    >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete PR</span>
                    </Button>
                )}
                 {isEditMode && onDelete && showDeleteConfirm && (
                     <div className="flex items-center gap-2">
                        <span className="text-sm text-destructive">Delete?</span>
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteClick}
                            disabled={isSubmitting}
                        >
                            Yes
                        </Button>
                         <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDeleteConfirm(false)}
                            disabled={isSubmitting}
                        >
                            No
                        </Button>
                     </div>
                )}
            </div>

            <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : isEditMode ? "Save Changes" : "Add PR"}
                </Button>
            </div>
        </div>
      </form>
    </Form>
  );
} 