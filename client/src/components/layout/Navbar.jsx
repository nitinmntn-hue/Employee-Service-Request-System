"use client";

import Link from "next/link";
import { Menu, Bell, LogOut, UserCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-950 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open sidebar"
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 lg:hidden"
        >
          <Menu size={22} />
        </button>

        <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
          Employee Portal
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <Link
          href="/dashboard/notifications"
          aria-label="Notifications"
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Bell size={20} />
        </Link>

        <div className="hidden items-center gap-2 sm:flex">
          <UserCircle size={30} className="text-gray-500" />

          <div className="max-w-36">
            <p className="truncate text-sm font-semibold text-gray-800 dark:text-white">
              {user?.name || "User"}
            </p>
            <p className="text-xs text-gray-500">
              {user?.role?.replace("_", " ")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
        >
          <LogOut size={18} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
