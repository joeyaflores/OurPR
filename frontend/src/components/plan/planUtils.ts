import React from 'react';
import {
    Footprints,
    Gauge,
    Zap,
    TrendingUp,
    Bed,
    Bike,
    Dumbbell,
    Play,
    Pause,
    Flag,
    HelpCircle
} from "lucide-react";
import type { DailyWorkout } from "@/types/training_plan";

// --- Workout Type Definitions for Icons and Tooltips ---
export const workoutTypeMap: Record<DailyWorkout['workout_type'], { icon: React.ElementType, tooltip: string }> = {
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
};

// --- Helper Function to get Workout Icon ---
export const getWorkoutIcon = (workoutType: DailyWorkout['workout_type']): React.ElementType => {
    return workoutTypeMap[workoutType]?.icon || HelpCircle; // Fallback icon
};

// Add other plan-related utility functions here in the future 