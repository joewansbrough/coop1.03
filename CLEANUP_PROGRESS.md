# Cleanup Progress & Roadmap

Tracking the migration and cleanup of the `coop1` repository into a production-ready multi-tenant application.

## Phase 1 — Dependency Cleanup (Completed)

### 1.1 Remove orphaned dependencies from package.json
Removed legacy dependencies inherited from the previous Vite + Express setup and updated necessary tools.

**Changes:**
- **Removed (Dependencies):**
    - `express`, `express-session`, `cookie-session`: Replaced by Next.js built-in API routes and `iron-session`.
    - `multer`: File uploads are being transitioned to `@vercel/blob` or Next.js native handling.
    - `@supabase/auth-helpers-nextjs`, `@supabase/ssr`: Auth is handled by `iron-session`.
    - `@tailwindcss/vite`: No longer using Vite; project uses Tailwind CSS v4 with Next.js.
    - `axios`: Replaced with native `fetch` in `app/auth/callback/route.ts` to reduce bundle size and leverage Next.js caching/fetch extensions.
- **Removed (Dev Dependencies):**
    - `vite`, `@vitejs/plugin-react`: Obsolete after migration to Next.js.
    - `@types/express`, `@types/express-session`, `@types/cookie-session`, `@types/multer`: No longer needed without the associated packages.
    - `@vercel/node`: Next.js handles deployment to Vercel natively.
- **Updated:**
    - `eslint-config-next`: Updated to `^15.0.0` to align with the intended Next.js version (despite `next` being at `^16.2.3` in `package.json`).
- **Validated:**
    - Ran `npm install` and `prisma generate` to ensure a clean state.

### 1.2 Delete orphaned files and folders
Removed debris from the Vite build system and old API structure.

**Changes:**
- **Deleted `dist/`**: Vite build artifact, irrelevant in Next.js.
- **Deleted `tmp/`**: Temporary/scratch files.
- **Deleted `utils/supabase/`**:
    - `server.ts`, `client.ts`, `middleware.ts`: These were using the deprecated `@supabase/ssr` package. Auth is now via `iron-session`.
- **Deleted `app/api/hello/`**: Scaffolding route.
- **Deleted `vercel.json`**: Contained Express-style rewrites (`api/index.ts`) that conflicted with Next.js App Router conventions.
- **Verified Absence**: `vite.config.ts` was confirmed as already removed.

---

## Phase 2 — Configuration Fixes (Completed)
*Goal: Align project configuration with Next.js App Router standards and verify environment integrity.*

**Changes:**
- **2.1 Verified `next.config.js`**: Cleaned up the configuration, ensuring no legacy Express or Vite references exist.
- **2.2 Updated `tsconfig.json`**:
    - Set `target` to `ES2017`.
    - Added `dom.iterable` and `esnext` to `lib`.
    - Set `jsx` to `preserve` for Next.js compatibility.
    - Verified `paths` alias `@/*` and added Next.js plugin.
    - Cleaned up `include` and `exclude` sections.
- **2.3 Verified Environment Variables**: Audit completed. The codebase expects the following variables:
    - `SESSION_SECRET`: Required (32+ chars) in `utils/session.ts`.
    - `API_KEY`: Required for Gemini AI in `utils/aiClient.ts` and API routes.
    - `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: Required for OAuth in `app/api/auth/url/route.ts` and callback.
    - `APP_URL`: Used for redirect URI construction.
    - `PICKER_API_KEY`: Referenced in `app/api/config/route.ts`.
    - *Note:* `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` were identified in `.env` examples but are no longer referenced in the active codebase after Phase 1 cleanup.

---

## Phase 3 — Multi-Tenant Foundation (Planned)
*Goal: Implement the core multi-tenant architecture by adding a `Cooperative` model and scoping all tenant-related data.*

**Work Summary:**
- **3.1 Add `Cooperative` model to `prisma/schema.prisma`**: Define the new entity for housing co-operatives.
- **3.2 Add `cooperativeId` to tenant-scoped models**:
    - Models: `Unit`, `Tenant`, `Announcement`, `Document`, `CoopEvent`, `Committee`, `MaintenanceRequest`, `ScheduledMaintenance`, `Transaction`.
    - Implementation: Add foreign key and relation after the `id` field.
- **3.3 Update `UserSession`**: Add `cooperativeId` to the session interface in `utils/session.ts`.
- **3.4 Database Migration**: Execute `prisma migrate dev` to apply changes.
- **3.5 Update Seed Script**: Modify `prisma/seed.ts` to create a default "Oak Bay Housing Co-op" and link all seeded data to it.

---

## Future Phases (Planned)

### Phase 4 — Database & Schema Refinement
*Goal: Ensure the Prisma schema supports multi-tenancy efficiently.*
- [ ] Audit `prisma/schema.prisma` for tenant relationships.
- [ ] Implement database migrations for required tenant fields.

### Phase 5 — UI & Feature Consolidation
*Goal: Polish the application and remove legacy flows.*
- [ ] Audit UI components for dead logic.
- [ ] Standardize layout and navigation across tenant scopes.
- [ ] Finalize production README and metadata.

---

## Verification Checklist
- [x] Dependencies rationalized.
- [x] Build artifacts and temporary files removed.
- [x] `npm install` runs without errors.
- [x] `prisma generate` runs successfully.
- [ ] `npm run lint` passes (Future task).
- [ ] `npm run build` passes (Future task).
