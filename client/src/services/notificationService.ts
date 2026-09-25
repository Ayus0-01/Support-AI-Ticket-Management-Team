import api from "../api";

export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error";

export interface AppNotification {
  _id: string;
  recipient: string;
  title: string;
  message: string;
  type: NotificationType | string;
  ticket_id?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unread_count: number;
}

export const getNotifications =
  async (): Promise<NotificationsResponse> => {
    const response = await api.get(
      "/api/notifications/"
    );

    return response.data;
  };

export const markNotificationRead =
  async (notificationId: string) => {
    const response = await api.patch(
      `/api/notifications/${notificationId}/read/`
    );

    return response.data;
  };

export const markAllNotificationsRead =
  async () => {
    const response = await api.patch(
      "/api/notifications/mark-all-read/"
    );

    return response.data;
  };