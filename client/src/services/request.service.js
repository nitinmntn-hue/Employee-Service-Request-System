import api from "@/lib/axios";

export const getRequests = async (params = {}) => {
  const response = await api.get("/requests", {
    params: {
      page: params.page || 1,
      limit: params.limit || 10,
      ...(params.search?.trim() && { search: params.search.trim() }),
      ...(params.status &&
        params.status !== "ALL" && { status: params.status }),
      ...(params.priority &&
        params.priority !== "ALL" && { priority: params.priority }),
      ...(params.categoryId &&
        params.categoryId !== "ALL" && { categoryId: params.categoryId }),
      ...(params.departmentId && { departmentId: params.departmentId }),
    },
  });

  return response.data;
};

export const getRequestById = async (id) => {
  const response = await api.get(`/requests/${id}`);
  return response.data;
};

export const createRequest = async (data) => {
  const response = await api.post("/requests", data);
  return response.data;
};

export const updateRequest = async (id, data) => {
  const response = await api.patch(`/requests/${id}`, data);
  return response.data;
};

export const updateRequestStatus = async (id, status) => {
  const response = await api.patch(`/requests/${id}/status`, { status });
  return response.data;
};
