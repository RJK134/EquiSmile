import { NextRequest } from 'next/server';
import { vetupExportService } from '@/lib/services/vetup-export.service';
import { handleApiError, errorResponse } from '@/lib/api-utils';
import { requireRole, authzErrorResponse, AuthzError, ROLES } from '@/lib/auth/rbac';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { rateLimiter, rateLimitedResponse } from '@/lib/utils/rate-limit';

// 10 bulk exports per admin per hour is more than any human operator
// needs; a tighter cap discourages automated exfil attempts.
const exportLimiter = rateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });

function filename(base: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `equismile-${base}-${stamp}.csv`;
}

/**
 * GET /api/export/vetup?profile=patient|customers|yards
 *
 * Bulk CSV export of customer / horse / yard data. Restricted to
 * `ROLES.ADMIN` because it emits personally-identifiable information
 * (names, phone numbers, email addresses, locations) for the entire
 * dataset. Every invocation is appended to `SecurityAuditLog`.
 */
export async function GET(request: NextRequest) {
  let subject: Awaited<ReturnType<typeof requireRole>>;
  try {
    subject = await requireRole(ROLES.ADMIN);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }

  const decision = exportLimiter.check(`export:${subject.id}`);
  if (!decision.allowed) return rateLimitedResponse(decision);

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

    // Best-effort audit entry — await so a failure is surfaced but never
    // blocks the export itself (the service catches its own errors).
    await securityAuditService.record({
      event: 'EXPORT_DATASET',
      actor: subject,
      targetType: 'vetup-export',
      targetId: profile,
      detail: `profile=${profile}; size=${csv.length} bytes`,
    });

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
