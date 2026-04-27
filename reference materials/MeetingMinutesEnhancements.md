# Meeting Minutes Enhancement - Master Implementation Plan

## Project Overview
Enhance the meeting minutes system with 6 major features:
1. Rich text editor for detailed reports
2. File attachments (local + Google Drive)
3. Email notifications (opt-in)
4. Export to Word/PDF (proper formatting)
5. Templates library
6. AI summarization using Gemini

---

## Enhancement 1: Rich Text Editor for Detailed Reports

### Objective
Replace plain textarea fields with a rich text editor for key sections to allow formatting, lists, and better structure.

### Implementation Details

**Technology Choice:**
- **React Quill** (recommended) - Well-maintained, good TypeScript support
- Alternative: TinyMCE, Draft.js, Slate.js

**Fields to Enhance:**
- Board Report
- Financial Report
- Committee Reports
- Business Arising
- New Business
- Action Items
- Additional Notes

**Tasks:**
- [ ] Install dependencies (`react-quill` and types)
- [ ] Create `RichTextEditor` wrapper component
- [ ] Configure toolbar (bold, italic, lists, headings, links)
- [ ] Add dark mode CSS overrides for Quill
- [ ] Update MinutesBuilder to use RichTextEditor for key fields
- [ ] Add HTML sanitization for security
- [ ] Test save/load with HTML content
- [ ] Update backend to handle HTML storage
- [ ] Add "Strip Formatting" button option

**Dependencies:**
```json
{
  "react-quill": "^2.0.0",
  "@types/react-quill": "^2.0.0",
  "dompurify": "^3.0.6",
  "@types/dompurify": "^3.0.5"
}
```

**Estimated Time:** 4-6 hours

**Complexity:** Medium

**Handoff Notes:**
- Configuration in `RichTextEditor.tsx`
- Quill styles in `quill-custom.css`
- Sanitization function in `utils/sanitize.ts`

---

## Enhancement 2: File Attachments (Local + Google Drive)

### Objective
Allow users to attach supporting documents via local upload or Google Drive picker.

### Implementation Details

**Two Attachment Methods:**

#### A. Local File Upload
- Upload to your backend/Supabase storage
- Store file metadata in database
- Generate download URLs

#### B. Google Drive Integration (existing)
- Use your existing Google Picker API
- Store Drive file ID and permissions
- Provide direct links to Drive files

**Database Schema:**
```prisma
model MeetingAttachment {
  id          String   @id @default(cuid())
  minutesId   String
  name        String
  url         String
  type        String   // 'local' | 'google_drive'
  mimeType    String?
  size        Int?     // bytes
  uploadedBy  String
  uploadedAt  DateTime @default(now())
  
  minutes     MeetingMinutes @relation(fields: [minutesId], references: [id], onDelete: Cascade)
  
  @@index([minutesId])
}
```

**Tasks:**
- [ ] Create database migration for attachments table
- [ ] Build `AttachmentsManager` component
- [ ] Implement local file upload endpoint (`POST /api/minutes/:id/attachments`)
- [ ] Add file type validation (PDF, DOCX, XLSX, images)
- [ ] Add file size limits (10MB per file)
- [ ] Integrate Google Picker API for Drive attachments
- [ ] Create attachment preview/download UI
- [ ] Add delete attachment functionality
- [ ] Show attachment list in export documents
- [ ] Add attachment icons by file type

**File Upload Flow:**
1. User clicks "Add Attachment"
2. Choose: Local File or Google Drive
3. If local: Select file → Upload to storage → Save metadata
4. If Drive: Open picker → Select file → Save Drive ID
5. Display in attachment list with preview

**Security Considerations:**
- Validate file types on backend
- Scan for malware (optional: ClamAV)
- Ensure proper access control (only meeting participants)
- Generate temporary signed URLs for downloads

**Estimated Time:** 8-10 hours

**Complexity:** High

**Handoff Notes:**
- Upload endpoint in `routes/attachments.ts`
- Storage configuration in `.env` (Supabase or S3)
- Component in `components/AttachmentsManager.tsx`

---

## Enhancement 3: Email Notifications (Opt-in)

### Objective
Send email notifications to committee members when minutes are published or approved.

### Implementation Details

**Email Service Options:**
- SendGrid (recommended - free tier: 100 emails/day)
- AWS SES
- Resend
- Nodemailer + Gmail SMTP

**Notification Triggers:**
1. Minutes saved (draft notification)
2. Minutes published
3. Minutes approved
4. Minutes updated after approval

**Email Template Structure:**
```
Subject: [Co-op Name] - Board Meeting Minutes Published - [Date]

Body:
- Meeting type and date
- Link to view minutes
- Brief summary
- Attachments list
- Unsubscribe link
```

**Database Schema:**
```prisma
model NotificationPreference {
  id        String   @id @default(cuid())
  userId    String   @unique
  email     String
  notifyOnPublish  Boolean @default(true)
  notifyOnApprove  Boolean @default(true)
  notifyOnUpdate   Boolean @default(false)
  
  user      Tenant   @relation(fields: [userId], references: [id])
}

model NotificationLog {
  id          String   @id @default(cuid())
  minutesId   String
  recipientId String
  type        String   // 'published' | 'approved' | 'updated'
  sentAt      DateTime @default(now())
  status      String   // 'sent' | 'failed' | 'bounced'
  
  minutes     MeetingMinutes @relation(fields: [minutesId], references: [id])
}
```

**Tasks:**
- [ ] Choose email service provider
- [ ] Set up email service account and API keys
- [ ] Create database migrations for preferences and logs
- [ ] Build email template (HTML + plain text)
- [ ] Create `NotificationPreferences` component in user settings
- [ ] Add checkbox in MinutesBuilder for "Send notifications"
- [ ] Implement `sendMinutesNotification()` function
- [ ] Add recipient selector (all members / board only / custom)
- [ ] Create unsubscribe functionality
- [ ] Add email queue for batch sending
- [ ] Log all sent emails
- [ ] Handle bounces and failures

**Email Template Features:**
- Responsive HTML design
- Plain text fallback
- Meeting details summary
- Direct link to minutes
- Unsubscribe link
- Co-op branding

**Estimated Time:** 10-12 hours

**Complexity:** High

**Handoff Notes:**
- Email service config in `.env`
- Templates in `templates/emails/`
- Notification logic in `services/notifications.ts`

---

## Enhancement 4: Export to Word/PDF (Proper Formatting)

### Objective
Generate professional, properly formatted Word and PDF documents instead of browser print.

### Implementation Details

**Word Export:**
- Library: `docx` (npm package)
- Generate .docx with proper styling
- Include all sections, tables, and formatting
- Embed or link attachments

**PDF Export:**
- Library: `puppeteer` or `html-pdf-node`
- Generate from HTML template
- Professional styling
- Include page numbers, headers, footers

**Document Structure:**
```
Header:
- Co-op name and logo
- Meeting type
- Date

Body:
- All sections with proper headings
- Attendance table
- Motions table
- Reports with formatting preserved
- Attachments list

Footer:
- Page numbers
- Approval signatures
```

**Tasks:**

#### Word Export
- [ ] Install `docx` package
- [ ] Create document generator function
- [ ] Design document styles (headings, fonts, spacing)
- [ ] Map form data to Word sections
- [ ] Generate attendance table
- [ ] Generate motions table
- [ ] Handle rich text HTML → Word conversion
- [ ] Add attachments list with links
- [ ] Create download endpoint (`POST /api/minutes/:id/export/docx`)
- [ ] Add co-op logo to header

#### PDF Export
- [ ] Install `puppeteer` or `html-pdf-node`
- [ ] Create HTML template for PDF
- [ ] Design print-ready CSS
- [ ] Add page numbers and headers/footers
- [ ] Handle page breaks intelligently
- [ ] Create download endpoint (`POST /api/minutes/:id/export/pdf`)
- [ ] Optimize for file size

#### Common Tasks
- [ ] Add "Export" dropdown in UI
- [ ] Show loading spinner during generation
- [ ] Handle errors gracefully
- [ ] Cache generated documents (optional)
- [ ] Add watermark for draft minutes

**Export Format Options:**
- Standard format (default)
- Compact format (less spacing)
- Official format (with signatures)

**Estimated Time:** 12-15 hours

**Complexity:** High

**Handoff Notes:**
- Document generators in `services/export/`
- Templates in `templates/documents/`
- Styling in `templates/documents/styles.ts`

---

## Enhancement 5: Templates Library

### Objective
Provide pre-written templates for common agenda items and reports to speed up minute-taking.

### Implementation Details

**Template Categories:**
1. Board Reports
2. Financial Reports
3. Committee Reports
4. Action Items
5. Motions (common types)
6. Territorial Acknowledgements
7. Meeting Agreements

**Template Structure:**
```typescript
interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  content: string;
  meetingType: MeetingType[];
  tags: string[];
  isCustom: boolean;
  createdBy?: string;
  createdAt: Date;
}
```

**Features:**
- Built-in templates (system-provided)
- Custom templates (user-created)
- Template preview before insert
- Search and filter templates
- Edit custom templates
- Share templates with co-op

**Database Schema:**
```prisma
model MinutesTemplate {
  id          String   @id @default(cuid())
  name        String
  category    String
  content     String   @db.Text
  meetingType String[] // array of meeting types
  tags        String[]
  isCustom    Boolean  @default(false)
  isPublic    Boolean  @default(false)
  coopId      String?
  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  coop        Coop?    @relation(fields: [coopId], references: [id])
  
  @@index([category])
  @@index([coopId])
}
```

**Tasks:**
- [ ] Create database migration
- [ ] Build `TemplateLibrary` component
- [ ] Create built-in template seed data (20-30 templates)
- [ ] Add "Insert Template" button to rich text fields
- [ ] Build template browser modal
- [ ] Add search and filter functionality
- [ ] Implement "Save as Template" feature
- [ ] Add template editor for custom templates
- [ ] Create template management page
- [ ] Add template preview
- [ ] Implement template sharing within co-op
- [ ] Add template usage analytics (optional)

**Built-in Templates to Create:**

1. **Board Reports:**
   - Standard monthly report
   - Year-end summary
   - Emergency board report

2. **Financial Reports:**
   - Monthly financial summary
   - Budget vs. actual
   - Reserve fund update

3. **Committee Reports:**
   - Maintenance committee
   - Finance committee
   - Membership committee

4. **Action Items:**
   - Follow-up template
   - Delegation template

5. **Territorial Acknowledgements:**
   - Vancouver (Coast Salish)
   - Victoria (Lək̓ʷəŋən peoples)
   - Generic template

**Estimated Time:** 8-10 hours

**Complexity:** Medium

**Handoff Notes:**
- Component in `components/TemplateLibrary.tsx`
- Seed data in `prisma/seeds/templates.ts`
- API routes in `routes/templates.ts`

---

## Enhancement 6: AI Summarization using Gemini

### Objective
Use Google's Gemini AI to automatically summarize long discussions into concise minutes.

### Implementation Details

**Use Cases:**
1. Summarize recorded discussion transcripts
2. Extract key points from draft notes
3. Generate action items from discussions
4. Create executive summaries

**Gemini Integration:**
- Use `@google/generative-ai` package
- Model: `gemini-1.5-flash` (fast, cost-effective)
- Streaming responses for better UX

**Features:**
- "Summarize with AI" button on text fields
- Customize summary style (formal, brief, detailed)
- Show original and AI-generated side-by-side
- Accept/reject/edit AI suggestions
- AI-generated action items extraction

**Database Schema:**
```prisma
model AISummaryLog {
  id          String   @id @default(cuid())
  minutesId   String
  fieldName   String
  originalText String  @db.Text
  summaryText  String  @db.Text
  accepted    Boolean  @default(false)
  userId      String
  createdAt   DateTime @default(now())
  
  minutes     MeetingMinutes @relation(fields: [minutesId], references: [id])
}
```

**Tasks:**
- [ ] Install `@google/generative-ai` package
- [ ] Set up Gemini API key
- [ ] Create `AISummarizer` service class
- [ ] Build prompt templates for different summary types
- [ ] Add "Summarize with AI" button to rich text fields
- [ ] Create AI suggestions modal
- [ ] Implement streaming response UI
- [ ] Add accept/reject/edit actions
- [ ] Build action items extractor
- [ ] Add AI usage tracking (cost control)
- [ ] Implement rate limiting
- [ ] Add error handling for API failures
- [ ] Create AI settings panel (enable/disable, style preferences)

**Prompt Engineering:**

```typescript
const PROMPTS = {
  boardReport: `Summarize this board discussion into a professional board report. 
    Include: key decisions, concerns raised, actions taken.
    Format: 3-5 concise paragraphs.
    Tone: Formal, factual.`,
  
  actionItems: `Extract all action items from this discussion.
    For each item provide: task, responsible party, deadline (if mentioned).
    Format as a numbered list.`,
  
  executiveSummary: `Create a 2-paragraph executive summary of this meeting.
    Highlight the most important decisions and outcomes.
    Tone: Professional, concise.`
};
```

**AI Features:**
- Summary strength slider (brief ↔ detailed)
- Tone selector (formal, casual, technical)
- Language selector (if multilingual support needed)
- Highlight changes button (diff view)

**Cost Control:**
- Set monthly API budget limit
- Track tokens used per request
- Cache summaries to avoid regeneration
- Show cost estimate before generating

**Estimated Time:** 10-12 hours

**Complexity:** Medium-High

**Handoff Notes:**
- Gemini service in `services/ai/gemini.ts`
- Prompts in `services/ai/prompts.ts`
- Component in `components/AISummarizer.tsx`
- API key in `.env`

---

## Master Task Checklist

### Phase 1: Foundation (Week 1)
- [ ] Review and approve implementation plan
- [ ] Set up development environment
- [ ] Create feature branch (`feature/minutes-enhancements`)
- [ ] Install all required dependencies
- [ ] Create database migrations
- [ ] Set up external service accounts (email, Gemini)

### Phase 2: Core Features (Week 2-3)
- [ ] Enhancement 1: Rich Text Editor (4-6 hrs)
- [ ] Enhancement 5: Templates Library (8-10 hrs)
- [ ] Enhancement 2: File Attachments (8-10 hrs)

### Phase 3: Advanced Features (Week 4)
- [ ] Enhancement 6: AI Summarization (10-12 hrs)
- [ ] Enhancement 3: Email Notifications (10-12 hrs)
- [ ] Enhancement 4: Export to Word/PDF (12-15 hrs)

### Phase 4: Testing & Polish (Week 5)
- [ ] Integration testing
- [ ] User acceptance testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] Deploy to production

---

## Dependencies & Environment Setup

### NPM Packages to Install
```json
{
  "dependencies": {
    "react-quill": "^2.0.0",
    "dompurify": "^3.0.6",
    "docx": "^8.5.0",
    "puppeteer": "^21.6.0",
    "@google/generative-ai": "^0.2.0",
    "@sendgrid/mail": "^8.1.0"
  },
  "devDependencies": {
    "@types/react-quill": "^2.0.0",
    "@types/dompurify": "^3.0.5",
    "@types/node": "^20.10.0"
  }
}
```

### Environment Variables
```env
# Email Service
SENDGRID_API_KEY=your_key_here
FROM_EMAIL=noreply@yourcoop.com

# AI Service
GEMINI_API_KEY=your_key_here

# File Storage (if using Supabase)
SUPABASE_URL=your_url_here
SUPABASE_SERVICE_KEY=your_key_here
STORAGE_BUCKET=meeting-attachments

# Or AWS S3
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here
S3_BUCKET=meeting-attachments
```

### Prisma Migrations
```bash
npx prisma migrate dev --name add_attachments
npx prisma migrate dev --name add_templates
npx prisma migrate dev --name add_notifications
npx prisma migrate dev --name add_ai_logs
```

---

## File Structure

```
src/
├── components/
│   ├── minutes/
│   │   ├── MinutesBuilderEnhanced.tsx
│   │   ├── RichTextEditor.tsx
│   │   ├── AttachmentsManager.tsx
│   │   ├── TemplateLibrary.tsx
│   │   ├── AISummarizer.tsx
│   │   └── NotificationSettings.tsx
│   └── ...
├── services/
│   ├── ai/
│   │   ├── gemini.ts
│   │   └── prompts.ts
│   ├── export/
│   │   ├── wordGenerator.ts
│   │   └── pdfGenerator.ts
│   ├── notifications/
│   │   ├── emailService.ts
│   │   └── templates.ts
│   └── storage/
│       └── fileUpload.ts
├── hooks/
│   ├── useMinutesManager.ts
│   ├── useAttachments.ts
│   └── useTemplates.ts
├── utils/
│   ├── sanitize.ts
│   └── validation.ts
├── templates/
│   ├── emails/
│   │   └── minutes-published.html
│   └── documents/
│       ├── word-template.ts
│       └── pdf-template.html
└── styles/
    ├── quill-custom.css
    └── print.css
```

---

## Testing Strategy

### Unit Tests
- [ ] File upload validation
- [ ] Email template rendering
- [ ] Word document generation
- [ ] PDF document generation
- [ ] AI prompt construction
- [ ] HTML sanitization

### Integration Tests
- [ ] Complete minutes creation flow
- [ ] Attachment upload and retrieval
- [ ] Email sending
- [ ] Template insertion
- [ ] AI summarization
- [ ] Export generation

### User Acceptance Tests
- [ ] Board member can create minutes quickly
- [ ] Attachments are properly linked
- [ ] Email notifications arrive correctly
- [ ] Exports are professional quality
- [ ] Templates save time
- [ ] AI summaries are useful

---

## Rollback Plan

If issues arise during deployment:

1. **Immediate Issues:**
   - Revert to previous git commit
   - Restore database from backup
   - Disable new features via feature flags

2. **Data Migration Issues:**
   - Keep old schema alongside new for 30 days
   - Dual-write to both schemas
   - Gradual migration with verification

3. **External Service Failures:**
   - Gracefully degrade (disable AI, email, etc.)
   - Show user-friendly error messages
   - Log failures for debugging

---

## Success Metrics

### Performance
- Minutes creation time reduced by 40%
- Export generation < 5 seconds
- AI summary generation < 10 seconds

### Adoption
- 80%+ of meetings use the new system
- 50%+ use AI summarization
- 70%+ use templates

### Quality
- Minutes approval rate improves
- Fewer requests for clarification
- Better formatted documents

---

## Handoff Documentation Locations

All handoff documents will be created in:
```
/docs/
├── handoff/
│   ├── 01-rich-text-editor.md
│   ├── 02-file-attachments.md
│   ├── 03-email-notifications.md
│   ├── 04-export-generation.md
│   ├── 05-templates-library.md
│   └── 06-ai-summarization.md
├── api/
│   ├── attachments-api.md
│   ├── export-api.md
│   ├── notifications-api.md
│   └── templates-api.md
└── deployment/
    ├── environment-setup.md
    ├── database-migrations.md
    └── external-services.md
```

---

## Timeline Estimate

**Total Estimated Time:** 52-65 hours

**Suggested Schedule (6 weeks):**
- Week 1: Planning, setup, dependencies (8-10 hrs)
- Week 2: Rich Text Editor + Templates (12-16 hrs)
- Week 3: File Attachments (8-10 hrs)
- Week 4: AI Summarization + Email (20-24 hrs)
- Week 5: Export Generation (12-15 hrs)
- Week 6: Testing, docs, deployment (8-10 hrs)

**Parallel Work Opportunities:**
- File attachments + Templates (independent)
- AI + Email (share notification logic)
- Exports can be done last

---

## Next Steps

1. ✅ Review this plan
2. ⏳ Approve enhancements priority order
3. ⏳ Set up external service accounts
4. ⏳ Create feature branch
5. ⏳ Begin Phase 1 implementation

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-26  
**Author:** Claude  
**Status:** Awaiting Approval
