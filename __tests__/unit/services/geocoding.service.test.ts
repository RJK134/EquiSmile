import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    yard: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/env', () => ({
  env: {
    GOOGLE_MAPS_API_KEY: 'test-api-key',
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { geocodingService } from '@/lib/services/geocoding.service';

describe('geocodingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('geocodeAddress', () => {
    it('returns coordinates for a valid address', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          status: 'OK',
          results: [{
            geometry: { location: { lat: 51.5074, lng: -0.1278 } },
            formatted_address: '10 Downing St, London SW1A 2AA, UK',
            place_id: 'ChIJdZ8JaGkFdkgRAcedT0gRDAQ',
            partial_match: false,
          }],
        }),
      });

      const result = await geocodingService.geocodeAddress('10 Downing St, London');
      expect(result).toBeTruthy();
      expect(result!.latitude).toBe(51.5074);
      expect(result!.longitude).toBe(-0.1278);
      expect(result!.formattedAddress).toBe('10 Downing St, London SW1A 2AA, UK');
      expect(result!.partialMatch).toBe(false);
    });

    it('returns null for ZERO_RESULTS', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ status: 'ZERO_RESULTS', results: [] }),
      });

      const result = await geocodingService.geocodeAddress('nonexistent address 12345');
      expect(result).toBeNull();
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          status: 'REQUEST_DENIED',
          error_message: 'Invalid API key',
          results: [],
        }),
      });

      await expect(geocodingService.geocodeAddress('test')).rejects.toThrow(
        'Geocoding API error: REQUEST_DENIED',
      );
    });

    it('warns on partial match', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          status: 'OK',
          results: [{
            geometry: { location: { lat: 51.5, lng: -0.1 } },
            formatted_address: 'London, UK',
            place_id: 'test',
            partial_match: true,
          }],
        }),
      });

      const result = await geocodingService.geocodeAddress('vague address');
      expect(result!.partialMatch).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Partial match'),
      );
    });

    it('passes correct parameters to Google API', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ status: 'ZERO_RESULTS', results: [] }),
      });

      await geocodingService.geocodeAddress('Test Address, UK');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('maps.googleapis.com/maps/api/geocode/json'),
        expect.any(Object),
      );
      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.searchParams.get('address')).toBe('Test Address, UK');
      expect(url.searchParams.get('key')).toBe('test-api-key');
      expect(url.searchParams.get('region')).toBe('gb');
    });
  });

  describe('geocodeYard', () => {
    it('returns success for already geocoded yard', async () => {
      mockPrisma.yard.findUnique.mockResolvedValue({
        id: 'yard1',
        latitude: 51.5,
        longitude: -0.1,
        geocodedAt: new Date(),
        addressLine1: 'Test',
        town: 'London',
        postcode: 'SW1A 1AA',
      });

      const result = await geocodingService.geocodeYard('yard1');
      expect(result.success).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns error for non-existent yard', async () => {
      mockPrisma.yard.findUnique.mockResolvedValue(null);

      const result = await geocodingService.geocodeYard('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Yard not found');
    });

    it('geocodes yard and updates record', async () => {
      mockPrisma.yard.findUnique.mockResolvedValue({
        id: 'yard1',
        latitude: null,
        longitude: null,
        geocodedAt: null,
        addressLine1: '10 Downing St',
        addressLine2: null,
        town: 'London',
        county: null,
        postcode: 'SW1A 2AA',
      });

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          status: 'OK',
          results: [{
            geometry: { location: { lat: 51.5034, lng: -0.1276 } },
            formatted_address: '10 Downing St',
            place_id: 'test',
          }],
        }),
      });

      mockPrisma.yard.update.mockResolvedValue({});

      const result = await geocodingService.geocodeYard('yard1');
      expect(result.success).toBe(true);
      expect(mockPrisma.yard.update).toHaveBeenCalledWith({
        where: { id: 'yard1' },
        data: expect.objectContaining({
          latitude: 51.5034,
          longitude: -0.1276,
          geocodeFailed: false,
        }),
      });
    });

    it('marks yard as geocodeFailed on error', async () => {
      mockPrisma.yard.findUnique.mockResolvedValue({
        id: 'yard1',
        latitude: null,
        longitude: null,
        geocodedAt: null,
        addressLine1: 'Bad Address',
        town: 'Nowhere',
        postcode: 'XX1 1XX',
      });

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ status: 'ZERO_RESULTS', results: [] }),
      });

      mockPrisma.yard.update.mockResolvedValue({});

      const result = await geocodingService.geocodeYard('yard1');
      expect(result.success).toBe(false);
      expect(mockPrisma.yard.update).toHaveBeenCalledWith({
        where: { id: 'yard1' },
        data: { geocodeFailed: true },
      });
    });
  });

  describe('batchGeocodeYards', () => {
    it('processes all un-geocoded yards', async () => {
      mockPrisma.yard.findMany.mockResolvedValue([
        {
          id: 'yard1',
          latitude: null,
          longitude: null,
          geocodedAt: null,
          geocodeFailed: false,
          addressLine1: 'Addr 1',
          town: 'Town 1',
          postcode: 'AA1 1AA',
        },
        {
          id: 'yard2',
          latitude: null,
          longitude: null,
          geocodedAt: null,
          geocodeFailed: false,
          addressLine1: 'Addr 2',
          town: 'Town 2',
          postcode: 'BB1 1BB',
        },
      ]);

      mockPrisma.yard.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
        return Promise.resolve({
          id: where.id,
          latitude: null,
          longitude: null,
          geocodedAt: null,
          addressLine1: 'Test',
          town: 'Town',
          postcode: 'AA1 1AA',
        });
      });

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          status: 'OK',
          results: [{
            geometry: { location: { lat: 51.5, lng: -0.1 } },
            formatted_address: 'Test',
            place_id: 'test',
          }],
        }),
      });

      mockPrisma.yard.update.mockResolvedValue({});

      const result = await geocodingService.batchGeocodeYards();
      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('returns empty result when no yards need geocoding', async () => {
      mockPrisma.yard.findMany.mockResolvedValue([]);

      const result = await geocodingService.batchGeocodeYards();
      expect(result.total).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('updateYardCoordinates', () => {
    it('updates yard with provided coordinates', async () => {
      mockPrisma.yard.findUnique.mockResolvedValue({ id: 'yard1' });
      mockPrisma.yard.update.mockResolvedValue({});

      const result = await geocodingService.updateYardCoordinates(
        'yard1', 51.5, -0.1
      );
      expect(result.success).toBe(true);
      expect(mockPrisma.yard.update).toHaveBeenCalledWith({
        where: { id: 'yard1' },
        data: expect.objectContaining({
          latitude: 51.5,
          longitude: -0.1,
          geocodeFailed: false,
        }),
      });
    });

    it('returns error for non-existent yard', async () => {
      mockPrisma.yard.findUnique.mockResolvedValue(null);

      const result = await geocodingService.updateYardCoordinates(
        'nonexistent', 51.5, -0.1
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Yard not found');
    });
  });
});

