export type NotificationSection = "people" | "system";
export type NotificationView = "list" | "compact" | "grid";
export interface NotificationAction {
  label: string;
  path: string;
}
export interface NotificationEvent {
  id: string;
  source: NotificationSection;
  type: string;
  title: string;
  body: string;
  actorId?: string | null;
  actorName?: string;
  category?: "NEWS" | "SERVICE" | "RELEASE";
  releaseId?: string | null;
  actions: NotificationAction[];
  readAt: string | null;
  createdAt: string;
}
export interface NotificationSender {
  id: string;
  name: string;
  username: string | null;
  preview: string;
  total: number;
  unread: number;
  lastAt: string;
}
export interface NotificationPage<T> {
  items: T[];
  total: number;
  asOf?: string;
  unread?: number;
}
export interface NotificationSummary {
  people: number;
  system: number;
  asOf: string;
}
