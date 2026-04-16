'use client';

import { useMemo } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import { useState, useCallback, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteStop {
  sequenceNo: number;
  yardName: string;
  postcode: string;
  town?: string;
  latitude: number;
  longitude: number;
  plannedArrival?: string | null;
  plannedDeparture?: string | null;
}

export interface RouteMapProps {
  stops: RouteStop[];
  homeBase?: { latitude: number; longitude: number; label?: string };
  /** Height CSS value (default: "400px") */
  height?: string;
  /** Compact mode for list preview */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Polyline component (draws between markers)
// ---------------------------------------------------------------------------

function RoutePolyline({ stops, homeBase }: { stops: RouteStop[]; homeBase?: RouteMapProps['homeBase'] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps) return;

    const path: google.maps.LatLngLiteral[] = [];

    if (homeBase) {
      path.push({ lat: homeBase.latitude, lng: homeBase.longitude });
    }

    for (const stop of stops) {
      path.push({ lat: stop.latitude, lng: stop.longitude });
    }

    if (homeBase) {
      path.push({ lat: homeBase.latitude, lng: homeBase.longitude });
    }

    const polyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#1e40af',
      strokeOpacity: 0.8,
      strokeWeight: 3,
    });

    polyline.setMap(map);

    return () => {
      polyline.setMap(null);
    };
  }, [map, stops, homeBase]);

  return null;
}

// ---------------------------------------------------------------------------
// Map bounds fitter
// ---------------------------------------------------------------------------

function FitBounds({ stops, homeBase }: { stops: RouteStop[]; homeBase?: RouteMapProps['homeBase'] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps || stops.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    if (homeBase) {
      bounds.extend({ lat: homeBase.latitude, lng: homeBase.longitude });
    }

    for (const stop of stops) {
      bounds.extend({ lat: stop.latitude, lng: stop.longitude });
    }

    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
  }, [map, stops, homeBase]);

  return null;
}

// ---------------------------------------------------------------------------
// Static fallback (no API key / demo mode)
// ---------------------------------------------------------------------------

function StaticMapPlaceholder({ stops, homeBase, height }: RouteMapProps & { height: string }) {
  return (
    <div
      className="flex flex-col rounded-md border border-border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900"
      style={{ height, minHeight: '120px' }}
    >
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
        <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
        <span className="text-xs font-medium text-muted">Route Map (API key not configured)</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {homeBase && (
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white">H</span>
            <span className="text-muted">{homeBase.label || 'Home Base'}</span>
          </div>
        )}
        {stops.map((stop) => (
          <div key={stop.sequenceNo} className="mb-1.5 flex items-center gap-2 text-xs">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {stop.sequenceNo}
            </span>
            <span className="font-medium">{stop.yardName}</span>
            <span className="text-muted">{stop.postcode}</span>
          </div>
        ))}
        {homeBase && stops.length > 0 && (
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white">H</span>
            <span className="text-muted">Return to {homeBase.label || 'Home Base'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RouteMap({ stops, homeBase, height = '400px', compact = false }: RouteMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.DEMO_MODE === 'true';

  const [activeMarker, setActiveMarker] = useState<number | null>(null);

  const center = useMemo(() => {
    if (stops.length === 0 && homeBase) {
      return { lat: homeBase.latitude, lng: homeBase.longitude };
    }
    if (stops.length === 0) {
      return { lat: 46.4653, lng: 6.8961 }; // Default: Blonay, Switzerland
    }
    const avgLat = stops.reduce((sum, s) => sum + s.latitude, 0) / stops.length;
    const avgLng = stops.reduce((sum, s) => sum + s.longitude, 0) / stops.length;
    return { lat: avgLat, lng: avgLng };
  }, [stops, homeBase]);

  const handleMarkerClick = useCallback((sequenceNo: number) => {
    setActiveMarker((prev) => (prev === sequenceNo ? null : sequenceNo));
  }, []);

  const effectiveHeight = compact ? '200px' : height;

  // Show static fallback when no API key or in demo mode
  if (!apiKey || isDemoMode) {
    return <StaticMapPlaceholder stops={stops} homeBase={homeBase} height={effectiveHeight} />;
  }

  return (
    <div style={{ height: effectiveHeight, minHeight: '120px' }} className="overflow-hidden rounded-md border border-border">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={11}
          gestureHandling="cooperative"
          disableDefaultUI={compact}
          mapId="route-map"
          style={{ width: '100%', height: '100%' }}
        >
          <FitBounds stops={stops} homeBase={homeBase} />
          <RoutePolyline stops={stops} homeBase={homeBase} />

          {/* Home base marker */}
          {homeBase && (
            <AdvancedMarker
              position={{ lat: homeBase.latitude, lng: homeBase.longitude }}
              title={homeBase.label || 'Home Base'}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-green-600 text-xs font-bold text-white shadow-md">
                H
              </div>
            </AdvancedMarker>
          )}

          {/* Stop markers */}
          {stops.map((stop) => (
            <AdvancedMarker
              key={stop.sequenceNo}
              position={{ lat: stop.latitude, lng: stop.longitude }}
              title={`${stop.sequenceNo}. ${stop.yardName}`}
              onClick={() => handleMarkerClick(stop.sequenceNo)}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-primary text-xs font-bold text-white shadow-md">
                {stop.sequenceNo}
              </div>
            </AdvancedMarker>
          ))}

          {/* Info windows */}
          {stops.map((stop) =>
            activeMarker === stop.sequenceNo ? (
              <InfoWindow
                key={`info-${stop.sequenceNo}`}
                position={{ lat: stop.latitude, lng: stop.longitude }}
                onCloseClick={() => setActiveMarker(null)}
              >
                <div className="min-w-[160px] p-1">
                  <p className="font-semibold">{stop.yardName}</p>
                  <p className="text-xs text-gray-500">{stop.postcode}{stop.town ? `, ${stop.town}` : ''}</p>
                  {stop.plannedArrival && (
                    <p className="mt-1 text-xs">
                      Planned: {new Date(stop.plannedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </InfoWindow>
            ) : null,
          )}
        </Map>
      </APIProvider>
    </div>
  );
}
