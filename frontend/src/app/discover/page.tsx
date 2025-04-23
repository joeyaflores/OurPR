"use client"; // Need state for filters, so convert to Client Component

import { useState, useMemo, useEffect, useCallback } from "react";
import { ChatSearchInput } from "@/components/discover/ChatSearchInput";
import { FilterSidebar } from "@/components/discover/FilterSidebar";
import { RaceResults } from "@/components/discover/RaceResults";
import { ClientMapWrapper } from "@/components/discover/ClientMapWrapper";
import { Race } from "@/types/race";
import { DateRange } from "react-day-picker";
import { format } from 'date-fns'; // Keep format for date query params
import { useDebounce } from "@/hooks/useDebounce";
import { PRTimeline } from "@/components/discover/PRTimeline";

// REMOVE MOCK DATA
// const MOCK_RACES: Race[] = [ ... ];

// Keep unique distances definition, but it might be empty initially or need updating
// TODO: Populate distances from API or use a predefined list
const uniqueDistances: string[] = ['5K', '10K', 'Half Marathon', 'Marathon', '50K', '50 Miles', '100K', '100 Miles', 'Other']; // Updated with ultra distances

export default function DiscoverPage() {
  // State for filters
  const [selectedDistance, setSelectedDistance] = useState<string>("all");
  const [showFlatOnly, setShowFlatOnly] = useState<boolean>(false);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [hoveredRaceId, setHoveredRaceId] = useState<string | number | null>(null);
  const [selectedRaceId, setSelectedRaceId] = useState<string | number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [showTrending, setShowTrending] = useState<boolean>(false);
  const [showPopular, setShowPopular] = useState<boolean>(false);

  // New State for Fetched Data
  const [races, setRaces] = useState<Race[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching Functions ---

  // Renamed: Fetches races based on sidebar filters
  const fetchFilteredRaces = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'; 
    const url = new URL('/api/races', baseUrl);
    const params = new URLSearchParams();

    // Append query parameters based on filters
    if (selectedDistance !== "all") {
      params.append('distance', selectedDistance);
    }
    if (showFlatOnly) {
      params.append('flat_only', 'true');
    }
    if (selectedDateRange?.from) {
      params.append('start_date', format(selectedDateRange.from, 'yyyy-MM-dd'));
    }
    if (selectedDateRange?.to) {
      params.append('end_date', format(selectedDateRange.to, 'yyyy-MM-dd'));
    }
    // TODO: Add trending/popular/pagination params later

    url.search = params.toString();
    console.log("Fetching filtered races from:", url.toString());

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      const data: Race[] = await response.json();
      setRaces(data);
    } catch (e: any) {
      console.error("Failed to fetch filtered races:", e);
      setError(e.message || "Failed to fetch filtered races.");
      setRaces([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDistance, showFlatOnly, selectedDateRange]); // Dependencies for filtered fetch

  // New: Fetches races based on AI search query
  const fetchAiRaces = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    // Ensure the correct endpoint path
    const url = new URL('/api/race-query/ai', baseUrl); 
    console.log(`Fetching AI races for query: "${query}" from: ${url.toString()}`);

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      const data: Race[] = await response.json();
      setRaces(data);
    } catch (e: any) {
      console.error("Failed to fetch AI races:", e);
      setError(e.message || "Failed to fetch AI races.");
      setRaces([]);
    } finally {
      setIsLoading(false);
    }
  }, []); // No external state dependencies needed inside, only the query argument

  // --- Effect for Combined Fetching Logic ---
  useEffect(() => {
    if (debouncedSearchQuery) {
      console.log("Effect: Debounced search query detected, fetching AI races.");
      fetchAiRaces(debouncedSearchQuery);
    } else {
      console.log("Effect: No search query, fetching filtered races.");
      fetchFilteredRaces();
    }
  }, [debouncedSearchQuery, fetchFilteredRaces, fetchAiRaces]); // Re-run when query or fetch functions change

  // Handlers
  const handleRaceSelect = (id: string | number | null) => {
    setSelectedRaceId(id);
  };

  // This handler now just updates the raw search query state
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  return (
    <main className="flex flex-col items-center min-h-screen py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight mb-4 text-center">
        Discover Your Next PR
      </h1>

      {/* 1. Chat Search Input */}
      <ChatSearchInput
        value={searchQuery}
        onChange={handleSearchChange}
      />

      <div className="flex flex-col lg:flex-row w-full max-w-7xl mx-auto gap-6 mt-6">
        {/* 3. Smart Filters Sidebar */}
        <FilterSidebar
          // Use predefined or fetched distances
          distances={uniqueDistances}
          selectedDistance={selectedDistance}
          onDistanceChange={setSelectedDistance}
          showFlatOnly={showFlatOnly}
          onFlatnessChange={setShowFlatOnly}
          selectedDateRange={selectedDateRange}
          onDateRangeChange={setSelectedDateRange}
          // Keep placeholder filters, they don't affect fetchRaces yet
          showTrending={showTrending}
          onTrendingChange={setShowTrending}
          showPopular={showPopular}
          onPopularChange={setShowPopular}
        />

        <div className="flex-1 flex flex-col gap-6">
           {/* 2. Map View - Pass fetched races and loading/error state */}
           <ClientMapWrapper
             className="min-h-[300px] h-[60vh] lg:h-auto lg:aspect-video relative"
             races={races}
             isLoading={isLoading} // Pass loading state
             error={error} // Pass error state
             hoveredRaceId={hoveredRaceId}
             selectedRaceId={selectedRaceId}
             onRaceSelect={handleRaceSelect}
             onRaceHover={setHoveredRaceId}
           />

           {/* 4. Race Results - Pass fetched races and loading/error state */}
           <RaceResults
             races={races}
             isLoading={isLoading} // Pass loading state
             error={error} // Pass error state
             hoveredRaceId={hoveredRaceId}
             onRaceHover={setHoveredRaceId}
             onRaceSelect={handleRaceSelect}
             selectedRaceId={selectedRaceId}
           />
        </div>
      </div>

      {/* 5. Your PR Timeline */}
      {/* TODO: Implement data fetching for PRTimeline (Priority 3) */}
      <PRTimeline />

    </main>
  );
} 