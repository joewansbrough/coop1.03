# Onboarding-First Task Tracker

This tracker replaces the old multi-tenancy-first task direction. Work from the current OBHC onboarding branch and preserve useful features already present: File Search/RAG, Drive documents, Oracle/Policy Assistant, dashboard improvements, and OBHC provisioning utilities.

## Phase 0: Planning Reset

- [x] Reframe product focus around onboarding-ready coopHUB.
- [x] Preserve File Search, Policy Assistant, Drive, and Oracle as core product capabilities.
- [x] Treat the old multi-tenancy branch as reference material, not the base.
- [x] Replace `reference materials/implementation-plan.md` with the onboarding-first plan.
- [x] Add this task tracker.

## Phase 1: Readiness Foundation

- [x] Create `utils/onboardingStatus.ts`.
- [x] Create `tests/onboardingStatus.test.ts`.
- [x] Define readiness checks for profile, units, tenants, assignments, documents, Drive, RAG, committees, and launch.
- [x] Add `GET /api/onboarding/status`.
- [x] Add `useOnboardingStatus` in `hooks/useCoopData.ts`.
- [x] Verify readiness status for empty, partial, and populated co-ops.

## Phase 2: Optional Setup Flow

- [x] Add an admin-only `/onboarding` route.
- [x] Create `pages/OnboardingSetup.tsx`.
- [x] Show setup progress and next actions.
- [x] Add setup entry point in admin layout/profile navigation.
- [x] Add setup progress to Dashboard when co-op data is incomplete.
- [x] Keep setup optional; normal app navigation must remain available.

## Phase 3: Units Before Tenants

- [x] Improve empty state on Units page.
- [x] Confirm unit creation flow works before tenants exist.
- [x] Add unit template download if needed.
- [x] Decide whether tenant import can create missing units during confirmed import.
- [x] Add tests for unit readiness and missing-unit warnings.

Decision: tenant import should warn on missing unit numbers by default. The confirm step can offer an explicit "create missing units" option later, but it should never silently create units from tenant rows.

## Phase 4: Tenant Spreadsheet Import

- [x] Create `utils/tenantImport.ts`.
- [x] Create `tests/tenantImport.test.ts`.
- [x] Define tenant template columns.
- [x] Add downloadable tenant CSV template.
- [x] Add downloadable full-site onboarding data template for units, members, committees, committee memberships, roles, documents, events, announcements, and maintenance requests.
- [x] Implement upload parsing and row normalization.
- [x] Validate required fields: first name, last name, email, unit number.
- [x] Validate duplicate emails, existing tenant conflicts, missing units, invalid dates, unknown roles, and unknown statuses.
- [x] Add preview endpoint that does not mutate the database.
- [x] Add confirm endpoint that creates/updates tenants, links units, updates occupancy, and records tenant history.
- [x] Add frontend upload, preview, fix guidance, and confirm flow.

## Phase 5: Documents, Drive, And File Search

- [x] Create document onboarding readiness helper and tests.
- [x] Show Drive root readiness in onboarding.
- [x] Link onboarding step to existing document/Drive setup.
- [x] Show document indexing readiness.
- [x] Keep RAG/File Search admin indexing controls.
- [x] Improve user-facing errors for missing Drive or Gemini configuration.
- [x] Update Oracle/Policy Assistant copy so missing indexed documents are explained clearly.
- [x] Fix Oracle voice mode Gemini key fallback and missing-configuration messaging.
- [x] Add saved per-user audio voice preferences for Oracle Live and generated narration.

## Phase 6: Empty Real-Data States

- [x] Dashboard shows setup progress when records are empty.
- [x] Tenants page offers spreadsheet import when empty.
- [x] Units page explains unit setup as the foundation.
- [x] Documents page offers Drive connect/upload/index actions.
- [x] Policy Assistant explains data-dependent answers.
- [x] Maintenance page supports request creation while explaining missing unit/member context.
- [x] Calendar page supports first meeting creation.
- [x] Committees page offers common presets and member assignment after tenant import.

## Phase 7: Verification

- [x] Run `npx tsx tests/onboardingStatus.test.ts`.
- [x] Run `npx tsx tests/unitOnboarding.test.ts`.
- [x] Run `npx tsx tests/tenantImport.test.ts`.
- [x] Run `npx tsx tests/onboardingTemplate.test.ts`.
- [x] Run `npx tsx tests/documentOnboarding.test.ts`.
- [x] Run `npx tsx tests/pageEmptyStates.test.ts`.
- [x] Run `npx tsx tests/productionGuardrails.test.ts`.
- [x] Run `npx tsx tests/cooperativeProductionSchema.test.ts`.
- [x] Run `npx tsx tests/coopResolution.test.ts`.
- [x] Run `npx tsx tests/tenantContext.test.ts`.
- [x] Run `npx tsx tests/queryGuard.test.ts`.
- [x] Run `npx prisma validate`.
- [x] Run `npm run lint`.
- [x] Run existing File Search/RAG tests.
- [x] Run existing data-loading/dashboard tests.
- [x] Run `npm run build`.
- [ ] Manually verify empty co-op admin onboarding.
- [ ] Manually verify partially populated OBHC onboarding.

## Phase 8: Production Guardrails Before Second Client

- [x] Lock or remove `/api/migrate`, `/api/seed`, and `/api/debug/config`.
- [x] Add or confirm `Cooperative.subdomain`, `status`, `onboardingState`, lifecycle timestamps, and `settings`.
- [x] Install strict host/subdomain cooperative resolution for normal requests.
- [x] Remove first-cooperative fallback behavior.
- [x] Define `withTenantContext(req, callback)` for session-backed HTTP requests.
- [x] Define `withCooperativeContext(cooperativeId, callback)` for background jobs, cron tasks, imports, exports, and ingestion.
- [x] Document production guardrail rollout state and temporary query guard behavior.
- [ ] Ensure webhook/callback endpoints authenticate independently and look up cooperatives by provider identifiers.
- [ ] Scope imports, exports, downloads, Drive, RAG, and cooperative-owned CRUD by `cooperativeId`.
- [x] Add query guard coverage for cooperative-owned routes.
- [x] Add production-safe query guard logging/alert mode before enabling hard-fail behavior in production.
- [x] Replace production query guard console warnings with durable `QueryGuardFinding` records.
- [ ] Add soft-delete support with `deletedAt` for cooperative-owned records before production hard deletes.
- [ ] Add support/audit logging for sensitive support and recovery actions.
- [ ] Add per-user and per-cooperative rate limits for onboarding import, Drive ingestion, document indexing, exports, RAG ask, maintenance image upload, and bulk document operations.
- [ ] Document secret storage, environment separation, and rotation expectations.
- [ ] Define staging as a separate database/Supabase project with at least two seeded cooperatives.
- [ ] Verify the second cooperative in staging before production onboarding.
- [ ] Add cross-coop isolation tests for IDs, cookies, downloads, admin routes, exports, imports, Drive roots, and RAG.

## Parking Lot

- [ ] AI-assisted messy spreadsheet parsing.
- [ ] Multi-entity onboarding import preview/confirm from the full onboarding template.
- [ ] Full XLSX import if CSV template is not enough.
- [ ] Member-facing document question answering.
- [ ] Batch Drive indexing automation.
- [ ] Cost/usage dashboard for Gemini File Search.
- [ ] RLS defense-in-depth after app-layer scoping is clean and staging-tested.
