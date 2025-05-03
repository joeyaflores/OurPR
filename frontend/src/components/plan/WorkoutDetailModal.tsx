import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription 
} from "@/components/ui/dialog";
import type { DailyWorkout } from "@/types/training_plan";
import { Badge } from "@/components/ui/badge";
import { getWorkoutIcon } from "./planUtils"; // <-- Import from new utility file

interface WorkoutDetailModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  workout: DailyWorkout | null;
}

export function WorkoutDetailModal({ isOpen, onOpenChange, workout }: WorkoutDetailModalProps) {
  if (!workout) return null;

  const WorkoutIcon = getWorkoutIcon(workout.workout_type);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <WorkoutIcon className="h-5 w-5 mr-2 flex-shrink-0" />
            {workout.workout_type} - {workout.day_of_week}
          </DialogTitle>
          <DialogDescription>
            {new Date(workout.date + 'T00:00:00').toLocaleDateString('en-US', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            })} - Status: <span className={`font-medium ${workout.status === 'completed' ? 'text-green-600' : workout.status === 'skipped' ? 'text-red-600' : 'text-gray-500'}`}>{workout.status}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-3 text-sm">
          <p><strong className="font-medium">Description:</strong> {workout.description}</p>
          
          {(workout.distance || workout.duration) && (
            <div className="flex items-center space-x-4">
              {workout.distance && <div><strong className="font-medium">Distance:</strong> {workout.distance}</div>}
              {workout.duration && <div><strong className="font-medium">Duration:</strong> {workout.duration}</div>}
            </div>
          )}

          {workout.intensity && (
            <p><strong className="font-medium">Intensity:</strong> <Badge variant="outline">{workout.intensity}</Badge></p>
          )}
          
          {workout.notes && workout.notes.length > 0 && (
            <div>
              <strong className="font-medium">Notes:</strong>
              <ul className="list-disc list-inside pl-4 mt-1 text-muted-foreground">
                {workout.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Potential Future Additions:
           * - Purpose of this workout type
           * - Pace guidance (if applicable)
           * - Links to warm-up/cool-down routines
           * - User notes/feedback section
           */}
        </div>
        {/* No explicit footer needed for now */}
      </DialogContent>
    </Dialog>
  );
} 