# Multi-Tenancy Phase 1 Notes

## Context Contracts

HTTP handlers should resolve the cooperative from the request host and authorize the signed-in user by active membership in that cooperative. Background jobs do not have a request host or session, so they must use an explicit cooperative context:

- `withTenantContext(req, callback)` is the target request-scoped pattern for tenant routes.
- `withCooperativeContext(db, cooperativeId, callback)` is for workers, imports, ingestion, exports, and cron jobs. The caller must validate the job record and cooperative ID before entering the context.

Tenant-scoped handlers should not trust a `cooperativeId` supplied by the browser.

## External Callbacks

Webhook and callback endpoints must sit outside the normal session/subdomain authorization flow. They authenticate with provider signatures or shared secrets, then look up cooperatives by internal identifiers such as billing customer ID or stored job ID. They must not infer cooperative access from the request host.

## Secrets

Production secrets live in Vercel environment variables or a future secrets manager, never in the repository. Staging and production secrets must be distinct. Rotate `ADMIN_API_KEY` when a team member with access leaves, and rotate encryption keys using versioned key variables if offline Google credentials are introduced.

## Staging

Staging should use a separate Supabase project with seed data for at least two cooperatives. Isolation, resolver, migration, and export checks must pass in staging before production deployment. A second real cooperative should be provisioned in staging before production.

## Restore And Deletion

Tenant export is data portability, not disaster recovery. Phase 1 keeps destructive operations cooperative-scoped; the next recovery step should add `deletedAt` soft-delete fields to tenant-scoped records before broad cancellation/deletion workflows are enabled. Until then, hard-delete routes remain admin-only and cooperative-scoped.

## Rate Limits

AI budgets are a later phase, but expensive non-AI routes should also be rate-limited before the second client. Priority endpoints are document upload/ingestion, onboarding import, export job creation, and AI routes.
