'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { Race } from "@/types/race";
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Define props type to include className, races, hoveredRaceId, and selectedRaceId
interface ClientMapWrapperProps {
  className?: string;
  races: Race[];
  hoveredRaceId: string | number | null;
  selectedRaceId: string | number | null;
  onRaceSelect: (id: string | number | null) => void;
  isLoading: boolean;
  error: string | null;
}

// Dynamically import the actual MapView component
const MapView = dynamic(() => import('@/components/discover/MapView').then((mod) => mod.MapView),
  {
    ssr: false, // This is allowed in a Client Component
    loading: () => <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center border"><p className="text-muted-foreground">Loading Map...</p></div>
  }
);

// This wrapper component ensures the dynamic import happens client-side
export const ClientMapWrapper: React.FC<ClientMapWrapperProps> = ({ className, races, hoveredRaceId, selectedRaceId, onRaceSelect, isLoading, error }) => {
  // Wrap the MapView in a motion.div for animation
  return (
    // Outer div controls overall size and positioning
    <div className={className}>
      {isLoading ? (
        // --- Data Loading State --- 
        <Skeleton className="h-full w-full rounded-lg" />
      ) : error ? (
        // --- Error State --- 
        <div className="h-full w-full bg-destructive/10 rounded-lg flex flex-col items-center justify-center p-4 border border-destructive/30">
          <AlertCircle className="h-8 w-8 text-destructive mb-2" />
          <p className="text-sm font-medium text-destructive text-center">Error loading map data</p>
          <p className="text-xs text-destructive/80 text-center mt-1">{error}</p>
        </div>
      ) : (
        // --- Map Ready State (render dynamically imported map) ---
        <motion.div
          className="h-full w-full" // Ensure motion div fills container
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <MapView 
            races={races} 
            hoveredRaceId={hoveredRaceId} 
            selectedRaceId={selectedRaceId} 
            onRaceSelect={onRaceSelect} 
            isLoading={isLoading} 
            error={error} 
          />
        </motion.div>
      )}
    </div>
  );
}; 