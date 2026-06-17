# Google Workspace Integration

## Goal
Make Google Workspace the collaboration layer for BC housing co-ops while coopHUB remains the governance, permissions, audit, and AI-search system of record.

## Current Slice
- Admin status page: `/admin/google-workspace`
- Read-only status API: `/api/integrations/google-workspace/status`
- Workspace settings API: `/api/integrations/google-workspace/settings`
- Event Calendar sync API: `/api/events/:id/google-calendar/sync`
- Shared Workspace capability/readiness model: `utils/googleWorkspace.ts`
- Calendar payload builder and sync service: `utils/googleCalendar.ts`, `services/googleCalendar.ts`
- Focused tests: `tests/googleWorkspace.test.ts`, `tests/googleCalendar.test.ts`

## Calendar And Meet Integration
- Configure `calendarId` and `timeZone` in `Cooperative.settings.googleWorkspace` from `/admin/google-workspace`.
- Enable the Calendar sync lane before syncing events.
- On `/calendar`, admins can create a new event and check **Create Google Meet link**. coopHUB saves the event first, then syncs it to Google Calendar and persists the returned Meet link.
- Use the event detail action, **Sync Google Calendar**, to create or update the Google Calendar event.
- The sync service searches by Google Calendar private extended property `coopHubEventId=<eventId>` so repeated syncs update the same event.
- The Google payload requests a Google Meet link using `conferenceData.createRequest`.
- Successful real syncs persist `googleCalendarId`, `googleCalendarEventId`, `googleCalendarHtmlLink`, `googleMeetLink`, and `googleCalendarSyncedAt` on `CoopEvent`.
- Event detail pages show persisted Google Meet and Calendar links after sync and after reload.
- Real sync requires `GOOGLE_SERVICE_ACCOUNT_JSON` with Calendar event scope access and the target Google Calendar shared with the service account.
- `POST /api/events/:id/google-calendar/sync` accepts `{ "dryRun": true }` to return the Google payload without writing to Calendar.

## Drive Minutes Archive Integration
- Configure `minutesArchiveFolderId` in `/admin/google-workspace`.
- Finalized meeting minutes now include an admin **Archive to Drive** action.
- The action generates the minutes PDF, uploads it into the configured Google Drive folder, and records the file as a Google Drive-backed coopHUB document.
- The archive uses the stable tag `minutes-meeting:<meetingId>` so later archives replace/update the same minutes document in coopHUB.
- Real upload requires `GOOGLE_SERVICE_ACCOUNT_JSON` with Drive file write access and the target archive folder shared with the service account.

## Build Plan
1. Workspace profile and settings
   - Save domain, admin email, Drive root IDs, and planned sync toggles into `Cooperative.settings.googleWorkspace`.
   - Preserve unrelated `Cooperative.settings` keys when updating Workspace settings.
2. Drive knowledge hub
   - Continue using configured co-op Drive roots for browsing and RAG ingestion.
   - Add clearer folder-to-visibility mapping before any write-capable Drive operations.
3. Directory and Groups
   - Sync Google Workspace users and Google Groups into coopHUB users, groups, and memberships.
   - Keep manual memberships intact and mark synced memberships with `MembershipSource.GOOGLE_SYNC`.
4. Calendar and Meet
   - Add event mapping and sync status before creating or updating Google Calendar events.
   - Attach Meet links and archive minutes back to Drive once event sync is stable.
5. Communications and Forms
   - Route announcements through Gmail or Google Groups only after audit and opt-out rules are explicit.
   - Import reviewed Forms/Sheets rows into waitlist, maintenance, events, and attendance workflows.

## Implementation Log
- 2026-06-16: Created Workspace status foundation, admin page, read-only API, RBAC keys, and focused tests.
- 2026-06-16: Added settings merge helper, admin save API, audit logging, and editable Workspace configuration UI.
- 2026-06-16: Added Google Calendar event payload builder, Calendar/Meet sync service, admin event sync endpoint, and event detail sync action.
- 2026-06-16: Added Calendar sync persistence fields, migration, metadata mapper, and Event Detail Google Workspace link display.
- 2026-06-16: Added visible event creation flow for Google Meet links and Meet badges/links on calendar surfaces.
- 2026-06-16: Added Google Drive minutes archive helper, write-capable Drive upload service, API endpoint, Workspace archive folder setting, and finalized-minutes archive action.

## Verification
- `npx tsx tests/googleWorkspace.test.ts`
- `npx tsx tests/googleCalendar.test.ts`
- `npx tsx tests/googleDriveMinutesArchive.test.ts`
- `npm run lint`
- `npm run build`

## Notes
- On Windows, `npm run build` can fail during `prisma generate` if a local `npm run dev` / `tsx server.ts` process is holding `node_modules/.prisma/client/query_engine-windows.dll.node`. Stop the local dev-server process and rerun the build.
