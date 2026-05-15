
export enum RequestStatus {
  PENDING = 'Pending',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled'
}

export type MaintenanceCategory = 'Plumbing' | 'Electrical' | 'Structural' | 'Appliance' | 'HVAC' | 'Exterior' | 'Safety' | 'Other';

export interface MaintenanceNote {
  id: string;
  author: string;
  date: string;
  content: string;
}

export interface MaintenanceExpense {
  id: string;
  item: string;
  cost: number;
  date: string;
}

export interface TenantHistory {
  id: string;
  tenantId: string;
  unitId: string;
  unit?: Unit;
  tenant?: Tenant;
  startDate: string;
  endDate?: string;
  moveReason?: string;
  createdAt?: string;
}

export interface Unit {
  id: string;
  number: string;
  type: string;
  floor: number;
  buildingId?: string;
  building?: Building;
  status: string;
  currentTenantId?: string;
  currentTenant?: Tenant;
  maintenanceHistory?: MaintenanceRequest[];
  occupancyHistory?: TenantHistory[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Building {
  id: string;
  cooperativeId?: string;
  name: string;
  code?: string;
  address?: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  startDate: string;
  status: string;
  role: string;
  unitId?: string;
  unit?: Unit;
  committees?: Committee[];
  history?: TenantHistory[];
  balance?: number;
  shareCapital?: number;
  split?: any;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export enum MaintenancePriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  EMERGENCY = 'Emergency'
}

export interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  status: RequestStatus;
  priority: MaintenancePriority;
  category: MaintenanceCategory[];
  unitId: string;
  unit?: Unit;
  tenantId?: string;
  requestedBy?: string;
  notes?: MaintenanceNote[];
  expenses?: MaintenanceExpense[];
  attachments?: any[];
  aiTriage?: MaintenanceAITriage;
  visualDescription?: string;
  residentTip?: string;
  triageReviewedBy?: string;
  triageReviewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  urgency?: string;
}

export interface MaintenanceAITriage {
  priority: MaintenancePriority;
  urgency: string;
  category: MaintenanceCategory[];
  residentTip: string;
  confidence: number;
  safetyWarning?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  author: string;
  date: string;
  createdAt?: string;
  updatedAt?: string;
}
export interface Document {
  id: string;
  title: string;
  category: string;
  committee?: string;
  url: string;
  fileType: string;
  author: string;
  date: string;
  tags?: string[];
  status?: 'ACTIVE' | 'ARCHIVED' | 'SUPERSEDED';
  visibility?: 'PUBLIC' | 'MEMBERS' | 'COMMITTEE' | 'BOARD' | 'ADMIN' | 'CUSTOM' | 'PRIVATE';
  committeeAccess?: string | null;
  ownerUserId?: string | null;
  storageProvider?: 'LOCAL' | 'VERCEL_BLOB' | 'GOOGLE_DRIVE' | 'EXTERNAL_LINK';
  sourceExternalId?: string | null;
  sourceFolderId?: string | null;
  sourceWebUrl?: string | null;
  sourceMimeType?: string | null;
  sourceModifiedAt?: string | null;
  accessRules?: {
    id: string;
    groupId?: string | null;
    userId?: string | null;
    permission: 'VIEW' | 'COMMENT' | 'EDIT' | 'MANAGE' | string;
  }[];
  currentVersionId?: string;
  currentVersion?: {
    id: string;
    version: number;
    source: string;
    storageUrl: string;
    storageKey?: string | null;
    ingestionStatus: 'pending' | 'processing' | 'ready' | 'failed' | string;
    ingestionError?: string | null;
    ragStatus?: 'not_indexed' | 'indexing' | 'indexed' | 'failed' | 'stale' | 'deleted' | string;
    ragStoreName?: string | null;
    ragDocumentName?: string | null;
    ragIndexedAt?: string | null;
    ragIndexError?: string | null;
    createdAt?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  content?: string;
}

export interface Committee {
  id: string;
  name: string;
  description: string;
  chair: string;
  icon: string;
  members?: any[];
  events?: CoopEvent[];
  createdAt?: string;
  updatedAt?: string;
}

// Restoring missing types for UI compatibility
export interface CoopEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  category: string;
  description: string;
  committeeId?: string;
  cooperativeId?: string;
  attendees?: Tenant[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Transaction {
  id: string;
  tenantId: string;
  amount: number;
  type: string;
  status: string;
  date: string;
  description: string;
}

export interface Message {
  id: string;
  fromId: string;
  toId: string;
  body: string;
  timestamp: string;
}

export interface RepairQuote {
  id: string;
  requestId: string;
  vendorName: string;
  amount: number;
  status: string;
  details: string;
  date: string;
}

export interface Notification {
  id: string;
  cooperativeId?: string;
  audience: 'admin' | 'member' | 'user' | 'all';
  recipientUserEmail?: string;
  title: string;
  body: string;
  type: string;
  severity: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  timestamp?: string;
  createdAt: string;
  readAt?: string | null;
  isRead: boolean;
}

export interface ParticipationRecord {
  id: string;
  tenantId: string;
  date: string;
  hours: number;
  description: string;
}

export interface ScheduledMaintenance {
  id: string;
  unitId: string;
  task: string;
  dueDate: string;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  assignedTo: string;
  isCompleted?: boolean;
  category: 'PLUMBING' | 'ELECTRICAL' | 'HVAC' | 'SAFETY' | 'GENERAL' | 'OTHER';
}

export interface MinutesTemplate {
  id: string;
  meetingId: string;
  coopName: string;
  meetingType: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  chair: string;
  secretary: string;
  attendees: string[];
  guests: string[];
  agenda: { id: string; title: string; completed: boolean }[];
  motions: { id: string; mover: string; seconder: string; resolution: string; carried: boolean }[];
  actionItems: { id: string; task: string; owner: string; dueDate: string }[];
  notes: string;
  status: 'Draft' | 'Finalized';
}

export type OracleLanguage = 'English' | 'Spanish' | 'French' | 'Cantonese' | 'Mandarin' | 'Punjabi' | 'Tagalog';

export interface OracleSuggestedAction {
  type: 'start-maintenance-request';
  label: string;
  href: string;
}

export interface OracleResponse {
  answer: string;
  citations: { title: string; documentId?: string; pageNumber?: number }[];
  language: OracleLanguage;
  intent: 'policy' | 'maintenance' | 'governance' | 'general';
  suggestedAction?: OracleSuggestedAction;
  confidence: number;
}

export interface RagCitation {
  title: string;
  text?: string;
  uri?: string;
  pageNumber?: number | null;
  documentId?: string | null;
  documentVersionId?: string | null;
  scope?: string | null;
  sourceSystem?: string | null;
}

export interface RagAskResponse {
  answer: string;
  citations: RagCitation[];
  storeNames: string[];
}

export interface MeetingAnalysisActionItem {
  id: string;
  description: string;
  ownerName?: string;
  committee?: string;
  dueDate?: string;
  priority: 'Low' | 'Medium' | 'High';
  sourceSnippet?: string;
}

export interface MeetingAnalysisTopicBriefing {
  topic: string;
  context: string;
  discussionSummary: string;
  implications: string;
  recommendedMinuteText: string;
}

export interface MeetingAnalysis {
  id: string;
  meetingId?: string;
  rawNotes: string;
  professionalSummary: string;
  topicBriefings?: MeetingAnalysisTopicBriefing[];
  decisions: string[];
  motionsMentioned: string[];
  actionItems: MeetingAnalysisActionItem[];
  risksOrFollowUps: string[];
  confidenceNotes?: string[];
  createdBy: string;
  approvedAt?: string;
  createdAt: string;
}
