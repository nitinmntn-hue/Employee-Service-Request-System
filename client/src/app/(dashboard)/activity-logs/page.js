"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Search,
  RefreshCw,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  User,
  ClipboardList,
  Filter,
  History,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import {
  getActivityLogs,
  getRequestActivityLogs,
  getActivityLogById,
} from "@/services/activityLog.service";

import { useAuth } from "@/context/AuthContext";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const LIMIT = 20;

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

function formatAction(action) {
  if (!action) return "Unknown action";

  return action
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getErrorMessage(error) {
  return (
    error.response?.data?.message ||
    error.message ||
    "Something went wrong. Please try again."
  );
}

// Convert a local date input to an ISO datetime.
// "from" starts at the beginning of the selected day.
// "to" ends at the end of the selected day.
function toISODate(value, endOfDay = false) {
  if (!value) return undefined;

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);

  return date.toISOString();
}

function ActionBadge({ action }) {
  return (
    <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
      {formatAction(action)}
    </span>
  );
}

function DetailModal({ log, onClose }) {
  if (!log) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Activity log details
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Complete activity record
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <p className="text-xs font-medium text-gray-500">ACTION</p>
            <div className="mt-2">
              <ActionBadge action={log.action} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-gray-500">ACTOR</p>
              <p className="mt-1 font-semibold text-gray-900">
                {log.actor?.name || "System / Unknown"}
              </p>
              {log.actor?.email && (
                <p className="mt-1 text-sm text-gray-500">{log.actor.email}</p>
              )}
              {log.actor?.role && (
                <p className="mt-1 text-xs text-gray-500">{log.actor.role}</p>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500">DATE AND TIME</p>
              <p className="mt-1 text-sm text-gray-800">
                {formatDate(log.createdAt)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500">REQUEST CODE</p>
              <p className="mt-1 font-medium text-blue-600">
                {log.request?.requestCode || "—"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500">
                REQUEST STATUS
              </p>
              <p className="mt-1 text-sm text-gray-800">
                {log.request?.status?.replaceAll("_", " ") || "—"}
              </p>
            </div>
          </div>

          {log.request?.title && (
            <div>
              <p className="text-xs font-medium text-gray-500">REQUEST TITLE</p>
              <p className="mt-1 text-sm text-gray-800">{log.request.title}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-500">ACTIVITY LOG ID</p>
            <p className="mt-1 break-all font-mono text-xs text-gray-600">
              {log.id}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500">ACTOR ID</p>
            <p className="mt-1 break-all font-mono text-xs text-gray-600">
              {log.actorId || "System / Unknown"}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500">REQUEST ID</p>
            <p className="mt-1 break-all font-mono text-xs text-gray-600">
              {log.requestId || "—"}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">
              ACTIVITY DETAILS
            </p>

            <pre className="max-h-72 overflow-auto rounded-xl bg-gray-900 p-4 text-xs leading-6 text-green-300">
              {JSON.stringify(log.details ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ActivityLogsPage() {
  const { user } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  const [logs, setLogs] = useState([]);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [actionInput, setActionInput] = useState("");
  const [action, setAction] = useState("");
  const [actorId, setActorId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Detail modal
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ADMIN gets the global list.
  // Other roles must provide a request ID to view its history.
  const fetchLogs = useCallback(
    async (showLoader = true) => {
      if (!user) return;

      try {
        if (showLoader) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        let result;

        if (isAdmin) {
          result = await getActivityLogs({
            page,
            limit: LIMIT,
            ...(action && { action }),
            ...(actorId.trim() && {
              actorId: actorId.trim(),
            }),
            ...(requestId.trim() && {
              requestId: requestId.trim(),
            }),
            ...(from && {
              from: toISODate(from),
            }),
            ...(to && {
              to: toISODate(to, true),
            }),
          });
        } else {
          if (!requestId.trim()) {
            setLogs([]);
            setTotal(0);
            setTotalPages(1);
            return;
          }

          result = await getRequestActivityLogs(requestId.trim(), {
            page,
            limit: LIMIT,
          });
        }

        if (!result.success) {
          throw new Error(result.message || "Failed to fetch activity logs");
        }

        setLogs(Array.isArray(result.data) ? result.data : []);
        setTotal(result.pagination?.total ?? 0);
        setTotalPages(result.pagination?.totalPages ?? 1);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, isAdmin, page, action, actorId, requestId, from, to],
  );

  useEffect(() => {
    if (!user) return;

    if (!isAdmin && !requestId.trim()) {
      setLogs([]);
      setTotal(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    fetchLogs();
  }, [user, isAdmin, requestId, fetchLogs]);

  const handleSearch = (event) => {
    event.preventDefault();

    if (!isAdmin && !requestId.trim()) {
      toast.error("Please enter a valid request ID.");
      return;
    }

    if (from && to && from > to) {
      toast.error("The start date cannot be after the end date.");
      return;
    }

    setPage(1);
    setAction(actionInput.trim());
  };

  const handleReset = () => {
    setActionInput("");
    setAction("");
    setActorId("");
    setRequestId("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const handleViewDetails = async (log) => {
    try {
      setSelectedLog(log);
      setDetailLoading(true);

      const result = await getActivityLogById(log.id);

      if (!result.success) {
        throw new Error(result.message || "Failed to fetch activity details");
      }

      setSelectedLog(result.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchLogs(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Activity size={24} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Activity Logs
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Track actions and changes across service requests.
              </p>
            </div>
          </div>
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Matching activity logs
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{total}</p>
            </div>

            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <History size={22} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Current page records
              </p>
              <p className="mt-2 text-3xl font-bold text-indigo-600">
                {logs.length}
              </p>
            </div>

            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
              <FileText size={22} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Filter size={18} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900">Filter activity logs</h2>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          {isAdmin && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="action"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Action
                  </label>

                  <div className="relative">
                    <Search
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      id="action"
                      type="text"
                      value={actionInput}
                      onChange={(event) => setActionInput(event.target.value)}
                      placeholder="Example: REQUEST_ASSIGNED"
                      className="form-input pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="actorId"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Actor ID
                  </label>

                  <input
                    id="actorId"
                    type="text"
                    value={actorId}
                    onChange={(event) => setActorId(event.target.value)}
                    placeholder="Enter user UUID"
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="requestId"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Request ID
                </label>

                <input
                  id="requestId"
                  type="text"
                  value={requestId}
                  onChange={(event) => setRequestId(event.target.value)}
                  placeholder="Enter request UUID"
                  className="form-input"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="from"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    From date
                  </label>

                  <div className="relative">
                    <CalendarDays
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      id="from"
                      type="date"
                      value={from}
                      max={to || undefined}
                      onChange={(event) => setFrom(event.target.value)}
                      className="form-input pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="to"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    To date
                  </label>

                  <div className="relative">
                    <CalendarDays
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      id="to"
                      type="date"
                      value={to}
                      min={from || undefined}
                      onChange={(event) => setTo(event.target.value)}
                      className="form-input pl-10"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {!isAdmin && (
            <div>
              <label
                htmlFor="requestId"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Request ID
              </label>

              <input
                id="requestId"
                type="text"
                value={requestId}
                onChange={(event) => setRequestId(event.target.value)}
                placeholder="Enter the UUID of a request you can access"
                className="form-input"
              />

              <p className="mt-2 text-xs text-gray-500">
                You can view activity history only for requests you're
                authorized to access.
              </p>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reset
            </button>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Search size={16} />
              Apply filters
            </button>
          </div>
        </form>
      </div>

      {/* Activity log table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Activity history</h2>

          <p className="mt-1 text-xs text-gray-500">
            Showing {logs.length} of {total} records
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <LoadingSpinner message="Loading activity logs..." />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
            <div className="rounded-full bg-gray-100 p-5 text-gray-400">
              <Activity size={32} />
            </div>

            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              No activity logs found
            </h3>

            <p className="mt-1 max-w-md text-sm text-gray-500">
              {isAdmin
                ? "There are no activity records matching your filters."
                : "Enter a request ID above to view its activity history."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Activity</th>
                    <th className="px-5 py-4 font-semibold">Performed by</th>
                    <th className="px-5 py-4 font-semibold">Request</th>
                    <th className="px-5 py-4 font-semibold">Date and time</th>
                    <th className="px-5 py-4 text-right font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="transition hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <ActionBadge action={log.action} />
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="rounded-full bg-gray-100 p-2 text-gray-500">
                            <User size={15} />
                          </div>

                          <div>
                            <p className="font-medium text-gray-900">
                              {log.actor?.name || "System / Unknown"}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {log.actor?.role || ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {log.request ? (
                          <div>
                            <p className="font-semibold text-blue-600">
                              {log.request.requestCode}
                            </p>
                            <p className="mt-1 max-w-52 truncate text-gray-600">
                              {log.request.title}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400">No request</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                        {formatDate(log.createdAt)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleViewDetails(log)}
                          title="View activity details"
                          className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Eye size={17} />
                        </button>
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

      {/* Detail modal */}
      {selectedLog &&
        (detailLoading ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="rounded-xl bg-white p-8">
              <LoadingSpinner message="Loading activity details..." />
            </div>
          </div>
        ) : (
          <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
        ))}
    </div>
  );
}
