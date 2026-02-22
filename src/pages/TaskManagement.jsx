import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api";

const defaultForm = {
  title: "",
  description: "",
  assignedTo: "",
  assignedBy: "admin",
  status: "pending",
  priority: "medium",
  category: "other",
  dueDate: "",
  frequency: [],
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.tasks)) return value.tasks;
  if (Array.isArray(value?.employees)) return value.employees;
  if (value && typeof value === "object" && (value._id || value.id)) {
    return [value];
  }
  return [];
};

const toDateTimeLocalValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
};

const formatDateTime = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
};

const DAY_OPTIONS = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

const normalizeDay = (value) => {
  const day = String(value || "").trim().toLowerCase();
  const map = {
    mon: "monday",
    monday: "monday",
    tue: "tuesday",
    tues: "tuesday",
    tuesday: "tuesday",
    wed: "wednesday",
    wednesday: "wednesday",
    thu: "thursday",
    thur: "thursday",
    thurs: "thursday",
    thursday: "thursday",
    fri: "friday",
    friday: "friday",
    sat: "saturday",
    saturday: "saturday",
    sun: "sunday",
    sunday: "sunday",
  };
  return map[day] || "";
};

const getLocalDayName = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return DAY_OPTIONS[(date.getDay() + 6) % 7]?.value || "";
};

const isSameLocalDate = (a, b) => {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const TaskManagement = ({ embedded = false }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [form, setForm] = useState(defaultForm);
  const [schedulesByEmployee, setSchedulesByEmployee] = useState({});
  const [todayAttendanceByEmployee, setTodayAttendanceByEmployee] = useState({});

  const employeeNameById = useMemo(() => {
    const map = new Map();
    employees.forEach((employee) => {
      map.set(employee._id?.toString(), employee.name || "Unknown");
    });
    return map;
  }, [employees]);

  const loadData = async () => {
    try {
      setLoading(true);
      const schedulesPromise = api
        .get("/employee-schedule")
        .catch((error) => {
          if (error?.response?.status === 404) {
            return api.get("/employee-schedules");
          }
          throw error;
        })
        .catch((error) => {
          if (error?.response?.status === 404) {
            console.warn(
              "Employee schedule routes unavailable; continuing without schedule constraints."
            );
            return { data: [] };
          }
          throw error;
        });

      const attendancePromise = api.get("/attendance/today").catch((error) => {
        if (error?.response?.status === 404) {
          console.warn(
            "Attendance today route unavailable; continuing without attendance constraints."
          );
          return { data: [] };
        }
        throw error;
      });

      const [tasksResponse, employeesResponse, schedulesResponse, attendanceResponse] = await Promise.all([
        api.get("/tasks"),
        api.get("/employees"),
        schedulesPromise,
        attendancePromise,
      ]);

      const fetchedTasks = toArray(tasksResponse.data)
        .map((task) => ({ ...task }))
        .sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });

      setTasks(fetchedTasks);
      setEmployees(toArray(employeesResponse.data));

      const scheduleMap = {};
      toArray(schedulesResponse.data).forEach((schedule) => {
        const employeeId =
          (schedule.employeeId?._id || schedule.employeeId || "").toString();
        if (employeeId) {
          scheduleMap[employeeId] = schedule;
        }
      });
      setSchedulesByEmployee(scheduleMap);

      const attendanceMap = {};
      toArray(attendanceResponse.data).forEach((row) => {
        const employeeId =
          (row.employeeId?._id || row.employeeId || "").toString();
        if (employeeId) {
          attendanceMap[employeeId] = String(row.status || "").toLowerCase();
        }
      });
      setTodayAttendanceByEmployee(attendanceMap);
    } catch (error) {
      console.error("Failed to load tasks", error);
      alert(error.response?.data?.message || "Failed to load task data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getOffDaysForEmployee = (employeeId) => {
    if (!employeeId) return [];
    const schedule = schedulesByEmployee[employeeId];
    if (!Array.isArray(schedule?.weeklySchedule)) return [];
    return schedule.weeklySchedule
      .filter((day) => day?.isWorking === false)
      .map((day) => normalizeDay(day.day))
      .filter(Boolean);
  };

  const getTodayAttendanceStatusForEmployee = (employeeId) => {
    return String(todayAttendanceByEmployee[employeeId] || "").toLowerCase();
  };

  const selectedEmployeeOffDays = getOffDaysForEmployee(form.assignedTo);

  const resetForm = () => {
    setForm(defaultForm);
    setEditingTask(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setEditingTask(null);
    setForm({
      ...defaultForm,
      assignedTo: employees[0]?._id || "",
      dueDate: toDateTimeLocalValue(new Date().toISOString()),
    });
    setShowForm(true);
  };

  const openEditForm = (task) => {
    const assignedTo = (task.assignedTo?._id || task.assignedTo || "").toString();
    const offDays = getOffDaysForEmployee(assignedTo);
    setEditingTask(task);
    setForm({
      title: task.title || "",
      description: task.description || "",
      assignedTo,
      assignedBy: task.assignedBy || "admin",
      status: task.status || "pending",
      priority: task.priority || "medium",
      category: task.category || "other",
      dueDate: toDateTimeLocalValue(task.dueDate || task.createdAt),
      frequency: Array.isArray(task.frequency)
        ? task.frequency
            .map(normalizeDay)
            .filter((day) => day && !offDays.includes(day))
        : [],
    });
    setShowForm(true);
  };

  const handleSaveTask = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      alert("Task title is required");
      return;
    }
    if (!form.assignedTo) {
      alert("Please assign this task to an employee");
      return;
    }

    const normalizedFrequency = Array.isArray(form.frequency)
      ? form.frequency.map(normalizeDay).filter(Boolean)
      : [];
    const offDays = getOffDaysForEmployee(form.assignedTo);
    const dueDateValue = form.dueDate
      ? new Date(form.dueDate)
      : new Date();
    const dueDay = getLocalDayName(dueDateValue);
    const today = new Date();
    const attendanceStatus = getTodayAttendanceStatusForEmployee(form.assignedTo);
    const isEmployeeUnavailableToday =
      attendanceStatus === "on_leave" || attendanceStatus === "sick";

    const blockedFrequencyDays = normalizedFrequency.filter((day) =>
      offDays.includes(day)
    );
    if (blockedFrequencyDays.length > 0) {
      const labels = blockedFrequencyDays
        .map((day) => DAY_OPTIONS.find((d) => d.value === day)?.label || day)
        .join(", ");
      alert(
        `Cannot assign recurring task on employee off day(s): ${labels}`
      );
      return;
    }

    if (offDays.includes(dueDay)) {
      alert(
        `Cannot assign task on ${DAY_OPTIONS.find((d) => d.value === dueDay)?.label || dueDay}. This is employee off day.`
      );
      return;
    }

    if (isSameLocalDate(dueDateValue, today) && isEmployeeUnavailableToday) {
      alert(
        `Cannot assign task today. Employee attendance is marked ${attendanceStatus === "on_leave" ? "on leave" : attendanceStatus}.`
      );
      return;
    }

    if (
      isEmployeeUnavailableToday &&
      normalizedFrequency.includes(getLocalDayName(today))
    ) {
      alert(
        `Cannot assign recurring task for today. Employee attendance is marked ${attendanceStatus === "on_leave" ? "on leave" : attendanceStatus}.`
      );
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      assignedTo: form.assignedTo,
      assignedBy: form.assignedBy || "admin",
      status: form.status || "pending",
      priority: form.priority || "medium",
      category: form.category || "other",
      dueDate: dueDateValue.toISOString(),
      frequency: normalizedFrequency,
    };

    try {
      setSaving(true);
      if (editingTask?._id) {
        await api.put(`/tasks/${editingTask._id}`, payload);
      } else {
        await api.post("/tasks", payload);
      }
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Failed to save task", error);
      alert(error.response?.data?.message || "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (task) => {
    const ok = window.confirm(`Delete task "${task.title}"?`);
    if (!ok) return;

    try {
      setBusyTaskId(task._id);
      await api.delete(`/tasks/${task._id}`);
      await loadData();
    } catch (error) {
      console.error("Failed to delete task", error);
      alert(error.response?.data?.message || "Failed to delete task");
    } finally {
      setBusyTaskId("");
    }
  };

  const handleToggleCompletion = async (task) => {
    try {
      setBusyTaskId(task._id);
      if (task.status === "completed") {
        await api.patch(`/tasks/${task._id}`, {
          status: "pending",
          completedAt: null,
        });
      } else {
        await api.post(`/tasks/${task._id}/complete`);
      }
      await loadData();
    } catch (error) {
      console.error("Failed to update task status", error);
      alert(error.response?.data?.message || "Failed to update task status");
    } finally {
      setBusyTaskId("");
    }
  };

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return tasks.filter((task) => {
      const assignedId = (task.assignedTo?._id || task.assignedTo || "").toString();
      const taskStatus = task.status || "pending";
      const title = (task.title || "").toLowerCase();
      const description = (task.description || "").toLowerCase();
      const frequencyText = Array.isArray(task.frequency)
        ? task.frequency.join(" ").toLowerCase()
        : "";

      if (statusFilter !== "all" && taskStatus !== statusFilter) {
        return false;
      }
      if (assigneeFilter !== "all" && assignedId !== assigneeFilter) {
        return false;
      }
      if (
        query &&
        !title.includes(query) &&
        !description.includes(query) &&
        !frequencyText.includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [tasks, searchQuery, statusFilter, assigneeFilter]);

  const pendingCount = tasks.filter((task) => task.status === "pending").length;
  const inProgressCount = tasks.filter((task) => task.status === "in_progress").length;
  const completedCount = tasks.filter((task) => task.status === "completed").length;

  const statusBadgeClass = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "in_progress":
        return "bg-blue-100 text-blue-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      case "late":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const selectedAttendanceStatus = getTodayAttendanceStatusForEmployee(
    form.assignedTo
  );
  const employeeUnavailableToday =
    selectedAttendanceStatus === "absent" ||
    selectedAttendanceStatus === "on_leave";

  return (
    <div className={`space-y-6 ${embedded ? "" : "max-w-7xl mx-auto"}`}>
      {!embedded && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
          <h1 className="text-2xl font-semibold text-[#2b211c]">Task Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Admin CRUD console for all tasks assigned to employees.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold text-[#2b211c]">{tasks.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">In Progress</p>
          <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-green-600">{completedCount}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-2 flex-1 min-w-[260px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search task title or description"
              className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2f8f4e] min-w-[220px]"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2f8f4e]"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="late">Late</option>
            </select>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2f8f4e]"
            >
              <option value="all">All Employees</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadData}
              className="px-4 py-2 rounded-lg bg-[#2f8f4e] text-white text-sm font-medium hover:bg-[#256f3d]"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreateForm}
              className="px-4 py-2 rounded-lg bg-[#ff6b35] text-white text-sm font-medium hover:bg-[#e25827]"
            >
              New Task
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSaveTask} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#2b211c]">
                {editingTask ? "Edit Task" : "Create Task"}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Task title"
                className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2f8f4e]"
                required
              />
              <select
                value={form.assignedTo}
                onChange={(e) => {
                  const nextAssignedTo = e.target.value;
                  const blockedDays = new Set(getOffDaysForEmployee(nextAssignedTo));
                  setForm((prev) => ({
                    ...prev,
                    assignedTo: nextAssignedTo,
                    frequency: Array.isArray(prev.frequency)
                      ? prev.frequency
                          .map(normalizeDay)
                          .filter((day) => day && !blockedDays.has(day))
                      : [],
                  }));
                }}
                className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2f8f4e]"
                required
              >
                <option value="">Assign employee</option>
                {employees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {employee.name} ({employee.employeeRole || "employee"})
                  </option>
                ))}
              </select>
              <select
                value={form.priority}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2f8f4e]"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent Priority</option>
              </select>
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2f8f4e]"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2f8f4e]"
              >
                <option value="other">Other</option>
                <option value="service">Service</option>
                <option value="cleaning">Cleaning</option>
                <option value="inventory">Inventory</option>
                <option value="maintenance">Maintenance</option>
                <option value="food_preparation">Food Preparation</option>
                <option value="safety">Safety</option>
              </select>
              <input
                type="datetime-local"
                value={form.dueDate}
                onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2f8f4e]"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Description"
                className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2f8f4e] md:col-span-2"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#2b211c]">
                  Frequency (optional recurring days)
                </p>
                {selectedEmployeeOffDays.length > 0 && (
                  <p className="text-xs text-amber-700">
                    Off-day selection is disabled
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {DAY_OPTIONS.map((day) => {
                  const isSelected = (form.frequency || []).includes(day.value);
                  const isOffDay = selectedEmployeeOffDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      disabled={isOffDay}
                      onClick={() => {
                        setForm((prev) => {
                          const current = Array.isArray(prev.frequency)
                            ? prev.frequency
                            : [];
                          const next = current.includes(day.value)
                            ? current.filter((entry) => entry !== day.value)
                            : [...current, day.value];
                          return { ...prev, frequency: next };
                        });
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold border ${
                        isOffDay
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : isSelected
                          ? "bg-[#2f8f4e] text-white border-[#2f8f4e]"
                          : "bg-white text-gray-700 border-gray-300 hover:border-[#2f8f4e]"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              {employeeUnavailableToday && (
                <p className="text-xs text-red-700">
                  Employee attendance today is marked{" "}
                  {selectedAttendanceStatus === "on_leave"
                    ? "on leave"
                    : selectedAttendanceStatus}
                  . Tasks for today are restricted.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-[#ff6b35] text-white text-sm font-medium hover:bg-[#e25827] disabled:opacity-60"
              >
                {saving ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Loading tasks...</p>
        ) : filteredTasks.length === 0 ? (
          <p className="text-sm text-gray-500">No tasks found for current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Assignee</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Priority</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Frequency</th>
                  <th className="py-2 pr-4">Due</th>
                  <th className="py-2 pr-4">Completed</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const taskId = task._id;
                  const assignedId = (task.assignedTo?._id || task.assignedTo || "").toString();
                  const assigneeName =
                    task.assignedTo?.name || employeeNameById.get(assignedId) || "-";
                  const isBusy = busyTaskId === taskId;
                  const frequencyLabels = Array.isArray(task.frequency)
                    ? task.frequency
                        .map((day) => DAY_OPTIONS.find((d) => d.value === normalizeDay(day))?.label)
                        .filter(Boolean)
                    : [];

                  return (
                    <tr key={taskId} className="border-b last:border-b-0 align-top">
                      <td className="py-2 pr-4">
                        <p className="font-medium text-[#2b211c]">{task.title}</p>
                        {task.description ? (
                          <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4">{assigneeName}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(
                            task.status
                          )}`}
                        >
                          {(task.status || "pending").replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-2 pr-4 uppercase text-xs">{task.priority || "medium"}</td>
                      <td className="py-2 pr-4 uppercase text-xs">{task.assignedBy || "admin"}</td>
                      <td className="py-2 pr-4 text-gray-600">
                        {frequencyLabels.length > 0
                          ? frequencyLabels.join(", ")
                          : "-"}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{formatDateTime(task.dueDate)}</td>
                      <td className="py-2 pr-4 text-gray-600">{formatDateTime(task.completedAt)}</td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => openEditForm(task)}
                            className="px-2 py-1 rounded border border-gray-300 text-xs hover:bg-gray-100 disabled:opacity-60"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleToggleCompletion(task)}
                            className="px-2 py-1 rounded border border-blue-300 text-blue-700 text-xs hover:bg-blue-50 disabled:opacity-60"
                          >
                            {task.status === "completed" ? "Reopen" : "Complete"}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDeleteTask(task)}
                            className="px-2 py-1 rounded border border-red-300 text-red-700 text-xs hover:bg-red-50 disabled:opacity-60"
                          >
                            Delete
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
    </div>
  );
};

export default TaskManagement;
