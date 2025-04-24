'use client';

import type { TrainingPlanOutline } from '@/types/training_plan';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface TrainingPlanDisplayProps {
  plan: TrainingPlanOutline;
}

export function TrainingPlanDisplay({ plan }: TrainingPlanDisplayProps) {
  if (!plan) return null;

  return (
    <div className="space-y-4 p-1"> 
      <h3 className="text-lg font-semibold">Training Outline: {plan.race_name} ({plan.race_distance})</h3>
      <p className="text-sm text-muted-foreground">Total Weeks: {plan.total_weeks}</p>

      <Accordion type="single" collapsible className="w-full">
        {plan.weeks.map((week) => (
          <AccordionItem value={`week-${week.week_number}`} key={week.week_number}>
            <AccordionTrigger>Week {week.week_number}</AccordionTrigger>
            <AccordionContent className="space-y-2">
              {week.estimated_weekly_mileage && (
                <p className="text-sm font-medium text-muted-foreground">
                    Est. Mileage: {week.estimated_weekly_mileage}
                </p>
              )}
              <p className="text-sm">{week.summary}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {plan.notes && plan.notes.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">Notes:</h4>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            {plan.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 