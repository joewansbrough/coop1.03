# Co-op Platform — AI Feature Implementation Brief
**Project:** Oak Bay Housing Co-op / Co-op Management SaaS Platform  
**Stack:** React + TypeScript, Express.js, Prisma + PostgreSQL, Gemini AI (`@google/genai`)  
**Prepared for:** AI Coding Agent (Gemini CLI)

---

## Overview

This brief covers three interconnected AI features to be built on top of the existing platform. They share a common foundation: a two-tier document system. **Build the document system first — it unlocks everything else.**

---

## Foundation: Two-Tier Document System

### The Concept

All AI features draw answers from documents. Documents exist at two levels:

| Tier | Name | Scope | Editable by client? |
|------|------|-------|---------------------|
| 1 | BC Baseline | Platform-wide, shared by all co-ops | No — admin only |
| 2 | Co-op Specific | Per-client, uploaded by each co-op | Yes |

When the AI answers a question, it searches **Tier 2 first**, then falls back to **Tier 1**. Every answer must cite the source document and section.

### Tier 1 — BC Baseline Document Catalog

These documents apply to every BC housing co-op and should be pre-loaded into the platform. They are sourced from the **CHF BC Centre for Co-operative Learning** (cooplearning.ca) and BC legislation. Contact CHF BC for permission before ingesting their materials commercially.

**Legal**
- *Co-operative Association Act* (RSBC 1996) — the constitutional law governing all BC co-ops
- BC *Personal Information Protection Act* (PIPA) — privacy obligations
- Civil Resolution Tribunal guidance for co-op disputes

**Rules & Agreements**
- CHF BC Model Rules — standard rules template, legally reviewed, CAA-compliant
- CHF BC Standard Occupancy Agreement template

**Policy Templates** *(CHF BC)*
- Board & Governance policies
- Community policies
- Financial policies
- Maintenance policies
- Managing Members policies
- Job descriptions (standard co-op roles)

**Meeting & Governance Tools** *(CHF BC)*
- AGM, SAGM, Special GM templates and procedures
- Board meeting templates
- Voting and election toolkits

**Membership**
- Member manual template
- Member onboarding documentation

### Tier 2 — Per-Co-op Documents

Each co-op client uploads their own versions of:
- Their specific Rules (often amended from Model Rules)
- Their signed Occupancy Agreement
- Board meeting minutes (historical and ongoing)
- Financial statements and budgets
- Internal policies that differ from templates
- Any correspondence relevant to governance

### Database Schema Changes Needed

Extend the existing `Document` model in `prisma/schema.prisma`:

```prisma
model Document {
  id          String   @id @default(uuid())
  title       String
  category    String
  url         String           // file storage path or URL
  fileType    String           // "pdf", "docx", "txt"
  author      String           @default("Admin")
  date        String
  tier        Int              @default(2)    // 1 = BC Baseline, 2 = Co-op Specific
  coopId      String?                         // null for Tier 1 docs
  content     String?                         // extracted plain text for AI search
  embedding   Json?                           // vector embedding for semantic search (future)
  isActive    Boolean          @default(true)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
}
```

### File Upload Requirements

- Accept: PDF, DOCX, TXT
- On upload: extract plain text content and store in `content` field
- Use a library like `pdf-parse` for PDF text extraction
- Store files in a persistent location (Vercel Blob, Supabase Storage, or similar)
- Tier 1 documents: seeded via `prisma/seed.ts`, not uploadable via UI
- Tier 2 documents: uploaded via the existing Documents page UI

---

## Feature 1: Document Intelligence (Policy Assistant Upgrade)

### Current State

`pages/PolicyAssistant.tsx` already exists with a working Gemini chat interface. It currently filters documents by category and passes their `content` field as context. The hardcoded BC co-op context is a plain text block in the component.

### What to Build

**Replace the hardcoded context block** with a dynamic retrieval system:

1. When a user submits a question, run a keyword/relevance search against the `content` field of all documents (Tier 2 for this co-op first, then Tier 1)
2. Pull the top 3–5 most relevant document chunks
3. Pass those chunks to Gemini along with the question
4. Require Gemini to cite the source document name and section in its response

**Prompt template for Gemini:**
```
You are a policy assistant for a BC housing co-op. Answer the member's question using ONLY the documents provided below. 

For every claim you make, cite the source document in the format: [Document Title, Section X].

If the answer is not found in the provided documents, say so clearly and suggest the member contact the board.

Documents:
{retrieved_document_chunks}

Member's question: {user_question}
```

**Access control:**
- Members see answers grounded in their co-op's Tier 2 docs + Tier 1 baseline
- Admins can see which documents were retrieved to answer each question (audit trail)

**UI additions to `PolicyAssistant.tsx`:**
- Show a "Sources" section below each AI response listing cited documents
- Add a "Document coverage" indicator showing how many docs are indexed

---

## Feature 2: Maintenance Intelligence

### Current State

`pages/Maintenance.tsx` and `pages/MaintenanceDetail.tsx` exist. The `MaintenanceRequest` model has `title`, `description`, `status`, `priority`, `category`, `unitId`.

### What to Build

**2a — AI Triage on Submission**

When a maintenance request is submitted, call Gemini before saving to the database. Ask it to return a structured JSON assessment:

```json
{
  "urgency": "Routine | Urgent | Emergency",
  "responsibility": "Member | Co-op | Unclear",
  "responsibilityReason": "Brief explanation citing relevant policy",
  "suggestedCategory": "Plumbing | Electrical | Appliance | Structural | etc.",
  "acknowledgementDraft": "Dear [member name], we have received your request..."
}
```

Store the AI assessment fields in the database alongside the request. Add these fields to the schema:

```prisma
model MaintenanceRequest {
  // existing fields...
  aiUrgency           String?   // AI-suggested urgency
  aiResponsibility    String?   // "Member" | "Co-op" | "Unclear"
  aiResponsibilityReason String?
  aiAcknowledgement   String?   // draft email text
  adminOverride       Boolean   @default(false) // true if admin changed AI assessment
}
```

**Admin review UI (`MaintenanceDetail.tsx`):**
- Show AI assessment as a card with "Accept" / "Override" buttons
- If admin overrides, capture what they changed (for future training signal)
- Show the draft acknowledgement with a "Send" button that fires the Communications system

**2b — Pattern Detection**

Add a background query (run on page load for admins, or on a schedule) that detects:
- 3+ requests of the same category for the same unit in 12 months
- 2+ "Urgent" or "Emergency" requests for the same unit in 6 months

Surface these as alert banners on the admin Dashboard and on the relevant Unit Detail page (`pages/UnitDetail.tsx`).

No AI needed for pattern detection — this is a database aggregation query.

---

## Feature 3: Governance Companion

### What to Build

This feature has three components that can be built independently.

**3a — Meeting Prep Assistant**

New page or modal: "Meeting Prep"

Input: paste or upload an agenda
Output from Gemini:
- Briefing note for each agenda item (1–2 paragraphs)
- Relevant past decisions surfaced from meeting minutes in the document store
- Flag any items that require a formal vote under the co-op's rules
- Flag any items requiring member notice in advance

**3b — Motion Drafting**

Available from the governance section or as a standalone tool.

Input: plain English description of what the board wants to do
Output: properly formatted motion with:
- "Whereas" context clauses
- "Be it resolved" resolution language
- Notice requirements (if any) per the co-op's rules
- Vote threshold required (simple majority vs. special resolution)

Prompt must include the co-op's Rules document as context so thresholds are accurate.

**3c — Communications Drafting**

Extend the existing Communications page to offer AI drafting for:
- Non-renewal notices
- Bylaw violation letters
- Waitlist offer letters
- AGM notice packages

Input: select template type, fill in member name + specifics
Output: complete draft letter, legally careful in tone, ready for board review before sending

**Tone instruction for all governance drafts:**
```
Write in a tone that is firm, fair, and respectful. 
Avoid legal conclusions. Use plain language. 
Flag any sections that should be reviewed by a lawyer before sending.
```

---

## Implementation Order

Build in this sequence — each phase unblocks the next:

1. **Document schema migration** — add `tier`, `coopId`, `content` fields
2. **File upload with text extraction** — PDF/DOCX to plain text on upload
3. **Tier 1 seed data** — load BC baseline docs into the database
4. **Policy Assistant upgrade** — replace hardcoded context with dynamic retrieval + citations
5. **Maintenance triage** — AI assessment on submission + admin review UI
6. **Pattern detection** — database query + dashboard alerts
7. **Governance companion** — meeting prep, motion drafting, communications drafting

---

## Technical Notes for the AI Coding Agent

- The Gemini client is already initialized in `services/geminiService.ts` — extend it rather than creating a new service
- For document text extraction, install `pdf-parse` for PDFs and `mammoth` for DOCX files
- All Gemini calls that return structured data should request JSON output and parse it safely with try/catch
- The existing `generalContext` block in `PolicyAssistant.tsx` can be retired once Tier 1 docs are seeded — the AI will get that context from the actual documents
- Keep all AI assessments non-blocking: if the Gemini call fails, the maintenance request should still save normally with null AI fields
- For file storage: the current `url` field in `Document` assumes an external URL — you'll need to add a file upload endpoint and decide on storage (Vercel Blob is the simplest choice given the existing Vercel deployment config)

---

## CHF BC Licensing Note

Before ingesting CHF BC documents into a commercial SaaS product, contact CHF BC directly at the Centre for Co-operative Learning (cooplearning.ca). Position the conversation as: *"We're building a platform that serves BC co-op members, and we'd like to use your resources as the baseline knowledge layer — essentially putting your materials in front of every co-op we work with."* This is a partnership pitch, not just a licensing request.
