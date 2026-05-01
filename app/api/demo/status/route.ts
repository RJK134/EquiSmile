import { NextResponse } from 'next/server';
import { isDemoMode, isLiveMapsForced } from '@/lib/demo/demo-mode';
import { prisma } from '@/lib/prisma';
import { whatsappClient } from '@/lib/integrations/whatsapp.client';
import { googleMapsClient } from '@/lib/integrations/google-maps.client';
import { smtpClient } from '@/lib/integrations/smtp.client';
import { n8nClient } from '@/lib/integrations/n8n.client';

export const dynamic = 'force-dynamic';

/**
 * Compute which Google Maps env vars are unset, so the demo banner
 * can list them by name. Names only — never values.
 */
function mapsMissingKeys(): string[] {
  const missing: string[] = [];
  if (!process.env.GOOGLE_MAPS_API_KEY) missing.push('GOOGLE_MAPS_API_KEY');
  if (!process.env.GCP_PROJECT_ID) missing.push('GCP_PROJECT_ID');
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY) {
    missing.push('NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY');
  }
  return missing;
}

export async function GET() {
  const demoEnabled = isDemoMode();
  const liveMapsRequested = isLiveMapsForced();
  const missing = mapsMissingKeys();

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
    maps: {
      // Operator opted in via EQUISMILE_LIVE_MAPS=true.
      liveRequested: liveMapsRequested,
      // Effective mode of the Maps client. May be 'demo' even when
      // liveRequested if any required key is absent.
      live: googleMapsClient.getMode() === 'live',
      // Names only — for operator guidance. Never values.
      missing,
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
