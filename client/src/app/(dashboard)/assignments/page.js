"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  ClipboardList,
  Users,
  History,
  UserRound,
  Eye,
  UserCog,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

import {
  getAssignments,
  getAssignmentById,
  getRequestAssignmentHistory,
  reassignRequest,
} from "@/services/assignment.service";

import { getUsers } from "@/services/user.service";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/context/AuthContext";

const LIMIT = 10;

const STATUS_STYLES = {
  OPEN: "bg-blue-50 text-blue-700",
  ASSIGNED: "bg-indigo-50 text-indigo-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  ON_HOLD: "bg-orange-50 text-orange-700",
  RESOLVED: "bg-green-50 text-green-700",
  CLOSED: "bg-gray-100 text-gray-700",
  REJECTED: "bg-red-50 text-red-700",
};

const PRIORITY_STYLES = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-orange-50 text-orange-700",
  URGENT: "bg-red-50 text-red-700",
};

function formatDate(date) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatLabel(value) {
  if (!value) return "—";

  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getErrorMessage(error) {
  return (
    error.response?.data?.message ||
    error.message ||
    "Something went wrong. Please try again."
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        STATUS_STYLES[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {formatLabel(status)}
    </span>
  );
}

function PriorityBadge({ priority }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        PRIORITY_STYLES[priority] || "bg-gray-100 text-gray-700"
      }`}
    >
      {formatLabel(priority)}
    </span>
  );
}

function Modal({ title, onClose, children, size = "max-w-2xl" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`max-h-[90vh] w-full ${size} overflow-y-auto rounded-2xl bg-white shadow-xl`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function AssignmentsPage() {
  const { user } = useAuth();

  const canManage = user?.role === "ADMIN" || user?.role === "SUPPORT_STAFF";

  const [assignments, setAssignments] = useState([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [summary, setSummary] = useState({
    activeCount: 0,
    previousCount: 0,
  });

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [reassignTarget, setReassignTarget] = useState(null);
  const [supportStaff, setSupportStaff] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [reassignNote, setReassignNote] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchAssignments = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        const params = {
          page,
          limit: LIMIT,
          ...(search && { search }),
          ...(statusFilter !== "ALL" && {
            isActive: statusFilter === "ACTIVE",
          }),
        };

        const result = await getAssignments(params);

        if (!result.success) {
          throw new Error(result.message || "Failed to load assignments");
        }

        setAssignments(Array.isArray(result.data) ? result.data : []);

        setTotal(result.pagination?.total ?? 0);
        setTotalPages(result.pagination?.totalPages ?? 1);

        setSummary({
          activeCount: result.summary?.activeCount ?? 0,
          previousCount: result.summary?.previousCount ?? 0,
        });
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, search, statusFilter],
  );

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleStatusFilter = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleRefresh = () => {
    fetchAssignments(false);
  };

  // View assignment details and complete assignment history.
  const handleViewDetails = async (assignment) => {
    try {
      setSelectedAssignment(assignment);
      setDetailLoading(true);
      setAssignmentHistory([]);

      const [detailResult, historyResult] = await Promise.all([
        getAssignmentById(assignment.id),
        getRequestAssignmentHistory(assignment.requestId),
      ]);

      if (!detailResult.success) {
        throw new Error(detailResult.message || "Failed to load assignment");
      }

      if (!historyResult.success) {
        throw new Error(
          historyResult.message || "Failed to load assignment history",
        );
      }

      setSelectedAssignment(detailResult.data);
      setAssignmentHistory(
        Array.isArray(historyResult.data) ? historyResult.data : [],
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  };

  // Load active support staff from the same request department.
  const openReassignModal = async (assignment) => {
    if (!canManage) return;

    const departmentId = assignment.request?.departmentId;

    if (!departmentId) {
      toast.error("The request does not have a department.");
      return;
    }

    try {
      setReassignTarget(assignment);
      setSelectedAssignee("");
      setReassignNote("");
      setSupportStaff([]);
      setStaffLoading(true);

      const result = await getUsers({
        page: 1,
        limit: 100,
        role: "SUPPORT_STAFF",
        status: "ACTIVE",
        departmentId,
      });

      if (!result.success) {
        throw new Error(result.message || "Failed to load support staff");
      }

      const staff = Array.isArray(result.data) ? result.data : [];

      setSupportStaff(staff);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setReassignTarget(null);
    } finally {
      setStaffLoading(false);
    }
  };

  const handleReassign = async (event) => {
    event.preventDefault();

    if (!reassignTarget || !selectedAssignee) {
      toast.error("Please select support staff.");
      return;
    }

    try {
      setSubmitting(true);

      const result = await reassignRequest(reassignTarget.id, {
        assigneeId: selectedAssignee,
        ...(reassignNote.trim() && {
          note: reassignNote.trim(),
        }),
      });

      if (!result.success) {
        throw new Error(result.message || "Reassignment failed");
      }

      toast.success("Request reassigned successfully");

      setReassignTarget(null);
      setSelectedAssignee("");
      setReassignNote("");

      await fetchAssignments(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const closeDetails = () => {
    setSelectedAssignment(null);
    setAssignmentHistory([]);
  };

  const activeOnCurrentPage = assignments.filter(
    (item) => item.isActive,
  ).length;

  const previousOnCurrentPage = assignments.filter(
    (item) => !item.isActive,
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage service request assignments and support staff.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total assignments</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{total}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <ClipboardList size={23} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active assignments</p>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {summary.activeCount}
              </p>
            </div>
            <div className="rounded-xl bg-green-50 p-3 text-green-600">
              <CheckCircle2 size={23} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Previous assignments</p>
              <p className="mt-2 text-3xl font-bold text-gray-700">
                {summary.previousCount}
              </p>
            </div>
            <div className="rounded-xl bg-gray-100 p-3 text-gray-600">
              <History size={23} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active on this page</p>
              <p className="mt-2 text-3xl font-bold text-indigo-600">
                {activeOnCurrentPage}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {previousOnCurrentPage} previous on this page
              </p>
            </div>
            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
              <Users size={23} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <form
            onSubmit={handleSearch}
            className="flex w-full gap-2 lg:max-w-md"
          >
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search request or support staff..."
                className="form-input pl-10"
              />
            </div>

            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {[
              { value: "ALL", label: "All assignments" },
              { value: "ACTIVE", label: "Active" },
              { value: "PREVIOUS", label: "Previous" },
            ].map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => handleStatusFilter(filter.value)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  statusFilter === filter.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Assignments table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Assignment records</h2>
          <p className="mt-1 text-xs text-gray-500">
            Showing {assignments.length} of {total} assignments
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <LoadingSpinner message="Loading assignments..." />
          </div>
        ) : assignments.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
            <div className="rounded-full bg-gray-100 p-5 text-gray-400">
              <ClipboardList size={32} />
            </div>

            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              No assignments found
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Try changing your search or filters.
            </p>

            {(search || statusFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSearchInput("");
                  setStatusFilter("ALL");
                  setPage(1);
                }}
                className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Request</th>
                    <th className="px-5 py-4 font-semibold">Assigned to</th>
                    <th className="px-5 py-4 font-semibold">Assigned by</th>
                    <th className="px-5 py-4 font-semibold">Priority</th>
                    <th className="px-5 py-4 font-semibold">Request status</th>
                    <th className="px-5 py-4 font-semibold">Assignment</th>
                    <th className="px-5 py-4 font-semibold">Assigned date</th>
                    <th className="px-5 py-4 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-blue-600">
                          {assignment.request?.requestCode || "—"}
                        </p>
                        <p className="mt-1 max-w-52 truncate text-gray-700">
                          {assignment.request?.title || "Untitled request"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900">
                          {assignment.assignee?.name || "—"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {assignment.assignee?.email || ""}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-gray-700">
                          {assignment.assignedBy?.name || "—"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <PriorityBadge
                          priority={assignment.request?.priority}
                        />
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={assignment.request?.status} />
                      </td>

                      <td className="px-5 py-4">
                        {assignment.isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
                            <span className="h-2 w-2 rounded-full bg-green-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                            <span className="h-2 w-2 rounded-full bg-gray-400" />
                            Previous
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-gray-600">
                        {formatDate(assignment.assignedAt)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            title="View details and history"
                            onClick={() => handleViewDetails(assignment)}
                            className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Eye size={16} />
                          </button>

                          {canManage && assignment.isActive && (
                            <button
                              type="button"
                              title="Reassign request"
                              onClick={() => openReassignModal(assignment)}
                              className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"
                            >
                              <UserCog size={16} />
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
            {totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => current + 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Assignment details and history modal */}
      {selectedAssignment && (
        <Modal
          title="Assignment details"
          onClose={closeDetails}
          size="max-w-3xl"
        >
          {detailLoading ? (
            <div className="flex min-h-48 items-center justify-center">
              <LoadingSpinner message="Loading assignment details..." />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      REQUEST CODE
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-blue-600">
                      {selectedAssignment.request?.requestCode || "—"}
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={selectedAssignment.request?.status} />
                    <PriorityBadge
                      priority={selectedAssignment.request?.priority}
                    />
                  </div>
                </div>

                <p className="mt-3 font-semibold text-gray-900">
                  {selectedAssignment.request?.title || "Untitled request"}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-gray-500">
                    ASSIGNED TO
                  </p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {selectedAssignment.assignee?.name || "—"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedAssignment.assignee?.email || ""}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500">
                    ASSIGNED BY
                  </p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {selectedAssignment.assignedBy?.name || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500">
                    ASSIGNED DATE
                  </p>
                  <p className="mt-1 text-sm text-gray-800">
                    {formatDate(selectedAssignment.assignedAt)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500">
                    UNASSIGNED DATE
                  </p>
                  <p className="mt-1 text-sm text-gray-800">
                    {formatDate(selectedAssignment.unassignedAt)}
                  </p>
                </div>
              </div>

              {selectedAssignment.note && (
                <div>
                  <p className="text-xs font-medium text-gray-500">
                    ASSIGNMENT NOTE
                  </p>
                  <p className="mt-1 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                    {selectedAssignment.note}
                  </p>
                </div>
              )}

              <div>
                <div className="mb-4 flex items-center gap-2">
                  <History size={19} className="text-blue-600" />
                  <h3 className="font-semibold text-gray-900">
                    Assignment history
                  </h3>
                </div>

                {assignmentHistory.length === 0 ? (
                  <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
                    No assignment history available.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {assignmentHistory.map((history) => (
                      <div key={history.id} className="flex gap-3">
                        <div className="mt-1">
                          {history.isActive ? (
                            <CheckCircle2
                              size={18}
                              className="text-green-600"
                            />
                          ) : (
                            <Clock size={18} className="text-gray-400" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 rounded-lg border border-gray-100 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-gray-900">
                              {history.assignee?.name || "Unknown staff"}
                            </p>

                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                history.isActive
                                  ? "bg-green-50 text-green-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {history.isActive ? "Active" : "Previous"}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-gray-500">
                            Assigned by: {history.assignedBy?.name || "—"}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {formatDate(history.assignedAt)}
                          </p>

                          {history.unassignedAt && (
                            <p className="mt-1 text-xs text-gray-500">
                              Unassigned: {formatDate(history.unassignedAt)}
                            </p>
                          )}

                          {history.note && (
                            <p className="mt-2 text-sm text-gray-600">
                              {history.note}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Reassign modal */}
      {reassignTarget && (
        <Modal
          title="Reassign service request"
          onClose={() => {
            if (!submitting) setReassignTarget(null);
          }}
          size="max-w-lg"
        >
          <form onSubmit={handleReassign} className="space-y-5">
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-xs font-semibold text-blue-600">REQUEST</p>
              <p className="mt-1 font-semibold text-gray-900">
                {reassignTarget.request?.requestCode}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {reassignTarget.request?.title}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Current support staff
              </label>

              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
                {reassignTarget.assignee?.name || "Unknown staff"}
              </div>
            </div>

            <div>
              <label
                htmlFor="assigneeId"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                New support staff *
              </label>

              {staffLoading ? (
                <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
                  <RefreshCw size={16} className="animate-spin" />
                  Loading support staff...
                </div>
              ) : supportStaff.length === 0 ? (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                  <AlertCircle size={16} className="mr-2 inline" />
                  No active support staff found in this department.
                </div>
              ) : (
                <select
                  id="assigneeId"
                  required
                  value={selectedAssignee}
                  onChange={(event) => setSelectedAssignee(event.target.value)}
                  className="form-input"
                >
                  <option value="">Select support staff</option>

                  {supportStaff
                    .filter((staff) => staff.id !== reassignTarget.assigneeId)
                    .map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} ({staff.email})
                      </option>
                    ))}
                </select>
              )}
            </div>

            <div>
              <label
                htmlFor="reassignNote"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Reassignment note
              </label>

              <textarea
                id="reassignNote"
                rows={3}
                maxLength={1000}
                value={reassignNote}
                onChange={(event) => setReassignNote(event.target.value)}
                placeholder="Enter reason for reassignment (optional)"
                className="form-input resize-none"
              />

              <p className="mt-1 text-right text-xs text-gray-400">
                {reassignNote.length}/1000
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setReassignTarget(null)}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting || staffLoading || !selectedAssignee}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Reassigning..." : "Confirm reassignment"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
