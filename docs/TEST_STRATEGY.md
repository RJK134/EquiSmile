# EquiSmile Test Strategy

## Testing Framework

- **Unit / Integration Tests:** Vitest + React Testing Library
- **Type Checking:** TypeScript strict mode (`tsc --noEmit`)
- **Linting:** ESLint with Next.js + TypeScript rules
- **Schema Validation:** Prisma validate

## Test Pyramid

### Unit Tests
- Pure utility functions (parsing, scoring, validation)
- Prisma query builders
- Route optimisation payload builders
- Translation key completeness

### Integration Tests
- API route handlers
- Server actions with database
- n8n webhook handlers
- Prisma migrations against real database

### Component Tests
- React components with React Testing Library
- Form validation behaviour
- Navigation and routing
- Locale switching

### End-to-End Tests (Phase 7+)
- Full business flows
- Mobile viewport testing
- Bilingual flow completion

## Test Organisation

```
__tests__/
  unit/               # Pure function tests
  integration/        # API and database tests
  components/         # React component tests
```

## Coverage Targets

| Area | Target |
|------|--------|
| Utility functions | 90%+ |
| API routes | 80%+ |
| Components | 70%+ |
| Overall | 75%+ |

## CI Integration

Every PR must pass:
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npx prisma validate`
- `npm run build`

## Testing Conventions

- Test files live alongside the code they test or in `__tests__/`
- Use descriptive test names in British English
- Prefer testing behaviour over implementation details
- Mock external APIs, never the database in integration tests
- All translation keys must exist in both EN and FR message files
