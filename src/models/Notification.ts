export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  WEB_SOCKET = 'WEB_SOCKET',
  IN_APP = 'IN_APP',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  READ = 'READ',
}

export interface Notification {
  id: string;
  userId: string;
  templateId: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  status: NotificationStatus;
  data: Record<string, any>;
  metadata?: Record<string, any>;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
}

export interface SendNotificationInput {
  userId: string;
  templateId: string;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  data?: Record<string, any>;
}
