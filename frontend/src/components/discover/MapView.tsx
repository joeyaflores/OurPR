"use client"; // Map will require client-side interaction

import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet'; // Import Leaflet library itself
import { Race } from '@/types/race'; // Import Race type
import { useEffect, useState } from 'react';
import { Mountain, Sparkles, Zap, Users, Group } from 'lucide-react'; // <-- Import Mountain, Sparkles, and Zap icons, and Users, Group
import { Badge } from '@/components/ui/badge'; // <-- Import Badge

// --- Icon Setup ---
// Import the images using require
const markerIcon2x = require('leaflet/dist/images/marker-icon-2x.png');
const markerIcon = require('leaflet/dist/images/marker-icon.png');
const markerShadow = require('leaflet/dist/images/marker-shadow.png');

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
  onRaceHover: (id: string | number | null) => void;
  isLoading: boolean;
  error: string | null;
}

// Commented out as per last working step
// delete (L.Icon.Default.prototype as any)._getIconUrl;

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

  return null; // This component doesn't render anything itself
};

// Update component signature to accept props
export const MapView: React.FC<MapViewProps> = ({ className, races, hoveredRaceId, selectedRaceId, onRaceSelect, onRaceHover, isLoading, error }) => {
  
  // Find the first race WITH valid coordinates for the default center
  const firstRaceWithCoords = races.find(r => r.lat != null && r.lng != null);
  
  // Use the first valid race's location as default center, or fallback
  const defaultCenter: L.LatLngExpression = firstRaceWithCoords
    ? [firstRaceWithCoords.lat!, firstRaceWithCoords.lng!] // Use non-null assertion as we checked
    : [39.8283, -98.5795]; // Fallback center

  const defaultZoom = firstRaceWithCoords ? 9 : 4; // Zoom in closer if we have races with coords

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
                  // Toggle selection: if clicking the already selected marker, deselect it (null)
                  const nextSelectedId = race.id === selectedRaceId ? null : race.id;
                  onRaceSelect(nextSelectedId);
                },
                mouseover: (e: L.LeafletMouseEvent) => {
                  onRaceHover(race.id);
                  // Optional: Bring marker to front visually on hover (Leaflet specific)
                  if (e.target && typeof (e.target as any).bringToFront === 'function') {
                    (e.target as any).bringToFront();
                  } else {
                    console.warn("bringToFront not available on event target", e.target);
                  }
                },
                mouseout: () => {
                  onRaceHover(null);
                },
              }}
            >
              <Popup minWidth={200}>
                <div className="space-y-1.5 text-sm">
                  <div className="font-bold text-base mb-1">{race.name}</div>
                  
                  {/* Location & Date (formatted) - Consistent with Card Header */}
                  <p className="text-muted-foreground text-sm"> 
                    {race.city}, {race.state} - {new Date(race.date).toLocaleDateString()}
                  </p>

                  {/* Distance - Consistent with Card Body */}
                  <div className="text-sm">Distance: {race.distance}</div>

                  {/* Elevation Badge - Consistent with Card Header */}
                  {race.elevation != null && (
                     <div className="flex items-center text-sm"> {/* Wrap for layout */} 
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1"
                        >
                          <Mountain className="h-3 w-3" />
                          {typeof race.elevation === 'number'
                            ? `${(race.elevation as number).toLocaleString()} ft`
                            : String(race.elevation)}
                        </Badge>
                      </div>
                  )}
                  
                  {/* AI Summary - Consistent with Card */}
                  {race.ai_summary && (
                    <div className="text-xs text-muted-foreground border-l-2 border-primary pl-2 italic my-1"> {/* Reduced margin */}
                      <Sparkles className="inline h-3 w-3 mr-1" /> {race.ai_summary}
                    </div>
                  )}

                  {/* PR Potential - Consistent with Card (without tooltip) */}
                  {race.pr_potential_score && (
                     <div className="flex items-center text-sm pt-1"> {/* Added padding-top */} 
                         <Zap className="h-4 w-4 mr-1 text-yellow-500 shrink-0" /> {/* Added shrink-0 */} 
                         <span>PR Potential: </span>
                         <Badge variant="secondary" className="ml-1.5">{race.pr_potential_score}/10</Badge>
                     </div>
                  )}

                  {/* Social Signals - Consistent with Card (icons + simplified text) */}
                  {(race.similar_runners_count !== undefined || race.training_groups_count !== undefined || race.similar_pace_runners_count !== undefined) && (
                      <div className="text-xs pt-1 border-t border-dashed mt-1.5 space-y-1 text-muted-foreground"> {/* Added text-muted-foreground and space-y */} 
                          {race.similar_runners_count !== undefined && (
                            <div className="flex items-center gap-1.5"> {/* Added flex container */} 
                              <Users className="h-3 w-3 shrink-0" /> 
                              <span>{race.similar_runners_count} similar PRs</span>
                            </div>
                          )}
                          {race.training_groups_count !== undefined && (
                            <div className="flex items-center gap-1.5"> {/* Added flex container */} 
                              <Group className="h-3 w-3 shrink-0" />
                              <span>{race.training_groups_count} groups joined</span>
                            </div>
                          )}
                          {race.similar_pace_runners_count !== undefined && (
                            <div className="flex items-center gap-1.5"> {/* Added flex container */} 
                              <Users className="h-3 w-3 shrink-0" />
                              <span>{race.similar_pace_runners_count} at your pace</span>
                            </div>
                          )}
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
              {/* Add Tooltip for hover */}
              <Tooltip 
                direction="top" 
                offset={[0, -10]}
                // Use the custom class defined in globals.css 
                className="leaflet-tooltip-custom"
              >
                <span>{race.name}</span>
              </Tooltip>
            </Marker>
          );
        })}

        {/* Render the interaction handler component *inside* MapContainer */}
        <MapInteractionHandler selectedRaceId={selectedRaceId} races={races} />
      </MapContainer>
      
      {/* Add the legend */}
      <MapLegend />
    </div>
  );
}; 