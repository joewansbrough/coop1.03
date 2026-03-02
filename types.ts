
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

export interface Unit {
  id: string;
  number: string;
  type: '1BR' | '2BR' | '3BR' | '4BR';
  floor: number;
  currentTenantId?: string;
  status: 'Occupied' | 'Vacant' | 'Maintenance';
  lastInspectionDate?: string;
  ownerEmail?: string;
}

export interface ParticipationRecord {
  id: string;
  tenantId: string;
  date: string;
  hours: number;
  description: string;
  committeeId?: string;
}

export interface ResidencyRecord {
  unitId: string;
  unitNumber: string;
  startDate: string;
  endDate?: string;
  moveReason?: string;
  isCurrent: boolean;
}

export interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  unitId?: string;
  startDate: string;
  endDate?: string;
  status: 'Current' | 'Past' | 'Waitlist';
  balance?: number;
  shareCapital?: number;
  infractions?: { date: string, details: string }[];
  residencyHistory?: ResidencyRecord[];
}

export interface MaintenanceRequest {
  id: string;
  unitId: string;
  tenantId: string;
  category: MaintenanceCategory[];
  description: string;
  urgency: 'Low' | 'Medium' | 'High' | 'Emergency';
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  notes: MaintenanceNote[];
  expenses: MaintenanceExpense[];
  attachments?: string[];
}

export interface RepairQuote {
  id: string;
  requestId: string;
  vendorName: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  details: string;
  date: string;
}

export interface Document {
  id: string;
  title: string;
  category: 'Minutes' | 'Policy' | 'Financial' | 'Committee' | 'Bylaws' | 'Unit' | 'Repair' | 'Newsletters';
  date: string;
  author: string;
  isPrivate?: boolean;
  relatedId?: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'urgent';
  timestamp: string;
  isRead: boolean;
}

export interface Transaction {
  id: string;
  tenantId: string;
  amount: number;
  type: 'Housing Charge' | 'Maintenance Fee' | 'Parking' | 'Other' | 'Share Capital';
  status: 'Paid' | 'Pending' | 'Overdue';
  date: string;
  description: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  date: string;
  priority: 'Normal' | 'Urgent';
}

export interface Message {
  id: string;
  fromId: string;
  toId: string;
  toCommitteeId?: string;
  body: string;
  timestamp: string;
}

export interface CoopEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  category: 'Meeting' | 'Social' | 'Maintenance' | 'Board';
  description: string;
}

export interface Committee {
  id: string;
  name: string;
  description: string;
  chair: string;
  members: string[];
  icon: string;
}

export interface ScheduledMaintenance {
  id: string;
  unitId: string;
  task: string;
  dueDate: string;
  frequency: 'Monthly' | 'Quarterly' | 'Annual';
  assignedTo: string;
  isCompleted?: boolean;
}
