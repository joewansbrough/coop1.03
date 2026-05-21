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

- [ ] Improve empty state on Units page.
- [ ] Confirm unit creation flow works before tenants exist.
- [ ] Add unit template download if needed.
- [ ] Decide whether tenant import can create missing units during confirmed import.
- [ ] Add tests for unit readiness and missing-unit warnings.

## Phase 4: Tenant Spreadsheet Import

- [ ] Create `utils/tenantImport.ts`.
- [ ] Create `tests/tenantImport.test.ts`.
- [ ] Define tenant template columns.
- [ ] Add downloadable tenant CSV template.
- [ ] Implement upload parsing and row normalization.
- [ ] Validate required fields: first name, last name, email, unit number.
- [ ] Validate duplicate emails, existing tenant conflicts, missing units, invalid dates, unknown roles, and unknown statuses.
- [ ] Add preview endpoint that does not mutate the database.
- [ ] Add confirm endpoint that creates/updates tenants, links units, updates occupancy, and records tenant history.
- [ ] Add frontend upload, preview, fix guidance, and confirm flow.

## Phase 5: Documents, Drive, And File Search

- [ ] Show Drive root readiness in onboarding.
- [ ] Link onboarding step to existing document/Drive setup.
- [ ] Show document indexing readiness.
- [ ] Keep RAG/File Search admin indexing controls.
- [ ] Improve user-facing errors for missing Drive or Gemini configuration.
- [ ] Update Oracle/Policy Assistant copy so missing indexed documents are explained clearly.

## Phase 6: Empty Real-Data States

- [ ] Dashboard shows setup progress when records are empty.
- [ ] Tenants page offers spreadsheet import when empty.
- [ ] Units page explains unit setup as the foundation.
- [ ] Documents page offers Drive connect/upload/index actions.
- [ ] Policy Assistant explains data-dependent answers.
- [ ] Maintenance page supports request creation while explaining missing unit/member context.
- [ ] Calendar page supports first meeting creation.
- [ ] Committees page offers common presets and member assignment after tenant import.

## Phase 7: Verification

- [x] Run `npx tsx tests/onboardingStatus.test.ts`.
- [ ] Run `npx tsx tests/tenantImport.test.ts`.
- [ ] Run existing File Search/RAG tests.
- [ ] Run existing data-loading/dashboard tests.
- [x] Run `npm run build`.
- [ ] Manually verify empty co-op admin onboarding.
- [ ] Manually verify partially populated OBHC onboarding.

## Phase 8: Production Guardrails Before Second Client

- [ ] Lock or remove `/api/migrate`, `/api/seed`, and `/api/debug/config`.
- [ ] Add or confirm `Cooperative.subdomain`, `status`, `onboardingState`, lifecycle timestamps, and `settings`.
- [ ] Install strict host/subdomain cooperative resolution for normal requests.
- [ ] Remove first-cooperative fallback behavior.
- [ ] Define `withTenantContext(req, callback)` for session-backed HTTP requests.
- [ ] Define `withCooperativeContext(cooperativeId, callback)` for background jobs, cron tasks, imports, exports, and ingestion.
- [ ] Ensure webhook/callback endpoints authenticate independently and look up cooperatives by provider identifiers.
- [ ] Scope imports, exports, downloads, Drive, RAG, and cooperative-owned CRUD by `cooperativeId`.
- [ ] Add query guard coverage for cooperative-owned routes.
- [ ] Add soft-delete support with `deletedAt` for cooperative-owned records before production hard deletes.
- [ ] Add support/audit logging for sensitive support and recovery actions.
- [ ] Add per-user and per-cooperative rate limits for onboarding import, Drive ingestion, document indexing, exports, RAG ask, maintenance image upload, and bulk document operations.
- [ ] Document secret storage, environment separation, and rotation expectations.
- [ ] Define staging as a separate database/Supabase project with at least two seeded cooperatives.
- [ ] Verify the second cooperative in staging before production onboarding.
- [ ] Add cross-coop isolation tests for IDs, cookies, downloads, admin routes, exports, imports, Drive roots, and RAG.

## Parking Lot

- [ ] AI-assisted messy spreadsheet parsing.
- [ ] Full XLSX import if CSV template is not enough.
- [ ] Member-facing document question answering.
- [ ] Batch Drive indexing automation.
- [ ] Cost/usage dashboard for Gemini File Search.
- [ ] RLS defense-in-depth after app-layer scoping is clean and staging-tested.
