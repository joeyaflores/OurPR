export interface WeeklySummary {
    week_number: number;
    summary: string;
    estimated_weekly_mileage?: string | null;
}

export interface TrainingPlanOutline {
    race_name: string;
    race_distance: string;
    total_weeks: number;
    weeks: WeeklySummary[];
    notes?: string[] | null;
} 