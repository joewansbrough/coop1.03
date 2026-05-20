# Antigravity Self-Improvement Lessons Learned

## Lesson 1: Keep Planning Documents and Code State in Sync
- **Issue**: After completing Phase 2 code changes and staging a commit/push, the main implementation plan (`docs/multi-tenancy/implementation-plan.md`) was left out-of-sync, with Phase 2 items unchecked and pointing to a stale commit hash (`a567bb2` instead of `8c1b754`).
- **Correction Pattern**: Whenever completing a development phase and pushing changes, always update the overarching planning documents (like `docs/multi-tenancy/implementation-plan.md`) alongside local tasks (`tasks/todo.md`), marking them as completed and updating the HEAD commit hash references.
- **Rule**: Before initiating a git push of a milestone, check all design, architecture, and phase planning files to verify their completion checkboxes and commit hashes correspond directly to the code's actual HEAD state.

## Lesson 2: Explicitly Document Static vs. Runtime Verification Caveats
- **Issue**: The Phase 2 integration test suite relies on static analysis / AST source-code checks to bypass local environment PostgreSQL connection limitations. Treating these as direct runtime logical isolation proofs without qualifying caveats is misleading.
- **Correction Pattern**: Always draw a clear distinction between compilation/static checks and runtime/E2E test verification in implementation docs. Add an explicit "Evidence / Caveats" section to clearly document what is validated via source-code analysis vs what is verified against running services.
- **Rule**: When db/API tests rely on static analysis, document this boundary directly in the planning artifact and main implementation plan with a "Verification Caveats" section.
