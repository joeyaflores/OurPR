"use client"; // Map will require client-side interaction

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet'; // Import Leaflet library itself
import { Race } from '@/types/race'; // Import Race type
import { useEffect } from 'react';

// --- Icon Setup ---
// Import the images using require
const markerIcon2x = require('leaflet/dist/images/marker-icon-2x.png');
const markerIcon = require('leaflet/dist/images/marker-icon.png');
const markerShadow = require('leaflet/dist/images/marker-shadow.png');

// Normal icon
const defaultIcon = L.icon({
    iconUrl: markerIcon.default?.src ?? markerIcon.default ?? markerIcon,
    iconRetinaUrl: markerIcon2x.default?.src ?? markerIcon2x.default ?? markerIcon2x,
    shadowUrl: markerShadow.default?.src ?? markerShadow.default ?? markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Highlighted icon (larger)
const highlightedIcon = L.icon({
    iconUrl: markerIcon.default?.src ?? markerIcon.default ?? markerIcon,
    iconRetinaUrl: markerIcon2x.default?.src ?? markerIcon2x.default ?? markerIcon2x,
    shadowUrl: markerShadow.default?.src ?? markerShadow.default ?? markerShadow,
    iconSize: [35, 57], // Increased size
    iconAnchor: [17, 57], // Adjust anchor based on new size
    popupAnchor: [1, -48], // Adjust popup anchor
    shadowSize: [57, 57] // Increase shadow size
});
// --- End Icon Setup ---

// Define props type
interface MapViewProps {
  className?: string;
  races: Race[];
  hoveredRaceId: string | number | null;
  selectedRaceId: string | number | null;
  onRaceSelect: (id: string | number | null) => void;
  isLoading: boolean; // Add loading state prop
  error: string | null; // Add error state prop
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
export const MapView: React.FC<MapViewProps> = ({ className, races, hoveredRaceId, selectedRaceId, onRaceSelect, isLoading, error }) => {
  
  // Find the first race WITH valid coordinates for the default center
  const firstRaceWithCoords = races.find(r => r.lat != null && r.lng != null);
  
  // Use the first valid race's location as default center, or fallback
  const defaultCenter: L.LatLngExpression = firstRaceWithCoords
    ? [firstRaceWithCoords.lat!, firstRaceWithCoords.lng!] // Use non-null assertion as we checked
    : [39.8283, -98.5795]; // Fallback center

  const defaultZoom = firstRaceWithCoords ? 9 : 4; // Zoom in closer if we have races with coords

  return (
    <MapContainer center={defaultCenter} zoom={defaultZoom} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }} className={`rounded-lg border z-0 ${className || ''}`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Map over races data to create markers, only for races with coords */}
      {races.filter(race => race.lat != null && race.lng != null).map((race) => {
        // Choose icon based on hover state
        const currentIcon = race.id === hoveredRaceId ? highlightedIcon : defaultIcon;
        return (
          <Marker
            key={race.id}
            position={[race.lat!, race.lng!]} // Use non-null assertion as we filtered
            icon={currentIcon}
            zIndexOffset={race.id === hoveredRaceId ? 1000 : 0} 
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
                <div>{race.city}, {race.state}</div> 
                <div>{race.date} - {race.distance}</div>
                {race.elevation && <div>Elevation: {race.elevation}</div>}
                
                {/* AI Summary */}
                {race.aiSummary && (
                  <div className="text-xs text-gray-600 italic pt-1">
                    " {race.aiSummary} "
                  </div>
                )}

                {/* PR Potential */}
                {race.prPotentialScore && (
                  <div className="pt-1">
                     PR Potential: <b>{race.prPotentialScore}/10</b>
                  </div>
                )}

                {/* Social Signals - simplified for popup */}
                {(race.similarRunnersCount !== undefined || race.trainingGroupsCount !== undefined || race.similarPaceRunnersCount !== undefined) && (
                    <div className="text-xs pt-1 border-t border-dashed mt-1.5">
                        {race.similarRunnersCount !== undefined && <div>{race.similarRunnersCount} similar PRs</div>}
                        {race.trainingGroupsCount !== undefined && <div>{race.trainingGroupsCount} groups joined</div>}
                        {race.similarPaceRunnersCount !== undefined && <div>{race.similarPaceRunnersCount} at your pace</div>}
                    </div>
                )}

                {/* Website Link */}
                {race.website && race.website !== '#' && (
                  <div className="pt-1.5 mt-1 border-t border-dashed">
                     <a href={race.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Visit Website
                    </a>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Render the interaction handler component *inside* MapContainer */}
      <MapInteractionHandler selectedRaceId={selectedRaceId} races={races} />

    </MapContainer>
  );
}; 