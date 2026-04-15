import { describe, it, expect } from 'vitest';
import { manualEnquirySchema } from '@/lib/validations/manual-enquiry.schema';

describe('manualEnquirySchema', () => {
  it('accepts valid manual enquiry with existing customer', () => {
    const result = manualEnquirySchema.parse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      channel: 'WHATSAPP',
      rawText: 'Horse needs dental checkup',
      requestType: 'ROUTINE_DENTAL',
      urgencyLevel: 'ROUTINE',
    });
    expect(result.customerId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.channel).toBe('WHATSAPP');
  });

  it('accepts manual enquiry with new customer', () => {
    const result = manualEnquirySchema.parse({
      newCustomerName: 'John Smith',
      newCustomerPhone: '+447700900002',
      channel: 'EMAIL',
      rawText: 'New horse needs first visit',
      requestType: 'FIRST_VISIT',
      urgencyLevel: 'SOON',
    });
    expect(result.newCustomerName).toBe('John Smith');
    expect(result.requestType).toBe('FIRST_VISIT');
  });

  it('requires rawText', () => {
    expect(() => manualEnquirySchema.parse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      channel: 'WHATSAPP',
      rawText: '',
      requestType: 'ROUTINE_DENTAL',
    })).toThrow();
  });

  it('requires channel', () => {
    expect(() => manualEnquirySchema.parse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      rawText: 'message',
      requestType: 'ROUTINE_DENTAL',
    })).toThrow();
  });

  it('requires requestType', () => {
    expect(() => manualEnquirySchema.parse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      channel: 'WHATSAPP',
      rawText: 'message',
    })).toThrow();
  });

  it('accepts preferred days and time', () => {
    const result = manualEnquirySchema.parse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      channel: 'WHATSAPP',
      rawText: 'message',
      requestType: 'ROUTINE_DENTAL',
      preferredDays: ['Mon', 'Wed', 'Fri'],
      preferredTimeBand: 'AM',
    });
    expect(result.preferredDays).toEqual(['Mon', 'Wed', 'Fri']);
    expect(result.preferredTimeBand).toBe('AM');
  });
});
