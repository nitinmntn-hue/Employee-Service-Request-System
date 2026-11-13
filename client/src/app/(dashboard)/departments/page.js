"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  RefreshCw,
  Building2,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  getDepartments,
  createDepartment,
  updateDepartment,
  updateDepartmentStatus,
} from "@/services/department.service";

const initialForm = {
  name: "",
  description: "",
};

function getDepartmentList(result) {
  const data = result?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.departments)) return data.departments;
  if (Array.isArray(data?.items)) return data.items;

  return [];
}

function isDepartmentActive(department) {
  if (typeof department.isActive === "boolean") {
    return department.isActive;
  }

  return department.status === "ACTIVE";
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      setError("");

      const result = await getDepartments();

      if (result?.success === false) {
        throw new Error(result.message || "Failed to load departments");
      }

      setDepartments(getDepartmentList(result));
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Unable to load departments";

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return departments;

    return departments.filter((department) =>
      [department.name, department.description, department.code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [departments, search]);

  const activeCount = departments.filter(isDepartmentActive).length;
  const inactiveCount = departments.length - activeCount;

  const openCreateModal = () => {
    setEditingDepartment(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (department) => {
    setEditingDepartment(department);
    setForm({
      name: department.name || "",
      description: department.description || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingDepartment(null);
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

    if (!form.name.trim()) {
      toast.error("Department name is required");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
      };

      let result;

      if (editingDepartment) {
        result = await updateDepartment(editingDepartment.id, payload);
      } else {
        result = await createDepartment(payload);
      }

      if (result?.success === false) {
        throw new Error(result.message || "Operation failed");
      }

      toast.success(
        editingDepartment
          ? "Department updated successfully"
          : "Department created successfully",
      );

      setModalOpen(false);
      setEditingDepartment(null);
      setForm(initialForm);

      await fetchDepartments();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Unable to save department",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (department) => {
    const nextActive = !department.isActive;

    try {
      const result = await updateDepartmentStatus(department.id, nextActive);

      if (!result?.success) {
        throw new Error(result?.message || "Status update failed");
      }

      toast.success(result.message);

      await fetchDepartments();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Unable to update department status",
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Departments
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage organization departments.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchDepartments}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={18} />
            Add Department
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total Departments
            </p>
            <Building2 className="text-blue-600" size={22} />
          </div>
          <h2 className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">
            {departments.length}
          </h2>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Active Departments
            </p>
            <CheckCircle2 className="text-green-600" size={22} />
          </div>
          <h2 className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">
            {activeCount}
          </h2>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Inactive Departments
            </p>
            <XCircle className="text-gray-500" size={22} />
          </div>
          <h2 className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">
            {inactiveCount}
          </h2>
        </div>
      </div>

      {/* Department Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Department List
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {filteredDepartments.length} department(s) found
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search departments..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-blue-900"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-gray-500">
            <RefreshCw size={20} className="animate-spin" />
            Loading departments...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <AlertCircle className="text-red-500" size={28} />
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={fetchDepartments}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Building2 size={36} className="text-gray-400" />
            <h3 className="mt-3 font-medium text-gray-900 dark:text-white">
              No departments found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {search
                ? "Try another search term."
                : "Create your first department to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Department</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredDepartments.map((department) => {
                  const active = isDepartmentActive(department);

                  return (
                    <tr
                      key={department.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/40"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                            <Building2 size={19} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {department.name}
                            </p>
                            {department.code && (
                              <p className="mt-1 text-xs text-gray-500">
                                {department.code}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="max-w-xs px-5 py-4 text-gray-600 dark:text-gray-300">
                        <span className="line-clamp-2">
                          {department.description || "—"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            active
                              ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400"
                          }`}
                        >
                          {active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400">
                        {department.createdAt
                          ? new Date(department.createdAt).toLocaleDateString(
                              "en-IN",
                            )
                          : "—"}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(department)}
                            title="Edit department"
                            className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            onClick={() => handleStatusChange(department)}
                            title={active ? "Deactivate" : "Activate"}
                            className={`rounded-lg px-3 py-2 text-xs font-medium ${
                              active
                                ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                                : "text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10"
                            }`}
                          >
                            {active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-800">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  {editingDepartment ? "Edit Department" : "Create Department"}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Enter the department information below.
                </p>
              </div>

              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Department Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  maxLength={100}
                  placeholder="e.g. Information Technology"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={4}
                  maxLength={500}
                  placeholder="Describe the department's responsibilities..."
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving && <RefreshCw size={16} className="animate-spin" />}
                  {saving
                    ? "Saving..."
                    : editingDepartment
                      ? "Update Department"
                      : "Create Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
