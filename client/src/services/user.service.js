import api from "@/lib/axios";

export const getUsers = async (params = {}) => {
  const response = await api.get("/users", {
    params: {
      page: params.page || 1,
      limit: params.limit || 10,
      ...(params.search?.trim() && { search: params.search.trim() }),
      ...(params.role && params.role !== "ALL" && { role: params.role }),
      ...(params.status &&
        params.status !== "ALL" && {
          status: params.status,
        }),
      ...(params.departmentId && {
        departmentId: params.departmentId,
      }),
    },
  });

  return response.data;
};

export const getUserById = async (id) => {
  const response = await api.get(`/users/${id}`);
  return response.data;
};

export const createUser = async (userData) => {
  const response = await api.post("/users", userData);
  return response.data;
};

export const updateUser = async (id, userData) => {
  const response = await api.patch(`/users/${id}`, userData);
  return response.data;
};

export const updateUserStatus = async (id, status) => {
  const response = await api.patch(`/users/${id}/status`, { status });
  return response.data;
};
