export enum AuditLogAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  EXPORT = 'EXPORT',
  REQUEST_DATA = 'REQUEST_DATA',
  CONSENT_CHANGE = 'CONSENT_CHANGE',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
}

export enum AuditLogSource {
  API = 'API',
  SYSTEM = 'SYSTEM',
  EXTERNAL = 'EXTERNAL',
  BLOCKCHAIN = 'BLOCKCHAIN',
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: AuditLogAction;
  source: AuditLogSource;
  resourceType: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, any>; // Sensitive data should be hashed/encrypted
  isImmutable: boolean;
  retentionUntil: Date;
  timestamp: Date;
}

export interface CreateAuditLogInput {
  userId?: string;
  action: AuditLogAction;
  source: AuditLogSource;
  resourceType: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
}
