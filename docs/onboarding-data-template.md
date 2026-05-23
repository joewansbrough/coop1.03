# Full Onboarding Data Template

The full onboarding template is available to administrators at:

- `GET /api/onboarding/import-template`
- UI entry points: Onboarding setup page and the member import panel
- Download filename: `coophub-full-onboarding-template.csv`

## Purpose

This template is the single data-gathering worksheet for a new co-op workspace. It is intentionally broader than the current member import CSV so an administrator can collect every category of site data before the automated multi-entity importer exists.

The current automated importer still supports only the tenant/member CSV from `GET /api/tenants/import-template`. That narrower file must remain stable because it is used by the member preview and confirm flow.

## Record Types

Each row uses `recordType` to describe the kind of site data represented by the row.

- `unit`: physical unit inventory.
- `member`: tenant/member contact, role, status, and unit assignment data.
- `committee`: committee spaces and chairs.
- `committeeMembership`: member-to-committee assignments and committee roles.
- `roleAssignment`: app-level roles such as `ADMIN`, `BOARD`, or `MEMBER`.
- `document`: document metadata, links, tags, and visibility.
- `event`: meetings, committee events, and calendar entries.
- `announcement`: announcements and notices.
- `maintenanceRequest`: initial maintenance backlog or known open requests.

## Import Status

Supported today:

- Downloading the full onboarding template for data collection.
- Downloading and importing the existing tenant/member CSV.
- Validating member rows before confirm.

Temporary gap:

- The full onboarding template is not yet accepted by an automated multi-entity import endpoint. It is a prepared schema for the next onboarding phase, so implementation notes stay visible instead of living only in conversation history.

Next implementation step:

- Add a multi-entity preview endpoint that validates record groups in dependency order: units, members, committees, committee memberships, roles, documents, events, announcements, then maintenance requests.
