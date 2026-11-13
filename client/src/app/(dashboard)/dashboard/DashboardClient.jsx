"use client";

export const instant = false;

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowUpRight,
  RefreshCw,
  Users,
  Building2,
  Layers,
  Activity,
} from "lucide-react";

import { getDashboard } from "@/services/dashboard.service";
import { useAuth } from "@/context/AuthContext";

const statusStyles = {
  OPEN: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  ASSIGNED:
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
  IN_PROGRESS:
    "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
  ON_HOLD:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  RESOLVED:
    "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  CLOSED: "bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400",
  REJECTED: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

const priorityStyles = {
  LOW: "text-gray-500",
  MEDIUM: "text-blue-600 dark:text-blue-400",
  HIGH: "text-orange-600 dark:text-orange-400",
  URGENT: "text-red-600 dark:text-red-400",
};

const formatStatus = (status = "") => status.replaceAll("_", " ");

const formatDate = (date) => {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
};

function StatCard({ title, value, description, icon: Icon, color }) {
  const colors = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    amber:
      "bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    purple:
      "bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
    green:
      "bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400",
    indigo:
      "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </p>

        <div className={`rounded-lg p-2.5 ${colors[color] || colors.blue}`}>
          <Icon size={21} />
        </div>
      </div>

      <h2 className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
        {value ?? 0}
      </h2>

      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
      <RefreshCw className="animate-spin text-blue-600" size={30} />
      <p className="text-sm text-gray-500">Loading dashboard...</p>
    </div>
  );
}

export default function DashboardClient() {
  const { user } = useAuth();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = async () => {
    try {
      setError("");

      const result = await getDashboard();

      if (!result?.success) {
        throw new Error(result?.message || "Unable to load dashboard");
      }

      setDashboard(result.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Something went wrong while loading dashboard.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const firstName = user?.name?.split(" ")[0] || "User";
  const stats = dashboard?.stats || {};
  const recentRequests = dashboard?.recentRequests || [];

  const statCards = [
    {
      title: "Total Requests",
      value: stats.totalRequests,
      description: "Requests visible to you",
      icon: ClipboardList,
      color: "blue",
    },
    {
      title: "Open Requests",
      value: stats.OPEN,
      description: "Waiting for assignment",
      icon: Clock,
      color: "amber",
    },
    {
      title: "In Progress",
      value: stats.IN_PROGRESS,
      description: "Currently being handled",
      icon: Activity,
      color: "purple",
    },
    {
      title: "Resolved Requests",
      value: stats.RESOLVED,
      description: "Successfully resolved",
      icon: CheckCircle2,
      color: "green",
    },
  ];

  // Additional cards for administrators
  if (dashboard?.role === "ADMIN") {
    statCards.push(
      {
        title: "Total Users",
        value: stats.totalUsers,
        description: "Registered system users",
        icon: Users,
        color: "indigo",
      },
      {
        title: "Departments",
        value: stats.totalDepartments,
        description: "Registered departments",
        icon: Building2,
        color: "blue",
      },
      {
        title: "Categories",
        value: stats.totalCategories,
        description: "Service categories",
        icon: Layers,
        color: "purple",
      },
      {
        title: "Active Assignments",
        value: stats.activeAssignments,
        description: "Currently active assignments",
        icon: ClipboardList,
        color: "green",
      },
    );
  }

  // Additional card for support staff
  if (dashboard?.role === "SUPPORT_STAFF") {
    statCards.push({
      title: "My Active Assignments",
      value: stats.myActiveAssignments,
      description: "Requests assigned to you",
      icon: ClipboardList,
      color: "indigo",
    });
  }

  const statusItems = [
    { label: "Open", value: stats.OPEN || 0, color: "bg-blue-500" },
    { label: "Assigned", value: stats.ASSIGNED || 0, color: "bg-indigo-500" },
    {
      label: "In Progress",
      value: stats.IN_PROGRESS || 0,
      color: "bg-purple-500",
    },
    { label: "On Hold", value: stats.ON_HOLD || 0, color: "bg-amber-500" },
    { label: "Resolved", value: stats.RESOLVED || 0, color: "bg-green-500" },
    { label: "Closed", value: stats.CLOSED || 0, color: "bg-gray-500" },
    { label: "Rejected", value: stats.REJECTED || 0, color: "bg-red-500" },
  ];

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/20">
        <div className="flex items-center gap-3">
          <AlertCircle className="text-red-600" size={22} />
          <div>
            <h2 className="font-semibold text-red-700 dark:text-red-400">
              Unable to load dashboard
            </h2>
            <p className="mt-1 text-sm text-red-600 dark:text-red-300">
              {error}
            </p>
          </div>
        </div>

        <button
          onClick={fetchDashboard}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <RefreshCw size={16} />
          Try Again
        </button>
      </div>
    );
  }

  const totalForChart = statusItems.reduce(
    (total, item) => total + item.value,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Welcome back, {firstName}! Here's your service request overview.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={fetchDashboard}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <Link
            href="/requests/create"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={18} />
            Create Request
          </Link>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      {/* Requests and quick actions */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Recent Requests */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 xl:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Recent Requests
              </h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Latest service requests
              </p>
            </div>

            <Link
              href="/requests"
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              View all <ArrowUpRight size={16} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Request</th>
                  <th className="px-5 py-3 font-medium">Requester</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {recentRequests.length > 0 ? (
                  recentRequests.map((request) => (
                    <tr
                      key={request.id}
                      className="transition hover:bg-gray-50 dark:hover:bg-gray-800/40"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/requests/${request.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600 dark:text-white"
                        >
                          {request.title}
                        </Link>

                        <p className="mt-1 text-xs text-gray-500">
                          {request.requestCode}
                        </p>

                        <p className="text-xs text-gray-400">
                          {request.category?.name || "Uncategorized"}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                        {request.requester?.name || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`text-xs font-semibold ${priorityStyles[request.priority] || "text-gray-500"}`}
                        >
                          {request.priority}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[request.status] || "bg-gray-100 text-gray-600"}`}
                        >
                          {formatStatus(request.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(request.createdAt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-sm text-gray-500"
                    >
                      No service requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Quick Actions
          </h2>

          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Frequently used options
          </p>

          <div className="mt-5 space-y-3">
            {[
              {
                label: "Create Request",
                description: "Submit a new service request",
                href: "/requests/create",
                icon: Plus,
              },
              {
                label: "View Requests",
                description: "Track service requests",
                href: "/requests",
                icon: ClipboardList,
              },
              {
                label: "Notifications",
                description: "View latest updates",
                href: "/notifications",
                icon: AlertCircle,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition hover:border-blue-300 hover:bg-blue-50 dark:border-gray-800 dark:hover:bg-blue-500/5"
                >
                  <div className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    <Icon size={19} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>

                  <ArrowUpRight size={16} className="text-gray-400" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Status Overview */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-5">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Request Status Overview
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Distribution of requests visible to you
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-4">
            {statusItems.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">
                    {item.label}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {item.value}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className={`h-full rounded-full ${item.color}`}
                    style={{
                      width: `${
                        totalForChart > 0
                          ? (item.value / totalForChart) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col justify-center rounded-xl bg-gray-50 p-6 dark:bg-gray-800/50">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total Requests
            </p>

            <p className="mt-2 text-4xl font-bold text-gray-900 dark:text-white">
              {stats.totalRequests || 0}
            </p>

            <div className="mt-5 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Pending Requests
              </span>

              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {stats.pendingRequests || 0}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Active Assignments
              </span>

              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {stats.activeAssignments || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
