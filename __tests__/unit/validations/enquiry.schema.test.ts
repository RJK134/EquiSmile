import { describe, it, expect } from 'vitest';
import { createEnquirySchema, updateEnquirySchema, enquiryQuerySchema } from '@/lib/validations/enquiry.schema';

describe('createEnquirySchema', () => {
  it('accepts valid enquiry', () => {
    const result = createEnquirySchema.parse({
      channel: 'WHATSAPP',
      sourceFrom: '+447700900001',
      rawText: 'My horse needs dental work',
    });
    expect(result.channel).toBe('WHATSAPP');
    expect(result.triageStatus).toBe('NEW');
    expect(result.receivedAt).toBeInstanceOf(Date);
  });

  it('requires channel', () => {
    expect(() => createEnquirySchema.parse({
      sourceFrom: 'test',
      rawText: 'message',
    })).toThrow();
  });

  it('requires rawText', () => {
    expect(() => createEnquirySchema.parse({
      channel: 'EMAIL',
      sourceFrom: 'test@email.com',
      rawText: '',
    })).toThrow();
  });

  it('rejects invalid channel', () => {
    expect(() => createEnquirySchema.parse({
      channel: 'SMS',
      sourceFrom: 'test',
      rawText: 'message',
    })).toThrow();
  });
});

describe('updateEnquirySchema', () => {
  it('accepts triage status update', () => {
    const result = updateEnquirySchema.parse({ triageStatus: 'TRIAGED' });
    expect(result.triageStatus).toBe('TRIAGED');
  });

  it('rejects invalid triage status', () => {
    expect(() => updateEnquirySchema.parse({ triageStatus: 'INVALID' })).toThrow();
  });
});

describe('enquiryQuerySchema', () => {
  it('applies defaults', () => {
    const result = enquiryQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('parses valid filter params', () => {
    const result = enquiryQuerySchema.parse({
      triageStatus: 'NEEDS_INFO',
      channel: 'EMAIL',
    });
    expect(result.triageStatus).toBe('NEEDS_INFO');
    expect(result.channel).toBe('EMAIL');
  });
});
