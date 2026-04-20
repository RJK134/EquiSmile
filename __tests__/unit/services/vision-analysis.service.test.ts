import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const messagesCreateMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/integrations/anthropic.client', () => ({
  getAnthropicClient: () => ({
    messages: { create: messagesCreateMock },
  }),
  VISION_MODEL: 'claude-opus-4-7',
  __resetAnthropicClientForTests: () => {},
}));

vi.mock('@/lib/services/attachment.service', () => ({
  attachmentService: {
    findById: vi.fn(),
    loadBytes: vi.fn(),
  },
}));

vi.mock('@/lib/services/clinical-record.service', () => ({
  clinicalRecordService: {
    createDentalChart: vi.fn(),
    createFinding: vi.fn(),
    createPrescription: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

import {
  visionAnalysisService,
  __internals,
  FINDING_CATEGORIES,
} from '@/lib/services/vision-analysis.service';
import { attachmentService } from '@/lib/services/attachment.service';
import { clinicalRecordService } from '@/lib/services/clinical-record.service';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = 'test-key';
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

const sampleResult = {
  generalNotes: 'Mild wear on molars, no acute issues.',
  findings: [
    { toothId: '106', category: 'HOOK', severity: 'MILD', description: 'Minor buccal hook.' },
    { toothId: '406', category: 'WEAR', severity: 'MODERATE', description: 'Normal wear pattern.' },
  ],
  prescriptions: [
    {
      medicineName: 'Phenylbutazone',
      dosage: '2 g PO SID',
      durationDays: 3,
      withdrawalPeriodDays: 7,
      instructions: null,
    },
  ],
  confidence: 'high',
};

function mockAnthropicResponse(payload: unknown) {
  messagesCreateMock.mockResolvedValue({
    id: 'msg_1',
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    parsed_output: payload,
    stop_reason: 'end_turn',
  });
}

describe('AnalysisResultSchema', () => {
  it('accepts a complete well-formed payload', () => {
    expect(() => __internals.AnalysisResultSchema.parse(sampleResult)).not.toThrow();
  });

  it('rejects unknown category', () => {
    expect(() =>
      __internals.AnalysisResultSchema.parse({
        ...sampleResult,
        findings: [{ toothId: '106', category: 'INVENTED', severity: 'MILD', description: 'x' }],
      }),
    ).toThrow();
  });

  it('rejects negative durationDays in prescriptions', () => {
    expect(() =>
      __internals.AnalysisResultSchema.parse({
        ...sampleResult,
        prescriptions: [
          {
            medicineName: 'X',
            dosage: 'Y',
            durationDays: -5,
            withdrawalPeriodDays: null,
            instructions: null,
          },
        ],
      }),
    ).toThrow();
  });

  it('allows empty findings and prescriptions for low-confidence results', () => {
    expect(() =>
      __internals.AnalysisResultSchema.parse({
        generalNotes: 'Image illegible.',
        findings: [],
        prescriptions: [],
        confidence: 'low',
      }),
    ).not.toThrow();
  });

  it('enumerates all ten finding categories', () => {
    expect(FINDING_CATEGORIES).toHaveLength(10);
    expect(FINDING_CATEGORIES).toContain('EOTRH');
    expect(FINDING_CATEGORIES).toContain('DIASTEMA');
  });
});

describe('extractAndValidate', () => {
  it('prefers parsed_output when present', () => {
    const out = __internals.extractAndValidate({
      content: [{ type: 'text', text: '{}' }],
      parsed_output: sampleResult,
    } as unknown as Parameters<typeof __internals.extractAndValidate>[0]);
    expect(out.findings).toHaveLength(2);
  });

  it('falls back to JSON-parsing the text block when parsed_output is absent', () => {
    const out = __internals.extractAndValidate({
      content: [{ type: 'text', text: JSON.stringify(sampleResult) }],
    } as unknown as Parameters<typeof __internals.extractAndValidate>[0]);
    expect(out.confidence).toBe('high');
  });

  it('throws on non-JSON text output', () => {
    expect(() =>
      __internals.extractAndValidate({
        content: [{ type: 'text', text: 'I cannot analyse this.' }],
      } as Parameters<typeof __internals.extractAndValidate>[0]),
    ).toThrow(/non-JSON/);
  });

  it('throws when there is no text block at all', () => {
    expect(() =>
      __internals.extractAndValidate({
        content: [],
      } as unknown as Parameters<typeof __internals.extractAndValidate>[0]),
    ).toThrow(/no text content/);
  });
});

describe('visionAnalysisService.analyseAttachment', () => {
  it('rejects unknown attachment', async () => {
    (attachmentService.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      visionAnalysisService.analyseAttachment({ attachmentId: 'nope' }),
    ).rejects.toThrow(/not found/);
  });

  it('rejects unsupported mime type', async () => {
    (attachmentService.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1',
      horseId: 'h1',
      mimeType: 'application/zip',
      storagePath: 'x',
    });
    (attachmentService.loadBytes as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Uint8Array([1, 2, 3]),
    );
    await expect(
      visionAnalysisService.analyseAttachment({ attachmentId: 'a1' }),
    ).rejects.toThrow(/Unsupported mimeType/);
  });

  it('persists a DentalChart + findings + prescriptions when persist=true', async () => {
    (attachmentService.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1',
      horseId: 'h1',
      mimeType: 'image/jpeg',
      storagePath: 'x',
    });
    (attachmentService.loadBytes as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Uint8Array([0, 1, 2]),
    );
    (clinicalRecordService.createDentalChart as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'chart-1',
    });
    (clinicalRecordService.createFinding as ReturnType<typeof vi.fn>).mockImplementation(
      async (input) => ({ id: `f-${input.toothId}` }),
    );
    (clinicalRecordService.createPrescription as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'rx-1',
    });
    mockAnthropicResponse(sampleResult);

    const out = await visionAnalysisService.analyseAttachment({
      attachmentId: 'a1',
      staffId: 's1',
    });

    expect(out.dentalChartId).toBe('chart-1');
    expect(out.findingIds).toEqual(['f-106', 'f-406']);
    expect(out.prescriptionIds).toEqual(['rx-1']);
    expect(clinicalRecordService.createDentalChart).toHaveBeenCalledWith(
      expect.objectContaining({
        horseId: 'h1',
        attachmentId: 'a1',
        recordedById: 's1',
        generalNotes: sampleResult.generalNotes,
      }),
    );
    // System prompt is cache-control marked for prompt caching.
    const callArgs = messagesCreateMock.mock.calls[0][0];
    expect(callArgs.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(callArgs.model).toBe('claude-opus-4-7');
    expect(callArgs.thinking).toEqual({ type: 'adaptive' });
  });

  it('does not persist anything when persist=false', async () => {
    (attachmentService.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1',
      horseId: 'h1',
      mimeType: 'application/pdf',
      storagePath: 'x',
    });
    (attachmentService.loadBytes as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Uint8Array([0, 1, 2]),
    );
    mockAnthropicResponse(sampleResult);

    const out = await visionAnalysisService.analyseAttachment({
      attachmentId: 'a1',
      persist: false,
    });

    expect(out.dentalChartId).toBeNull();
    expect(out.findingIds).toEqual([]);
    expect(out.prescriptionIds).toEqual([]);
    expect(clinicalRecordService.createDentalChart).not.toHaveBeenCalled();
    expect(clinicalRecordService.createFinding).not.toHaveBeenCalled();
    expect(clinicalRecordService.createPrescription).not.toHaveBeenCalled();
  });

  it('sends a PDF as a document block and an image as an image block', async () => {
    (attachmentService.loadBytes as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Uint8Array([0, 1, 2]),
    );
    mockAnthropicResponse({ ...sampleResult, findings: [], prescriptions: [] });

    // PDF
    (attachmentService.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1',
      horseId: 'h1',
      mimeType: 'application/pdf',
      storagePath: 'x',
    });
    (clinicalRecordService.createDentalChart as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'chart-pdf',
    });
    await visionAnalysisService.analyseAttachment({ attachmentId: 'a1' });
    const pdfCall = messagesCreateMock.mock.calls[0][0];
    expect(pdfCall.messages[0].content[0].type).toBe('document');

    // Image
    messagesCreateMock.mockClear();
    (attachmentService.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a2',
      horseId: 'h1',
      mimeType: 'image/png',
      storagePath: 'x',
    });
    (clinicalRecordService.createDentalChart as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'chart-img',
    });
    await visionAnalysisService.analyseAttachment({ attachmentId: 'a2' });
    const imgCall = messagesCreateMock.mock.calls[0][0];
    expect(imgCall.messages[0].content[0].type).toBe('image');
    expect(imgCall.messages[0].content[0].source.media_type).toBe('image/png');
  });
});
