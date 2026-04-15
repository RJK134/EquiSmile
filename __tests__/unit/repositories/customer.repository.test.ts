import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    customer: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { customerRepository } from '@/lib/repositories/customer.repository';

describe('customerRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findMany', () => {
    it('returns paginated results', async () => {
      const customers = [{ id: '1', fullName: 'Sarah Jones' }];
      mockPrisma.customer.findMany.mockResolvedValue(customers);
      mockPrisma.customer.count.mockResolvedValue(1);

      const result = await customerRepository.findMany({
        page: 1,
        pageSize: 20,
      });

      expect(result.data).toEqual(customers);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('applies search filter', async () => {
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(0);

      await customerRepository.findMany({
        search: 'Jones',
        page: 1,
        pageSize: 20,
      });

      const findManyCall = mockPrisma.customer.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      expect(findManyCall.where.OR).toHaveLength(3);
      expect(findManyCall.where.OR[0].fullName.contains).toBe('Jones');
    });

    it('applies channel filter', async () => {
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(0);

      await customerRepository.findMany({
        preferredChannel: 'EMAIL',
        page: 1,
        pageSize: 20,
      });

      const findManyCall = mockPrisma.customer.findMany.mock.calls[0][0];
      expect(findManyCall.where.preferredChannel).toBe('EMAIL');
    });

    it('calculates pagination correctly', async () => {
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(45);

      const result = await customerRepository.findMany({
        page: 2,
        pageSize: 20,
      });

      expect(result.totalPages).toBe(3);
      const findManyCall = mockPrisma.customer.findMany.mock.calls[0][0];
      expect(findManyCall.skip).toBe(20);
      expect(findManyCall.take).toBe(20);
    });
  });

  describe('findById', () => {
    it('returns customer with includes', async () => {
      const customer = { id: '1', fullName: 'Sarah', yards: [], horses: [], enquiries: [] };
      mockPrisma.customer.findUnique.mockResolvedValue(customer);

      const result = await customerRepository.findById('1');

      expect(result).toEqual(customer);
      expect(mockPrisma.customer.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: expect.objectContaining({
          yards: true,
          horses: expect.any(Object),
          enquiries: expect.any(Object),
        }),
      });
    });

    it('returns null for non-existent customer', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      const result = await customerRepository.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates a customer', async () => {
      const newCustomer = { id: '1', fullName: 'New Customer', preferredChannel: 'WHATSAPP', preferredLanguage: 'en' };
      mockPrisma.customer.create.mockResolvedValue(newCustomer);

      const result = await customerRepository.create({
        fullName: 'New Customer',
        preferredChannel: 'WHATSAPP',
        preferredLanguage: 'en',
      });

      expect(result).toEqual(newCustomer);
      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: { fullName: 'New Customer', preferredChannel: 'WHATSAPP', preferredLanguage: 'en' },
      });
    });
  });

  describe('update', () => {
    it('updates a customer', async () => {
      const updated = { id: '1', fullName: 'Updated Name' };
      mockPrisma.customer.update.mockResolvedValue(updated);

      const result = await customerRepository.update('1', { fullName: 'Updated Name' });

      expect(result).toEqual(updated);
      expect(mockPrisma.customer.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { fullName: 'Updated Name' },
      });
    });
  });

  describe('delete', () => {
    it('deletes a customer', async () => {
      mockPrisma.customer.delete.mockResolvedValue({ id: '1' });

      await customerRepository.delete('1');

      expect(mockPrisma.customer.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });

  describe('count', () => {
    it('returns customer count', async () => {
      mockPrisma.customer.count.mockResolvedValue(42);

      const result = await customerRepository.count();
      expect(result).toBe(42);
    });
  });
});
