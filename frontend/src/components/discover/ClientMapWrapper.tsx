'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { Race } from "@/types/race";
import { motion } from "framer-motion";

// Define props type to include className, races, hoveredRaceId, and selectedRaceId
interface ClientMapWrapperProps {
  className?: string;
  races: Race[];
  hoveredRaceId: string | number | null;
  selectedRaceId: string | number | null;
  onRaceSelect: (id: string | number | null) => void;
  onRaceHover: (id: string | number | null) => void;
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
export const ClientMapWrapper: React.FC<ClientMapWrapperProps> = ({ className, races, hoveredRaceId, selectedRaceId, onRaceSelect, onRaceHover, isLoading, error }) => {
  // Wrap the MapView in a motion.div for animation
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <MapView 
        races={races} 
        hoveredRaceId={hoveredRaceId} 
        selectedRaceId={selectedRaceId} 
        onRaceSelect={onRaceSelect} 
        onRaceHover={onRaceHover}
        isLoading={isLoading} 
        error={error} 
      />
    </motion.div>
  );
}; 