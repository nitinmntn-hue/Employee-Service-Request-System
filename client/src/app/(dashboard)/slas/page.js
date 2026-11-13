"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

import { getDepartments } from "@/services/department.service";
import {
  getSlas,
  createSla,
  updateSla,
  deleteSla,
  getApplicableSla,
} from "@/services/sla.service";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const emptyForm = {
  priority: "MEDIUM",
  responseMinutes: "60",
  resolutionMinutes: "240",
  departmentId: "",
};

const formatDuration = (minutes) => {
  if (minutes === null || minutes === undefined) return "—";

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;

  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (remainingMinutes || parts.length === 0) {
    parts.push(`${remainingMinutes}m`);
  }

  return parts.join(" ");
};

const formatDate = (date) => {
  if (!date) return "—";

  return new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
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

export default function SlasPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [slas, setSlas] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  const [showForm, setShowForm] = useState(false);
  const [editingSla, setEditingSla] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [showApplicable, setShowApplicable] = useState(false);
  const [applicablePriority, setApplicablePriority] = useState("MEDIUM");
  const [applicableDepartmentId, setApplicableDepartmentId] = useState("");
  const [applicableSla, setApplicableSla] = useState(null);
  const [applicableLoading, setApplicableLoading] = useState(false);

  const fetchSlas = useCallback(async () => {
    try {
      setLoading(true);

      const result = await getSlas({
        page,
        limit: 10,
        priority: priorityFilter,
        departmentId: departmentFilter,
      });

      if (!result?.success) {
        throw new Error(result?.message || "Unable to load SLA policies");
      }

      setSlas(Array.isArray(result.data) ? result.data : []);
      setPagination(
        result.pagination || {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to load SLA policies",
      );
    } finally {
      setLoading(false);
    }
  }, [page, priorityFilter, departmentFilter]);

  const fetchDepartments = useCallback(async () => {
    try {
      const result = await getDepartments({
        page: 1,
        limit: 100,
      });

      setDepartments(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to load departments",
      );
    }
  }, []);

  useEffect(() => {
    fetchSlas();
  }, [fetchSlas]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const openCreateForm = () => {
    setEditingSla(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (sla) => {
    setEditingSla(sla);

    setForm({
      priority: sla.priority,
      responseMinutes: String(sla.responseMinutes),
      resolutionMinutes: String(sla.resolutionMinutes),
      departmentId: sla.departmentId || "",
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingSla(null);
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

    const responseMinutes = Number(form.responseMinutes);
    const resolutionMinutes = Number(form.resolutionMinutes);

    if (
      !Number.isInteger(responseMinutes) ||
      !Number.isInteger(resolutionMinutes) ||
      responseMinutes < 1 ||
      resolutionMinutes < 1 ||
      responseMinutes > 525600 ||
      resolutionMinutes > 525600
    ) {
      toast.error("Enter valid times between 1 and 525600 minutes.");
      return;
    }

    if (resolutionMinutes < responseMinutes) {
      toast.error(
        "Resolution time must be greater than or equal to response time.",
      );
      return;
    }

    const payload = {
      priority: form.priority,
      responseMinutes,
      resolutionMinutes,
      departmentId: form.departmentId || null,
    };

    try {
      setSaving(true);

      if (editingSla) {
        const result = await updateSla(editingSla.id, payload);
        toast.success(result.message || "SLA policy updated successfully.");
      } else {
        const result = await createSla(payload);
        toast.success(result.message || "SLA policy created successfully.");
      }

      setShowForm(false);
      setEditingSla(null);
      setForm(emptyForm);

      if (page !== 1) {
        setPage(1);
      } else {
        await fetchSlas();
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to save SLA policy.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sla) => {
    const confirmed = window.confirm(
      `Delete the ${sla.priority} SLA policy for ${
        sla.department?.name || "Global"
      }?`,
    );

    if (!confirmed) return;

    try {
      const result = await deleteSla(sla.id);

      toast.success(result.message || "SLA policy deleted successfully.");

      if (slas.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await fetchSlas();
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Unable to delete SLA policy. It may be linked to service requests.",
      );
    }
  };

  const handlePriorityFilter = (event) => {
    setPriorityFilter(event.target.value);
    setPage(1);
  };

  const handleDepartmentFilter = (event) => {
    setDepartmentFilter(event.target.value);
    setPage(1);
  };

  const handleApplicableSearch = async (event) => {
    event.preventDefault();

    try {
      setApplicableLoading(true);
      setApplicableSla(null);

      const result = await getApplicableSla(
        applicablePriority,
        applicableDepartmentId,
      );

      if (!result?.success) {
        throw new Error(result?.message || "No applicable SLA found");
      }

      setApplicableSla(result.data);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "No applicable SLA policy found.",
      );
    } finally {
      setApplicableLoading(false);
    }
  };

  const closeApplicable = () => {
    setShowApplicable(false);
    setApplicableSla(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SLA Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure response and resolution time policies.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowApplicable(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Search size={17} />
            Check Applicable SLA
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={18} />
              Add SLA Policy
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Matching policies</p>
            <ShieldCheck size={20} className="text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {pagination.total}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Policies on this page</p>
            <Clock size={20} className="text-indigo-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{slas.length}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Current page</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {pagination.page || page} / {pagination.totalPages || 1}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 md:flex-row">
        <select
          value={priorityFilter}
          onChange={handlePriorityFilter}
          className="form-input w-full md:w-52"
        >
          <option value="ALL">All priorities</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>

        <select
          value={departmentFilter}
          onChange={handleDepartmentFilter}
          className="form-input w-full md:flex-1"
        >
          <option value="ALL">All departments and global policies</option>
          <option value="global">Global policies only</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={fetchSlas}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* SLA table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : slas.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
            <Clock size={42} className="text-gray-300" />
            <h3 className="mt-3 font-semibold text-gray-800">
              No SLA policies found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Try changing the filters or create a new SLA policy.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-4">Priority</th>
                    <th className="px-5 py-4">Department</th>
                    <th className="px-5 py-4">Response time</th>
                    <th className="px-5 py-4">Resolution time</th>
                    <th className="px-5 py-4">Last updated</th>
                    {isAdmin && (
                      <th className="px-5 py-4 text-right">Actions</th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {slas.map((sla) => (
                    <tr key={sla.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClass(
                            sla.priority,
                          )}`}
                        >
                          {sla.priority}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-medium text-gray-800">
                          {sla.department?.name || "Global"}
                        </span>
                        {!sla.departmentId && (
                          <p className="mt-1 text-xs text-gray-500">
                            Fallback policy
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">
                          {formatDuration(sla.responseMinutes)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {sla.responseMinutes} minutes
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">
                          {formatDuration(sla.resolutionMinutes)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {sla.resolutionMinutes} minutes
                        </p>
                      </td>

                      <td className="px-5 py-4 text-gray-600">
                        {formatDate(sla.updatedAt)}
                      </td>

                      {isAdmin && (
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              title="Edit SLA"
                              onClick={() => openEditForm(sla)}
                              className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                            >
                              <Pencil size={17} />
                            </button>

                            <button
                              type="button"
                              title="Delete SLA"
                              onClick={() => handleDelete(sla)}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={17} />
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
                Page {pagination.page || page} of {pagination.totalPages || 1} ·{" "}
                {pagination.total} policies
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

      {/* Create / Edit SLA modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingSla ? "Edit SLA Policy" : "Create SLA Policy"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Configure response and resolution deadlines.
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
                  Priority *
                </label>
                <select
                  name="priority"
                  value={form.priority}
                  onChange={handleFormChange}
                  required
                  className="form-input w-full"
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Department
                </label>
                <select
                  name="departmentId"
                  value={form.departmentId}
                  onChange={handleFormChange}
                  className="form-input w-full"
                >
                  <option value="">Global policy (all departments)</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  A department-specific policy takes precedence over a global
                  policy for the same priority.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Response time (minutes) *
                  </label>
                  <input
                    type="number"
                    name="responseMinutes"
                    value={form.responseMinutes}
                    onChange={handleFormChange}
                    min="1"
                    max="525600"
                    step="1"
                    required
                    className="form-input w-full"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {formatDuration(Number(form.responseMinutes))}
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Resolution time (minutes) *
                  </label>
                  <input
                    type="number"
                    name="resolutionMinutes"
                    value={form.resolutionMinutes}
                    onChange={handleFormChange}
                    min="1"
                    max="525600"
                    step="1"
                    required
                    className="form-input w-full"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {formatDuration(Number(form.resolutionMinutes))}
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                Resolution time must be greater than or equal to response time.
                The maximum allowed time is 365 days.
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
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingSla
                      ? "Save Changes"
                      : "Create Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Applicable SLA lookup modal */}
      {showApplicable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Check Applicable SLA
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Check which policy will apply to a new request.
                </p>
              </div>

              <button
                type="button"
                onClick={closeApplicable}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleApplicableSearch} className="space-y-5 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Priority *
                </label>
                <select
                  value={applicablePriority}
                  onChange={(event) => {
                    setApplicablePriority(event.target.value);
                    setApplicableSla(null);
                  }}
                  className="form-input w-full"
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Department
                </label>
                <select
                  value={applicableDepartmentId}
                  onChange={(event) => {
                    setApplicableDepartmentId(event.target.value);
                    setApplicableSla(null);
                  }}
                  className="form-input w-full"
                >
                  <option value="">Global policy only</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  When a department is selected, its policy is checked first;
                  the global policy is used as a fallback.
                </p>
              </div>

              <button
                type="submit"
                disabled={applicableLoading}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {applicableLoading ? "Checking..." : "Find Applicable Policy"}
              </button>
            </form>

            {applicableSla && (
              <div className="mx-6 mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2 font-semibold text-green-800">
                  <ShieldCheck size={19} />
                  Applicable SLA found
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs text-gray-500">Priority</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {applicableSla.priority}
                    </p>
                  </div>

                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs text-gray-500">Policy department</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {applicableSla.department?.name || "Global"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs text-gray-500">Response time</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {formatDuration(applicableSla.responseMinutes)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs text-gray-500">Resolution time</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {formatDuration(applicableSla.resolutionMinutes)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
