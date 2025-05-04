'use client';

import React, { useState } from 'react';
import {
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter, 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AddNoteModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  dayDate: string | null; // To know which day we're adding a note for
  onSaveNote: (dayDate: string, note: string) => void;
}

export function AddNoteModal({ isOpen, onOpenChange, dayDate, onSaveNote }: AddNoteModalProps) {
    const [noteText, setNoteText] = useState('');

    const handleSave = () => {
        if (dayDate && noteText.trim()) {
            onSaveNote(dayDate, noteText.trim());
        }
        // Reset and close even if note is empty
        setNoteText(''); 
        onOpenChange(false);
    };

    const handleCancel = () => {
        setNoteText('');
        onOpenChange(false);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Workout Complete!</DialogTitle>
                    <DialogDescription>
                        Add an optional note about your workout (e.g., how you felt, conditions).
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="workout-note" className="sr-only">Note</Label>
                    <Textarea
                        id="workout-note"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Type your note here..."
                        className="min-h-[80px]"
                        autoFocus // Focus the textarea when modal opens
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel}>Skip Note</Button>
                    <Button onClick={handleSave}>Save Note</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 