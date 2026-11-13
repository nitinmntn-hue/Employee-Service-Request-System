import api from "@/lib/axios";

// Get notifications with pagination and optional filters.
export const getMyNotifications = async (params = {}) => {
  const response = await api.get("/notifications", {
    params: {
      page: params.page || 1,
      limit: params.limit || 10,
      ...(typeof params.isRead === "boolean" && {
        isRead: params.isRead,
      }),
      ...(params.type &&
        params.type !== "ALL" && {
          type: params.type,
        }),
    },
  });

  return response.data;
};

// Get the unread notification count.
export const getUnreadNotificationCount = async () => {
  const response = await api.get("/notifications/unread-count");
  return response.data;
};

// Mark one notification as read.
export const markNotificationAsRead = async (notificationId) => {
  const response = await api.patch(`/notifications/${notificationId}/read`);
  return response.data;
};

// Mark all notifications as read.
export const markAllNotificationsAsRead = async () => {
  const response = await api.patch("/notifications/read-all");
  return response.data;
};

// Delete one notification.
export const deleteNotification = async (notificationId) => {
  const response = await api.delete(`/notifications/${notificationId}`);
  return response.data;
};
