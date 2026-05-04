# EquiSmile — session memory

Append discoveries as you find them. Read this file at session start. Keep
entries short: date, what, why.

Format:
```
- YYYY-MM-DD — <what> — <why future sessions need it>
```

---

## Standing rules (read first)

- **PR-batching rule** (CLAUDE.md, added 2026-05-02): one Claude session =
  one branch = one PR. Batch related fixes; never open follow-up PRs for
  small fixes — update the existing PR.
- **Final merge is always human** (Richard or Freddie). Claude marks PRs
  ready-for-review when CI is green and stops there.
- **Five-check gate before push**: `npm run lint && npm run typecheck &&
  npx prisma validate && npm run test && npm run build`. Stub
  `DATABASE_URL=postgresql://test:test@localhost:5432/test` for prisma validate.
- **Copilot Autofix is OFF at the repo level** — see `docs/OPERATIONS.md`
  §5 incident on PR #61. Do not re-enable. Treat any
  "Potential fix for pull request finding" commit as suspect.
- **British English** in UI + docs. API field names stay as defined.

## Session-discovered notes

- 2026-05-03 — `DEMO_MODE=true` is the most-likely root cause of "stuck on
  the login screen" Vercel symptom — without it, `/login` renders the bare
  GitHub-OAuth/email-magic-link form and there are no allow-listed
  GitHub logins to sign in with. Diagnostic: `curl /api/health` →
  `checks.environment.missing[]` will list the missing var.
- 2026-05-03 — After PRs squash-merge, the local branch can show "diverged"
  from origin/main on next rebase. If your local commit is content-equal
  to the squash commit on main, run `git rebase --skip` rather than
  resolving the conflict — the squash-merge has the same content under a
  new SHA.
- 2026-05-03 — `AGENTS.md` documents a Docker cgroup-v2 limit on Cursor
  Cloud / Cloud Agent VMs: `docker compose up postgres` fails because
  `deploy.resources.limits` triggers cgroup errors. Use `docker run`
  directly (no resource limits). Postgres binds to host port 5433, not
  5432.
- 2026-05-03 — Webhook handlers fail-closed when `N8N_API_KEY` is unset
  in production (KI-006). Even on Vercel Preview, set a pseudo-random
  `N8N_API_KEY`; differentiate from production so a leaked preview key
  can't authenticate against live n8n.
- 2026-05-03 — Vercel preview deploys auto-migrate + auto-seed only when
  BOTH `VERCEL_PREVIEW_MIGRATE=true` AND `DATABASE_URL` are set on the
  Preview environment. The seed (`prisma/seed-demo.ts`) is idempotent
  via upserts — re-running resets to canonical demo state.
- 2026-05-03 — DEMO_MODE-aware `sendTemplateMessage` in
  `lib/services/whatsapp.service.ts` (PR #104) is the right path for
  any new outbound WhatsApp template — it routes through the simulator
  in demo mode and through Meta WhatsApp Cloud API in production. New
  templates register in `lib/demo/template-registry.ts`.
- 2026-05-03 — When extending `app/api/horses/[id]/route.ts` GET response,
  use Prisma `select` (not `include`) on relations to keep payload size
  bounded. Pattern: limit related rows to newest 5; defer "see all" to a
  separate page.
