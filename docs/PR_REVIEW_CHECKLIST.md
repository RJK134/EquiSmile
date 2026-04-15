# EquiSmile PR Review Checklist

## Pre-Merge Checks

### Code Quality
- [ ] TypeScript strict mode — no `any` types
- [ ] No hardcoded UI strings — all text via next-intl translation keys
- [ ] British English in UI and documentation
- [ ] No secrets in source control
- [ ] External payloads validated
- [ ] Error handling for external integrations

### Testing
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] `npx prisma validate` passes
- [ ] `npm run build` passes

### Mobile
- [ ] Mobile layout checked at 390px width minimum
- [ ] Bottom navigation visible and functional on mobile
- [ ] Responsive breakpoints working correctly

### Internationalisation
- [ ] All new UI strings added to both `messages/en.json` and `messages/fr.json`
- [ ] Translation keys follow naming convention
- [ ] Language switcher tested

### Database
- [ ] Prisma migrations are additive and reversible
- [ ] No ad hoc schema edits
- [ ] Indexes added for frequently queried fields

### Documentation
- [ ] `docs/` updated for phase scope
- [ ] `docs/KNOWN_ISSUES.md` updated if needed
- [ ] Verification summary included in PR description

## Review Workflow

1. Claude implements the scoped task
2. Claude runs local checks
3. Claude updates documentation and known issues
4. GitHub Copilot review requested
5. Cursor/Bugbot feedback reviewed
6. Valid findings addressed
7. Verification summary posted to PR
8. Merge when GREEN or MERGEABLE WITH AMBER LOG
