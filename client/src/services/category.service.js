import api from "@/lib/axios";

export const getCategories = async (params = {}) => {
  const response = await api.get("/categories", {
    params: {
      page: params.page || 1,
      limit: params.limit || 10,
      ...(params.search?.trim() && {
        search: params.search.trim(),
      }),
      ...(params.departmentId &&
        params.departmentId !== "ALL" && {
          departmentId: params.departmentId,
        }),
      ...(typeof params.isActive === "boolean" && {
        isActive: params.isActive,
      }),
    },
  });

  return response.data;
};

export const getCategoryById = async (id) => {
  const response = await api.get(`/categories/${id}`);
  return response.data;
};

export const createCategory = async (categoryData) => {
  const response = await api.post("/categories", categoryData);
  return response.data;
};

export const updateCategory = async (id, categoryData) => {
  const response = await api.patch(`/categories/${id}`, categoryData);
  return response.data;
};

export const updateCategoryStatus = async (id, isActive) => {
  const response = await api.patch(`/categories/${id}/status`, {
    isActive,
  });
  return response.data;
};
