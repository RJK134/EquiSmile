import { NextResponse } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { requireDemoMode, demoLog } from '@/lib/demo/demo-mode';
import { prisma } from '@/lib/prisma';
import { securityAuditService } from '@/lib/services/security-audit.service';

export const dynamic = 'force-dynamic';

export async function POST() {
  const actor = await requireActorWithRole(['admin']);
  const guard = requireDemoMode();
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.reason }, { status: 403 });
  }

  // Find pending enquiries (NEW or PARSED)
  const pendingEnquiries = await prisma.enquiry.findMany({
    where: {
      triageStatus: { in: ['NEW', 'PARSED'] },
    },
    orderBy: { receivedAt: 'asc' },
    take: 5,
  });

  const results = [];

  for (const enquiry of pendingEnquiries) {
    demoLog('Simulating triage', { enquiryId: enquiry.id, currentStatus: enquiry.triageStatus });

    // Simulate triage: advance NEW → PARSED, PARSED → TRIAGED
    const nextStatus = enquiry.triageStatus === 'NEW' ? 'PARSED' : 'TRIAGED';

    await prisma.enquiry.update({
      where: { id: enquiry.id },
      data: { triageStatus: nextStatus },
    });

    results.push({
      enquiryId: enquiry.id,
      previousStatus: enquiry.triageStatus,
      newStatus: nextStatus,
    });
  }

  await securityAuditService.log({
    action: 'demo.trigger-triage',
    entityType: 'demo',
    actor,
    details: { processed: results.length },
  });

  return NextResponse.json({
    success: true,
    simulation: 'triage',
    processed: results.length,
    results,
  });
}
