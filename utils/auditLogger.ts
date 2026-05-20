export type AuditEvent = {
  cooperativeId: string;
  userEmail: string;
  action: string;
  details?: Record<string, any>;
};

/**
 * Robust console-based audit logger for tracking sensitive tenant-scoped actions.
 * In a full production system, this would write to an `AuditLog` table in Postgres
 * or send events to an external security monitoring tool.
 */
export const logAuditEvent = (event: AuditEvent) => {
  const timestamp = new Date().toISOString();
  console.log(`[AUDIT_LOG] [${timestamp}] [Coop: ${event.cooperativeId}] [User: ${event.userEmail}] Action: ${event.action}`, {
    details: event.details || {},
  });
};
