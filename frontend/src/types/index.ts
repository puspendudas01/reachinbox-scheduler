export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

export interface SlackStatus {
  connected: boolean;
  teamName?: string;
}

export type EmailStatus = 'scheduled' | 'sent' | 'failed' | 'cancelled';

export interface Email {
  id: string;
  toEmail: string;
  subject: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt?: string | null;
  error?: string | null;
}

export interface ScheduleCampaignPayload {
  subject: string;
  body: string;
  emails: string[];
  startTime: string; // ISO-8601 string
  delayMs: number;
  hourlyLimit: number;
}

export interface SearchEmailsParams {
  q?: string;
  status?: EmailStatus;
}

export interface ScheduleCampaignResult {
  campaignId?: string;
  scheduledCount?: number;
}

export interface ParseEmailsResult {
  validEmails: string[];
  invalidCount: number;
  duplicateCount: number;
  totalParsed: number;
}
