# Overnight session runbook

This document generalises the pattern set by `docs/OVERNIGHT_BUILD.md` (the
Phase 16 hardening sweep) into a reusable shape for **autonomous Claude
Code overnight sessions**. Use this when an operator wants to land a
batch of S/XS work units without sitting at the keyboard.

If you are about to run an overnight session: read `CLAUDE.md` end-to-end,
read this file, then read the most recent `docs/CLIENT_USER_STORY_TRIAGE*.md`
to know which gaps are in scope.

---

## Session shape

One session = one branch = one PR (CLAUDE.md PR-batching rule). The PR
typically carries 2–4 commits, one per work unit. Reviewable per commit;
single merge point.

```
Operator (T-2h)        →  pre-conditions ready (env, DB, dependencies)
Claude (T+0..T+10h)    →  autonomous: branch → commit → push → repeat
                          → CI green → status comment → next unit
                          → final gate → mark PR ready-for-review → STOP
Operator (T+morning)   →  reviews PR → merges → triggers preview redeploy
```

## Pre-conditions (operator, before kicking off)

- [ ] Vercel Preview env vars set per `docs/CLIENT_USER_STORY_TRIAGE.md` §6
      (`DATABASE_URL`, `AUTH_SECRET`, `N8N_API_KEY`, `DEMO_MODE=true`,
      `VERCEL_PREVIEW_MIGRATE=true`).
- [ ] Neon Vercel integration installed (per-PR branch DB).
- [ ] Any blocker PRs merged to `main` (last overnight blocked on PR #104
      until merged).
- [ ] `git fetch origin main` clean from the operator's laptop.
- [ ] `npm install` clean; `node_modules` present.
- [ ] Optional: trigger one Vercel deploy refresh so the baseline preview
      is current.

## In-session conventions (Claude)

### Branch + PR

- Branch off `origin/main` directly. Name: `feature/<phase>-<short>` or
  the harness-designated `claude/<task>-<slug>`.
- First push opens the PR as **draft** (per harness rule).
- PR template auto-populates Summary / Scope / Test plan / Risk / Stop-gate
  (`.github/PULL_REQUEST_TEMPLATE.md`). Fill it before push.
- CODEOWNERS auto-pings reviewers on path-touch (`.github/CODEOWNERS`).

### Per work unit

1. **Plan the unit** — list files to touch + tests to add.
2. **Implement** — make the changes.
3. **Run the five-check gate locally** (see below). Fix in-session.
4. **Commit** with a descriptive message:
   `feat(<scope>): <one-line description> (<gap-id>)`.
5. **Push** — first push opens the PR; subsequent pushes update it.
6. **Wait for CI green** on the PR — `mcp__github__pull_request_read` →
   `get_check_runs`. Don't fire the next work unit until green; otherwise
   stacked failures conflate root causes.
7. **Append a status comment** to the PR via `mcp__github__add_issue_comment`:
   `"Work unit X complete — N tests passing, build green."`

### Five-check gate (local)

```sh
DATABASE_URL=postgresql://test:test@localhost:5432/test \
  npm run lint && \
  npm run typecheck && \
  npx prisma validate && \
  npm run test && \
  npm run build
```

All five must pass before push. CI runs the same gate (`.github/workflows/ci.yml`).

### Session end

- Run the gate one final time on a clean checkout.
- Update PR description with the final Summary / Test plan / Risk / Stop-gate.
- Trigger a Vercel preview redeploy via `bash scripts/trigger-vercel-deploy.sh`.
- Mark the PR ready-for-review (`mcp__github__update_pull_request` with
  `draft: false`).
- Append final status comment summarising what shipped + the preview URL.
- **Stop.** Do not merge — final merge belongs to a human (CLAUDE.md).

## Failure handling

| Symptom | Action |
|---|---|
| Local gate fails after edit | Fix in-session, recommit, repush. Same branch. |
| CI fails after push (obvious cause) | Fix in-session, recommit. Don't open a new PR. |
| CI fails after push (non-obvious) | Rely on `ci-failure-to-issue.yml` + `claude-code-fix.yml` to auto-investigate. Move on to next work unit. |
| Migration conflict (someone landed a migration on main mid-session) | `git fetch origin main` → `git rebase origin/main --force-with-lease` → re-run gate → repush. |
| Hard architectural decision surfaces mid-unit | Add `// STOP-GATE: <decision>` code comment, revert the unit's commit, append "Deferred from overnight" to PR description, move on. Human triages in the morning. |
| Branch diverges from `origin/<branch>` after a squash merge | The session's prior commit was already squash-merged. `git rebase origin/main` → `git rebase --skip` the duplicate. |

## What overnight sessions DO NOT do

- ❌ Merge to `main` — always human.
- ❌ Re-enable Copilot Autofix — see `docs/OPERATIONS.md` §5 incident.
- ❌ Push to a non-feature branch.
- ❌ Modify `.env*` or `vercel.json` (env config is operator territory).
- ❌ Touch gaps that need client clarification (e.g. VetUp API spec, FAQ
      corpus, voice dictation moment).
- ❌ Use `--no-verify` to bypass hooks.
- ❌ Open a separate PR per work unit (PR-batching rule).
- ❌ Force-push to a branch under active human review.

## CI / automation surface (already wired)

| Workflow | Trigger | Purpose |
|---|---|---|
| `.github/workflows/ci.yml` | push, PR | Five-check gate (lint, typecheck, prisma validate + generate, test, build) + Docker image build + npm audit |
| `.github/workflows/ci-failure-to-issue.yml` | workflow_run failure on default branch | Auto-files a `bug` + `ci-failure` labeled issue with @claude ping |
| `.github/workflows/claude-code-fix.yml` | issue label / @claude mention | Spawns Claude Code with a bug-fix prompt; opens a PR if a fix lands |
| `.github/workflows/vercel-deploy-trigger.yml` | workflow_dispatch (+ optional cron) | Triggers a Vercel deploy via webhook (re-seeds preview demo data on Preview env) |

The CI→Issue→Claude-fix loop is production-grade. Overnight sessions ride
on top of it: a non-fatal CI failure mid-session does not require human
intervention — the loop will pick it up.

## Memory

`.claude/memory.md` is the canonical place for session-discovered lessons.
Append (don't rewrite) when:

- An environment quirk surfaces (e.g. cgroup v2 docker limit per `AGENTS.md`).
- A bug fix has a non-obvious root cause worth recording.
- An architectural decision is made that future sessions need to know.

Read `.claude/memory.md` at session start. Three-line entry per discovery
(date, what, why).

## Historical precedent

- `docs/OVERNIGHT_BUILD.md` — Phase 16 hardening sweep (G1, G2, G3 closure).
- `docs/UAT_v1_1_TRIAGE.md` + `_round2.md` — UAT-driven triage doc shape.
- `docs/CLIENT_USER_STORY_TRIAGE.md` — first client-user-story-driven
  triage, the precedent this overnight pattern serves.
