# Production Guardrails

This document tracks the second-cooperative hardening work that supports onboarding real co-ops safely. The task tracker records status; this file records intent, temporary choices, rollout stages, and operational notes.

## Current State

The app now has the first guardrail layer:

- Dangerous maintenance routes are locked: `/api/migrate`, `/api/seed`, `/api/debug/config`, and `/debug/config`.
- `Cooperative` has production lifecycle fields: `subdomain`, `status`, `onboardingState`, `settings`, `launchedAt`, `suspendedAt`, and `archivedAt`.
- Normal requests resolve cooperatives from host/subdomain and fail closed for unknown, suspended, or archived co-ops.
- First-cooperative fallback has been removed from normal request resolution.
- Context helpers exist:
  - `withTenantContext(prisma, req, callback)` for session-backed HTTP requests.
  - `withCooperativeContext(prisma, cooperativeId, callback)` for background work.
- A Prisma query guard exists for cooperative-owned models.

## Host Resolution

Strict host/subdomain lookup only applies to configured co-op host suffixes. This prevents preview hosts, Vercel deployment hosts, and other unmanaged app hosts from being mistaken for co-op subdomains.

Configuration:

- `COOPERATIVE_HOST_SUFFIXES` is a comma-separated list of managed co-op host suffixes.
- Defaults are `coophub.test,coophub.localhost` for local/test behavior.
- Production must set this to the real managed domain suffixes before onboarding a second co-op.

Example:

```text
COOPERATIVE_HOST_SUFFIXES=coop.example.com,coophub.ca
```

With that setting, `oak.coop.example.com` resolves by `Cooperative.subdomain = "oak"`. An unmanaged host such as a preview deployment falls back to authenticated user/session cooperative resolution and still does not fall back to the first cooperative.

## Query Guard Rollout

The query guard is installed in every normal environment, but it uses different enforcement modes.

Reason:

- The current guard is strict by design. It detects when a cooperative-owned query lacks a visible `cooperativeId` scope.
- Hard-failing is exactly what we want in development and tests while route groups are being migrated.
- It is not yet safe to hard-fail production traffic because some existing routes may still contain legitimate but not-yet-migrated query shapes.

Temporary behavior:

- Development/test: hard-fail missing cooperative scope.
- Production: report-only mode. Missing scope is logged as a structured `QueryGuard` warning and the query is allowed to continue.

Target behavior:

- Development/test: hard-fail missing cooperative scope.
- Staging: hard-fail after two-cooperative seed data and route verification pass.
- Production phase 1: structured log and alert for missing cooperative scope.
- Production phase 2: hard-fail missing cooperative scope after an observation window.

Do not treat production report-only mode as final. It is a migration safety tool until route scoping is complete and the production warning stream has been reviewed.

## Query Guard Limitations

The guard detects query arguments that visibly include `cooperativeId`, including nested filters such as `document: { cooperativeId }`.

It does not prove full authorization by itself. It does not replace:

- `withTenantContext` for session-backed route authorization.
- `withCooperativeContext` for explicit background job scoping.
- RBAC permission checks.
- Cross-coop isolation tests.

The guard is a seatbelt, not the steering wheel.

## Next Guardrail Work

Recommended order:

1. Send production query guard findings to a durable audit/alert destination instead of `console.warn`.
2. Migrate high-risk route groups to `withTenantContext` / `withCooperativeContext`.
3. Add cross-coop isolation tests for imports, downloads, Drive roots, RAG, admin routes, and exports.
4. Add webhook/callback provider-auth documentation and implementation.
5. Add rate limits for expensive and bulk endpoints.

## Temporary Items To Resolve

- Replace query guard `console.warn` reporting with structured audit logging or an alert sink.
- Promote production query guard from report-only to hard-fail once route scoping is complete and staging has passed.
- Decide where provider identifiers live for webhook/callback cooperative lookup.
- Define staging seed policy with at least two cooperatives.
- Verify a second cooperative in staging before production onboarding.
