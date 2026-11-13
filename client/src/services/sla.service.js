import api from "@/lib/axios";

export const getSlas = async (params = {}) => {
  const response = await api.get("/slas", {
    params: {
      page: params.page || 1,
      limit: params.limit || 10,
      ...(params.priority &&
        params.priority !== "ALL" && { priority: params.priority }),
      ...(params.departmentId &&
        params.departmentId !== "ALL" && {
          departmentId: params.departmentId,
        }),
    },
  });

  return response.data;
};

export const getSlaById = async (id) => {
  const response = await api.get(`/slas/${id}`);
  return response.data;
};

export const createSla = async (data) => {
  const response = await api.post("/slas", data);
  return response.data;
};

export const updateSla = async (id, data) => {
  const existingResult = await getSlaById(id);
  const existing = existingResult.data;

  const responseMinutes = data.responseMinutes ?? existing.responseMinutes;

  const resolutionMinutes =
    data.resolutionMinutes ?? existing.resolutionMinutes;

  if (resolutionMinutes < responseMinutes) {
    throw new Error(
      "Resolution time must be greater than or equal to response time.",
    );
  }

  const response = await api.patch(`/slas/${id}`, data);
  return response.data;
};

export const deleteSla = async (id) => {
  const response = await api.delete(`/slas/${id}`);
  return response.data;
};

export const getApplicableSla = async (priority, departmentId) => {
  const response = await api.get(`/slas/applicable/${priority}`, {
    params: departmentId ? { departmentId } : {},
  });

  return response.data;
};
