"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Ticket,
  Users,
  Building2,
  Tags,
  ClipboardList,
  BarChart3,
  Settings,
  Bell,
  X,
  UserCheck,
  Clock,
} from "lucide-react";

const navigation = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["EMPLOYEE", "SUPPORT_STAFF", "ADMIN"],
      },
    ],
  },
  {
    title: "Service Management",
    items: [
      {
        label: "Requests",
        href: "/requests",
        icon: Ticket,
        roles: ["EMPLOYEE", "SUPPORT_STAFF", "ADMIN"],
      },
      {
        label: "Assignments",
        href: "/assignments",
        icon: ClipboardList,
        roles: ["SUPPORT_STAFF", "ADMIN"],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        label: "Categories",
        href: "/categories",
        icon: Tags,
        roles: ["EMPLOYEE", "SUPPORT_STAFF", "ADMIN"],
      },
      {
        label: "Departments",
        href: "/departments",
        icon: Building2,
        roles: ["SUPPORT_STAFF", "ADMIN"],
      },
      {
        label: "Users",
        href: "/users",
        icon: Users,
        roles: ["ADMIN"],
      },
      {
        label: "SLAs",
        href: "/slas",
        icon: Clock,
        roles: ["SUPPORT_STAFF", "ADMIN"],
      },
    ],
  },
  {
    title: "Reports & Activity",
    items: [
      {
        label: "Activity Logs",
        href: "/activity-logs",
        icon: BarChart3,
        roles: ["ADMIN"],
      },
      {
        label: "Notifications",
        href: "/notifications",
        icon: Bell,
        roles: ["EMPLOYEE", "SUPPORT_STAFF", "ADMIN"],
      },
    ],
  },
];

export default function Sidebar({ user, isOpen = false, onClose = () => {} }) {
  const pathname = usePathname();

  const userRole = user?.role;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white shadow-sm transition-transform duration-300 dark:border-gray-800 dark:bg-gray-950 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 px-5 dark:border-gray-800">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="text-xl font-bold text-blue-600"
          >
            ServiceDesk
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-7 overflow-y-auto p-4">
          {navigation.map((group) => {
            const visibleItems = group.items.filter((item) =>
              item.roles.includes(userRole),
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title}>
                <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {group.title}
                </p>

                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;

                    const active =
                      pathname === item.href ||
                      (item.href !== "/dashboard" &&
                        pathname.startsWith(`${item.href}/`));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                          active
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                            : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900"
                        }`}
                      >
                        <Icon size={19} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User information */}
        <div className="shrink-0 border-t border-gray-200 p-4 dark:border-gray-800">
          <p className="truncate text-sm font-semibold text-gray-800 dark:text-white">
            {user?.name || "User"}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {userRole?.replaceAll("_", " ") || "Loading role..."}
          </p>
        </div>
      </aside>
    </>
  );
}
