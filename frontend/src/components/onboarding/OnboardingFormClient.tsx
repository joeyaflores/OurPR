'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, SubmitHandler } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation'; // Import useRouter for redirection

import { Button } from "@/components/ui/button";
import {
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle, 
} from "@/components/ui/card";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { TimePicker, type TimeValue } from '@/components/ui/time-picker';
import { RaceCard } from '@/components/onboarding/RaceCard';

// --- Import API Client Functions and Types ---
import { 
    createOrUpdateUserGoal, 
    getRecommendedRaces, 
    type UserGoalPayload, 
    type Race 
} from '@/lib/apiClient';

// --- Form Schema Definition ---
const goalFormSchema = z.object({
  goal_race_name: z.string().optional(),
  goal_race_date: z.date().optional(),
  goal_distance: z.string().optional(),
  goal_time: z.object({
      hours: z.number().min(0).max(99).optional(),
      minutes: z.number().min(0).max(59).optional(),
      seconds: z.number().min(0).max(59).optional(),
  }).optional(),
  explore_only: z.boolean().optional(),
});

type GoalFormValues = z.infer<typeof goalFormSchema>;

// --- Geolocation State Type ---
type Coordinates = {
  latitude: number;
  longitude: number;
};

// --- Component Definition ---
// Changed export default function OnboardingPage() {
export default function OnboardingFormClient() { // Rename component
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Race[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submittedGoalData, setSubmittedGoalData] = useState<UserGoalPayload | null>(null);
  const router = useRouter(); // Initialize router

  // --- Get Geolocation --- 
  useEffect(() => {
    if (step === 1 && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCoordinates({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
                setLocationError(null);
                console.log('Geolocation obtained:', position.coords);
            },
            (error) => {
                console.warn(`Geolocation Error: ${error.message}`);
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        setLocationError("Location access denied. Recommendations might be less accurate.");
                        break;
                    case error.POSITION_UNAVAILABLE:
                        setLocationError("Location information is unavailable.");
                        break;
                    case error.TIMEOUT:
                        setLocationError("The request to get user location timed out.");
                        break;
                    default:
                        setLocationError("An unknown error occurred while getting location.");
                        break;
                }
            },
            { timeout: 10000 } 
        );
    } else if (step === 1) {
        setLocationError("Geolocation is not supported by this browser.");
    }
  }, [step]); 

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
        goal_race_name: undefined,
        goal_race_date: undefined,
        goal_distance: undefined,
        goal_time: { hours: undefined, minutes: undefined, seconds: undefined },
        explore_only: false,
    },
  });

  const onSubmit: SubmitHandler<GoalFormValues> = async (values) => {
    setIsLoading(true);
    setError(null);
    console.log("Form Values:", values);
    console.log("Coordinates available:", coordinates);

    const isExploring = values.explore_only ?? false;
    const payload: UserGoalPayload = {
      goal_race_name: values.goal_race_name || null,
      goal_race_date: values.goal_race_date ? format(values.goal_race_date, 'yyyy-MM-dd') : null,
      goal_distance: values.goal_distance || null,
      goal_time: null
    };

    if (values.goal_time && (values.goal_time.hours != null || values.goal_time.minutes != null || values.goal_time.seconds != null)) {
        const hours = (values.goal_time.hours ?? 0).toString().padStart(2, '0');
        const minutes = (values.goal_time.minutes ?? 0).toString().padStart(2, '0');
        const seconds = (values.goal_time.seconds ?? 0).toString().padStart(2, '0');
        payload.goal_time = `${hours}:${minutes}:${seconds}`;
    }

    setSubmittedGoalData(payload);

    if (isExploring) {
        console.log("Exploring only, potentially submitting minimal goal data...");
    }

    try {
        console.log("Submitting goal data:", payload);
        await createOrUpdateUserGoal(payload);
        console.log("Goal data submitted successfully.");

        console.log("Fetching recommendations...", coordinates ? `with coords: ${coordinates.latitude}, ${coordinates.longitude}` : "without coords");
        const fetchedRecommendations = await getRecommendedRaces(coordinates);
        setRecommendations(fetchedRecommendations);
        console.log("Recommendations received:", fetchedRecommendations);

        setStep(2);

    } catch (err) {
        console.error("Onboarding API Error:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred during the onboarding process.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleExplore = () => {
    form.reset({
        goal_race_name: undefined,
        goal_race_date: undefined,
        goal_distance: undefined,
        goal_time: { hours: undefined, minutes: undefined, seconds: undefined },
        explore_only: true
    });
    form.handleSubmit(onSubmit)();
  };

  // --- Race Distances for Dropdown ---
  const distances = [
    { label: "5K", value: "5K" },
    { label: "10K", value: "10K" },
    { label: "Half Marathon", value: "Half Marathon" },
    { label: "Marathon", value: "Marathon" },
  ];

  // Function to handle redirect after viewing recommendations
  const handleContinue = () => {
      router.push('/discover'); // Or your main app page
  };

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center p-4">
      {step === 1 && (
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Find Your Next PR Race</CardTitle>
            <CardDescription>Tell us a bit about your goals to get personalized race recommendations.</CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-6">
                {/* Goal Race Name */}
                <FormField
                  control={form.control}
                  name="goal_race_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What's your next goal race? (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Chicago Marathon" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Goal Race Date */}
                <FormField
                  control={form.control}
                  name="goal_race_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>When is it? (Optional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0)) // Disable past dates
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Goal Distance */}
                 <FormField
                  control={form.control}
                  name="goal_distance"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>What's your target distance or recent PR distance?</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                    "w-full justify-between",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                {field.value
                                    ? distances.find(
                                        (distance) => distance.value === field.value
                                    )?.label
                                    : "Select distance"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Search distance..." />
                                <CommandList>
                                    <CommandEmpty>No distance found.</CommandEmpty>
                                    <CommandGroup>
                                    {distances.map((distance) => (
                                        <CommandItem
                                        value={distance.label}
                                        key={distance.value}
                                        onSelect={(currentValue) => {
                                            const selectedDistance = distances.find(d => d.label.toLowerCase() === currentValue.toLowerCase());
                                            form.setValue("goal_distance", selectedDistance ? selectedDistance.value : undefined);
                                        }}
                                        >
                                        <Check
                                            className={cn(
                                            "mr-2 h-4 w-4",
                                            distance.value === field.value
                                                ? "opacity-100"
                                                : "opacity-0"
                                            )}
                                        />
                                        {distance.label}
                                        </CommandItem>
                                    ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                    )}
                    />

                {/* Goal Time - Use TimePicker Component */}
                 <FormField
                    control={form.control}
                    name="goal_time"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>What's your target time or recent PR time? (Optional)</FormLabel>
                            <FormControl>
                                <TimePicker
                                    value={field.value as TimeValue | undefined}
                                    onChange={field.onChange}
                                />
                            </FormControl>
                             <FormDescription>Enter time as Hours : Minutes : Seconds</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Display Location Error if any */}
                {locationError && (
                     <p className="text-sm text-yellow-600 dark:text-yellow-500">Note: {locationError}</p>
                )}

                {error && (
                    <p className="text-sm font-medium text-destructive">{error}</p>
                )}

              </CardContent>
              <CardFooter className="flex flex-col items-stretch gap-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Please wait...</>
                  ) : (
                    'Find My Races'
                  )}
                </Button>
                <Button variant="ghost" type="button" onClick={handleExplore} disabled={isLoading}>
                  Not sure yet / Just exploring
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      )}

      {step === 2 && (
        <Card className="w-full max-w-2xl">
            <CardHeader>
                <CardTitle className="text-2xl">Your Recommended Races</CardTitle>
                {submittedGoalData && (
                     <CardDescription>
                         Based on your goal{submittedGoalData.goal_distance ? ` of ${submittedGoalData.goal_distance}` : ''}
                         {submittedGoalData.goal_time ? ` in ${submittedGoalData.goal_time}` : ''}
                         {submittedGoalData.goal_race_name ? ` for the ${submittedGoalData.goal_race_name}` : ''}
                         {submittedGoalData.goal_race_date ? ` around ${format(new Date(submittedGoalData.goal_race_date), 'PPP')}` : ''}:
                     </CardDescription>
                )} 
                 {!submittedGoalData && (
                     <CardDescription>Here are some PR-friendly races we found for you:</CardDescription>
                 )}
            </CardHeader>
            <CardContent className="space-y-4">
                 {isLoading && (
                     <div className="space-y-4">
                         <div className="h-24 w-full rounded-md bg-muted animate-pulse"></div>
                         <div className="h-24 w-full rounded-md bg-muted animate-pulse"></div>
                         <div className="h-24 w-full rounded-md bg-muted animate-pulse"></div>
                     </div>
                 )}
                 {!isLoading && error && (
                     <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-center text-destructive">
                         <p className="font-semibold">Error Loading Recommendations</p>
                         <p className="text-sm">{error}</p>
                     </div>
                 )}
                {!isLoading && !error && recommendations.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No specific recommendations found matching your criteria. Try adjusting your goals.</p>
                )}
                {!isLoading && !error && recommendations.map((race: Race) => (
                    <RaceCard key={race.id} race={race} />
                ))}
            </CardContent>
             <CardFooter className="flex justify-center gap-4">
                 {/* Button to go back */}
                 <Button variant="outline" onClick={() => { setStep(1); setError(null); form.reset(); }}>
                    Go Back
                 </Button>
                 {/* Button to continue to the main app */}
                  <Button onClick={handleContinue} disabled={isLoading}>
                      Continue to App
                 </Button>
             </CardFooter>
        </Card>
      )}
    </div>
  );
} 