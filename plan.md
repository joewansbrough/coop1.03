# Plan for converting repo into a live housing-association service

## Goals
- Migrate the existing codebase toward a polished live site we can sell as a service to housing associations across BC.
- Optimize for security, build/test hygiene, and UI clarity before trimming unused features.
- Document the cleanup plan so no deletions happen without your approval.

## Steps
1. **Security pass**
   - Review authentication/authorization setup (Supabase auth helpers, Express middleware, session storage).
   - Ensure environment handling, secret management, and Prisma/client queries avoid leaks or injection risks.
   - Document any risky dependencies or misconfigurations that would need hardening before launch.
2. **Build/test pass**
   - Reproduce and fix any lint/type errors (`next lint`, `tsc`, `npm run build`) and ensure `prisma generate` runs cleanly.
   - Remove unused scripts, CLI helpers, and redundant configs (e.g., duplicate env files) that slow developer onboarding.
   - Rationalize dependencies and devDependencies by verifying import usage and dropping what’s not needed for the service offering.
3. **Frontend/UI pass**
   - Audit UI components/pages to identify dead flows or overly complex interactions that aren’t part of the MVP.
   - Consolidate styling and layout logic where possible (e.g., repeated utility classes, unused assets).
   - Validate Next/React routing and accessibility concerns that could hurt the customer-facing experience.
4. **Cleanup execution**
   - After we review the findings together, delete unused features/modules in a single coordinated effort.
   - Update docs (README, metadata) to reflect the production-ready intent, including service positioning for housing associations.
   - Add or adjust automated checks (lint, type, test) so the repo stays clean going forward.

## Verification
- Run `npm run lint`, `npm run build`, and any targeted tests or scripts post-cleanup.
- Confirm the site still launches (`next dev` or `next start`) with the optimized set of features.

## Constraints
- No deletions or major rewrites happen until you approve this plan.
- If any step risks breaking data contracts, I’ll pause and highlight the dependency for your direction.
