import { describe, it, expect } from 'vitest';
import { createCustomerSchema, updateCustomerSchema, customerQuerySchema } from '@/lib/validations/customer.schema';

describe('createCustomerSchema', () => {
  it('accepts valid input', () => {
    const result = createCustomerSchema.parse({
      fullName: 'Sarah Jones',
      mobilePhone: '+447700900001',
      email: 'sarah@example.com',
      preferredChannel: 'WHATSAPP',
      preferredLanguage: 'en',
      notes: 'Regular customer',
    });
    expect(result.fullName).toBe('Sarah Jones');
    expect(result.preferredChannel).toBe('WHATSAPP');
  });

  it('requires fullName', () => {
    expect(() => createCustomerSchema.parse({ fullName: '' })).toThrow();
  });

  it('applies defaults for optional fields', () => {
    const result = createCustomerSchema.parse({ fullName: 'Test User' });
    expect(result.preferredChannel).toBe('WHATSAPP');
    expect(result.preferredLanguage).toBe('en');
  });

  it('rejects invalid email', () => {
    expect(() => createCustomerSchema.parse({
      fullName: 'Test',
      email: 'not-an-email',
    })).toThrow();
  });

  it('rejects invalid preferredChannel', () => {
    expect(() => createCustomerSchema.parse({
      fullName: 'Test',
      preferredChannel: 'FAX',
    })).toThrow();
  });
});

describe('updateCustomerSchema', () => {
  it('accepts partial updates', () => {
    const result = updateCustomerSchema.parse({ fullName: 'Updated Name' });
    expect(result.fullName).toBe('Updated Name');
  });

  it('accepts empty object', () => {
    const result = updateCustomerSchema.parse({});
    expect(result).toBeDefined();
  });
});

describe('customerQuerySchema', () => {
  it('applies defaults for page and pageSize', () => {
    const result = customerQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('parses search and filter params', () => {
    const result = customerQuerySchema.parse({
      search: 'Jones',
      preferredChannel: 'EMAIL',
      page: '2',
      pageSize: '10',
    });
    expect(result.search).toBe('Jones');
    expect(result.preferredChannel).toBe('EMAIL');
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
  });

  it('rejects invalid preferredChannel in query', () => {
    expect(() => customerQuerySchema.parse({ preferredChannel: 'FAX' })).toThrow();
  });
});
