# PRD: Native Role-Based Security + Optional Google Workspace Integration for coopHUB

**Product:** coopHUB  
**Document type:** Product Requirements Document  
**Status:** Draft for implementation planning  
**Date:** 2026-05-14  
**Primary objective:** Build native role-based security into coopHUB, with Google Workspace integrations as optional enhancements for Drive-backed document storage, calendar sync, and official email sending.

---

## 1. Executive Summary

coopHUB needs a native role-based access control system that allows members, board members, committee members, committee chairs, administrators, and limited external users to securely access different parts of the platform.

Google Workspace should be treated as an optional enhancement layer, not a dependency. Members should be able to use any email address. Google Workspace integrations should add value for calendar sync, official email notices, and Shared Drive-based document storage, but coopHUB should remain the source of truth for users, roles, permissions, document visibility, and audit trails.

The ideal document model is:

> Documents may be stored in Google Drive, Vercel Blob, or another provider, but coopHUB controls who can see them.

The most important product requirement is role-restricted document access. A Drive-backed document should appear in coopHUB only when the current user has permission to view it.

---

## 2. Goals

### 2.1 Primary Goals

1. Allow users to log into coopHUB with any email address.
2. Support native groups and permissions inside coopHUB.
3. Restrict pages, actions, documents, events, and workflows by role.
4. Allow users to belong to multiple groups.
5. Support document visibility by role, committee, group, and individual exception.
6. Add auditable access logs for sensitive actions.
7. Allow optional Google Workspace integrations:
   - Google Drive / Shared Drive storage
   - Google Calendar sync
   - Gmail email sending
   - Optional Google Groups sync in a later phase

### 2.2 Non-Goals for First Release

1. Do not require Google accounts for members.
2. Do not make Google Workspace the primary identity provider.
3. Do not use Google Groups as the sole source of app authorization.
4. Do not build a full Google Admin console replacement.
5. Do not attempt complex nested Google Group sync in the first version.
6. Do not expose raw Drive links unless coopHUB has already authorized the user.

---

## 3. Product Principles

### 3.1 coopHUB Owns Authorization

Google can store files, send emails, and sync calendars, but coopHUB decides:

```txt
Who is this user?
What groups do they belong to?
What permissions do they have?
Can they view this document?
Can they edit this event?
Can they assign this maintenance request?
```

### 3.2 Google Workspace Is Optional

A co-op should be able to run coopHUB with native login, native roles, native document permissions, native events, and native notices. If the co-op connects Google Workspace, coopHUB can enhance the experience with Shared Drive file storage, Google Calendar sync, Gmail delivery, Google Meet links, and optional Google Group sync.

### 3.3 Users Should Not Need New Gmail Accounts

Tenants and members should be able to use personal emails such as Gmail, Hotmail, iCloud, Shaw, Outlook, or custom personal domains. Google Workspace accounts should be optional for official co-op roles like `chair@coopdomain.ca`, `treasurer@coopdomain.ca`, `maintenance@coopdomain.ca`, and `secretary@coopdomain.ca`.

---

## 4. Target Users

### Tenant / Member

Needs to view member-facing documents, announcements, events, unit-specific information, submit maintenance requests, receive notices by email, and use a personal email address.

### Board Member

Needs to view board documents, board calendar, meeting packages, motions/minutes, committee reports, and potentially confidential documents.

### Committee Member

Needs access to committee-specific documents, events, workflows, and notices.

### Committee Chair

Needs elevated committee permissions: assign work, approve items, manage committee membership where permitted, upload committee documents, and create committee events.

### Admin

Needs to manage users, groups, permissions, integrations, audit logs, documents, and access overrides.

### Contractor / External User

Needs access only to specific requests, documents, or tasks, usually with time-limited permissions.

---

## 5. Current-State Observations

Existing schema foundations:

| Existing Item | Current Usefulness |
|---|---|
| `Tenant.email` | Can become the login identity anchor |
| `Tenant.role` | Useful short-term, but too simple long-term |
| `Committee` model | Can map naturally to groups |
| `DocumentVisibility` enum | Good starting point for document restrictions |
| `Document.committeeAccess` | Can support committee-level document access |
| `DocumentVersion` | Useful for Drive/blob-backed versioning |
| `DocumentAccessLog` | Strong foundation for auditability |
| `CoopEvent.committeeId` | Useful for committee-scoped calendar access |

The existing `Tenant.role` field should not be the long-term authorization model because one person may be a tenant, board member, committee member, and committee chair at the same time.

The existing document model appears to be a strong candidate for role-restricted document views because it already tracks visibility, committee access, document versions, ingestion jobs, chunks, and access logs.

---

## 6. Proposed Solution

### 6.1 Native coopHUB RBAC

Build a native permissions system around:

```txt
User
Group
Membership
Permission
GroupPermission
UserPermissionOverride
AuditLog
```

This replaces the idea of one user having one static role. A user can belong to multiple groups, for example: Tenant, Board, Maintenance Committee, and Maintenance Chair. The final permission set is calculated from all active memberships.

### 6.2 Optional Google Workspace Integration

Google Workspace should be connected at the co-op level, not required globally.

Recommended priority:

1. Google Drive / Shared Drive storage
2. Google Calendar sync
3. Gmail sending
4. Google Groups / Admin Directory sync

---

## 7. Core Feature Requirements

## Epic 1: Authentication

### Objective

Allow users to securely sign into coopHUB using any email address.

### Requirements

| ID | Requirement | Priority |
|---|---|---|
| AUTH-001 | Users can sign in with email/password or magic link. | P0 |
| AUTH-002 | User email must be unique within the cooperative. | P0 |
| AUTH-003 | Users do not need a Gmail account. | P0 |
| AUTH-004 | Optional Google sign-in may be supported, but only as a login convenience. | P1 |
| AUTH-005 | Suspended/inactive users cannot access protected areas. | P0 |
| AUTH-006 | Admins can reset or revoke user sessions. | P1 |
| AUTH-007 | Failed login attempts should be rate-limited. | P0 |
| AUTH-008 | Authentication events should be logged. | P1 |

### Acceptance Criteria

- A member with `joe@hotmail.com` can log in.
- A member with `alex@gmail.com` can log in.
- A board member with `chair@coopdomain.ca` can log in.
- Google login is not required.
- Inactive users cannot access protected routes.
- Authentication does not grant permissions by itself; permissions come from coopHUB memberships.

---

## Epic 2: Users, Groups, and Memberships

### Objective

Replace the single-role model with flexible many-to-many membership.

### Recommended Groups

```txt
Tenant / Member
Board
Board Chair
Admin
Maintenance Committee
Maintenance Chair
Finance Committee
Treasurer
Membership Committee
Membership Chair
Governance Committee
Governance Chair
Communications Committee
Contractor
Auditor / Read-only Reviewer
```

### Requirements

| ID | Requirement | Priority |
|---|---|---|
| RBAC-001 | Admins can create groups. | P0 |
| RBAC-002 | Admins can assign users to one or more groups. | P0 |
| RBAC-003 | A user can belong to multiple groups. | P0 |
| RBAC-004 | A group can be marked as system-defined or custom. | P1 |
| RBAC-005 | Groups can be scoped to a cooperative. | P0 |
| RBAC-006 | Groups can optionally be linked to a committee. | P0 |
| RBAC-007 | Memberships can have start and end dates. | P1 |
| RBAC-008 | Memberships can be active or inactive. | P0 |
| RBAC-009 | Admins can view a user's effective permissions. | P0 |
| RBAC-010 | Admins can view why a user has a permission. | P1 |

### Acceptance Criteria

- A user can be both `Tenant` and `Board`.
- A user can be both `Maintenance Committee` and `Maintenance Chair`.
- Removing a user from `Board` removes board document access.
- Adding a user to `Finance Committee` grants finance document access if mapped.
- Admin can see that Alex has `documents.board.view` because Alex belongs to `Board`.

---

## Epic 3: Permissions

### Objective

Create a clear permission system that controls both page visibility and action-level access.

### Recommended Permission Keys

```txt
documents.view.public
documents.view.members
documents.view.board
documents.view.admin
documents.view.committee
documents.create
documents.update
documents.archive
documents.delete
documents.manage_visibility

events.view.members
events.view.board
events.view.committee
events.create
events.update
events.delete
events.sync_google

maintenance.requests.create
maintenance.requests.view_own
maintenance.requests.view_all
maintenance.requests.assign
maintenance.requests.update_status
maintenance.requests.close

users.view
users.create
users.update
users.deactivate
users.manage_groups

settings.view
settings.update
integrations.google.configure
audit.view
```

### Requirements

| ID | Requirement | Priority |
|---|---|---|
| PERM-001 | Permissions are stored in the database. | P0 |
| PERM-002 | Groups can be assigned permissions. | P0 |
| PERM-003 | Effective permissions are calculated from all active memberships. | P0 |
| PERM-004 | Admins can view permission assignments. | P0 |
| PERM-005 | Admins can edit group permissions. | P1 |
| PERM-006 | System-critical permissions require confirmation before changes. | P1 |
| PERM-007 | Permission checks must exist on both frontend and backend. | P0 |
| PERM-008 | Backend permission checks are authoritative. | P0 |
| PERM-009 | User-specific overrides are supported for exceptions. | P2 |
| PERM-010 | Permission changes are audit logged. | P0 |

### Acceptance Criteria

- Hiding a menu item in the UI is not considered sufficient security.
- A user without `documents.view.board` cannot fetch board docs by direct API call.
- A user without `users.manage_groups` cannot add themselves to another group.
- Permission changes appear in audit logs.

---

## Epic 4: Role-Restricted Document Views

### Objective

Allow documents to be visible only to authorized users based on role, committee, group, or explicit access rule. This is the highest-value feature in the PRD.

### Document Visibility Model

Use a layered model:

```txt
PUBLIC
MEMBERS
BOARD
ADMIN
COMMITTEE
CUSTOM
PRIVATE
```

Existing values already include `PUBLIC`, `MEMBERS`, `COMMITTEE`, `BOARD`, and `ADMIN`. Recommended additions are `CUSTOM` and `PRIVATE`.

### Recommended Visibility Rules

| Visibility | Who Can Access |
|---|---|
| `PUBLIC` | Anyone, possibly unauthenticated |
| `MEMBERS` | Any active tenant/member |
| `BOARD` | Board and Admin |
| `ADMIN` | Admin only |
| `COMMITTEE` | Members of the linked committee/group |
| `CUSTOM` | Users/groups explicitly granted access |
| `PRIVATE` | Owner/uploader/admin only |

### Requirements

| ID | Requirement | Priority |
|---|---|---|
| DOC-001 | Documents have a visibility level. | P0 |
| DOC-002 | Documents can be linked to one or more groups. | P0 |
| DOC-003 | Documents can be linked to one or more committees. | P0 |
| DOC-004 | Documents can be linked to individual users as exceptions. | P1 |
| DOC-005 | Users only see documents they are authorized to view. | P0 |
| DOC-006 | Unauthorized direct API access is rejected. | P0 |
| DOC-007 | Document downloads/views are logged. | P0 |
| DOC-008 | Admins can preview document access as a specific user. | P1 |
| DOC-009 | Admins can explain who can see this document and why. | P1 |
| DOC-010 | Archived/superseded documents remain permission-restricted. | P0 |
| DOC-011 | Document search only returns authorized documents. | P0 |
| DOC-012 | Policy assistant / AI retrieval only retrieves authorized chunks. | P0 |

### Document Access Examples

#### Member Handbook

```txt
Visibility: MEMBERS
Accessible by:
- Tenant / Member
- Board
- Admin
```

#### Board Minutes Draft

```txt
Visibility: BOARD
Accessible by:
- Board
- Admin
```

#### Maintenance Inspection Template

```txt
Visibility: COMMITTEE
Committee/group:
- Maintenance Committee
Accessible by:
- Maintenance Committee
- Maintenance Chair
- Admin
```

#### Finance Report

```txt
Visibility: CUSTOM
Groups:
- Finance Committee
- Treasurer
- Admin
```

#### In-Camera Board Document

```txt
Visibility: CUSTOM
Groups:
- Board Chair
- Admin
Optional explicit users:
- Selected board members
```

### Acceptance Criteria

- Tenant users cannot see board documents.
- Board users can see board documents but not necessarily admin-only documents.
- Maintenance Committee users can see maintenance documents but not finance documents.
- Finance Committee users can see finance documents but not maintenance documents unless separately granted.
- Search results exclude unauthorized documents.
- AI answers do not cite or summarize unauthorized document chunks.
- Every view/download creates a `DocumentAccessLog` entry.

---

## Epic 5: Document Storage Providers

### Objective

Allow coopHUB to support multiple storage backends while keeping authorization inside coopHUB.

### Supported Storage Providers

```txt
LOCAL / existing URL
VERCEL_BLOB
GOOGLE_DRIVE
EXTERNAL_LINK
```

### Requirements

| ID | Requirement | Priority |
|---|---|---|
| STORE-001 | Documents can identify their storage provider. | P0 |
| STORE-002 | Google Drive file ID can be stored separately from public URL. | P0 |
| STORE-003 | Direct Google Drive links are not exposed unless access is authorized. | P0 |
| STORE-004 | coopHUB can generate controlled view/download links. | P0 |
| STORE-005 | File metadata sync includes name, MIME type, size, modified time, and web view link. | P1 |
| STORE-006 | Admin can map a Google Drive folder to a coopHUB category/group. | P1 |
| STORE-007 | Documents can be imported from Drive into coopHUB metadata. | P1 |
| STORE-008 | Drive files can remain physically stored in Drive. | P0 |

### Recommended Schema Additions

```prisma
enum StorageProvider {
  LOCAL
  VERCEL_BLOB
  GOOGLE_DRIVE
  EXTERNAL_LINK
}

model Document {
  // existing fields...

  storageProvider StorageProvider @default(EXTERNAL_LINK)
  sourceExternalId String? // Google Drive file ID, blob key, etc.
  sourceFolderId   String?
  sourceWebUrl     String?
  sourceMimeType   String?
  sourceModifiedAt DateTime?
}
```

Provider-specific storage data may live on `Document`, `DocumentVersion`, or both.

---

## Epic 6: Google Drive / Shared Drive Integration

### Objective

Allow co-ops to store documents in Google Drive or Shared Drives while coopHUB controls visibility.

### Requirements

| ID | Requirement | Priority |
|---|---|---|
| GDRIVE-001 | Admin can enable Google Drive integration per cooperative. | P1 |
| GDRIVE-002 | Admin can configure root folder or Shared Drive ID. | P1 |
| GDRIVE-003 | coopHUB can list folders/files under the configured root. | P1 |
| GDRIVE-004 | Admin can import selected Drive files into coopHUB. | P1 |
| GDRIVE-005 | Imported Drive files get coopHUB visibility rules. | P1 |
| GDRIVE-006 | coopHUB stores Drive file ID, name, MIME type, size, modified time, and webViewLink. | P1 |
| GDRIVE-007 | coopHUB can sync metadata periodically or manually. | P2 |
| GDRIVE-008 | coopHUB can map Drive folders to default document categories/groups. | P2 |
| GDRIVE-009 | coopHUB should not automatically expose every Drive file to members. | P0 |
| GDRIVE-010 | Drive integration errors should be visible to admins. | P1 |

### Recommended Folder Mappings

| Drive Folder | Default coopHUB Category | Default Visibility |
|---|---|---|
| `/Policies` | Policies | MEMBERS |
| `/Forms` | Forms | MEMBERS |
| `/Board` | Board | BOARD |
| `/Board/In Camera` | Confidential Board | CUSTOM |
| `/Maintenance` | Maintenance | COMMITTEE: Maintenance |
| `/Finance` | Finance | COMMITTEE: Finance |
| `/Governance` | Governance | COMMITTEE: Governance |
| `/AGM` | AGM | MEMBERS |

### Drive Permission Strategy

#### Option A: coopHUB-Controlled Proxy Access

Drive files are stored in Drive, but users access them through coopHUB.

```txt
User clicks document
→ coopHUB checks permissions
→ coopHUB retrieves/redirects/previews file
→ access is logged
```

Pros:

- Best security model for coopHUB.
- Members do not need Google accounts.
- Works with any email address.
- Centralized audit trail.
- Easier to hide raw Drive structure.

Cons:

- More backend work.
- Need to handle file streaming/preview carefully.

#### Option B: Google Drive Native Sharing

Drive folders/files are shared directly with users or Google Groups.

Pros:

- Easy for Google-heavy co-ops.
- Drive handles access.
- Great for board/admin collaboration.

Cons:

- Members may need Google accounts.
- Sharing can drift outside coopHUB.
- Harder to guarantee audit consistency.
- More confusing for regular tenants.

### Recommended Approach

Use Option A for member-facing document views. Use Option B only for internal board/admin collaboration.

```txt
Tenants: use coopHUB, any email, no Drive complexity.
Board/Admin: optionally collaborate directly in Drive.
```

---

## Epic 7: Calendar Integration

### Objective

Allow coopHUB events to optionally sync to Google Calendar.

### Requirements

| ID | Requirement | Priority |
|---|---|---|
| GCAL-001 | Admin can enable Google Calendar integration per cooperative. | P2 |
| GCAL-002 | Admin can configure default calendar IDs. | P2 |
| GCAL-003 | coopHUB events can be synced to Google Calendar. | P2 |
| GCAL-004 | Synced events store Google Calendar event ID. | P2 |
| GCAL-005 | Updates in coopHUB update Google Calendar event. | P2 |
| GCAL-006 | Deleting/canceling coopHUB event updates Google Calendar appropriately. | P2 |
| GCAL-007 | Committee events can sync to committee-specific calendars. | P2 |
| GCAL-008 | Board events can sync to a board calendar. | P2 |
| GCAL-009 | Member events can sync to a general members calendar. | P2 |
| GCAL-010 | Google Meet link can optionally be created for events. | P2 |

### Recommended Calendar Mapping

| coopHUB Event Type | Google Calendar |
|---|---|
| General member event | Members calendar |
| Board meeting | Board calendar |
| Maintenance Committee event | Maintenance calendar |
| Finance Committee event | Finance calendar |
| AGM | Members calendar + Board calendar |
| Inspection | Maintenance calendar, optionally unit-specific visibility in coopHUB |

---

## Epic 8: Gmail / Official Email Integration

### Objective

Allow coopHUB to send official notices through a configured co-op Gmail/Workspace account.

### Requirements

| ID | Requirement | Priority |
|---|---|---|
| GMAIL-001 | Admin can enable Gmail integration per cooperative. | P2 |
| GMAIL-002 | Admin can configure sender identity. | P2 |
| GMAIL-003 | coopHUB can send official notices to selected users/groups. | P2 |
| GMAIL-004 | coopHUB stores email send status. | P2 |
| GMAIL-005 | Failed email sends are visible to admins. | P2 |
| GMAIL-006 | Admin can send test email. | P2 |
| GMAIL-007 | Sensitive notices require preview/confirmation before send. | P1 |
| GMAIL-008 | Email body can include links back to authorized coopHUB documents/events. | P2 |

### Recommended Email Use Cases

```txt
New document published
Board meeting reminder
AGM notice
Maintenance request update
Inspection scheduled
Committee task assigned
User added to committee
Password/magic link login
```

---

## Epic 9: Optional Google Groups / Admin Directory Sync

### Objective

Allow advanced co-ops to sync selected coopHUB groups to Google Groups. This should not be first-release functionality, but the data model should be ready for it.

### Requirements

| ID | Requirement | Priority |
|---|---|---|
| GGROUP-001 | Admin can link a coopHUB group to a Google Group. | P3 |
| GGROUP-002 | coopHUB stores Google Group unique ID. | P3 |
| GGROUP-003 | coopHUB can push membership changes to Google Group. | P3 |
| GGROUP-004 | coopHUB can pull membership changes from Google Group. | P3 |
| GGROUP-005 | Admin can choose sync direction: coopHUB → Google, Google → coopHUB, or manual. | P3 |
| GGROUP-006 | Sync conflicts are logged and reviewable. | P3 |
| GGROUP-007 | Group sync never overrides Admin access without confirmation. | P3 |

---

## 8. Recommended Data Model

### 8.1 New Core Models

```prisma
model User {
  id              String   @id @default(uuid())
  cooperativeId   String
  email           String
  name            String?
  firstName       String?
  lastName        String?
  isActive        Boolean  @default(true)
  lastLoginAt     DateTime?
  tenantId        String?
  googleSubjectId String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  memberships     Membership[]
  accessOverrides UserPermissionOverride[]
  auditLogs        AuditLog[]

  @@unique([cooperativeId, email])
  @@index([cooperativeId])
  @@index([email])
}

model Group {
  id               String   @id @default(uuid())
  cooperativeId    String
  name             String
  slug             String
  description      String?
  type             GroupType
  isSystem         Boolean  @default(false)
  committeeId      String?
  googleGroupId    String?
  googleGroupEmail String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  memberships      Membership[]
  permissions      GroupPermission[]
  documentRules    DocumentAccessRule[]

  @@unique([cooperativeId, slug])
  @@index([cooperativeId])
}

enum GroupType {
  SYSTEM
  BOARD
  COMMITTEE
  CHAIR
  ADMIN
  MEMBER
  CONTRACTOR
  CUSTOM
}

model Membership {
  id            String   @id @default(uuid())
  cooperativeId String
  userId        String
  groupId       String
  source        MembershipSource @default(MANUAL)
  startsAt      DateTime?
  endsAt        DateTime?
  isActive      Boolean @default(true)
  createdBy     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  group         Group @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([userId, groupId])
  @@index([cooperativeId])
  @@index([groupId])
}

enum MembershipSource {
  MANUAL
  GOOGLE_SYNC
  SYSTEM
  IMPORT
}

model Permission {
  id          String   @id @default(uuid())
  key         String   @unique
  name        String
  description String?
  category    String
  isSystem    Boolean @default(true)

  groups      GroupPermission[]
}

model GroupPermission {
  id            String @id @default(uuid())
  groupId       String
  permissionId  String
  createdAt     DateTime @default(now())

  group         Group      @relation(fields: [groupId], references: [id], onDelete: Cascade)
  permission    Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@unique([groupId, permissionId])
}

model UserPermissionOverride {
  id            String @id @default(uuid())
  cooperativeId String
  userId        String
  permissionId  String
  effect        PermissionEffect
  reason        String?
  expiresAt     DateTime?
  createdBy     String?
  createdAt     DateTime @default(now())

  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  permission    Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@index([cooperativeId])
  @@index([userId])
}

enum PermissionEffect {
  ALLOW
  DENY
}
```

### 8.2 Document Access Rules

```prisma
model DocumentAccessRule {
  id            String @id @default(uuid())
  cooperativeId String
  documentId    String
  groupId       String?
  userId        String?
  permission    DocumentAccessLevel
  createdBy     String?
  createdAt     DateTime @default(now())

  document      Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  group         Group?   @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user          User?    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([cooperativeId])
  @@index([documentId])
  @@index([groupId])
  @@index([userId])
}

enum DocumentAccessLevel {
  VIEW
  COMMENT
  EDIT
  MANAGE
}
```

### 8.3 Integration Settings

```prisma
model IntegrationConnection {
  id             String @id @default(uuid())
  cooperativeId  String
  provider       IntegrationProvider
  status         IntegrationStatus @default(DISABLED)
  config         Json
  credentialsRef String?
  lastSyncAt     DateTime?
  lastError      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([cooperativeId, provider])
}

enum IntegrationProvider {
  GOOGLE_DRIVE
  GOOGLE_CALENDAR
  GMAIL
  GOOGLE_DIRECTORY
}

enum IntegrationStatus {
  DISABLED
  ENABLED
  ERROR
  NEEDS_REAUTH
}
```

### 8.4 Audit Logging

```prisma
model AuditLog {
  id            String @id @default(uuid())
  cooperativeId String
  actorUserId   String?
  action        String
  entityType    String
  entityId      String?
  before        Json?
  after         Json?
  ipAddress     String?
  userAgent     String?
  createdAt     DateTime @default(now())

  actor         User? @relation(fields: [actorUserId], references: [id])

  @@index([cooperativeId])
  @@index([actorUserId])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

---

## 9. Backend Authorization Design

Every protected backend route should use a permission helper:

```ts
await requirePermission(req.user, "documents.view.board");
```

For document-specific checks:

```ts
await requireDocumentAccess(req.user, documentId, "VIEW");
```

### Document Access Algorithm

```txt
1. Load current user.
2. Load active memberships.
3. Load user permissions.
4. Load document metadata.
5. Check document status.
6. Evaluate visibility:
   - PUBLIC
   - MEMBERS
   - BOARD
   - ADMIN
   - COMMITTEE
   - CUSTOM
   - PRIVATE
7. Evaluate explicit document access rules.
8. Apply deny overrides.
9. Return allow/deny.
10. Log successful view/download.
```

Frontend checks are for user experience only. Backend checks are the actual security boundary.

---

## 10. Frontend Requirements

### Navigation

| Menu Item | Required Permission |
|---|---|
| Admin | `settings.view` or `users.view` |
| Documents | `documents.view.members` |
| Board Documents | `documents.view.board` |
| Maintenance | `maintenance.requests.view_all` |
| Users | `users.view` |
| Integrations | `integrations.google.configure` |
| Audit Logs | `audit.view` |

### Document Library UI

Document list should support search, category filter, visibility filter, committee filter, status filter, storage provider filter, tags, review date, and effective date.

Each document card/table row should show title, category, visibility badge, committee/group access, status, storage provider, last updated, and review date.

Admin-only view should show who can see the document, access rules, storage source, sync status, and access logs.

### User Management UI

Admin can create users, deactivate users, assign groups, remove groups, view effective permissions, preview document access, and view audit history.

### Group Management UI

Admin can create groups, edit groups, assign permissions, link a group to a committee, link a group to a Google Group later, view members, and view documents accessible to the group.

---

## 11. Integration Admin UI

### Google Drive Settings

Fields:

```txt
Enabled / Disabled
Authentication status
Root folder ID
Shared Drive ID
Default import visibility
Folder mappings
Last sync time
Last sync error
Test connection button
Sync now button
```

### Google Calendar Settings

Fields:

```txt
Enabled / Disabled
Default member calendar ID
Board calendar ID
Committee calendar mappings
Create Meet links: yes/no
Sync direction: coopHUB → Google initially
Last sync status
```

### Gmail Settings

Fields:

```txt
Enabled / Disabled
Sender email
Sender display name
Reply-to email
Test email recipient
Send test button
Last send status
```

---

## 12. Phased Implementation Plan

### Phase 1: Native RBAC Foundation

Deliverables:

```txt
User model
Group model
Membership model
Permission model
GroupPermission model
Basic audit log
Seed default groups
Seed default permissions
Backend requirePermission helper
Admin group assignment UI
```

Outcome:

- Users can belong to multiple groups.
- Backend can enforce permissions.
- Admin can manage group membership.

### Phase 2: Role-Restricted Document Library

Deliverables:

```txt
DocumentAccessRule model
Document access helper
Document list filtering by authorization
Document detail authorization
Download/view authorization
Document access logs
Admin “who can see this?” panel
Search restricted by permissions
```

Outcome:

- Documents are safely restricted by role/group/committee.
- Existing `DocumentVisibility` becomes enforceable, not just descriptive.

### Phase 3: Google Drive Storage Integration

Deliverables:

```txt
Google Drive connection settings
Root folder configuration
Drive folder browser
Import Drive file as coopHUB document
Store Drive metadata
Role-restricted Drive-backed document views
Manual metadata sync
```

Outcome:

- Drive can store files.
- coopHUB controls access.
- Members can view authorized Drive-backed documents without needing Google accounts.

### Phase 4: Calendar Sync

Deliverables:

```txt
Calendar connection settings
Calendar mappings
Sync coopHUB event to Google Calendar
Store Google event ID
Update synced event
Sync status/error UI
Optional Google Meet link
```

### Phase 5: Gmail Sending

Deliverables:

```txt
Gmail connection
Sender identity
Send notice to group
Send notice to individual
Email delivery logs
Admin preview before send
```

### Phase 6: Optional Google Groups Sync

Deliverables:

```txt
Link coopHUB group to Google Group
Push membership to Google
Pull membership from Google
Conflict review
Sync logs
```

---

## 13. MVP Scope

### Must-Have MVP

```txt
Native users
Native groups
Native memberships
Native permissions
Backend permission checks
Role-restricted document list
Role-restricted document detail/download
Document access logs
Admin user/group management
```

### Should-Have MVP

```txt
Committee-aware document access
Effective permission viewer
Document access explanation
Storage provider field
Google Drive metadata-ready schema
```

### Could-Have MVP

```txt
Magic link login
User-specific permission overrides
Google Drive import
Calendar sync
Gmail sending
```

### Not MVP

```txt
Google Groups sync
Nested group management
Complex Drive permission mirroring
Full inbox ingestion
Google Chat integration
Google Sites integration
```

---

## 14. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Users accidentally see restricted documents | Very high | Backend authorization on every document endpoint |
| Google Drive links bypass coopHUB | High | Proxy access or avoid exposing raw Drive URLs |
| Permission model becomes too complex | High | Use groups + permissions; avoid deep nesting |
| Admin locks themselves out | High | System admin fallback role; protected permissions |
| Google integration breaks | Medium | coopHUB remains source of truth; integration errors visible |
| Search/AI leaks restricted docs | Very high | Permission-filter chunks before retrieval |
| Members resist Google accounts | High | Native login with any email |
| Committee membership changes not reflected | Medium | Membership audit logs and clear admin UI |

---

## 15. Success Metrics

### Security Metrics

```txt
0 known unauthorized document access incidents
100% protected document endpoints use backend authorization
100% document views/downloads logged
```

### Adoption Metrics

```txt
80%+ active members logged in within launch period
Board/admin users successfully manage groups without developer help
Reduction in manual document-sharing requests
```

### Operational Metrics

```txt
Time to onboard board member reduced
Time to remove former board member access reduced
Document access questions answerable from admin UI
```

### Integration Metrics

```txt
Drive-backed documents successfully imported
Calendar sync success rate
Email send success rate
Google sync errors visible and recoverable
```

---

## 16. Open Decisions

1. Should `User` replace `Tenant`, or should `User` link to `Tenant`?
   - Recommendation: create `User` and optionally link it to `Tenant`.

2. Should users be unique globally or per cooperative?
   - Recommendation: per cooperative unless coopHUB is intended to become multi-co-op SaaS with cross-co-op accounts.

3. Should initial auth be password or magic link?
   - Recommendation: magic link for co-op members; password/passkey later.

4. Should Drive files be streamed through coopHUB or opened directly in Drive?
   - Recommendation: stream/proxy member-facing docs through coopHUB; allow direct Drive access for board/admin collaboration.

5. Should committees become groups automatically?
   - Recommendation: yes. Each committee should have a corresponding group.

6. Should chairs be separate groups or membership attributes?
   - Recommendation: separate groups for permission clarity, for example `Maintenance Chair`.

---

## 17. Final Recommendation

Build this in this order:

```txt
1. Native users/groups/permissions
2. Role-restricted document access
3. Audit logs and admin visibility tools
4. Google Drive storage integration
5. Calendar sync
6. Gmail sending
7. Optional Google Groups sync
```

The key architectural decision is:

> coopHUB should own identity, roles, permissions, and document visibility. Google Workspace should enhance storage, calendars, and communication, but never be required for basic member access.

That gives coopHUB the best balance: secure enough for board/admin governance, simple enough for tenants, and flexible enough to grow into a serious co-op operating platform.
