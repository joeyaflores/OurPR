"use client"; // Filters will likely involve state

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, TrendingUp, Star } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { motion } from "framer-motion";

// Import distance colors (same as in MapView)
const distanceColors = {
  '5K': '#4ade80', // green
  '10K': '#2563eb', // blue
  'Half Marathon': '#8b5cf6', // purple
  'Marathon': '#ef4444', // red
  '50K': '#f97316', // orange
  '50 Miles': '#eab308', // yellow
  '100K': '#ec4899', // pink
  '100 Miles': '#7c3aed', // violet
  'Other': '#64748b', // slate
} as const;

// Define props interface
interface FilterSidebarProps {
  distances: string[];
  selectedDistance: string;
  onDistanceChange: (value: string) => void;
  showFlatOnly: boolean;
  onFlatnessChange: (checked: boolean) => void;
  selectedDateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  showTrending: boolean;
  onTrendingChange: (checked: boolean) => void;
  showPopular: boolean;
  onPopularChange: (checked: boolean) => void;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  distances,
  selectedDistance,
  onDistanceChange,
  showFlatOnly,
  onFlatnessChange,
  selectedDateRange,
  onDateRangeChange,
  showTrending,
  onTrendingChange,
  showPopular,
  onPopularChange
}) => {
  return (
    <motion.aside
      className="w-full lg:w-64 p-4 border rounded-lg bg-background shadow-sm space-y-6"
      initial={{ x: -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <h3 className="text-lg font-semibold">Filters</h3>

      {/* Distance Filter */}
      <div className="space-y-2">
        <Label htmlFor="distance-select">Distance</Label>
        <Select value={selectedDistance} onValueChange={onDistanceChange}>
          <SelectTrigger id="distance-select" className="w-full">
            <SelectValue>
              {selectedDistance === 'all' ? (
                'All Distances'
              ) : (
                <div className="flex items-center gap-2">
                  <span 
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ 
                      backgroundColor: distanceColors[selectedDistance as keyof typeof distanceColors] || distanceColors.Other,
                      border: '2px solid white',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                    }}
                  />
                  {selectedDistance}
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 via-blue-500 to-purple-500" />
                All Distances
              </div>
            </SelectItem>
            {distances.map((distance) => (
              <SelectItem key={distance} value={distance}>
                <div className="flex items-center gap-2">
                  <span 
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ 
                      backgroundColor: distanceColors[distance as keyof typeof distanceColors] || distanceColors.Other,
                      border: '2px solid white',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                    }}
                  />
                  {distance}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Flatness Filter */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="flat-only"
          checked={showFlatOnly}
          onCheckedChange={onFlatnessChange}
        />
        <Label htmlFor="flat-only" className="cursor-pointer">
          Show flat courses only
        </Label>
      </div>

      {/* Date Range Filter */}
      <div className={cn("grid gap-2")}>
        <Label>Date Range</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !selectedDateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDateRange?.from ? (
                selectedDateRange.to ? (
                  <>
                    {format(selectedDateRange.from, "LLL dd, y")} - {" "}
                    {format(selectedDateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(selectedDateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={selectedDateRange?.from}
              selected={selectedDateRange}
              onSelect={onDateRangeChange}
              numberOfMonths={1}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* --- Advanced Filters --- */} 
      <div className="space-y-3 pt-4 border-t">
         <h4 className="text-sm font-medium text-muted-foreground">Smart Filters</h4>
         {/* Trending Filter */}
         <div className="flex items-center space-x-2">
            <Checkbox
              id="trending-filter"
              checked={showTrending}
              onCheckedChange={onTrendingChange}
            />
            <Label htmlFor="trending-filter" className="cursor-pointer flex items-center">
              <TrendingUp className="h-4 w-4 mr-1.5 text-blue-500"/> Show trending races near me
            </Label>
         </div>

         {/* Popular Filter */}
         <div className="flex items-center space-x-2">
            <Checkbox
              id="popular-filter"
              checked={showPopular}
              onCheckedChange={onPopularChange}
            />
            <Label htmlFor="popular-filter" className="cursor-pointer flex items-center">
              <Star className="h-4 w-4 mr-1.5 text-amber-500"/> Popular among similar runners
            </Label>
         </div>
      </div>

    </motion.aside>
  );
}; 