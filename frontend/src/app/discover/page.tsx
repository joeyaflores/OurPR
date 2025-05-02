"use client"; // Moved to the top

// Removed Metadata export as it cannot be in a Client Component
// import type { Metadata } from 'next'
// export const metadata: Metadata = { ... };

import { useState, useMemo, useEffect, useCallback } from "react";
import { ChatSearchInput } from "@/components/discover/ChatSearchInput";
import { FilterSidebar } from "@/components/discover/FilterSidebar";
import { RaceResults } from "@/components/discover/RaceResults";
import { ClientMapWrapper } from "@/components/discover/ClientMapWrapper";
import { Race } from "@/types/race";
import { DateRange } from "react-day-picker";
import { format, addMonths, startOfToday } from 'date-fns'; // Keep format, import addMonths and startOfToday
import { useDebounce } from "@/hooks/useDebounce";
import { PRTimeline } from "@/components/discover/PRTimeline";
import { createClient } from "@/lib/supabase/client"; // <<< Import Supabase client
import { Button } from "@/components/ui/button"; // <<< Import Button
import { SlidersHorizontal } from "lucide-react"; // <<< Import Icon

// REMOVE MOCK DATA
// const MOCK_RACES: Race[] = [ ... ];

const RACES_PER_PAGE = 20; // <<< Define page size constant

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
  // Debounce date range selection to avoid excessive fetching
  const debouncedDateRange = useDebounce(selectedDateRange, 500);
  const [showTrending, setShowTrending] = useState<boolean>(false);
  const [showPopular, setShowPopular] = useState<boolean>(false);

  // <<< State for filter sidebar visibility on mobile >>>
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);

  // New State for Fetched Data
  const [races, setRaces] = useState<Race[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFetchingMore, setIsFetchingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMoreRaces, setHasMoreRaces] = useState<boolean>(true);

  // --- Data Fetching Functions ---

  // Renamed: Fetches races based on sidebar filters, now accepts page number
  const fetchFilteredRaces = useCallback(async (page: number = 1) => {
    if (page > 1) {
      setIsFetchingMore(true);
    } else {
      setIsLoading(true);
      setHasMoreRaces(true);
    }
    setError(null);
    
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
        setError("User not authenticated. Please log in.");
        setIsLoading(false);
        setIsFetchingMore(false);
        setRaces([]);
        return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'; 
    const url = new URL('/api/races', baseUrl);
    const params = new URLSearchParams();

    if (debouncedDateRange === undefined) {
      const today = startOfToday();
      const sixMonthsLater = addMonths(today, 6);
      params.append('start_date', format(today, 'yyyy-MM-dd'));
      params.append('end_date', format(sixMonthsLater, 'yyyy-MM-dd'));
      console.log("Applying default date range (next 6 months)");
    } else {
      if (debouncedDateRange?.from) {
        params.append('start_date', format(debouncedDateRange.from, 'yyyy-MM-dd'));
      }
      if (debouncedDateRange?.to) {
        params.append('end_date', format(debouncedDateRange.to, 'yyyy-MM-dd'));
      }
    }

    if (selectedDistance !== "all") {
      params.append('distance', selectedDistance);
    }
    if (showFlatOnly) {
      params.append('flat_only', 'true');
    }

    const skip = (page - 1) * RACES_PER_PAGE;
    params.append('limit', String(RACES_PER_PAGE));
    params.append('skip', String(skip));

    url.search = params.toString();
    console.log(`Fetching filtered races (Page ${page}) from:`, url.toString());

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
             throw new Error("Authentication failed. Please log in again.");
        }
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      const data: Race[] = await response.json();

      setRaces(prevRaces => (page === 1 ? data : [...prevRaces, ...data]));
      setHasMoreRaces(data.length === RACES_PER_PAGE);

    } catch (e: any) {
      console.error("Failed to fetch filtered races:", e);
      setError(e.message || "Failed to fetch filtered races.");
      if (page === 1) {
          setRaces([]);
      }
      setHasMoreRaces(false);
    } finally {
      if (page > 1) {
        setIsFetchingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [selectedDistance, showFlatOnly, debouncedDateRange]);

  // New: Fetches races based on AI search query
  const fetchAiRaces = useCallback(async (query: string) => {
    setIsLoading(true);
    setIsFetchingMore(false);
    setError(null);
    setCurrentPage(1);
    setHasMoreRaces(false);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
        setError("User not authenticated to perform AI search. Please log in.");
        setIsLoading(false);
        setRaces([]);
        return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    const url = new URL('/api/race-query/ai', baseUrl); 
    console.log(`Fetching AI races for query: \"${query}\" from: ${url.toString()}`);

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query: query })
      });

      if (!response.ok) {
        if (response.status === 401) {
             throw new Error("Authentication failed. Please log in again.");
        }
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
  }, []);

  // --- Effect for Combined Fetching Logic ---
  useEffect(() => {
    if (debouncedSearchQuery) {
      console.log("Effect: Debounced search query detected, fetching AI races.");
      fetchAiRaces(debouncedSearchQuery);
    } else {
      console.log("Effect: No search query, fetching filtered races (Page 1).");
      setCurrentPage(1);
      fetchFilteredRaces(1);
    }
  }, [debouncedSearchQuery, selectedDistance, showFlatOnly, debouncedDateRange, fetchAiRaces, fetchFilteredRaces]);

  // <<< Handler to load the next page of races >>>
  const loadMoreRaces = () => {
      if (isLoading || isFetchingMore || !hasMoreRaces) {
          console.log("Load More: Aborted (loading, fetching more, or no more races)");
          return;
      }
      const nextPage = currentPage + 1;
      console.log(`Load More: Fetching page ${nextPage}`);
      setCurrentPage(nextPage);
      fetchFilteredRaces(nextPage);
  };

  // Handlers
  const handleRaceSelect = (id: string | number | null) => {
    setSelectedRaceId(id);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };
  
  const handleDateRangeChange = (range: DateRange | undefined) => {
    console.log("Calendar onSelect triggered with range:", range);
    setSelectedDateRange(range);
  };

  const toggleFilters = () => setIsFiltersOpen(!isFiltersOpen);

  return (
    <main className="flex flex-col items-center min-h-screen py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight mb-4 text-center">
        Discover Your Next PR
      </h1>

      <ChatSearchInput
        value={searchQuery}
        onChange={handleSearchChange}
      />

      <div className="w-full max-w-7xl mx-auto mt-4 flex justify-end lg:hidden">
        <Button variant="outline" onClick={toggleFilters}>
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          {isFiltersOpen ? "Hide Filters" : "Show Filters"}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row w-full max-w-7xl mx-auto gap-6 mt-2 lg:mt-6">
        
        <div className={`${isFiltersOpen ? 'block' : 'hidden'} lg:block lg:w-[300px] xl:w-[350px]`}> 
          <FilterSidebar
            distances={uniqueDistances}
            selectedDistance={selectedDistance}
            onDistanceChange={setSelectedDistance}
            showFlatOnly={showFlatOnly}
            onFlatnessChange={setShowFlatOnly}
            selectedDateRange={selectedDateRange}
            onDateRangeChange={handleDateRangeChange}
            showTrending={showTrending}
            onTrendingChange={setShowTrending}
            showPopular={showPopular}
            onPopularChange={setShowPopular}
          />
        </div>

        <div className="flex-1 flex flex-col gap-6">
           <ClientMapWrapper
             className="min-h-[300px] h-[40vh] lg:h-auto lg:aspect-video relative"
             races={races} 
             isLoading={isLoading}
             error={error}
             hoveredRaceId={hoveredRaceId}
             selectedRaceId={selectedRaceId}
             onRaceSelect={handleRaceSelect}
           />

           <RaceResults
             races={races}
             isLoading={isLoading}
             isFetchingMore={isFetchingMore}
             error={error}
             onRaceHover={setHoveredRaceId}
             onRaceSelect={handleRaceSelect}
             selectedRaceId={selectedRaceId}
             loadMoreRaces={loadMoreRaces}
             hasMoreRaces={hasMoreRaces}
           />
        </div>
      </div>

    </main>
  );
} 