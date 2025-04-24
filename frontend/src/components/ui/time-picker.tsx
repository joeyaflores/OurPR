'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Define the shape of the value the TimePicker expects/emits
export interface TimeValue {
  hours?: number;
  minutes?: number;
  seconds?: number;
}

interface TimePickerProps {
  value?: TimeValue;
  onChange?: (value: TimeValue) => void;
  className?: string;
}

const TimePicker = React.forwardRef<HTMLDivElement, TimePickerProps>(
  ({ value = {}, onChange, className }, ref) => {
    const handleInputChange = (
      part: keyof TimeValue,
      inputValue: string
    ) => {
      const numericValue = inputValue === '' ? undefined : parseInt(inputValue, 10);
      
      // Basic validation (can be expanded)
      if (numericValue !== undefined && isNaN(numericValue)) return; // Not a number

      let updatedValue: number | undefined = numericValue;

      // Clamp values to valid ranges
      if (updatedValue !== undefined) {
          if (part === 'hours' && (updatedValue < 0 || updatedValue > 99)) {
             updatedValue = undefined; // Set to undefined if invalid
          } 
          if ((part === 'minutes' || part === 'seconds') && (updatedValue !== undefined && (updatedValue < 0 || updatedValue > 59))) {
              updatedValue = undefined; // Set to undefined if invalid
          }
      }

      onChange?.({ ...value, [part]: updatedValue });
    };

    // Format display value (ensure two digits)
    const formatPart = (partValue?: number): string => {
        if (partValue === undefined || isNaN(partValue)) return '';
        // Keep single digit during input unless blurring?
        // For now, just return the number as string
        // return String(partValue).padStart(2, '0');
         return String(partValue);
    };

    return (
      <div ref={ref} className={cn('flex items-center space-x-1', className)}>
        <Input
          type="number"
          placeholder="HH"
          min={0}
          max={99}
          value={formatPart(value.hours)}
          onChange={(e) => handleInputChange('hours', e.target.value)}
          className="w-16 text-center"
          aria-label="Hours"
        />
        <span className="text-muted-foreground">:</span>
        <Input
          type="number"
          placeholder="MM"
          min={0}
          max={59}
          value={formatPart(value.minutes)}
          onChange={(e) => handleInputChange('minutes', e.target.value)}
          className="w-16 text-center"
          aria-label="Minutes"
        />
        <span className="text-muted-foreground">:</span>
        <Input
          type="number"
          placeholder="SS"
          min={0}
          max={59}
          value={formatPart(value.seconds)}
          onChange={(e) => handleInputChange('seconds', e.target.value)}
          className="w-16 text-center"
          aria-label="Seconds"
        />
      </div>
    );
  }
);

TimePicker.displayName = 'TimePicker';

export { TimePicker }; 