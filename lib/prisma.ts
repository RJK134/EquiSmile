import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Phase 16 — soft-delete enforcement at the data-access layer.
 *
 * Repositories already filter `deletedAt: null` when reading the four
 * PII-bearing tables (Customer, Yard, Horse, Enquiry). This extension
 * is the defence-in-depth: if a future contributor calls
 * `prisma.customer.findMany()` directly, bypassing the repository,
 * the auto-injected filter still hides tombstoned rows.
 *
 * Design choices:
 *
 *  - Auto-inject only on **read** operations: `findMany`, `findFirst`,
 *    `count`, `aggregate`, `groupBy`. Writes (`update`, `delete` and
 *    their `*Many` siblings) are NOT touched — repositories use
 *    `where: { id, deletedAt: null }` explicitly so they refuse to
 *    mutate tombstoned rows. Auto-injecting on writes would be a
 *    behavioural change that needs its own review.
 *
 *  - **`findUnique` is intentionally exempt.** Looking up a row by its
 *    primary key is "I know exactly which row I want" — used heavily
 *    by the `restore()` paths to find tombstoned rows for reactivation.
 *    Repositories that want the soft-delete filter on a by-id read use
 *    `findFirst({ where: { id, deletedAt: null } })` instead, which IS
 *    intercepted. Existing repository code already uses `findFirst`
 *    for this case, so no caller change is required.
 *
 *  - **Caller opt-out** — pass `where.deletedAt = undefined` (or any
 *    explicit value) to indicate "I'm taking responsibility for the
 *    tombstone semantics on this query". The extension only fires when
 *    the `deletedAt` key is **absent** from the where clause.
 *
 *  - Models are matched by their lower-cased Prisma model name
 *    (`'customer' | 'yard' | 'horse' | 'enquiry'`). Adding a new
 *    soft-delete table is a one-line edit to `SOFT_DELETE_MODELS`.
 */

export const SOFT_DELETE_MODELS = new Set<string>([
  'customer',
  'yard',
  'horse',
  'enquiry',
]);

/** True when the model has a `deletedAt` column the extension should guard. */
export function shouldFilterSoftDelete(model: string | undefined): boolean {
  if (!model) return false;
  return SOFT_DELETE_MODELS.has(model.toLowerCase());
}

/**
 * If `args.where` doesn't already mention `deletedAt`, add a
 * `deletedAt: null` filter so tombstoned rows stay hidden.
 *
 * Mutates `args` in place — Prisma's extension contract expects the
 * caller to forward the (possibly modified) args to the inner query.
 */
export function injectSoftDeleteFilter(args: { where?: Record<string, unknown> }): void {
  const where = args.where ?? {};
  // `'deletedAt' in where` distinguishes "key absent" from
  // "key present with undefined value". The latter is the
  // explicit opt-out — Prisma treats undefined as "no filter" but the
  // key's *presence* tells us the caller has already considered the
  // tombstone semantics.
  if (!('deletedAt' in where)) {
    (where as Record<string, unknown>).deletedAt = null;
  }
  args.where = where;
}

/**
 * Build the Prisma extension definition. Exposed as a function so
 * tests can construct an isolated extension over a fresh client
 * without sharing the singleton below.
 */
export function buildSoftDeleteExtension() {
  return Prisma.defineExtension({
    name: 'soft-delete-default-filter',
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (shouldFilterSoftDelete(model)) {
            injectSoftDeleteFilter(args as { where?: Record<string, unknown> });
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (shouldFilterSoftDelete(model)) {
            injectSoftDeleteFilter(args as { where?: Record<string, unknown> });
          }
          return query(args);
        },
        async findFirstOrThrow({ model, args, query }) {
          if (shouldFilterSoftDelete(model)) {
            injectSoftDeleteFilter(args as { where?: Record<string, unknown> });
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (shouldFilterSoftDelete(model)) {
            injectSoftDeleteFilter(args as { where?: Record<string, unknown> });
          }
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (shouldFilterSoftDelete(model)) {
            injectSoftDeleteFilter(args as { where?: Record<string, unknown> });
          }
          return query(args);
        },
        async groupBy({ model, args, query }) {
          if (shouldFilterSoftDelete(model)) {
            injectSoftDeleteFilter(args as { where?: Record<string, unknown> });
          }
          return query(args);
        },
      },
    },
  });
}

function buildExtendedClient() {
  return new PrismaClient().$extends(buildSoftDeleteExtension());
}

/**
 * The extended client. Same surface as `PrismaClient` minus a couple of
 * top-level methods stripped by `$extends`, plus the soft-delete query
 * callbacks. Repositories and route handlers should always import this
 * `prisma`, never `new PrismaClient()` directly — bypassing the extended
 * client also bypasses the soft-delete safety net.
 */
export type ExtendedPrismaClient = ReturnType<typeof buildExtendedClient>;

/**
 * Transaction-client type derived from the extended Prisma client's
 * `$transaction(async tx => ...)` callback. Use this in repository
 * helpers that accept a `tx` parameter (e.g. `cascadeRestoreWithin`)
 * so the type tracks the extension; using the un-extended
 * `Prisma.TransactionClient` will fail to typecheck once the
 * extension is in place.
 */
export type PrismaTransactionClient = Parameters<
  Parameters<ExtendedPrismaClient['$transaction']>[0]
>[0];

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? buildExtendedClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
