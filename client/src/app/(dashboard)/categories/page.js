"use client";

import { useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  Tags,
  CheckCircle,
  XCircle,
  Plus,
  Pencil,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import {
  getCategories,
  createCategory,
  updateCategory,
  updateCategoryStatus,
} from "@/services/category.service";
import { getDepartments } from "@/services/department.service";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const PAGE_SIZE = 10;

const initialForm = {
  name: "",
  description: "",
  departmentId: "",
};

const formatDate = (date) => {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
};

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Something went wrong. Please try again.";

export default function CategoriesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalCategories: 0,
    totalPages: 1,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  const fetchCategories = async (showRefresh = false) => {
    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const result = await getCategories({
        page,
        limit: PAGE_SIZE,
        search,
        departmentId: departmentFilter,
        ...(statusFilter === "ALL"
          ? {}
          : { isActive: statusFilter === "ACTIVE" }),
      });

      if (!result?.success) {
        throw new Error(result?.message || "Unable to load categories.");
      }

      setCategories(Array.isArray(result.data) ? result.data : []);

      setPagination({
        currentPage: result.pagination?.currentPage || page,
        totalCategories: result.pagination?.totalCategories ?? 0,
        totalPages: result.pagination?.totalPages || 1,
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const result = await getDepartments({
        page: 1,
        limit: 100,
        isActive: true,
      });

      setDepartments(Array.isArray(result?.data) ? result.data : []);
    } catch (err) {
      toast.error("Unable to load departments.");
    }
  };

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, departmentFilter, statusFilter]);

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
    setDepartmentFilter("ALL");
    setStatusFilter("ALL");
    setPage(1);
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (category) => {
    setEditingCategory(category);

    setForm({
      name: category.name || "",
      description: category.description || "",
      departmentId: category.departmentId || "",
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingCategory(null);
    setForm(initialForm);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (form.name.trim().length < 2) {
      toast.error("Category name must contain at least 2 characters.");
      return;
    }

    if (!form.departmentId) {
      toast.error("Please select a department.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      departmentId: form.departmentId,
    };

    try {
      setSaving(true);

      if (editingCategory) {
        await updateCategory(editingCategory.id, payload);
        toast.success("Category updated successfully.");
      } else {
        await createCategory(payload);
        toast.success("Category created successfully.");
      }

      setModalOpen(false);
      setEditingCategory(null);
      setForm(initialForm);

      // Reload the first page after creating a category.
      if (!editingCategory) {
        setPage(1);
        if (page === 1) await fetchCategories(true);
      } else {
        await fetchCategories(true);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (category) => {
    if (!isAdmin || updatingStatusId) return;

    const nextStatus = !category.isActive;
    const action = nextStatus ? "activate" : "deactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} "${category.name}"?`,
    );

    if (!confirmed) return;

    try {
      setUpdatingStatusId(category.id);

      await updateCategoryStatus(category.id, nextStatus);

      toast.success(
        `Category ${nextStatus ? "activated" : "deactivated"} successfully.`,
      );

      await fetchCategories(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const activeCount = categories.filter((item) => item.isActive).length;
  const inactiveCount = categories.filter((item) => !item.isActive).length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" message="Loading categories..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Categories Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Organize service categories by department.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fetchCategories(true)}
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
              Add Category
            </button>
          )}
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Categories"
          value={pagination.totalCategories}
          icon={Tags}
          iconClass="bg-blue-100 text-blue-600"
        />

        <StatCard
          title="Active (This Page)"
          value={activeCount}
          icon={CheckCircle}
          iconClass="bg-green-100 text-green-600"
        />

        <StatCard
          title="Inactive (This Page)"
          value={inactiveCount}
          icon={XCircle}
          iconClass="bg-red-100 text-red-600"
        />
      </div>

      {/* Search and filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={handleSearch}
          className="flex flex-col gap-3 sm:flex-row"
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
              placeholder="Search category name or description..."
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

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <Filter size={15} />
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
            onClick={() => fetchCategories()}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Categories table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">All Categories</h2>
          <p className="mt-1 text-xs text-gray-500">
            {pagination.totalCategories} categories found
          </p>
        </div>

        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 rounded-full bg-gray-100 p-4">
              <Tags size={28} className="text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900">No categories found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try another search or create a new category.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Category</th>
                    <th className="px-5 py-3 font-semibold">Description</th>
                    <th className="px-5 py-3 font-semibold">Department</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Created</th>
                    {isAdmin && (
                      <th className="px-5 py-3 text-right font-semibold">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {categories.map((category) => (
                    <tr
                      key={category.id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                            <Tags size={19} />
                          </div>
                          <span className="font-medium text-gray-900">
                            {category.name}
                          </span>
                        </div>
                      </td>

                      <td className="max-w-[250px] px-5 py-4 text-gray-500">
                        <p className="truncate">
                          {category.description || "No description"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span className="flex items-center gap-2 text-gray-600">
                          <Building2 size={15} className="text-gray-400" />
                          {category.department?.name || "Unknown"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            category.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {category.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-gray-500">
                        <span className="flex items-center gap-2">
                          <CalendarDays size={15} />
                          {formatDate(category.createdAt)}
                        </span>
                      </td>

                      {isAdmin && (
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(category)}
                              title="Edit category"
                              className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-100 hover:text-blue-600"
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleStatusChange(category)}
                              disabled={updatingStatusId === category.id}
                              title={
                                category.isActive
                                  ? "Deactivate category"
                                  : "Activate category"
                              }
                              className={`rounded-lg border p-2 disabled:opacity-50 ${
                                category.isActive
                                  ? "border-red-200 text-red-600 hover:bg-red-50"
                                  : "border-green-200 text-green-600 hover:bg-green-50"
                              }`}
                            >
                              {updatingStatusId === category.id ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : category.isActive ? (
                                <XCircle size={16} />
                              ) : (
                                <CheckCircle size={16} />
                              )}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row">
              <p className="text-sm text-gray-500">
                Page {pagination.currentPage} of {pagination.totalPages}
                {" · "}
                {pagination.totalCategories} total categories
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

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingCategory ? "Edit Category" : "Create Category"}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  {editingCategory
                    ? "Update category details."
                    : "Add a category to a department."}
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
              <FormField label="Category Name" required>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Enter category name"
                  className="form-input"
                />
              </FormField>

              <FormField label="Department" required>
                <select
                  name="departmentId"
                  value={form.departmentId}
                  onChange={handleChange}
                  required
                  className="form-input"
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Description">
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  maxLength={500}
                  rows={4}
                  placeholder="Enter category description (optional)"
                  className="form-input resize-none"
                />
                <p className="mt-1 text-right text-xs text-gray-400">
                  {form.description.length}/500
                </p>
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
                  disabled={saving || departments.length === 0}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingCategory
                      ? "Update Category"
                      : "Create Category"}
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
