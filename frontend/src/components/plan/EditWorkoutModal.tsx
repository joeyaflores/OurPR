'use client';

import React, { useState, useEffect } from 'react';
import type { DailyWorkout } from '@/types/training_plan';
import {
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter, 
    DialogClose 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { format, parseISO } from 'date-fns';
import { workoutTypeMap } from './planUtils'; // Assuming planUtils exists for workout types

interface EditWorkoutModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  workout: DailyWorkout | null;
  onSave: (updatedWorkout: DailyWorkout) => void;
}

// Define the allowed workout types explicitly for the Select component
const allowedWorkoutTypes: DailyWorkout['workout_type'][] = [
    'Easy Run', 'Tempo Run', 'Intervals', 'Speed Work', 'Long Run',
    'Rest', 'Cross-Training', 'Strength', 'Race Pace', 'Warm-up', 
    'Cool-down', 'Other'
];

export function EditWorkoutModal({ isOpen, onOpenChange, workout, onSave }: EditWorkoutModalProps) {
    // Internal state for form fields
    const [editedType, setEditedType] = useState<DailyWorkout['workout_type']>('Other');
    const [editedDescription, setEditedDescription] = useState('');
    const [editedDistance, setEditedDistance] = useState<string | undefined>('');
    const [editedDuration, setEditedDuration] = useState<string | undefined>('');
    const [editedIntensity, setEditedIntensity] = useState<string | undefined>('');
    const [editedNotes, setEditedNotes] = useState<string>(''); // Treat notes as a single string block for simplicity

    // Pre-populate form when workout prop changes
    useEffect(() => {
        if (workout) {
            setEditedType(workout.workout_type);
            setEditedDescription(workout.description || '');
            setEditedDistance(workout.distance || '');
            setEditedDuration(workout.duration || '');
            setEditedIntensity(workout.intensity || '');
            setEditedNotes(workout.notes?.join('\n') || ''); // Join notes array into a string
        } else {
            // Reset fields if workout is null (modal closed or no workout)
            setEditedType('Other');
            setEditedDescription('');
            setEditedDistance('');
            setEditedDuration('');
            setEditedIntensity('');
            setEditedNotes('');
        }
    }, [workout]);

    const handleSaveChanges = () => {
        if (!workout) return; // Should not happen if modal is open

        // Construct the updated workout object
        const updatedWorkout: DailyWorkout = {
            ...workout, // Keep original date, day_of_week, status, google_event_id
            workout_type: editedType,
            description: editedDescription.trim(),
            distance: editedDistance?.trim() || undefined, // Use undefined if empty
            duration: editedDuration?.trim() || undefined,
            intensity: editedIntensity?.trim() || undefined,
            notes: editedNotes.trim() ? editedNotes.split('\n').map(note => note.trim()).filter(note => note) : undefined, // Split string back into array, filter empty lines
        };

        onSave(updatedWorkout); // Call the parent's save handler
    };

    if (!workout) return null; // Don't render anything if no workout is provided

    // Format date for display
    let formattedDate = workout.date;
    try {
        formattedDate = format(parseISO(workout.date), "EEEE, MMMM d, yyyy");
    } catch (e) { console.error("Error formatting date:", e); }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit Workout</DialogTitle>
                    <DialogDescription>
                        Modify details for {workout.day_of_week}, {formattedDate}.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Workout Type */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-type" className="text-right">
                            Type
                        </Label>
                        <Select value={editedType} onValueChange={(value) => setEditedType(value as DailyWorkout['workout_type'])} >
                            <SelectTrigger id="edit-type" className="col-span-3">
                                <SelectValue placeholder="Select type..." />
                            </SelectTrigger>
                            <SelectContent>
                                {allowedWorkoutTypes.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Description */}
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="edit-description" className="text-right pt-2">
                            Description
                        </Label>
                        <Textarea
                            id="edit-description"
                            value={editedDescription}
                            onChange={(e) => setEditedDescription(e.target.value)}
                            placeholder="Workout details (e.g., 5 miles easy, target pace)"
                            className="col-span-3 min-h-[60px]"
                        />
                    </div>

                    {/* Distance */}
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-distance" className="text-right">
                            Distance (Optional)
                        </Label>
                        <Input
                            id="edit-distance"
                            value={editedDistance}
                            onChange={(e) => setEditedDistance(e.target.value)}
                            placeholder="e.g., 5 miles"
                            className="col-span-3"
                        />
                    </div>

                    {/* Duration */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-duration" className="text-right">
                            Duration (Optional)
                        </Label>
                        <Input
                            id="edit-duration"
                            value={editedDuration}
                            onChange={(e) => setEditedDuration(e.target.value)}
                            placeholder="e.g., 45 minutes"
                            className="col-span-3"
                        />
                    </div>

                     {/* Intensity */}
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-intensity" className="text-right">
                            Intensity (Optional)
                        </Label>
                        <Input
                            id="edit-intensity"
                            value={editedIntensity}
                            onChange={(e) => setEditedIntensity(e.target.value)}
                            placeholder="e.g., Easy, Tempo, HR Zone 2"
                            className="col-span-3"
                        />
                    </div>
                    
                    {/* Notes */}
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="edit-notes" className="text-right pt-2">
                            Notes (Optional)
                        </Label>
                        <Textarea
                            id="edit-notes"
                            value={editedNotes}
                            onChange={(e) => setEditedNotes(e.target.value)}
                            placeholder="Additional tips or variations (one per line)"
                            className="col-span-3 min-h-[60px]"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSaveChanges}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 