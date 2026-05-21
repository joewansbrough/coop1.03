# Onboarding-First coopHUB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Keep the current OBHC onboarding branch as the reference base. Do not resurrect the old multi-tenancy branch wholesale.

**Goal:** Turn coopHUB into an onboarding-ready operating shell: fully functional, feature-rich, and graceful while a new co-op is still loading its first real data.

**Architecture:** Preserve the strong feature layer already on this branch: Google Drive document linking, Gemini File Search/RAG, the written and verbal Oracle/Policy Assistant, OBHC onboarding utilities, dashboard customization, and admin workflows. Add a small onboarding readiness layer that detects missing foundational data, guides admins through setup, and makes every major page handle empty real data intentionally.

**Tech Stack:** React, Vite, TypeScript, Express, Prisma, TanStack Query, Google Drive API, Gemini File Search, existing coopHUB RBAC/session utilities.

---

## Product Direction

coopHUB should no longer be planned as a generic multi-tenancy hardening project first. The near-term product should be a clean onboarding experience for one co-op at a time, with future multi-coop foundations kept intact where they already exist.

The app should feel ready even before the co-op has loaded units, tenants, documents, committees, meetings, announcements, and maintenance history. It should not show broken dashboards, misleading demo data, or blank pages that look accidental. It should show useful setup states and clear next actions.

## Keep From Current Branch

- **Gemini File Search/RAG:** Keep document indexing, RAG ask endpoints, citation normalization, and admin document intelligence.
- **Policy Assistant / Oracle:** Keep written chat, voice mode, document-grounded answers, citations, and workflow nudges.
- **Google Drive integration:** Keep Drive roots, Drive explorer, linked Drive document metadata, Drive ingestion, and document download/search protections.
- **OBHC onboarding utilities:** Keep `services/obhcOnboarding.ts` and `scripts/createObhcOnboardingCoop.ts` as reference implementation, but move future work toward generic provisioning utilities.
- **Dashboard and workflow improvements:** Keep dashboard preferences, notifications, guided demo/onboarding tour concepts, document links, meeting minutes improvements, and admin workflows.

## Do Not Carry Forward As Primary Focus

- Do not make Phase 1/Phase 2 multi-tenancy hardening the immediate product plan.
- Do not require every co-op to have full tenant/unit/committee/document data before the app renders.
- Do not overbuild cross-coop tenant isolation before the onboarding/import path is stable.
- Do not rely on seeded demo data to hide empty real production states.
- Do not make the first version of spreadsheet import parse arbitrary messy spreadsheets with AI. Start with a clear template, validation, preview, and confirm step.

## Multi-Coop Production Guardrails

The previous multi-tenancy plan remains architecturally valuable, but it should be treated as the security and production-readiness track that supports onboarding, not as the first product surface to build. OBHC remains the pilot. Before onboarding a second real cooperative, the app must pass the guardrails below.

Core model:

- `Cooperative` is the tenant organization.
- `cooperativeId` is the tenant foreign key.
- Host/subdomain resolves the cooperative for normal browser/API requests.
- Session identifies the human user.
- Active membership in the resolved cooperative authorizes access.
- Role comes from membership, not from client input.
- The app should use "cooperative" for organizations and "member" or "resident" for people. Avoid using "tenant" as an organization synonym.

Phase 1 guardrails before a second real client:

- Remove or lock dangerous public routes: `/api/migrate`, `/api/seed`, and `/api/debug/config`.
- Add or confirm `Cooperative` fields for `subdomain`, `status`, `onboardingState`, lifecycle timestamps, and `settings`.
- Resolve cooperative strictly from host/subdomain for normal requests, with defined `404`, `403`, and `410` outcomes.
- Remove any first-cooperative fallback from request handling.
- Authenticate the user independently, then authorize by active membership in the resolved cooperative.
- Protect admin routes on the backend with role/permission checks.
- Scope every cooperative-owned read, write, update, delete, download, import, export, and RAG request by `cooperativeId`.
- Add a query guard that logs in production and hard-fails in development/test when cooperative-scoped routes query without tenant scope.
- Update local unique constraints such as `[cooperativeId, email]` and `[cooperativeId, number]`.
- Add cross-coop isolation tests for record IDs, cookies, downloads, admin routes, exports, imports, Drive roots, and RAG.

Context contract:

- `withTenantContext(req, callback)` is for normal HTTP requests. It resolves the cooperative from host/subdomain, validates the session user, checks active membership, derives role/permissions, and passes `{ tx, cooperativeId, user, membership, permissions }` to the callback.
- Calling `withTenantContext` outside a valid request context must fail closed. It must not fall back to the first cooperative, session cooperative, or client-provided cooperative ID.
- `withCooperativeContext(cooperativeId, callback)` is for background jobs, cron tasks, exports, imports, ingestion, and workers. The caller must validate the cooperative ID upstream before calling it. This helper opens a scoped transaction and passes `{ tx, cooperativeId }` to the callback.
- Tenant route handlers should use scoped transaction helpers for cooperative-owned data. Global Prisma access inside tenant-owned route handlers should be treated as a code-review finding.

Webhook and callback endpoints:

- Third-party callbacks sit outside host/subdomain tenant middleware.
- Webhooks authenticate with their own signature, shared secret, or provider verification.
- Webhooks look up cooperatives by internal provider identifiers such as billing customer ID, connected account ID, Drive watch channel metadata, or stored integration ID.
- Webhooks must not trust subdomain, session, cookies, or client-provided cooperative IDs.
- Webhook side effects such as suspension, billing changes, document ingestion, or status updates must enter `withCooperativeContext` only after provider authentication and cooperative lookup succeed.

Secrets and configuration:

- Secrets live in Vercel environment variables or a dedicated secrets manager when the platform outgrows Vercel-only configuration.
- Staging and production secrets must be different.
- Secrets must never be committed to the repository, written to logs, included in error responses, or exposed through debug endpoints.
- Rotate `SESSION_SECRET`, `ADMIN_API_KEY`, `ENCRYPTION_KEY_V1`, Google/Gemini credentials, Redis/Upstash credentials, and provider webhook secrets after suspected exposure.
- Rotate `ADMIN_API_KEY` when a team member with access departs.

Soft-delete and recovery:

- Add `deletedAt` to cooperative-owned records before relying on hard delete for production data.
- User-facing delete actions should soft-delete by default and preserve `cooperativeId`, actor, timestamp, and reason where useful.
- Permanent deletion should happen only through a retention job or explicit support action after a grace period.
- Single-cooperative recovery should first attempt soft-delete restoration. Backup restore should be the fallback path, not the default recovery method.
- Support access must be audited for member removal, admin role changes, document deletion, minutes edits, financial/governance exports, cooperative status changes, and permanent deletion.

Rate limiting:

- Add general API rate limits before onboarding a second real client.
- Prioritize per-user and per-cooperative limits on expensive endpoints: onboarding import preview/confirm, Drive ingestion, document indexing, exports, RAG ask, maintenance image upload, and bulk document operations.
- AI budget limits are still needed, but they do not replace import, ingest, and export rate limits.

Staging policy:

- Staging must be a separate Supabase/database project, not a schema inside production.
- Staging should contain realistic seed data for at least two cooperatives so isolation tests can prove cross-coop boundaries.
- The second cooperative should be provisioned in staging before production.
- Multi-coop guardrails, import behavior, Drive/RAG behavior, and support/recovery procedures should pass in staging before production rollout.

Later hardening:

- Add audit logging for sensitive events before broad admin/support use.
- Add RLS after app-layer scoping is clean and tested in staging. RLS is defense-in-depth, not the first isolation layer.
- If RLS is used, set tenant context with `SET LOCAL app.cooperativeId` inside explicit transaction blocks only; do not use `SET SESSION`.
- Long-running imports, ingestion, and exports should use short batched transactions and job-level cooperative validation.
- Add async export jobs, AI usage logs, atomic budget counters, and RAG filtering before heavy real-client AI usage.

## Target Onboarding Flow

The setup flow is optional. Admins can skip it and use the app normally, but incomplete co-ops should always have a clear way back to setup.

1. **Confirm Co-op Profile**
   - Confirm name, slug, province, admin email, timezone, and basic identity.
   - Show which admin account is currently managing setup.

2. **Create Units / Buildings**
   - Units come before tenants because tenant records need a reliable assignment target.
   - Support manual unit creation and template-based unit upload.
   - Keep required fields minimal: unit number and optional building/floor/type/status.

3. **Import Members / Tenants**
   - Provide a downloadable spreadsheet template.
   - Admin completes and uploads the file.
   - App parses rows and shows a preview before writing anything.
   - Required tenant fields should be minimal: first name, last name, email, unit number.
   - Optional fields can include phone, role, status, move-in date, emergency contact, parking stall, storage locker, and notes.

4. **Review Unit Assignments**
   - Auto-match tenant rows to units by `unitNumber`.
   - Flag unknown unit numbers, duplicate emails, missing names, invalid dates, and repeated active occupants.
   - Allow admin to fix simple issues before confirming import.

5. **Connect Documents**
   - Offer Google Drive root connection, manual upload, or skip for now.
   - Drive-backed documents should be the preferred onboarding path because many co-ops already maintain document libraries externally.

6. **Index Documents For Oracle**
   - Once documents exist, allow admins to index them with Gemini File Search.
   - Show indexing status and configuration errors clearly.
   - Oracle/Policy Assistant should say when no documents have been indexed yet.

7. **Configure Committees And Roles**
   - Use imported tenant emails as candidate members.
   - Start with common committee presets: Board, Maintenance, Finance, Membership, Communications.
   - Keep role setup useful but not mandatory for launch.

8. **Review And Launch**
   - Show readiness status: profile, units, tenants, documents, indexed docs, committees.
   - Allow launch with missing sections, but make missing data visible.

## Data Readiness Model

Create a setup status model that describes whether the co-op is ready, partially ready, or still waiting for initial data.

Suggested readiness checks:

- `profileReady`: cooperative exists with name, slug, province, and admin email.
- `unitsReady`: at least one unit exists.
- `tenantsReady`: at least one active/current tenant exists.
- `assignmentsReady`: active tenants are attached to units where possible.
- `documentsReady`: at least one document exists or Drive root is connected.
- `driveReady`: at least one active `CooperativeDriveRoot` exists, or Drive configuration is available.
- `ragReady`: at least one current document version has `ragStatus = "indexed"` or a File Search store is configured.
- `committeesReady`: at least one committee exists.

Expose this through a focused backend utility and endpoint rather than scattering readiness logic across pages.

## Spreadsheet Import Design

Start with a deterministic template import. Support CSV first if it is faster and reliable; add XLSX once parsing support is confirmed in the project dependencies.

Template columns:

```text
firstName
lastName
email
phone
unitNumber
role
status
moveInDate
emergencyContactName
emergencyContactPhone
parkingStall
storageLocker
notes
```

Required columns:

```text
firstName
lastName
email
unitNumber
```

Validation rules:

- Email must be syntactically valid.
- Unit number must match an existing unit unless the admin chooses to create missing units.
- Duplicate emails in the upload must be flagged.
- Existing tenant emails must be treated as updates or conflicts, not blind creates.
- Move-in date must parse as a date when provided.
- Role should normalize to `ADMIN`, `BOARD`, or `MEMBER`; unknown roles become warnings.
- Status should normalize to `Current`, `Pending`, `Former`, or `Waitlist`; unknown statuses become warnings.

Import commit behavior:

- Parse and validate upload.
- Return preview rows with `valid`, `warnings`, and `errors`.
- Do not mutate the database during preview.
- On confirm, upsert tenants, assign units, update unit occupancy, and create tenant history records.
- Return a summary of created tenants, updated tenants, assignments, skipped rows, warnings, and errors.

## Empty State Design

Every major page should intentionally support empty real data:

- **Dashboard:** show onboarding progress and key setup actions instead of empty metrics only.
- **Units:** explain that units are the backbone and offer manual creation or spreadsheet import.
- **Directory/Tenants:** offer tenant template download and upload.
- **Documents:** offer Drive connection, manual upload, and indexing guidance.
- **Policy Assistant:** explain that it can answer from loaded co-op data and indexed documents, and that some answers will be unavailable until data is loaded.
- **Maintenance:** allow manual request creation, but explain that unit/member context improves triage.
- **Calendar/Minutes:** allow meetings to be created from scratch, but do not imply historical minutes are loaded.
- **Committees:** offer presets and member assignment after tenant import.

## File Structure

Likely implementation files:

- Create `utils/onboardingStatus.ts` for pure readiness calculations and copy.
- Create `tests/onboardingStatus.test.ts` for readiness states.
- Modify `api/index.ts` to expose `GET /api/onboarding/status`.
- Modify `hooks/useCoopData.ts` to add `useOnboardingStatus`.
- Create `pages/OnboardingSetup.tsx` for the optional admin setup flow.
- Modify `components/Layout.tsx` to surface setup access for admins.
- Modify `pages/Dashboard.tsx` to show setup progress when data is incomplete.
- Create `utils/tenantImport.ts` for template schema, parsing, validation, and preview mapping.
- Create `tests/tenantImport.test.ts` for spreadsheet row validation and conflict detection.
- Modify `api/index.ts` to expose tenant import preview/confirm endpoints.
- Create or modify a small tenant import component, likely inside `pages/Tenants.tsx` or a focused `components/TenantImportPanel.tsx`.
- Modify `components/OracleAssistant.tsx` and/or `services/geminiService.ts` so responses acknowledge missing co-op data and unindexed documents.
- Create or modify tenant context helpers such as `utils/tenantContext.ts` once production guardrails begin.
- Create or modify support/audit utilities once soft-delete and support recovery work begins.

## Implementation Phases

### Phase 1: Readiness Foundation

Build the onboarding status utility and endpoint.

Tasks:

- Add pure readiness tests for empty, partial, and ready co-op data.
- Implement `utils/onboardingStatus.ts`.
- Add `GET /api/onboarding/status`.
- Add `useOnboardingStatus`.
- Verify with focused tests and build.

### Phase 2: Optional Setup Shell

Add an admin-only setup page and dashboard entry point.

Tasks:

- Add `/onboarding` route.
- Build a setup checklist with profile, units, tenants, documents, indexing, committees, and launch sections.
- Add dashboard setup progress when readiness is incomplete.
- Add layout/profile menu entry for admins.
- Verify empty-data rendering.

### Phase 3: Units First

Make units easy to create before tenant import.

Tasks:

- Ensure Units page has a useful empty state.
- Add or refine quick unit creation.
- Add a simple unit template download if needed.
- Decide whether missing units from tenant import can be auto-created; default should be preview warning plus admin choice.

### Phase 4: Tenant Spreadsheet Import

Build the template, upload preview, validation, and confirmed import.

Tasks:

- Add downloadable tenant CSV template.
- Implement row normalization and validation.
- Add preview endpoint.
- Add confirm endpoint.
- Add frontend upload/preview/confirm panel.
- Create tenant history and unit occupancy updates on confirm.
- Verify duplicate/conflict handling.

### Phase 5: Documents And File Search Onboarding

Connect the setup flow to existing Drive/RAG features.

Tasks:

- Show Drive root status in onboarding.
- Link to Drive/document setup from onboarding.
- Show document indexing readiness.
- Make File Search configuration errors user-friendly.
- Ensure Oracle says when no indexed documents are available.

### Phase 6: Page Empty States

Make empty real-data states feel intentional across the app.

Tasks:

- Dashboard empty/readiness state.
- Tenants empty/import state.
- Units empty/setup state.
- Documents empty/Drive state.
- Committees empty/preset state.
- Calendar/minutes empty state.
- Maintenance empty state.

### Phase 7: Final Verification

Tasks:

- Run focused tests for onboarding status and tenant import.
- Run existing RAG/File Search tests.
- Run existing dashboard/data-loading tests.
- Run `npm run build`.
- Manually verify an empty co-op admin experience and an OBHC partially populated experience.

### Phase 8: Second-Cooperative Production Guardrails

Do this before onboarding a second real client.

Tasks:

- Lock dangerous public routes.
- Install strict host/subdomain cooperative resolution.
- Remove first-cooperative fallbacks.
- Define `withTenantContext` and `withCooperativeContext`.
- Scope imports, exports, downloads, Drive, RAG, and all cooperative-owned CRUD operations.
- Add query guard coverage.
- Add soft-delete recovery for cooperative-owned records.
- Add rate limits for import, ingest, export, and AI-heavy endpoints.
- Define webhook/callback handling outside tenant middleware.
- Document staging environment policy and verify two-cooperative isolation in staging.
- Add cross-coop isolation tests.

## Success Criteria

- A newly provisioned co-op can load the app without seeded demo data.
- Admins can see exactly what setup steps remain.
- Admins can download a tenant template, upload completed rows, preview validation, and confirm import.
- Tenants are linked to units without corrupting existing records.
- Drive/File Search/Oracle remain available and are clearly described as data-dependent.
- Pages with no records show intentional setup states.
- The old multi-tenancy plan is no longer the immediate execution path.
- Before a second real cooperative is onboarded, app-layer cooperative isolation is tested in staging against at least two cooperatives.
