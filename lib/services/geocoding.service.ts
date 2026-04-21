/**
 * Phase 5 — Google Geocoding Service
 *
 * Geocodes yard addresses using the Google Geocoding API.
 * Supports single-yard and batch geocoding.
 */

import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { withRetry, circuitBreakers } from '@/lib/utils/retry';

const GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId: string;
  partialMatch: boolean;
  /**
   * AMBER-06 remediation — provenance of the geocode result.
   *
   * Google returns one of: ROOFTOP, RANGE_INTERPOLATED,
   * GEOMETRIC_CENTER, APPROXIMATE. See
   * https://developers.google.com/maps/documentation/geocoding/requests-geocoding#GeocodingResponses
   */
  precision: string | null;
  source: 'google' | 'n8n' | 'manual';
}

interface GeocodeApiResponse {
  status: string;
  results: Array<{
    geometry: {
      location: { lat: number; lng: number };
      location_type?: string;
    };
    formatted_address: string;
    place_id: string;
    partial_match?: boolean;
  }>;
  error_message?: string;
}

function buildAddressString(yard: {
  addressLine1: string;
  addressLine2?: string | null;
  town: string;
  county?: string | null;
  postcode: string;
}): string {
  const parts = [yard.addressLine1];
  if (yard.addressLine2) parts.push(yard.addressLine2);
  parts.push(yard.town);
  if (yard.county) parts.push(yard.county);
  parts.push(yard.postcode);
  return parts.join(', ');
}

export const geocodingService = {
  /**
   * Geocode a single yard address via Google Geocoding API.
   */
  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    if (!env.GOOGLE_MAPS_API_KEY) {
      console.warn('[geocoding] GOOGLE_MAPS_API_KEY not configured');
      return null;
    }

    const url = new URL(GEOCODING_API_URL);
    url.searchParams.set('address', address);
    url.searchParams.set('key', env.GOOGLE_MAPS_API_KEY);
    url.searchParams.set('region', 'gb');

    const { data } = await withRetry(
      async (signal) => {
        const response = await fetch(url.toString(), { signal });
        const json = (await response.json()) as GeocodeApiResponse;

        if (json.status === 'OVER_QUERY_LIMIT' || json.status === 'UNKNOWN_ERROR') {
          throw new Error(`Geocoding API error: ${json.status} - ${json.error_message || 'Retryable error'}`);
        }

        return json;
      },
      { maxRetries: 2, operationName: 'geocoding', timeoutMs: 10_000 },
      circuitBreakers.geocoding,
    );

    if (data.status === 'ZERO_RESULTS') {
      return null;
    }

    if (data.status !== 'OK') {
      throw new Error(`Geocoding API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    const result = data.results[0];
    if (!result) return null;

    const partialMatch = result.partial_match ?? false;
    if (partialMatch) {
      console.warn(`[geocoding] Partial match for address: ${address}`);
    }

    return {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      partialMatch,
      precision: result.geometry.location_type ?? null,
      source: 'google',
    };
  },

  /**
   * Geocode a single yard and update the database record.
   */
  async geocodeYard(yardId: string): Promise<{ success: boolean; error?: string }> {
    const yard = await prisma.yard.findUnique({ where: { id: yardId } });
    if (!yard) {
      return { success: false, error: 'Yard not found' };
    }

    // Skip if already geocoded and address hasn't changed
    if (yard.latitude !== null && yard.longitude !== null && yard.geocodedAt) {
      return { success: true };
    }

    const address = buildAddressString(yard);

    try {
      const result = await geocodingService.geocodeAddress(address);

      if (!result) {
        await prisma.yard.update({
          where: { id: yardId },
          data: { geocodeFailed: true },
        });
        return { success: false, error: 'No results found for address' };
      }

      await prisma.yard.update({
        where: { id: yardId },
        data: {
          latitude: result.latitude,
          longitude: result.longitude,
          geocodeFailed: false,
          geocodedAt: new Date(),
          geocodeSource: result.source,
          geocodePrecision: result.precision,
          formattedAddress: result.formattedAddress,
        },
      });

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[geocoding] Failed to geocode yard ${yardId}: ${message}`);

      await prisma.yard.update({
        where: { id: yardId },
        data: { geocodeFailed: true },
      });

      return { success: false, error: message };
    }
  },

  /**
   * Batch geocode all yards missing coordinates.
   * Respects rate limits with a delay between requests.
   */
  async batchGeocodeYards(): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    errors: Array<{ yardId: string; error: string }>;
  }> {
    const yardsToGeocode = await prisma.yard.findMany({
      where: {
        OR: [
          { latitude: null },
          { longitude: null },
        ],
        geocodeFailed: false,
      },
    });

    const results = {
      total: yardsToGeocode.length,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ yardId: string; error: string }>,
    };

    for (const yard of yardsToGeocode) {
      const result = await geocodingService.geocodeYard(yard.id);
      if (result.success) {
        results.succeeded++;
      } else {
        results.failed++;
        results.errors.push({ yardId: yard.id, error: result.error || 'Unknown' });
      }

      // Rate limit: ~10 requests per second (Google's limit is 50/s)
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  },

  /**
   * Update a yard with externally-provided geocode results (from n8n).
   *
   * Optional `meta` captures AMBER-06 provenance fields — source (who
   * geocoded), precision (Google's location_type or equivalent), and
   * the formatted address. These let operators audit stale/low-quality
   * coordinates without having to re-run the geocoder.
   */
  async updateYardCoordinates(
    yardId: string,
    latitude: number,
    longitude: number,
    meta?: {
      source?: string | null;
      precision?: string | null;
      formattedAddress?: string | null;
    },
  ): Promise<{ success: boolean; error?: string }> {
    const yard = await prisma.yard.findUnique({ where: { id: yardId } });
    if (!yard) {
      return { success: false, error: 'Yard not found' };
    }

    await prisma.yard.update({
      where: { id: yardId },
      data: {
        latitude,
        longitude,
        geocodeFailed: false,
        geocodedAt: new Date(),
        // Default to 'n8n' when the caller doesn't specify a source —
        // this method is exposed through the n8n callback.
        geocodeSource: meta?.source ?? 'n8n',
        geocodePrecision: meta?.precision ?? null,
        formattedAddress: meta?.formattedAddress ?? null,
      },
    });

    return { success: true };
  },
};
