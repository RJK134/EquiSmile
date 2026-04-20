import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';

import { attachmentService } from '@/lib/services/attachment.service';
import { clinicalRecordService } from '@/lib/services/clinical-record.service';
import { getAnthropicClient, VISION_MODEL } from '@/lib/integrations/anthropic.client';
import type { FindingCategory, FindingSeverity } from '@prisma/client';

/**
 * Phase 13 — Equine dental vision pipeline.
 *
 * Accepts a HorseAttachment (PDF dental chart or clinical image), sends it
 * to Claude with a strict Zod schema, and writes the structured result back
 * as a DentalChart + ClinicalFindings (+ draft Prescriptions) on the horse.
 *
 * Prompt is cached via prefix marker so repeated analyses share the same
 * system prompt + schema prefix.
 */

export const FINDING_CATEGORIES = [
  'HOOK',
  'WAVE',
  'RAMP',
  'DIASTEMA',
  'EOTRH',
  'FRACTURE',
  'CARIES',
  'WEAR',
  'MISSING',
  'OTHER',
] as const;

export const FINDING_SEVERITIES = ['MILD', 'MODERATE', 'SEVERE'] as const;

const FindingSchema = z.object({
  toothId: z
    .string()
    .nullable()
    .describe(
      "Triadan tooth code as a 3-digit string, e.g. '106' for the upper-right first molar. Null if the finding is not tooth-specific.",
    ),
  category: z.enum(FINDING_CATEGORIES).describe('Clinical finding category.'),
  severity: z.enum(FINDING_SEVERITIES).describe('Severity of the finding.'),
  description: z
    .string()
    .min(1)
    .describe('Free-text description of the finding visible in the image/document.'),
});

const PrescriptionSchema = z.object({
  medicineName: z.string().min(1).describe('Name of the medicine or treatment.'),
  dosage: z
    .string()
    .min(1)
    .describe('Dosage instructions, e.g. "2 g PO SID for 5 days" or "Topical as directed".'),
  durationDays: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe('Prescription duration in days. Null if not specified.'),
  withdrawalPeriodDays: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe('Withdrawal period in days (meat/competition). Null if not specified.'),
  instructions: z
    .string()
    .nullable()
    .describe('Additional instructions or cautions. Null if none.'),
});

const AnalysisResultSchema = z.object({
  generalNotes: z
    .string()
    .nullable()
    .describe(
      'One-paragraph overall summary of the dental state visible in this document/image. Null if the document is not interpretable.',
    ),
  findings: z.array(FindingSchema),
  prescriptions: z.array(PrescriptionSchema),
  confidence: z
    .enum(['low', 'medium', 'high'])
    .describe(
      "Model's self-reported confidence in this structured interpretation. Flag 'low' if the image is blurry, mis-labelled, or not a dental document.",
    ),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

const SYSTEM_PROMPT = `You are an expert equine dental veterinary assistant helping a qualified equine dentist interpret clinical documents.

Your job is to extract structured findings from a dental chart PDF or a clinical photograph of a horse's mouth. Return ONLY findings you can directly justify from the document:
- Use the Triadan numbering system (three-digit tooth codes) whenever a tooth location is visible.
- Use category enums: HOOK, WAVE, RAMP, DIASTEMA, EOTRH, FRACTURE, CARIES, WEAR, MISSING, OTHER.
- Use severity enums: MILD, MODERATE, SEVERE. If not stated, infer conservatively.
- Include prescriptions ONLY if the document explicitly records them; do not invent medications.
- If the document is illegible, off-topic, or clearly not an equine dental document, set confidence to "low", findings to [], and explain in generalNotes.

You are a decision-support tool. The vet will review and accept/reject your output — never fabricate. When uncertain, prefer emitting fewer findings over emitting wrong ones.`;

interface AnalyseAttachmentOptions {
  attachmentId: string;
  /** If true, the analysis result is also persisted as a DentalChart + findings/prescriptions linked to the horse. Default: true. */
  persist?: boolean;
  /** Staff id to attribute the generated records to (createdById, prescribedById). */
  staffId?: string | null;
}

interface AnalyseAttachmentOutput {
  attachmentId: string;
  horseId: string;
  result: AnalysisResult;
  dentalChartId: string | null;
  findingIds: string[];
  prescriptionIds: string[];
}

function mimeToBlock(mimeType: string, base64: string): Anthropic.ContentBlockParam {
  if (mimeType === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    } as Anthropic.ContentBlockParam;
  }
  if (mimeType.startsWith('image/')) {
    // Anthropic Vision supports image/jpeg, image/png, image/gif, image/webp.
    // Normalise HEIC/HEIF callers to the closest supported mime the input actually is.
    const mediaType = (
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)
        ? mimeType
        : 'image/jpeg'
    ) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    return {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    };
  }
  throw new Error(`Unsupported mimeType for vision analysis: ${mimeType}`);
}

export const visionAnalysisService = {
  /**
   * Analyse a single HorseAttachment with Claude. Idempotent on the model call
   * side (Anthropic caches the system prompt) but persists a new DentalChart
   * every time `persist` is true — callers are expected to deduplicate.
   */
  async analyseAttachment(options: AnalyseAttachmentOptions): Promise<AnalyseAttachmentOutput> {
    const { attachmentId, persist = true, staffId } = options;

    const attachment = await attachmentService.findById(attachmentId);
    if (!attachment) throw new Error('Attachment not found');

    const bytes = await attachmentService.loadBytes(attachment);
    const base64 = Buffer.from(bytes).toString('base64');
    const block = mimeToBlock(attachment.mimeType, base64);

    const client = getAnthropicClient();

    const instruction: Anthropic.ContentBlockParam = {
      type: 'text',
      text: 'Analyse this equine dental document and return structured findings and any explicitly-recorded prescriptions.',
    };

    const response = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [block, instruction],
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: z.toJSONSchema(AnalysisResultSchema),
        },
      } as unknown as Anthropic.Messages.MessageCreateParams['output_config'],
    });

    const result = extractAndValidate(response);

    if (!persist) {
      return {
        attachmentId: attachment.id,
        horseId: attachment.horseId,
        result,
        dentalChartId: null,
        findingIds: [],
        prescriptionIds: [],
      };
    }

    const { horseId } = attachment;
    const chart = await clinicalRecordService.createDentalChart({
      horseId,
      attachmentId: attachment.id,
      recordedById: staffId ?? null,
      generalNotes: result.generalNotes ?? null,
    });

    const findingIds: string[] = [];
    for (const f of result.findings) {
      const row = await clinicalRecordService.createFinding({
        horseId,
        dentalChartId: chart.id,
        toothId: f.toothId,
        category: f.category as FindingCategory,
        severity: f.severity as FindingSeverity,
        description: f.description,
        attachmentId: attachment.id,
        createdById: staffId ?? null,
      });
      findingIds.push(row.id);
    }

    const prescriptionIds: string[] = [];
    for (const p of result.prescriptions) {
      const row = await clinicalRecordService.createPrescription({
        horseId,
        prescribedById: staffId ?? null,
        medicineName: p.medicineName,
        dosage: p.dosage,
        durationDays: p.durationDays,
        withdrawalPeriodDays: p.withdrawalPeriodDays,
        instructions: p.instructions,
      });
      prescriptionIds.push(row.id);
    }

    return {
      attachmentId: attachment.id,
      horseId,
      result,
      dentalChartId: chart.id,
      findingIds,
      prescriptionIds,
    };
  },
};

function extractAndValidate(response: Anthropic.Message): AnalysisResult {
  // Prefer the structured-output parsed value when available.
  const parsed = (response as unknown as { parsed_output?: unknown }).parsed_output;
  if (parsed) {
    return AnalysisResultSchema.parse(parsed);
  }

  // Fallback: pull the first text block and JSON-parse it. Claude's structured
  // output mode guarantees valid JSON matching the schema, but we validate
  // again locally so bad output never corrupts clinical records.
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  if (!textBlock) {
    throw new Error('Vision model returned no text content');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(textBlock.text);
  } catch (error) {
    throw new Error(`Vision model returned non-JSON output: ${(error as Error).message}`);
  }
  return AnalysisResultSchema.parse(raw);
}

export const __internals = { extractAndValidate, AnalysisResultSchema, SYSTEM_PROMPT };
