import api from "@/lib/axios";

// Get all activity logs (ADMIN only).
export const getActivityLogs = async (params = {}) => {
  const response = await api.get("/activity-logs", {
    params: {
      page: params.page || 1,
      limit: params.limit || 20,
      ...(params.action?.trim() && {
        action: params.action.trim(),
      }),
      ...(params.actorId && {
        actorId: params.actorId,
      }),
      ...(params.requestId && {
        requestId: params.requestId,
      }),
      ...(params.from && {
        from: params.from,
      }),
      ...(params.to && {
        to: params.to,
      }),
    },
  });

  return response.data;
};

// Get activity logs for one request.
export const getRequestActivityLogs = async (requestId, params = {}) => {
  const response = await api.get(`/activity-logs/requests/${requestId}`, {
    params: {
      page: params.page || 1,
      limit: params.limit || 20,
    },
  });

  return response.data;
};

// Get one activity log.
export const getActivityLogById = async (activityLogId) => {
  const response = await api.get(`/activity-logs/${activityLogId}`);

  return response.data;
};
