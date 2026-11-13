import api from "@/lib/axios";

// Get assignments with pagination and filters.
export const getAssignments = async (params = {}) => {
  const response = await api.get("/assignments", {
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

// Assign a request.
export const assignRequest = async (requestId, assignmentData) => {
  const response = await api.post(
    `/assignments/requests/${requestId}`,
    assignmentData,
  );

  return response.data;
};

// Reassign an existing assignment.
export const reassignRequest = async (assignmentId, assignmentData) => {
  const response = await api.patch(
    `/assignments/${assignmentId}/reassign`,
    assignmentData,
  );

  return response.data;
};

// Get assignment history for a request.
export const getRequestAssignmentHistory = async (requestId) => {
  const response = await api.get(`/assignments/requests/${requestId}`);

  return response.data;
};

// Get one assignment by ID.
export const getAssignmentById = async (assignmentId) => {
  const response = await api.get(`/assignments/${assignmentId}`);
  return response.data;
};
