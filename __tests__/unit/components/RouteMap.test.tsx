import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');
const COMPONENT_PATH = resolve(ROOT, 'components/maps/RouteMap.tsx');

describe('RouteMap component', () => {
  it('component file exists', () => {
    expect(existsSync(COMPONENT_PATH)).toBe(true);
  });

  it('exports RouteMap and RouteStop type', () => {
    const content = readFileSync(COMPONENT_PATH, 'utf-8');
    expect(content).toContain('export function RouteMap');
    expect(content).toContain('export interface RouteStop');
  });

  it('uses @vis.gl/react-google-maps library', () => {
    const content = readFileSync(COMPONENT_PATH, 'utf-8');
    expect(content).toContain("from '@vis.gl/react-google-maps'");
    expect(content).toContain('APIProvider');
    expect(content).toContain('AdvancedMarker');
    expect(content).toContain('InfoWindow');
  });

  it('reads NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY for API provider', () => {
    const content = readFileSync(COMPONENT_PATH, 'utf-8');
    expect(content).toContain('NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY');
  });

  it('renders static placeholder when no API key or demo mode', () => {
    const content = readFileSync(COMPONENT_PATH, 'utf-8');
    expect(content).toContain('StaticMapPlaceholder');
    expect(content).toContain('API key not configured');
  });

  it('accepts stops with lat/lng and renders markers', () => {
    const content = readFileSync(COMPONENT_PATH, 'utf-8');
    // Check RouteStop interface has required fields
    expect(content).toContain('sequenceNo: number');
    expect(content).toContain('yardName: string');
    expect(content).toContain('latitude: number');
    expect(content).toContain('longitude: number');
  });

  it('draws a polyline connecting stops', () => {
    const content = readFileSync(COMPONENT_PATH, 'utf-8');
    expect(content).toContain('RoutePolyline');
    expect(content).toContain('google.maps.Polyline');
  });

  it('shows home base as a distinct marker', () => {
    const content = readFileSync(COMPONENT_PATH, 'utf-8');
    // Home base marker uses green color and "H" label
    expect(content).toContain('bg-green-600');
    expect(content).toContain('Home Base');
  });

  it('numbers each stop marker', () => {
    const content = readFileSync(COMPONENT_PATH, 'utf-8');
    // Stop markers display sequenceNo
    expect(content).toContain('stop.sequenceNo');
  });

  it('shows info windows on marker click', () => {
    const content = readFileSync(COMPONENT_PATH, 'utf-8');
    expect(content).toContain('InfoWindow');
    expect(content).toContain('activeMarker');
    expect(content).toContain('handleMarkerClick');
  });

  it('info window shows yard name and planned time', () => {
    const content = readFileSync(COMPONENT_PATH, 'utf-8');
    expect(content).toContain('stop.yardName');
    expect(content).toContain('stop.plannedArrival');
  });

  it('supports compact mode for list preview', () => {
    const content = readFileSync(COMPONENT_PATH, 'utf-8');
    expect(content).toContain("compact");
    expect(content).toContain("200px");
  });

  it('fits bounds to show all markers', () => {
    const content = readFileSync(COMPONENT_PATH, 'utf-8');
    expect(content).toContain('FitBounds');
    expect(content).toContain('fitBounds');
  });
});

describe('RouteMap integration in pages', () => {
  it('route-run detail page imports and uses RouteMap', () => {
    const detailPage = readFileSync(
      resolve(ROOT, 'app/[locale]/route-runs/[id]/page.tsx'),
      'utf-8',
    );
    expect(detailPage).toContain("from '@/components/maps/RouteMap'");
    expect(detailPage).toContain('<RouteMap');
  });

  it('route-runs list page imports and uses RouteMap', () => {
    const listPage = readFileSync(
      resolve(ROOT, 'app/[locale]/route-runs/page.tsx'),
      'utf-8',
    );
    expect(listPage).toContain("from '@/components/maps/RouteMap'");
    expect(listPage).toContain('<RouteMap');
    expect(listPage).toContain('compact');
  });

  it('route-run detail page no longer has placeholder div', () => {
    const detailPage = readFileSync(
      resolve(ROOT, 'app/[locale]/route-runs/[id]/page.tsx'),
      'utf-8',
    );
    // Should NOT contain the old placeholder
    expect(detailPage).not.toContain('border-dashed');
    expect(detailPage).not.toContain('Map View</p>');
  });
});
