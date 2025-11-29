import React, { useEffect, useRef } from 'react';
import { Coordinates } from '../types';

interface MapComponentProps {
  coordinates: Coordinates | null;
  isTracking: boolean;
}

// Global declaration for Leaflet (loaded via CDN)
declare global {
  interface Window {
    L: any;
  }
}

export const MapComponent: React.FC<MapComponentProps> = ({ coordinates, isTracking }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const pathRef = useRef<any>(null);
  const pathCoordinatesRef = useRef<[number, number][]>([]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    if (window.L) {
      // Default to Tokyo station if no coords yet, or current coords
      const initialLat = coordinates ? coordinates.latitude : 35.6812;
      const initialLng = coordinates ? coordinates.longitude : 139.7671;

      const map = window.L.map(mapContainerRef.current).setView([initialLat, initialLng], 15);

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      mapInstanceRef.current = map;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Marker and Path
  useEffect(() => {
    if (!mapInstanceRef.current || !coordinates || !window.L) return;

    const { latitude, longitude } = coordinates;
    const latLng = [latitude, longitude];

    // Create custom wagashi icon
    const wagashiIcon = window.L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: #65a30d; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);"></div>
             <div class="gps-ring" style="position: absolute; top: -1px; left: -1px; width: 24px; height: 24px; border-color: #65a30d;"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    // Update or create marker
    if (markerRef.current) {
      markerRef.current.setLatLng(latLng);
    } else {
      markerRef.current = window.L.marker(latLng, { icon: wagashiIcon }).addTo(mapInstanceRef.current);
    }

    // Pan map to new location
    mapInstanceRef.current.panTo(latLng);

    // Draw path if tracking is active
    if (isTracking) {
      pathCoordinatesRef.current.push(latLng as [number, number]);
      
      if (pathRef.current) {
        pathRef.current.setLatLngs(pathCoordinatesRef.current);
      } else {
        pathRef.current = window.L.polyline(pathCoordinatesRef.current, {
          color: '#84cc16', // Lime 500
          weight: 4,
          opacity: 0.7,
          dashArray: '10, 10', 
          lineCap: 'round'
        }).addTo(mapInstanceRef.current);
      }
    } else {
      // If tracking stopped, maybe we don't clear the path immediately, 
      // but for this logic, let's reset the path buffer if tracking explicitly toggled off (new session)
      // We handle session reset in parent, but visuals can persist.
    }

  }, [coordinates, isTracking]);

  return <div ref={mapContainerRef} className="w-full h-full z-0" />;
};