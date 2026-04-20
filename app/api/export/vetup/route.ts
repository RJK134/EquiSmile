import { NextRequest } from 'next/server';
import { vetupExportService } from '@/lib/services/vetup-export.service';
import { handleApiError, errorResponse } from '@/lib/api-utils';

function filename(base: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `equismile-${base}-${stamp}.csv`;
}

/**
 * GET /api/export/vetup?profile=patient|customers|yards
 * Returns a CSV stream for importing into VetUp (or any patient-centric PMS).
 * Default profile is `patient` (one row per horse with denormalised owner + yard).
 */
export async function GET(request: NextRequest) {
  try {
    const profile = request.nextUrl.searchParams.get('profile') ?? 'patient';

    let csv: string;
    let basename: string;
    switch (profile) {
      case 'patient':
        csv = await vetupExportService.horsesCsv();
        basename = 'vetup-patients';
        break;
      case 'customers':
        csv = await vetupExportService.customersCsv();
        basename = 'customers';
        break;
      case 'yards':
        csv = await vetupExportService.yardsCsv();
        basename = 'yards';
        break;
      default:
        return errorResponse(`Unknown profile '${profile}' (expected: patient, customers, yards)`, 400);
    }

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename(basename)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
