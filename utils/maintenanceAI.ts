import type { MaintenanceAITriage, MaintenanceCategory, MaintenancePriority } from '../types';

const MAINTENANCE_PRIORITY = {
  LOW: 'Low' as MaintenancePriority,
  MEDIUM: 'Medium' as MaintenancePriority,
  HIGH: 'High' as MaintenancePriority,
  EMERGENCY: 'Emergency' as MaintenancePriority,
} as const;

const normalizePriority = (priority?: string): MaintenancePriority => {
  const value = String(priority || '').toLowerCase();
  if (value === 'emergency' || value === 'urgent') return MAINTENANCE_PRIORITY.EMERGENCY;
  if (value === 'high') return MAINTENANCE_PRIORITY.HIGH;
  if (value === 'low') return MAINTENANCE_PRIORITY.LOW;
  return MAINTENANCE_PRIORITY.MEDIUM;
};

const normalizeCategories = (category?: string[] | string): MaintenanceCategory[] => {
  const categories = Array.isArray(category) ? category : category ? [category] : ['Other'];
  return categories.map(item => (
    item === 'Carpentry' || item === 'Flooring' || item === 'Security'
      ? 'Other'
      : item as MaintenanceCategory
  ));
};

export const createMaintenanceTriage = (input: {
  priority?: string;
  urgency?: string;
  category?: string[] | string;
  residentTip?: string;
  confidence?: number;
  safetyWarning?: string;
}): MaintenanceAITriage => ({
  priority: normalizePriority(input.priority || input.urgency),
  urgency: input.urgency || input.priority || 'Medium',
  category: normalizeCategories(input.category),
  residentTip: input.residentTip || 'If the issue is actively causing damage or feels unsafe, contact the co-op emergency contact while the request is reviewed.',
  confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 0.5))),
  safetyWarning: input.safetyWarning,
});

export const shouldFlagTriageForReview = (triage?: MaintenanceAITriage | null) =>
  Boolean(triage && (
    triage.confidence < 0.7 ||
    triage.priority === MAINTENANCE_PRIORITY.EMERGENCY ||
    triage.priority === MAINTENANCE_PRIORITY.HIGH
  ));
