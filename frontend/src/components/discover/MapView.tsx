"use client"; // Map will require client-side interaction

import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet'; // Import Leaflet library itself
import { Race } from '@/types/race'; // Import Race type
import { useEffect, useState } from 'react';

// --- Icon Setup ---
// Import the images using require is causing issues, let's revert to standard import if possible
// If these are truly needed via require, ensure build process handles them
// import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// import markerIcon from 'leaflet/dist/images/marker-icon.png';
// import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix for default icon path issues with bundlers like Webpack
// delete (L.Icon.Default.prototype as any)._getIconUrl;
// L.Icon.Default.mergeOptions({
//   iconRetinaUrl: markerIcon2x.src, // Use .src if using standard import
//   iconUrl: markerIcon.src,
//   shadowUrl: markerShadow.src,
// });

// Define color mapping for distances
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

// Common distances for the main legend
const commonDistances = ['5K', '10K', 'Half Marathon', 'Marathon'] as const;

// Function to create colored icon
const createIcon = (color: string, isHighlighted: boolean = false) => {
  const size: [number, number] = isHighlighted ? [24, 24] : [20, 20];
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${size[0]}px;
        height: ${size[1]}px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transform: translate(-50%, -50%);
      "></div>
    `,
    iconSize: size,
    iconAnchor: [size[0]/2, size[1]/2],
    popupAnchor: [0, -(size[1]/2) - 5],
  });
};

// Legend Control Component
const MapLegend = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showUltras, setShowUltras] = useState(false);

  const ultraDistances = ['50K', '50 Miles', '100K', '100 Miles'] as const;

  return (
    <div className="absolute left-3 top-3 z-[1000]">
      {isExpanded ? (
        <div className="bg-white rounded-lg shadow-lg p-3 max-w-[160px]">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold text-sm">Race Distances</h4>
            <button 
              onClick={() => setIsExpanded(false)}
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1.5">
            {/* Common distances */}
            {commonDistances.map((distance) => (
              <div key={distance} className="flex items-center gap-2 text-xs">
                <span 
                  className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                  style={{ 
                    backgroundColor: distanceColors[distance],
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}
                />
                <span className="truncate">{distance}</span>
              </div>
            ))}
            
            {/* Ultra distances toggle section */}
            <div className="pt-1 mt-1 border-t border-gray-100">
              <button
                onClick={() => setShowUltras(!showUltras)}
                className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <span>{showUltras ? '▼' : '▶'}</span>
                <span>Ultra Distances</span>
              </button>
              
              {showUltras && (
                <div className="mt-1.5 space-y-1.5 pl-1">
                  {ultraDistances.map((distance) => (
                    <div key={distance} className="flex items-center gap-2 text-xs">
                      <span 
                        className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                        style={{ 
                          backgroundColor: distanceColors[distance],
                          border: '2px solid white',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                      />
                      <span className="truncate">{distance}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-white rounded-lg shadow-lg p-2 hover:bg-gray-50 transition-colors"
          title="Show legend"
        >
          <div className="flex items-center gap-2">
            {commonDistances.slice(0, 3).map((distance, i) => (
              <span
                key={distance}
                className="w-3 h-3 rounded-full border-2 border-white"
                style={{ 
                  backgroundColor: distanceColors[distance],
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  zIndex: 3 - i
                }}
              />
            ))}
            <span className="text-xs font-medium">Legend</span>
          </div>
        </button>
      )}
    </div>
  );
};

// Define props type
interface MapViewProps {
  className?: string;
  races: Race[];
  hoveredRaceId: string | number | null;
  selectedRaceId: string | number | null;
  onRaceSelect: (id: string | number | null) => void;
  isLoading: boolean;
  error: string | null;
}

// <<< Define Default Map View Constants >>>
const DEFAULT_CENTER: L.LatLngTuple = [39.8283, -98.5795]; // Center of US
const DEFAULT_ZOOM = 4;

// Internal component to handle map interactions that require the map instance
const MapInteractionHandler: React.FC<{ selectedRaceId: string | number | null, races: Race[] }> = ({ selectedRaceId, races }) => {
  const map = useMap(); // This is valid here, inside MapContainer context

  // Effect to fly to selected race and open popup
  useEffect(() => {
    if (selectedRaceId !== null && map) {
      const selectedRace = races.find(race => race.id === selectedRaceId);
      // Check if race and coordinates exist before using them
      if (selectedRace && selectedRace.lat != null && selectedRace.lng != null) {
        const targetLatLng: L.LatLngTuple = [selectedRace.lat, selectedRace.lng];
        map.flyTo(targetLatLng, 13);

        map.eachLayer(layer => {
          if (layer instanceof L.Marker) {
            const markerLatLng = layer.getLatLng();
            if (markerLatLng.lat === targetLatLng[0] && markerLatLng.lng === targetLatLng[1]) {
              setTimeout(() => {
                layer.openPopup();
              }, 100); 
            }
          }
        });
      }
    }
  }, [selectedRaceId, map, races]);

  // <<< Effect to fit map bounds to race results >>>
  useEffect(() => {
    if (!map) return; // Exit if map is not initialized

    const racesWithCoords = races.filter(race => race.lat != null && race.lng != null);

    if (racesWithCoords.length > 0) {
      // Create LatLng objects for Leaflet bounds calculation
      const latLngs = racesWithCoords.map(race => L.latLng(race.lat!, race.lng!));
      
      // Calculate bounds
      const bounds = L.latLngBounds(latLngs);

      // Fit map to bounds with padding
      // Use flyToBounds for smoother animation, or fitBounds for instant jump
      map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 14 }); // Add padding and limit max zoom
      
    } else {
      // Optional: Reset view if there are no races
      // map.setView(DEFAULT_CENTER, DEFAULT_ZOOM); 
      // Let's not reset for now, maybe user zoomed/panned intentionally
    }

  // Rerun ONLY when the races array reference changes (or map initializes)
  // Avoid re-running on every render or if selectedRaceId changes.
  }, [races, map]);

  return null; // This component doesn't render anything itself
};

// Update component signature to accept props
export const MapView: React.FC<MapViewProps> = ({ className, races, hoveredRaceId, selectedRaceId, onRaceSelect, isLoading, error }) => {
  
  const [isClient, setIsClient] = useState(false); // <-- Add state

  // Set isClient to true only on the client side after mount
  useEffect(() => { // <-- Add effect
    setIsClient(true);
  }, []);

  // Find the first race WITH valid coordinates for the default center
  const firstRaceWithCoords = races.find(r => r.lat != null && r.lng != null);
  
  // Use the first valid race's location as default center, or fallback
  const defaultCenter: L.LatLngExpression = firstRaceWithCoords
    ? [firstRaceWithCoords.lat!, firstRaceWithCoords.lng!] // Use non-null assertion as we checked
    : [39.8283, -98.5795]; // Fallback center

  const defaultZoom = firstRaceWithCoords ? 9 : DEFAULT_ZOOM; // Use constant

  // Conditionally render MapContainer only on the client
  if (!isClient) { // <-- Add conditional check
    // You could return a placeholder/skeleton here instead of null
    return (
       <div className={`aspect-video w-full bg-muted rounded-lg flex items-center justify-center border ${className || ''}`}>
         <p className="text-muted-foreground">Loading Map...</p>
       </div>
    );
  }
  
  return (
    <div className="relative w-full h-full">
      <MapContainer center={defaultCenter} zoom={defaultZoom} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }} className={`rounded-lg border z-0 ${className || ''}`}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Map over races data to create markers, only for races with coords */}
        {races.filter(race => race.lat != null && race.lng != null).map((race) => {
          const isHovered = race.id === hoveredRaceId;
          const color = distanceColors[race.distance as keyof typeof distanceColors] || distanceColors.Other;
          const icon = createIcon(color, isHovered);
          return (
            <Marker
              key={race.id}
              position={[race.lat!, race.lng!]} // Use non-null assertion as we filtered
              icon={icon}
              zIndexOffset={isHovered ? 1000 : 0} 
              eventHandlers={{
                click: () => {
                  onRaceSelect(race.id);
                },
              }}
            >
              <Popup minWidth={200}>
                <div className="space-y-1.5 text-sm">
                  <div className="font-bold text-base">{race.name}</div>
                  {/* Display city/state directly */}
                  <div className="flex items-center gap-2">
                    <span 
                      className="inline-block w-3 h-3 rounded-full" 
                      style={{ 
                        backgroundColor: color,
                        border: '2px solid white',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }}
                    />
                    <span>{race.date} - {race.distance}</span>
                  </div>
                  {/* Use total_elevation_gain */}
                  {race.total_elevation_gain != null && (
                    <div>Elevation Gain: {race.total_elevation_gain.toLocaleString()} ft</div>
                  )}
                  
                  {/* AI Summary */}
                  {race.ai_summary && (
                    <div className="text-xs text-gray-600 italic pt-1">
                      " {race.ai_summary} "
                    </div>
                  )}

                  {/* PR Potential */}
                  {race.pr_potential_score && (
                    <div className="pt-1">
                       PR Potential: <b>{race.pr_potential_score}/10</b>
                    </div>
                  )}

                  {/* Social Signals - simplified for popup */}
                  {(race.similar_runners_count !== undefined || race.training_groups_count !== undefined || race.similar_pace_runners_count !== undefined) && (
                      <div className="text-xs pt-1 border-t border-dashed mt-1.5">
                          {race.similar_runners_count !== undefined && <div>{race.similar_runners_count} similar PRs</div>}
                          {race.training_groups_count !== undefined && <div>{race.training_groups_count} groups joined</div>}
                          {race.similar_pace_runners_count !== undefined && <div>{race.similar_pace_runners_count} at your pace</div>}
                      </div>
                  )}

                  {/* Website Link */}
                  {race.website && race.website !== '#' && (
                    <div className="pt-1.5 mt-1 border-t border-dashed">
                       <a 
                         href={race.website} 
                         target="_blank" 
                         rel="noopener noreferrer" 
                         className="text-blue-600 hover:underline"
                       >
                        Visit Website
                      </a>
                    </div>
                  )}
                </div>
              </Popup>
              <Tooltip sticky>
                {race.name}
              </Tooltip>
            </Marker>
          );
        })}

        {/* Custom MapLegend component rendered inside MapContainer */}
        <MapLegend /> 
        {/* Internal component for handling map interactions */}
        <MapInteractionHandler selectedRaceId={selectedRaceId} races={races} /> 
      </MapContainer>
    </div>
  );
}; 