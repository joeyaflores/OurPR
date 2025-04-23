"use client"; // Need state for filters, so convert to Client Component

import { useState, useMemo } from "react";
import { ChatSearchInput } from "@/components/discover/ChatSearchInput";
import { FilterSidebar } from "@/components/discover/FilterSidebar";
import { RaceResults } from "@/components/discover/RaceResults";
import { ClientMapWrapper } from "@/components/discover/ClientMapWrapper";
import { Race } from "@/types/race";
import { DateRange } from "react-day-picker";
import { parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { useDebounce } from "@/hooks/useDebounce";
import { PRTimeline } from "@/components/discover/PRTimeline";

// Mock Data (Replace with actual data fetching later)
const MOCK_RACES: Race[] = [
  {
    id: 1,
    name: "Dallas Downtown Dash",
    location: { city: "Dallas", state: "TX", lat: 32.779167, lng: -96.808891 },
    date: "2024-10-15",
    distance: "10K",
    elevation: "Flat",
    website: "#",
    aiSummary: "Known for its flat profile and typically cool October weather.",
    prPotentialScore: 8,
    similarRunnersCount: 15,
    trainingGroupsCount: 2,
    similarPaceRunnersCount: 25
  },
  {
    id: 2,
    name: "Denver Mile High Marathon",
    location: { city: "Denver", state: "CO", lat: 39.739235, lng: -104.990250 },
    date: "2024-11-01",
    distance: "Marathon",
    elevation: "Mixed",
    website: "#",
    aiSummary: "Challenging altitude, but well-supported with scenic city views.",
    prPotentialScore: 5,
    trainingGroupsCount: 5,
    similarPaceRunnersCount: 40
  },
  {
    id: 3,
    name: "Austin River Run",
    location: { city: "Austin", state: "TX", lat: 30.267153, lng: -97.743061 },
    date: "2024-09-22",
    distance: "Half Marathon",
    elevation: "Mostly Flat",
    website: "#",
    aiSummary: "Popular race along the river, generally flat with one notable hill.",
    prPotentialScore: 7,
    similarRunnersCount: 22,
    trainingGroupsCount: 8,
  },
  {
    id: 4,
    name: "Fort Worth Flat 5K",
    location: { city: "Fort Worth", state: "TX", lat: 32.7555, lng: -97.3308 },
    date: "2024-12-01",
    distance: "5K",
    elevation: "Flat",
    website: "#",
    aiSummary: "Very fast and flat course, perfect for a 5K PR attempt in cool weather.",
    prPotentialScore: 9,
    similarRunnersCount: 30,
    similarPaceRunnersCount: 18
  }
];

// Get unique distances for filter options
const uniqueDistances = Array.from(new Set(MOCK_RACES.map(race => race.distance)));

export default function DiscoverPage() {
  // State for filters
  const [selectedDistance, setSelectedDistance] = useState<string>("all");
  const [showFlatOnly, setShowFlatOnly] = useState<boolean>(false);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [hoveredRaceId, setHoveredRaceId] = useState<string | number | null>(null);
  const [selectedRaceId, setSelectedRaceId] = useState<string | number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [showTrending, setShowTrending] = useState<boolean>(false);
  const [showPopular, setShowPopular] = useState<boolean>(false);

  // Filtering logic
  const filteredRaces = useMemo(() => {
    const lowerCaseQuery = debouncedSearchQuery.toLowerCase();

    let intermediateRaces = MOCK_RACES.filter(race => {
      const distanceMatch = selectedDistance === "all" || race.distance === selectedDistance;
      const flatnessMatch = !showFlatOnly || (race.elevation && race.elevation.toLowerCase().includes('flat'));
      const dateMatch = (() => {
        if (!selectedDateRange?.from) return true;
        try {
          const raceDate = parseISO(race.date);
          const from = startOfDay(selectedDateRange.from);
          if (!selectedDateRange.to) {
            return raceDate >= from;
          }
          const to = endOfDay(selectedDateRange.to);
          return isWithinInterval(raceDate, { start: from, end: to });
        } catch (error) {
          console.error("Error parsing race date:", race.date, error);
          return false;
        }
      })();
      const searchMatch = lowerCaseQuery === "" || 
                          race.name.toLowerCase().includes(lowerCaseQuery) ||
                          race.location.city.toLowerCase().includes(lowerCaseQuery) ||
                          race.location.state.toLowerCase().includes(lowerCaseQuery);

      return distanceMatch && flatnessMatch && dateMatch && searchMatch;
    });

    if (showTrending) {
      console.log("Applying 'Trending' filter (placeholder)");
    }

    if (showPopular) {
      console.log("Applying 'Popular' filter (sorting by similarRunnersCount)");
      intermediateRaces = intermediateRaces.sort((a, b) => 
        (b.similarRunnersCount ?? 0) - (a.similarRunnersCount ?? 0)
      );
    }

    return intermediateRaces;
  }, [selectedDistance, showFlatOnly, selectedDateRange, debouncedSearchQuery, showTrending, showPopular]);

  // Handlers
  const handleRaceSelect = (id: string | number | null) => {
    setSelectedRaceId(id);
    // Optionally reset hover when a card is clicked
    // setHoveredRaceId(null);
  };

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
          distances={uniqueDistances}
          selectedDistance={selectedDistance}
          onDistanceChange={setSelectedDistance}
          showFlatOnly={showFlatOnly}
          onFlatnessChange={setShowFlatOnly}
          selectedDateRange={selectedDateRange}
          onDateRangeChange={setSelectedDateRange}
          showTrending={showTrending}
          onTrendingChange={setShowTrending}
          showPopular={showPopular}
          onPopularChange={setShowPopular}
        />

        <div className="flex-1 flex flex-col gap-6">
           {/* 2. Map View */}
           <ClientMapWrapper 
             className="h-[60vh] lg:h-auto lg:aspect-video" 
             races={filteredRaces} 
             hoveredRaceId={hoveredRaceId} 
             selectedRaceId={selectedRaceId}
             onRaceSelect={handleRaceSelect}
           />

           {/* 4. Race Results (Cards) - Linked to Map/Filters */}
           <RaceResults 
             races={filteredRaces} 
             onRaceHover={setHoveredRaceId} 
             onRaceSelect={handleRaceSelect}
             selectedRaceId={selectedRaceId}
           />
        </div>
      </div>

      {/* Replace placeholder div with the PRTimeline component */}
      {/* <div className="w-full max-w-7xl mx-auto mt-8 p-4 border rounded-lg shadow-sm bg-background">
        <h3 className="text-lg font-semibold mb-2">Your PR Timeline</h3>
        <p className="text-muted-foreground text-sm">Timeline Placeholder (Horizontal Scroll)</p>
      </div> */}
      <PRTimeline />

      {/* Other sections like Social Signals integration will go within the cards or map popups */}

    </main>
  );
} 