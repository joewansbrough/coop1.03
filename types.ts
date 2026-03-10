
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
  status: string;
  currentTenantId?: string;
  currentTenant?: Tenant;
  maintenanceHistory?: MaintenanceRequest[];
  occupancyHistory?: TenantHistory[];
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
  unitId?: string;
  unit?: Unit;
  committees?: Committee[];
  history?: TenantHistory[];
  balance?: number;
  shareCapital?: number;
  residencyHistory?: any[];
  split?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: any;
  unitId: string;
  unit?: Unit;
  tenantId?: string;
  requestedBy?: string;
  urgency?: string;
  notes?: any[];
  expenses?: any[];
  attachments?: any[];
  createdAt?: string;
  updatedAt?: string;
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
  url: string;
  fileType: string;
  author: string;
  date: string;
  content?: string;
  tags?: string[];
  isPrivate?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Committee {
  id: string;
  name: string;
  description: string;
  chair: string;
  icon: string;
  members?: any[];
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
  title: string;
  body: string;
  type: string;
  timestamp: string;
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
  frequency: 'Monthly' | 'Quarterly' | 'Annual';
  assignedTo: string;
  isCompleted?: boolean;
}
