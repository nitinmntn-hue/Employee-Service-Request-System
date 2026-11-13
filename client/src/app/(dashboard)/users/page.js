"use client";

import { useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Mail,
  Building2,
  CalendarDays,
  X,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import {
  getUsers,
  createUser,
  updateUser,
  updateUserStatus,
} from "@/services/user.service";
import { getDepartments } from "@/services/department.service";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const PAGE_SIZE = 10;

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "EMPLOYEE",
  departmentId: "",
};

const roleStyles = {
  ADMIN: "bg-purple-100 text-purple-700",
  SUPPORT_STAFF: "bg-blue-100 text-blue-700",
  EMPLOYEE: "bg-gray-100 text-gray-700",
};

const statusStyles = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-gray-100 text-gray-600",
  BLOCKED: "bg-red-100 text-red-700",
};

function formatDate(date) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "ADMIN";

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalUsers: 0,
    totalPages: 1,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  const fetchUsers = async (showRefresh = false) => {
    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const result = await getUsers({
        page,
        limit: PAGE_SIZE,
        search,
        role: roleFilter,
        status: statusFilter,
        departmentId: departmentFilter === "ALL" ? "" : departmentFilter,
      });

      if (!result?.success) {
        throw new Error(result?.message || "Unable to retrieve users.");
      }

      setUsers(Array.isArray(result.data) ? result.data : []);
      setPagination({
        currentPage: result.pagination?.currentPage || page,
        totalUsers: result.pagination?.totalUsers ?? 0,
        totalPages: result.pagination?.totalPages || 1,
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const result = await getDepartments({ page: 1, limit: 100 });
      setDepartments(Array.isArray(result?.data) ? result.data : []);
    } catch {
      toast.error("Unable to load departments.");
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, roleFilter, statusFilter, departmentFilter]);

  useEffect(() => {
    fetchDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");
    setDepartmentFilter("ALL");
    setPage(1);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "EMPLOYEE",
      departmentId: user.departmentId || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingUser(null);
    setForm(initialForm);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }

    if (!editingUser && form.password.length < 8) {
      toast.error("Password must contain at least 8 characters.");
      return;
    }

    if (form.password && form.password.length < 8) {
      toast.error("Password must contain at least 8 characters.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
      departmentId: form.departmentId || null,
    };

    if (form.password) {
      payload.password = form.password;
    }

    try {
      setSaving(true);

      if (editingUser) {
        await updateUser(editingUser.id, payload);
        toast.success("User updated successfully.");
      } else {
        await createUser({
          ...payload,
          password: form.password,
          status: "ACTIVE",
        });
        toast.success("User created successfully.");
      }

      setModalOpen(false);
      setEditingUser(null);
      setForm(initialForm);

      // Return to page 1 so a newly created user is visible.
      setPage(1);

      if (page === 1) {
        await fetchUsers(true);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (user, nextStatus) => {
    if (!isAdmin || updatingStatusId) return;

    if (user.id === currentUser?.id && nextStatus !== "ACTIVE") {
      toast.error("You cannot deactivate or block your own account.");
      return;
    }

    const confirmed = window.confirm(
      `Change ${user.name}'s status to ${nextStatus.replaceAll("_", " ")}?`,
    );

    if (!confirmed) return;

    try {
      setUpdatingStatusId(user.id);

      await updateUserStatus(user.id, nextStatus);
      toast.success("User status updated successfully.");

      await fetchUsers(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const activeCount = users.filter((item) => item.status === "ACTIVE").length;
  const inactiveCount = users.filter(
    (item) => item.status === "INACTIVE",
  ).length;
  const adminCount = users.filter((item) => item.role === "ADMIN").length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" message="Loading users..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage employee, support staff, and administrator accounts.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fetchUsers(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={17} />
              Add User
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Users"
          value={pagination.totalUsers}
          icon={Users}
          iconClass="bg-blue-100 text-blue-600"
        />
        <StatCard
          title="Active (This Page)"
          value={activeCount}
          icon={UserCheck}
          iconClass="bg-green-100 text-green-600"
        />
        <StatCard
          title="Inactive (This Page)"
          value={inactiveCount}
          icon={UserX}
          iconClass="bg-gray-100 text-gray-600"
        />
        <StatCard
          title="Admins (This Page)"
          value={adminCount}
          icon={ShieldCheck}
          iconClass="bg-purple-100 text-purple-600"
        />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={handleSearch}
          className="flex flex-col gap-3 lg:flex-row"
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
              placeholder="Search by name or email..."
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Search
          </button>
        </form>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={roleFilter}
            onChange={(event) => {
              setPage(1);
              setRoleFilter(event.target.value);
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPPORT_STAFF">Support Staff</option>
            <option value="EMPLOYEE">Employee</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value);
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="BLOCKED">Blocked</option>
          </select>

          <select
            value={departmentFilter}
            onChange={(event) => {
              setPage(1);
              setDepartmentFilter(event.target.value);
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={19} />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => fetchUsers()}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">All Users</h2>
          <p className="mt-1 text-xs text-gray-500">
            {pagination.totalUsers} users found
          </p>
        </div>

        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 rounded-full bg-gray-100 p-4">
              <Users size={28} className="text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900">No users found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try another search or change your filters.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">User</th>
                    <th className="px-5 py-3 font-semibold">Role</th>
                    <th className="px-5 py-3 font-semibold">Department</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Joined</th>
                    {isAdmin && (
                      <th className="px-5 py-3 text-right font-semibold">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {users.map((item) => {
                    const department = departments.find(
                      (department) => department.id === item.departmentId,
                    );

                    return (
                      <tr key={item.id} className="transition hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                              {getInitials(item.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-gray-900">
                                {item.name}
                              </p>
                              <p className="mt-1 flex items-center gap-1 truncate text-xs text-gray-500">
                                <Mail size={12} />
                                {item.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              roleStyles[item.role] ||
                              "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {item.role?.replaceAll("_", " ")}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          <span className="flex items-center gap-2">
                            <Building2 size={15} className="text-gray-400" />
                            {department?.name || "Not assigned"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              statusStyles[item.status] ||
                              "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-gray-500">
                          <span className="flex items-center gap-2">
                            <CalendarDays size={15} />
                            {formatDate(item.createdAt)}
                          </span>
                        </td>

                        {isAdmin && (
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                title="Edit user"
                                className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-100 hover:text-blue-600"
                              >
                                <Pencil size={16} />
                              </button>

                              <select
                                value={item.status}
                                disabled={updatingStatusId === item.id}
                                onChange={(event) =>
                                  handleStatusChange(item, event.target.value)
                                }
                                title="Change user status"
                                className="max-w-[125px] rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs outline-none focus:border-blue-500 disabled:opacity-50"
                              >
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                                <option value="BLOCKED">Blocked</option>
                              </select>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row">
              <p className="text-sm text-gray-500">
                Page {pagination.currentPage} of {pagination.totalPages}
                {" · "}
                {pagination.totalUsers} total users
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPage((previous) => Math.max(1, previous - 1))
                  }
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPage((previous) =>
                      Math.min(pagination.totalPages, previous + 1),
                    )
                  }
                  disabled={page >= pagination.totalPages}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingUser ? "Edit User" : "Create User"}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  {editingUser
                    ? "Update the user's account details."
                    : "Create a new system account."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <FormField label="Full Name" required>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Enter full name"
                  className="form-input"
                />
              </FormField>

              <FormField label="Email Address" required>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleFormChange}
                  required
                  placeholder="Enter email address"
                  className="form-input"
                />
              </FormField>

              <FormField
                label={editingUser ? "New Password (Optional)" : "Password"}
                required={!editingUser}
              >
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleFormChange}
                  required={!editingUser}
                  minLength={8}
                  maxLength={100}
                  autoComplete="new-password"
                  placeholder={
                    editingUser
                      ? "Leave blank to keep current password"
                      : "Minimum 8 characters"
                  }
                  className="form-input"
                />
              </FormField>

              <FormField label="Role" required>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleFormChange}
                  className="form-input"
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="SUPPORT_STAFF">Support Staff</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </FormField>

              <FormField label="Department">
                <select
                  name="departmentId"
                  value={form.departmentId}
                  onChange={handleFormChange}
                  className="form-input"
                >
                  <option value="">No Department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingUser
                      ? "Update User"
                      : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, iconClass }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`rounded-xl p-3 ${iconClass}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function FormField({ label, required, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
