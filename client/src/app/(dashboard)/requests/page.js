"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

import { getCategories } from "@/services/category.service";
import {
  getRequests,
  getRequestById,
  createRequest,
  updateRequest,
  updateRequestStatus,
} from "@/services/request.service";

const STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const STATUS_TRANSITIONS = {
  OPEN: ["ASSIGNED", "REJECTED"],
  ASSIGNED: ["IN_PROGRESS", "ON_HOLD", "REJECTED"],
  IN_PROGRESS: ["ON_HOLD", "RESOLVED", "REJECTED"],
  ON_HOLD: ["IN_PROGRESS", "REJECTED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
  REJECTED: [],
};

const emptyForm = {
  title: "",
  description: "",
  categoryId: "",
  priority: "MEDIUM",
};

const statusClass = (status) => {
  const styles = {
    OPEN: "bg-blue-100 text-blue-700",
    ASSIGNED: "bg-indigo-100 text-indigo-700",
    IN_PROGRESS: "bg-yellow-100 text-yellow-700",
    ON_HOLD: "bg-orange-100 text-orange-700",
    RESOLVED: "bg-green-100 text-green-700",
    CLOSED: "bg-gray-200 text-gray-700",
    REJECTED: "bg-red-100 text-red-700",
  };

  return styles[status] || "bg-gray-100 text-gray-700";
};

const priorityClass = (priority) => {
  const styles = {
    LOW: "bg-gray-100 text-gray-700",
    MEDIUM: "bg-blue-100 text-blue-700",
    HIGH: "bg-orange-100 text-orange-700",
    URGENT: "bg-red-100 text-red-700",
  };

  return styles[priority] || "bg-gray-100 text-gray-700";
};

const formatDate = (date) => {
  if (!date) return "—";

  return new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export default function RequestsPage() {
  const { user } = useAuth();

  const isAdmin = user?.role === "ADMIN";
  const isSupport = user?.role === "SUPPORT_STAFF";
  const canChangeStatus = isAdmin || isSupport;

  const [requests, setRequests] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRequests: 0,
    limit: 10,
  });

  const [showForm, setShowForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);

      const result = await getRequests({
        page,
        limit: 10,
        search,
        status: statusFilter,
        priority: priorityFilter,
      });

      if (!result?.success) {
        throw new Error(result?.message || "Unable to load requests");
      }

      setRequests(Array.isArray(result.data) ? result.data : []);
      setPagination(
        result.pagination || {
          currentPage: 1,
          totalPages: 1,
          totalRequests: 0,
          limit: 10,
        },
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to load requests",
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, priorityFilter]);

  const fetchCategories = useCallback(async () => {
    try {
      const result = await getCategories({
        page: 1,
        limit: 100,
        isActive: true,
      });

      setCategories(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to load request categories",
      );
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openCreateForm = () => {
    setEditingRequest(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (request) => {
    setEditingRequest(request);
    setForm({
      title: request.title || "",
      description: request.description || "",
      categoryId: request.categoryId || "",
      priority: request.priority || "MEDIUM",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingRequest(null);
    setForm(emptyForm);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.categoryId) {
      toast.error("Please select a category");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        categoryId: form.categoryId,
        priority: form.priority,
      };

      if (editingRequest) {
        const result = await updateRequest(editingRequest.id, payload);
        toast.success(result.message || "Request updated successfully");
      } else {
        const result = await createRequest(payload);
        toast.success(result.message || "Request submitted successfully");
      }

      closeForm();
      setPage(1);

      // Refresh the list after the mutation.
      if (page === 1) {
        await fetchRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save request");
    } finally {
      setSaving(false);
    }
  };

  const openDetails = async (requestId) => {
    try {
      setDetailsLoading(true);
      setSelectedRequest(null);

      const result = await getRequestById(requestId);

      if (!result?.success) {
        throw new Error(result?.message || "Unable to load request");
      }

      setSelectedRequest(result.data);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Unable to load request details",
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleStatusChange = async (request, nextStatus) => {
    if (!nextStatus || nextStatus === request.status) return;

    const confirmed = window.confirm(
      `Change request ${request.requestCode} from ${request.status} to ${nextStatus}?`,
    );

    if (!confirmed) return;

    try {
      const result = await updateRequestStatus(request.id, nextStatus);

      toast.success(result.message || "Request status updated");

      await fetchRequests();

      if (selectedRequest?.id === request.id) {
        const refreshed = await getRequestById(request.id);
        setSelectedRequest(refreshed.data);
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to update request status",
      );
    }
  };

  const canEditRequest = (request) => {
    if (isAdmin) return true;

    return (
      user?.role === "EMPLOYEE" &&
      request.requesterId === user.id &&
      request.status === "OPEN"
    );
  };

  const handleSearch = (event) => {
    setSearch(event.target.value);
    setPage(1);
  };

  const handleStatusFilter = (event) => {
    setStatusFilter(event.target.value);
    setPage(1);
  };

  const handlePriorityFilter = (event) => {
    setPriorityFilter(event.target.value);
    setPage(1);
  };

  const closeDetails = () => {
    setSelectedRequest(null);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Requests</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create, track, and manage employee service requests.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={18} />
          Create Request
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Total matching requests</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {pagination.totalRequests}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Requests on this page</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {requests.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Current page</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {pagination.currentPage || page} / {pagination.totalPages || 1}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 lg:flex-row">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={search}
            onChange={handleSearch}
            placeholder="Search request code, title, or description..."
            className="form-input w-full pl-10"
          />
        </div>

        <select
          value={statusFilter}
          onChange={handleStatusFilter}
          className="form-input w-full lg:w-48"
        >
          <option value="ALL">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={handlePriorityFilter}
          className="form-input w-full lg:w-44"
        >
          <option value="ALL">All priorities</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={fetchRequests}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Request table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
            <ClipboardList size={42} className="text-gray-300" />
            <h3 className="mt-3 font-semibold text-gray-800">
              No requests found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Try changing your filters or create a new request.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-4">Request</th>
                    <th className="px-5 py-4">Requester</th>
                    <th className="px-5 py-4">Department / Category</th>
                    <th className="px-5 py-4">Priority</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Created</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {requests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">
                          {request.title}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {request.requestCode}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-800">
                          {request.requester?.name || "—"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {request.requester?.email || ""}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-gray-800">
                          {request.department?.name || "—"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {request.category?.name || "—"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClass(
                            request.priority,
                          )}`}
                        >
                          {request.priority}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {canChangeStatus ? (
                          <select
                            value={request.status}
                            onChange={(event) =>
                              handleStatusChange(request, event.target.value)
                            }
                            className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold outline-none ${statusClass(
                              request.status,
                            )}`}
                          >
                            <option value={request.status}>
                              {request.status.replaceAll("_", " ")}
                            </option>
                            {(STATUS_TRANSITIONS[request.status] || []).map(
                              (status) => (
                                <option key={status} value={status}>
                                  {status.replaceAll("_", " ")}
                                </option>
                              ),
                            )}
                          </select>
                        ) : (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
                              request.status,
                            )}`}
                          >
                            {request.status.replaceAll("_", " ")}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-gray-600">
                        {formatDate(request.createdAt)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            title="View request"
                            onClick={() => openDetails(request.id)}
                            className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                          >
                            <Eye size={17} />
                          </button>

                          {canEditRequest(request) && (
                            <button
                              type="button"
                              title="Edit request"
                              onClick={() => openEditForm(request)}
                              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                            >
                              <Pencil size={17} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row">
              <p className="text-sm text-gray-500">
                Page {pagination.currentPage || page} of{" "}
                {pagination.totalPages || 1} · {pagination.totalRequests}{" "}
                requests
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-lg border border-gray-300 p-2 text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={18} />
                </button>

                <button
                  type="button"
                  disabled={page >= (pagination.totalPages || 1)}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-lg border border-gray-300 p-2 text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingRequest ? "Edit Request" : "Create Service Request"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Enter the request information below.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Request title *
                </label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleFormChange}
                  required
                  minLength={5}
                  maxLength={200}
                  placeholder="Enter a short request title"
                  className="form-input w-full"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Description *
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={5}
                  placeholder="Explain your issue or service requirement..."
                  className="form-input w-full"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Category *
                  </label>
                  <select
                    name="categoryId"
                    value={form.categoryId}
                    onChange={handleFormChange}
                    required
                    className="form-input w-full"
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name} — {category.department?.name}
                      </option>
                    ))}
                  </select>
                  {categories.length === 0 && (
                    <p className="mt-1 text-xs text-red-600">
                      No active categories available. Check your category
                      permissions and department configuration.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Priority *
                  </label>
                  <select
                    name="priority"
                    value={form.priority}
                    onChange={handleFormChange}
                    className="form-input w-full"
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || categories.length === 0}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingRequest
                      ? "Save Changes"
                      : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request details modal */}
      {(detailsLoading || selectedRequest) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-3xl rounded-xl bg-white shadow-xl">
            {detailsLoading ? (
              <div className="flex min-h-64 items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between border-b px-6 py-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      Request Details
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {selectedRequest.requestCode}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeDetails}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-5 p-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {selectedRequest.title}
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                      {selectedRequest.description}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Detail
                      label="Requester"
                      value={selectedRequest.requester?.name}
                    />
                    <Detail
                      label="Email"
                      value={selectedRequest.requester?.email}
                    />
                    <Detail
                      label="Department"
                      value={selectedRequest.department?.name}
                    />
                    <Detail
                      label="Category"
                      value={selectedRequest.category?.name}
                    />
                    <Detail label="Priority" value={selectedRequest.priority} />
                    <Detail
                      label="Status"
                      value={selectedRequest.status?.replaceAll("_", " ")}
                    />
                    <Detail
                      label="Created"
                      value={formatDate(selectedRequest.createdAt)}
                    />
                    <Detail
                      label="Last updated"
                      value={formatDate(selectedRequest.updatedAt)}
                    />
                    <Detail
                      label="Response due"
                      value={formatDate(selectedRequest.responseDueAt)}
                    />
                    <Detail
                      label="Resolution due"
                      value={formatDate(selectedRequest.resolutionDueAt)}
                    />
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="mb-3 font-semibold text-gray-900">
                      Assignment history
                    </h4>

                    {selectedRequest.assignments?.length ? (
                      <div className="space-y-3">
                        {selectedRequest.assignments.map((assignment) => (
                          <div
                            key={assignment.id}
                            className="rounded-lg border border-gray-200 p-3"
                          >
                            <p className="font-medium text-gray-800">
                              {assignment.assignee?.name || "Assignee"}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              Assigned by {assignment.assignedBy?.name || "—"} ·{" "}
                              {formatDate(assignment.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        This request has not been assigned yet.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end border-t pt-4">
                    <button
                      type="button"
                      onClick={closeDetails}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium text-gray-900">
        {value || "—"}
      </p>
    </div>
  );
}
