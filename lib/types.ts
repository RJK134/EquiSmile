/**
 * Shared TypeScript types used across the application.
 * Prisma-generated types are the source of truth for database models.
 * These types are for application-layer concerns.
 */

/** Health check response */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  version: string;
  checks?: {
    database?: boolean;
    n8n?: boolean;
  };
}

/** Navigation item for mobile/desktop nav */
export interface NavItem {
  labelKey: string;
  href: string;
}

/** Pagination params */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** Paginated result */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
