import api from "@/lib/axios";

export const getDepartments = async (params = {}) => {
  const response = await api.get("/departments", {
    params: {
      page: params.page || 1,
      limit: params.limit || 10,
      ...(params.search?.trim() && {
        search: params.search.trim(),
      }),
      ...(typeof params.isActive === "boolean" && {
        isActive: params.isActive,
      }),
    },
  });

  return response.data;
};

export const getDepartmentById = async (id) => {
  const response = await api.get(`/departments/${id}`);
  return response.data;
};

export const createDepartment = async (departmentData) => {
  const response = await api.post("/departments", departmentData);
  return response.data;
};

export const updateDepartment = async (id, departmentData) => {
  const response = await api.patch(`/departments/${id}`, departmentData);
  return response.data;
};

export const updateDepartmentStatus = async (id, isActive) => {
  const response = await api.patch(`/departments/${id}/status`, {
    isActive,
  });

  return response.data;
};
