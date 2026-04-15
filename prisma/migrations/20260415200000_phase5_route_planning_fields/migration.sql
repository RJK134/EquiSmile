-- Phase 5: Route Planning Fields
-- Add geocoding tracking fields to Yard
ALTER TABLE "Yard" ADD COLUMN "geocodeFailed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Yard" ADD COLUMN "geocodedAt" TIMESTAMP(3);

-- Add route scoring fields to RouteRun
ALTER TABLE "RouteRun" ADD COLUMN "totalHorses" INTEGER;
ALTER TABLE "RouteRun" ADD COLUMN "optimizationScore" DOUBLE PRECISION;
