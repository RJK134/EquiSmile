import { NextResponse } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { isDemoMode } from '@/lib/demo/demo-mode';
import { prisma } from '@/lib/prisma';
import { whatsappClient } from '@/lib/integrations/whatsapp.client';
import { googleMapsClient } from '@/lib/integrations/google-maps.client';
import { smtpClient } from '@/lib/integrations/smtp.client';
import { n8nClient } from '@/lib/integrations/n8n.client';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireActorWithRole(['admin']);
  const demoEnabled = isDemoMode();

  const [
    customerCount,
    yardCount,
    horseCount,
    enquiryCount,
    visitRequestCount,
    routeRunCount,
    appointmentCount,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.yard.count(),
    prisma.horse.count(),
    prisma.enquiry.count(),
    prisma.visitRequest.count(),
    prisma.routeRun.count(),
    prisma.appointment.count(),
  ]);

  const enquiryBreakdown = await prisma.enquiry.groupBy({
    by: ['triageStatus'],
    _count: true,
  });

  const visitBreakdown = await prisma.visitRequest.groupBy({
    by: ['planningStatus'],
    _count: true,
  });

  const routeBreakdown = await prisma.routeRun.groupBy({
    by: ['status'],
    _count: true,
  });

  return NextResponse.json({
    demoMode: demoEnabled,
    integrations: {
      whatsapp: whatsappClient.getMode(),
      googleMaps: googleMapsClient.getMode(),
      smtp: smtpClient.getMode(),
      n8n: n8nClient.getMode(),
    },
    counts: {
      customers: customerCount,
      yards: yardCount,
      horses: horseCount,
      enquiries: enquiryCount,
      visitRequests: visitRequestCount,
      routeRuns: routeRunCount,
      appointments: appointmentCount,
    },
    breakdown: {
      enquiries: Object.fromEntries(
        enquiryBreakdown.map((e) => [e.triageStatus, e._count]),
      ),
      visitRequests: Object.fromEntries(
        visitBreakdown.map((v) => [v.planningStatus, v._count]),
      ),
      routeRuns: Object.fromEntries(
        routeBreakdown.map((r) => [r.status, r._count]),
      ),
    },
  });
}
