"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ExternalLink,
  RefreshCw,
  Inbox,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  UserPlus,
  ClipboardList,
  AlertTriangle,
  Clock,
  CircleCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "@/services/notification.service";

import LoadingSpinner from "@/components/ui/LoadingSpinner";

const LIMIT = 10;

const TYPE_OPTIONS = [
  { value: "ALL", label: "All types" },
  { value: "REQUEST_CREATED", label: "Request created" },
  { value: "REQUEST_ASSIGNED", label: "Request assigned" },
  { value: "STATUS_CHANGED", label: "Status changed" },
  { value: "NEW_COMMENT", label: "New comment" },
  { value: "SLA_WARNING", label: "SLA warning" },
  { value: "SLA_BREACHED", label: "SLA breached" },
];

const TYPE_CONFIG = {
  REQUEST_CREATED: {
    label: "Request created",
    icon: ClipboardList,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  REQUEST_ASSIGNED: {
    label: "Request assigned",
    icon: UserPlus,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
  STATUS_CHANGED: {
    label: "Status changed",
    icon: CircleCheck,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  NEW_COMMENT: {
    label: "New comment",
    icon: MessageSquare,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  SLA_WARNING: {
    label: "SLA warning",
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  SLA_BREACHED: {
    label: "SLA breached",
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
};

function formatDate(date) {
  if (!date) return "Unknown date";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getErrorMessage(error) {
  return (
    error.response?.data?.message ||
    error.message ||
    "Something went wrong. Please try again."
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [readFilter, setReadFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(
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
          ...(readFilter !== "ALL" && {
            isRead: readFilter === "READ",
          }),
          ...(typeFilter !== "ALL" && {
            type: typeFilter,
          }),
        };

        const result = await getMyNotifications(params);

        if (!result.success) {
          throw new Error(result.message || "Failed to load notifications");
        }

        setNotifications(Array.isArray(result.data) ? result.data : []);

        setUnreadCount(result.unreadCount ?? 0);
        setTotal(result.pagination?.total ?? 0);
        setTotalPages(result.pagination?.totalPages ?? 1);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, readFilter, typeFilter],
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleReadFilter = (value) => {
    setReadFilter(value);
    setPage(1);
  };

  const handleTypeFilter = (value) => {
    setTypeFilter(value);
    setPage(1);
  };

  const handleMarkAsRead = async (notification) => {
    if (notification.isRead) return;

    try {
      setActionId(notification.id);

      const result = await markNotificationAsRead(notification.id);

      if (!result.success) {
        throw new Error(result.message);
      }

      setNotifications((previous) =>
        previous.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item,
        ),
      );

      setUnreadCount((count) => Math.max(0, count - 1));

      toast.success("Notification marked as read");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;

    try {
      setMarkingAll(true);

      const result = await markAllNotificationsAsRead();

      if (!result.success) {
        throw new Error(result.message);
      }

      setNotifications((previous) =>
        previous.map((item) => ({
          ...item,
          isRead: true,
        })),
      );

      setUnreadCount(0);

      toast.success(`${result.updatedCount ?? 0} notifications marked as read`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (notificationId) => {
    if (!window.confirm("Delete this notification?")) return;

    try {
      setActionId(notificationId);

      const result = await deleteNotification(notificationId);

      if (!result.success) {
        throw new Error(result.message);
      }

      const deletedNotification = notifications.find(
        (item) => item.id === notificationId,
      );

      setNotifications((previous) =>
        previous.filter((item) => item.id !== notificationId),
      );

      setTotal((count) => Math.max(0, count - 1));

      if (deletedNotification && !deletedNotification.isRead) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }

      toast.success("Notification deleted");

      // If the current page becomes empty, go to the previous page.
      if (notifications.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        fetchNotifications(false);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionId(null);
    }
  };

  const handleRefresh = () => {
    fetchNotifications(false);
  };

  const getTypeConfig = (type) => {
    return (
      TYPE_CONFIG[type] || {
        label: type?.replaceAll("_", " ") || "Notification",
        icon: Bell,
        color: "text-gray-600",
        bg: "bg-gray-100",
      }
    );
  };

  const readCount = total - notifications.filter((item) => !item.isRead).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Bell size={24} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Notifications
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Stay updated on your service requests.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0 || markingAll}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck size={16} />
            {markingAll ? "Updating..." : "Mark all as read"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Unread notifications
              </p>
              <p className="mt-2 text-3xl font-bold text-blue-600">
                {unreadCount}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Bell size={22} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Matching notifications
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{total}</p>
            </div>

            <div className="rounded-xl bg-green-50 p-3 text-green-600">
              <Inbox size={22} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { value: "ALL", label: "All" },
            { value: "UNREAD", label: "Unread" },
            { value: "READ", label: "Read" },
          ].map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => handleReadFilter(filter.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                readFilter === filter.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <select
          value={typeFilter}
          onChange={(event) => handleTypeFilter(event.target.value)}
          className="form-input w-full sm:w-56"
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Notification list */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-gray-900">Your notifications</h2>
            <p className="mt-1 text-xs text-gray-500">
              Showing {notifications.length} of {total} notifications
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <LoadingSpinner message="Loading notifications..." />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
            <div className="rounded-full bg-gray-100 p-5 text-gray-400">
              <Inbox size={32} />
            </div>

            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              No notifications found
            </h3>

            <p className="mt-1 max-w-sm text-sm text-gray-500">
              {readFilter === "UNREAD"
                ? "You're all caught up. You have no unread notifications."
                : "There are no notifications matching your selected filters."}
            </p>

            {(readFilter !== "ALL" || typeFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setReadFilter("ALL");
                  setTypeFilter("ALL");
                  setPage(1);
                }}
                className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => {
              const config = getTypeConfig(notification.type);
              const TypeIcon = config.icon;
              const busy = actionId === notification.id;

              return (
                <div
                  key={notification.id}
                  className={`flex flex-col gap-4 px-5 py-5 transition hover:bg-gray-50 sm:flex-row sm:items-start ${
                    !notification.isRead ? "bg-blue-50/40" : ""
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${config.bg} ${config.color}`}
                  >
                    <TypeIcon size={21} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {notification.title}
                      </h3>

                      {!notification.isRead && (
                        <span className="h-2 w-2 rounded-full bg-blue-600" />
                      )}
                    </div>

                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      {notification.message}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                      <span className="font-medium">{config.label}</span>

                      <span>{formatDate(notification.createdAt)}</span>

                      {notification.request && (
                        <Link
                          href={`/requests/${notification.request.id}`}
                          className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700"
                        >
                          {notification.request.requestCode}
                          <ExternalLink size={12} />
                        </Link>
                      )}
                    </div>

                    {notification.request && (
                      <p className="mt-2 text-xs text-gray-500">
                        Request: {notification.request.title}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                    {!notification.isRead && (
                      <button
                        type="button"
                        title="Mark as read"
                        disabled={busy}
                        onClick={() => handleMarkAsRead(notification)}
                        className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                      >
                        <Check size={17} />
                      </button>
                    )}

                    <button
                      type="button"
                      title="Delete notification"
                      disabled={busy}
                      onClick={() => handleDelete(notification.id)}
                      className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
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
      </div>
    </div>
  );
}
