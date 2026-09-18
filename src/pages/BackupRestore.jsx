import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../utils/api";
import { alert } from "../utils/alert";
import { getAdminApiOrigin } from "../utils/adminApiOrigin";

const TABS = ["Backup Now", "Scheduled Jobs", "Backup History", "Restore", "Audit Logs"];

const DEFAULT_BACKUP_FORM = {
  scopeType: "system",
  scopeId: "",
  selectedFranchiseId: "",
  selectedCartId: "",
  replaceDailyBackup: false,
  notes: "",
};

const DEFAULT_JOB_FORM = {
  name: "",
  scopeType: "system",
  scopeId: "",
  selectedFranchiseId: "",
  selectedCartId: "",
  frequency: "daily",
  scheduleTimeIST: "02:00",
  replaceDailyBackup: false,
  isEnabled: true,
};

const ACTIVE_BACKUP_STATUSES = new Set(["queued", "running"]);
const POLL_INTERVAL_MS = 5000;

function canDownloadBackup(backup) {
  return (
    backup?.status === "success" &&
    (Array.isArray(backup?.manifest?.files) ? backup.manifest.files.length > 0 : Boolean(backup?.manifestS3Key))
  );
}

function getBackupDownloadOrigin() {
  if (import.meta.env.DEV && String(import.meta.env.VITE_USE_VITE_PROXY || "").toLowerCase() === "true") {
    const target = import.meta.env.VITE_DEV_BACKEND_TARGET;
    if (target) return String(target).replace(/\/$/, "");
    const host = import.meta.env.VITE_DEV_BACKEND_HOST || "127.0.0.1";
    const port = import.meta.env.VITE_DEV_BACKEND_PORT || "5001";
    return `http://${host}:${port}`;
  }
  return String(getAdminApiOrigin()).replace(/\/$/, "");
}

function getAuthToken() {
  try {
    return (
      localStorage.getItem("superAdminToken") ||
      localStorage.getItem("franchiseAdminToken") ||
      localStorage.getItem("adminToken")
    );
  } catch {
    return null;
  }
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function resolveScopeLabel(job, franchiseOptions, cartOptions) {
  if (!job) return "-";
  if (job.scopeType === "system") return "Entire system";
  if (job.scopeType === "franchise") {
    const franchise = franchiseOptions.find((item) => item.id === String(job.scopeId));
    return franchise ? `Franchise: ${franchise.name}` : `Franchise (${job.scopeId})`;
  }
  const cart = cartOptions.find((item) => item.id === String(job.scopeId));
  return cart ? `Cart: ${cart.name}` : `Cart (${job.scopeId})`;
}

function statusBadgeClass(status) {
  switch (status) {
    case "success":
      return "bg-green-100 text-green-800 border-green-200";
    case "running":
    case "queued":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "failed":
    case "invalid":
      return "bg-red-100 text-red-800 border-red-200";
    case "deleted":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function phaseLabel(phase) {
  switch (phase) {
    case "initializing":
      return "Preparing backup";
    case "exporting":
      return "Exporting database collections";
    case "uploading":
      return "Uploading to S3";
    case "finalizing":
      return "Finalizing manifest and checksum";
    case "completed":
      return "Backup completed";
    case "failed":
      return "Backup failed";
    default:
      return "Processing";
  }
}

function BackupProgressPanel({ backup, title = "Backup in progress" }) {
  if (!backup) return null;
  const progress = backup.progress || {};
  const percentage = Number(progress.percentage || 0);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {ACTIVE_BACKUP_STATUSES.has(backup.status) && (
            <span className="inline-block h-4 w-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          )}
          <div>
            <div className="font-semibold text-blue-900">{title}</div>
            <div className="text-sm text-blue-800">
              {backup.scopeType}
              {backup.scopeId ? ` (${backup.scopeId})` : ""} · {backup.status}
            </div>
          </div>
        </div>
        <span className={`px-2 py-1 rounded border text-xs font-medium ${statusBadgeClass(backup.status)}`}>
          {backup.status}
        </span>
      </div>

      <div>
        <div className="flex justify-between text-sm text-blue-900 mb-1">
          <span>{phaseLabel(progress.phase)}</span>
          <span>{percentage}%</span>
        </div>
        <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${Math.max(percentage, backup.status === "queued" ? 5 : 0)}%` }}
          />
        </div>
      </div>

      {progress.currentCollection && (
        <div className="text-sm text-blue-900">
          Current collection: <strong>{progress.currentCollection}</strong>
        </div>
      )}

      {Number(progress.processedRecords || 0) > 0 && (
        <div className="text-sm text-blue-800">
          Records processed: {progress.processedRecords}
          {progress.totalRecords ? ` · ${progress.totalRecords} collections total` : ""}
        </div>
      )}

      {progress.updatedAt && (
        <div className="text-xs text-blue-700">
          Last update: {new Date(progress.updatedAt).toLocaleString()}
        </div>
      )}

      {backup.errorMessage && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
          {backup.errorMessage}
        </div>
      )}

      <div className="text-xs text-blue-700">
        Backup ID: {backup._id}
        {backup.startedAt ? ` · Started ${new Date(backup.startedAt).toLocaleString()}` : ""}
      </div>
    </div>
  );
}

function BackupRestore() {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [pageLoading, setPageLoading] = useState(false);
  const [backupSubmitting, setBackupSubmitting] = useState(false);
  const [downloadingBackupId, setDownloadingBackupId] = useState(null);
  const [activeBackupId, setActiveBackupId] = useState(null);
  const [activeBackupStatus, setActiveBackupStatus] = useState(null);
  const hasResumedPollingRef = useRef(false);
  const loadBaseDataRef = useRef(null);

  const [backupForm, setBackupForm] = useState(DEFAULT_BACKUP_FORM);
  const [backups, setBackups] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [jobForm, setJobForm] = useState(DEFAULT_JOB_FORM);
  const [editingJobId, setEditingJobId] = useState(null);
  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [franchiseOptions, setFranchiseOptions] = useState([]);
  const [cartOptions, setCartOptions] = useState([]);
  const [restorePreview, setRestorePreview] = useState(null);
  const [restoreForm, setRestoreForm] = useState({
    backupId: "",
    targetScopeType: "system",
    targetScopeId: "",
    restoreMode: "merge_with_validation",
    restoreRecordId: "",
    confirmationPhrase: "",
    acknowledgeRisk: false,
  });

  const selectedBackup = useMemo(
    () => backups.find((b) => String(b._id) === String(restoreForm.backupId)) || null,
    [backups, restoreForm.backupId]
  );

  const loadBaseData = useCallback(async (silent = false, resumeActiveBackup = false) => {
    if (!silent) setPageLoading(true);
    try {
      const [backupRes, jobRes, auditRes] = await Promise.all([
        api.get("/admin/superadmin/backup-restore/backups"),
        api.get("/admin/superadmin/backup-restore/jobs"),
        api.get("/admin/superadmin/backup-restore/audit-logs"),
      ]);
      let schedulerData = null;
      try {
        const schedulerRes = await api.get("/admin/superadmin/backup-restore/jobs/scheduler/status");
        schedulerData = schedulerRes.data?.data || null;
      } catch {
        schedulerData = null;
      }
      const usersRes = await api.get("/users");
      const users = usersRes.data || [];
      const franchises = users
        .filter((u) => u?.role === "franchise_admin")
        .map((u) => ({
          id: String(u._id),
          name: u?.name || u?.franchiseCode || String(u._id),
        }));
      const carts = users
        .filter((u) => u?.role === "admin")
        .map((u) => ({
          id: String(u._id),
          name: u?.cartName || u?.name || String(u._id),
          franchiseId: u?.franchiseId ? String(u.franchiseId) : "",
        }));

      const nextBackups = backupRes.data?.data || [];
      setBackups(nextBackups);
      setJobs(jobRes.data?.data || []);
      setSchedulerStatus(schedulerData);
      setAuditLogs(auditRes.data?.data || []);
      setFranchiseOptions(franchises);
      setCartOptions(carts);

      if (resumeActiveBackup && !hasResumedPollingRef.current) {
        const running = nextBackups.find((b) => ACTIVE_BACKUP_STATUSES.has(b.status));
        if (running) {
          hasResumedPollingRef.current = true;
          setActiveBackupId(running._id);
          setActiveBackupStatus(running);
          setBackupSubmitting(true);
        }
      }

      return nextBackups;
    } catch (error) {
      alert(error?.response?.data?.message || "Failed to load backup/restore data", "error");
      return [];
    } finally {
      if (!silent) setPageLoading(false);
    }
  }, []);

  loadBaseDataRef.current = loadBaseData;

  const runningJobIds = useMemo(
    () =>
      jobs
        .filter((job) => job.lastStatus === "running")
        .map((job) => String(job._id))
        .join(","),
    [jobs]
  );

  useEffect(() => {
    if (activeTab !== "Scheduled Jobs" || !runningJobIds) return undefined;

    const refreshJobs = async () => {
      try {
        const jobRes = await api.get("/admin/superadmin/backup-restore/jobs");
        setJobs(jobRes.data?.data || []);
      } catch (error) {
        console.error("Failed to poll scheduled jobs", error);
      }
    };

    refreshJobs();
    const intervalId = setInterval(refreshJobs, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [activeTab, runningJobIds]);

  useEffect(() => {
    loadBaseData(false, true);
  }, [loadBaseData]);

  useEffect(() => {
    if (!activeBackupId) return undefined;

    let cancelled = false;
    let intervalId = null;

    const finishPolling = async (statusData) => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      setBackupSubmitting(false);
      setActiveBackupId(null);
      setActiveBackupStatus(null);
      if (statusData?.status === "success") {
        alert("Backup completed successfully and uploaded to S3", "success");
      } else if (statusData?.status === "failed") {
        alert(statusData.errorMessage || "Backup failed", "error");
      }
      await loadBaseDataRef.current?.(true, false);
    };

    const tick = async () => {
      if (cancelled || document.visibilityState === "hidden") return;
      try {
        const response = await api.get(
          `/admin/superadmin/backup-restore/backups/${activeBackupId}/status`
        );
        const statusData = response.data?.data;
        if (cancelled || !statusData) return;

        setActiveBackupStatus(statusData);
        setBackups((prev) =>
          prev.map((item) =>
            String(item._id) === String(activeBackupId) ? { ...item, ...statusData } : item
          )
        );

        if (!ACTIVE_BACKUP_STATUSES.has(statusData.status)) {
          await finishPolling(statusData);
        }
      } catch (error) {
        console.error("Failed to poll backup status", error);
      }
    };

    tick();
    intervalId = setInterval(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeBackupId]);

  const dismissActiveBackupMonitor = () => {
    setActiveBackupId(null);
    setActiveBackupStatus(null);
    setBackupSubmitting(false);
  };

  const handleManualBackup = async () => {
    if (backupForm.scopeType !== "system" && !backupForm.scopeId.trim()) {
      alert("Please select a franchise or cart for scoped backup", "warning");
      return;
    }
    if (activeBackupId || backupSubmitting) {
      alert("A backup is already in progress. Please wait for it to finish.", "warning");
      return;
    }

    setBackupSubmitting(true);
    try {
      const response = await api.post("/admin/superadmin/backup-restore/backups/manual", {
        scopeType: backupForm.scopeType,
        scopeId: backupForm.scopeType === "system" ? undefined : backupForm.scopeId.trim(),
        replaceDailyBackup: backupForm.replaceDailyBackup,
        notes: backupForm.notes || undefined,
      });
      const queuedBackup = response.data?.data;
      alert("Backup queued. Upload to S3 will continue in the background.", "success");
      if (queuedBackup?._id) {
        setActiveBackupId(queuedBackup._id);
        setActiveBackupStatus(queuedBackup);
        setBackups((prev) => [queuedBackup, ...prev.filter((b) => String(b._id) !== String(queuedBackup._id))]);
      }
      setBackupForm(DEFAULT_BACKUP_FORM);
    } catch (error) {
      setBackupSubmitting(false);
      alert(error?.response?.data?.message || "Failed to start backup", "error");
    }
  };

  const handleDownloadBackup = async (backup) => {
    if (!canDownloadBackup(backup)) {
      alert("This backup is not ready for download yet. Only completed successful backups can be downloaded.", "warning");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      alert("You are not logged in. Please sign in again.", "error");
      return;
    }

    setDownloadingBackupId(backup._id);
    try {
      const downloadUrl = `${getBackupDownloadOrigin()}/api/admin/superadmin/backup-restore/backups/${backup._id}/download`;
      const response = await fetch(downloadUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Request-Source": "terra-admin-web",
        },
      });

      const contentType = String(response.headers.get("content-type") || "");

      if (!response.ok) {
        if (contentType.includes("application/json")) {
          const data = await response.json();
          throw new Error(data.message || "Failed to download backup");
        }
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          throw new Error(data.message || "Failed to download backup");
        } catch {
          throw new Error(text || `Download failed (${response.status})`);
        }
      }

      const blob = await response.blob();

      if (blob.size < 128) {
        const text = await blob.text();
        try {
          const data = JSON.parse(text);
          throw new Error(data.message || "Failed to download backup");
        } catch {
          if (text.trim()) {
            throw new Error(text.trim());
          }
        }
      }

      const fileName =
        backup.fileName && backup.fileName.endsWith(".zip")
          ? backup.fileName
          : `terracart-backup-${backup.scopeType}-${backup._id}.zip`;
      const url = window.URL.createObjectURL(new Blob([blob], { type: "application/zip" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      alert("Backup downloaded successfully", "success");
    } catch (error) {
      alert(error?.message || "Failed to download backup", "error");
    } finally {
      setDownloadingBackupId(null);
    }
  };

  const handleRunJobNow = async (jobId) => {
    setJobSubmitting(true);
    try {
      const response = await api.post(`/admin/superadmin/backup-restore/jobs/${jobId}/run-now`);
      const queuedBackup = response.data?.data?.backupRecord;
      alert("Scheduled backup queued. Check Backup History for progress.", "success");
      if (queuedBackup?._id) {
        setActiveBackupId(queuedBackup._id);
        setActiveBackupStatus(queuedBackup);
        setBackupSubmitting(true);
      }
      await loadBaseDataRef.current?.(true, false);
    } catch (error) {
      alert(error?.response?.data?.message || "Failed to run scheduled job", "error");
    } finally {
      setJobSubmitting(false);
    }
  };

  const handlePreviewRestore = async () => {
    if (!restoreForm.backupId) {
      alert("Please select a backup", "warning");
      return;
    }
    if (restoreForm.targetScopeType !== "system" && !restoreForm.targetScopeId.trim()) {
      alert("Scope ID is required for franchise/cart restore", "warning");
      return;
    }
    setPageLoading(true);
    try {
      const response = await api.post("/admin/superadmin/backup-restore/restores/preview", {
        backupId: restoreForm.backupId,
        targetScopeType: restoreForm.targetScopeType,
        targetScopeId:
          restoreForm.targetScopeType === "system" ? undefined : restoreForm.targetScopeId.trim(),
        restoreMode: restoreForm.restoreMode,
      });
      const restoreRecord = response.data?.data;
      setRestorePreview(restoreRecord);
      setRestoreForm((prev) => ({ ...prev, restoreRecordId: restoreRecord?._id || "" }));
      alert("Restore preview completed", "success");
    } catch (error) {
      setRestorePreview(null);
      alert(error?.response?.data?.message || "Restore preview failed", "error");
    } finally {
      setPageLoading(false);
    }
  };

  const filteredCartOptions = useMemo(() => {
    if (!backupForm.selectedFranchiseId) return cartOptions;
    return cartOptions.filter((cart) => cart.franchiseId === backupForm.selectedFranchiseId);
  }, [backupForm.selectedFranchiseId, cartOptions]);

  const filteredJobCartOptions = useMemo(() => {
    if (!jobForm.selectedFranchiseId) return cartOptions;
    return cartOptions.filter((cart) => cart.franchiseId === jobForm.selectedFranchiseId);
  }, [jobForm.selectedFranchiseId, cartOptions]);

  const resetJobForm = () => {
    setJobForm(DEFAULT_JOB_FORM);
    setEditingJobId(null);
  };

  const handleSaveJob = async () => {
    if (!jobForm.name.trim()) {
      alert("Job name is required", "warning");
      return;
    }
    if (jobForm.scopeType !== "system" && !jobForm.scopeId.trim()) {
      alert("Please select a franchise or cart for scoped backup", "warning");
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(jobForm.scheduleTimeIST.trim())) {
      alert("Schedule time must be in HH:MM format (24-hour IST)", "warning");
      return;
    }

    setJobSubmitting(true);
    const payload = {
      name: jobForm.name.trim(),
      scopeType: jobForm.scopeType,
      scopeId: jobForm.scopeType === "system" ? undefined : jobForm.scopeId.trim(),
      frequency: jobForm.frequency,
      scheduleTimeIST: jobForm.scheduleTimeIST.trim(),
      replaceDailyBackup: jobForm.replaceDailyBackup,
      isEnabled: jobForm.isEnabled,
    };

    try {
      if (editingJobId) {
        await api.patch(`/admin/superadmin/backup-restore/jobs/${editingJobId}`, payload);
        alert("Scheduled job updated", "success");
      } else {
        await api.post("/admin/superadmin/backup-restore/jobs", payload);
        alert("Scheduled job created", "success");
      }
      resetJobForm();
      await loadBaseDataRef.current?.(true, false);
    } catch (error) {
      alert(error?.response?.data?.message || "Failed to save scheduled job", "error");
    } finally {
      setJobSubmitting(false);
    }
  };

  const handleEditJob = (job) => {
    setEditingJobId(job._id);
    setJobForm({
      name: job.name || "",
      scopeType: job.scopeType || "system",
      scopeId: job.scopeId ? String(job.scopeId) : "",
      selectedFranchiseId: job.scopeType === "franchise" ? String(job.scopeId || "") : "",
      selectedCartId: job.scopeType === "cart" ? String(job.scopeId || "") : "",
      frequency: job.frequency || "daily",
      scheduleTimeIST: job.scheduleTimeIST || "02:00",
      replaceDailyBackup: Boolean(job.replaceDailyBackup),
      isEnabled: job.isEnabled !== false,
    });
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm("Delete this scheduled backup job?")) return;
    setJobSubmitting(true);
    try {
      await api.delete(`/admin/superadmin/backup-restore/jobs/${jobId}`);
      alert("Scheduled job deleted", "success");
      if (editingJobId === jobId) resetJobForm();
      await loadBaseDataRef.current?.(true, false);
    } catch (error) {
      alert(error?.response?.data?.message || "Failed to delete scheduled job", "error");
    } finally {
      setJobSubmitting(false);
    }
  };

  const handleToggleJobEnabled = async (job) => {
    setJobSubmitting(true);
    try {
      await api.patch(`/admin/superadmin/backup-restore/jobs/${job._id}`, {
        isEnabled: !job.isEnabled,
      });
      await loadBaseDataRef.current?.(true, false);
    } catch (error) {
      alert(error?.response?.data?.message || "Failed to update job status", "error");
    } finally {
      setJobSubmitting(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreForm.restoreRecordId) {
      alert("Please run restore preview first", "warning");
      return;
    }
    if (!restoreForm.acknowledgeRisk) {
      alert("Please acknowledge restore risk", "warning");
      return;
    }
    setPageLoading(true);
    try {
      await api.post("/admin/superadmin/backup-restore/restores/execute", {
        restoreRecordId: restoreForm.restoreRecordId,
        backupId: restoreForm.backupId,
        confirmationPhrase: restoreForm.confirmationPhrase,
        acknowledgeRisk: restoreForm.acknowledgeRisk,
      });
      alert("Restore started", "success");
      await loadBaseData();
    } catch (error) {
      alert(error?.response?.data?.message || "Restore execution failed", "error");
    } finally {
      setPageLoading(false);
    }
  };

  const displayedActiveBackup =
    activeBackupStatus || backups.find((b) => String(b._id) === String(activeBackupId)) || null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Database Backup &amp; Restore</h1>
          <p className="text-sm text-gray-600 mt-1">
            Backups are stored in S3. Successful backups can be downloaded as ZIP files from Backup History.
          </p>
        </div>
        <button
          className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
          onClick={() => loadBaseData()}
          disabled={pageLoading}
        >
          {pageLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {displayedActiveBackup && ACTIVE_BACKUP_STATUSES.has(displayedActiveBackup.status) && activeBackupId && (
        <div className="space-y-2">
          <BackupProgressPanel backup={displayedActiveBackup} title="Current backup operation" />
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Status checks every 5 seconds while this panel is open.</span>
            <button
              type="button"
              className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
              onClick={dismissActiveBackupMonitor}
            >
              Hide monitor (backup continues on server)
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`px-3 py-2 rounded ${activeTab === tab ? "bg-[#ff6b35] text-white" : "bg-gray-200 text-gray-700"}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Backup Now" && (
        <div className="bg-white p-4 rounded shadow space-y-3">
          <div className="text-sm text-red-600 font-medium">
            Warning: System backup is high-impact and should be used carefully.
          </div>
          <select
            value={backupForm.scopeType}
            onChange={(e) =>
              setBackupForm((p) => ({
                ...p,
                scopeType: e.target.value,
                scopeId: "",
                selectedFranchiseId: "",
                selectedCartId: "",
              }))
            }
            className="border rounded px-2 py-2 w-full"
            disabled={backupSubmitting || Boolean(activeBackupId)}
          >
            <option value="system">Entire system</option>
            <option value="franchise">Franchise</option>
            <option value="cart">Cart</option>
          </select>
          {backupForm.scopeType === "franchise" && (
            <select
              value={backupForm.selectedFranchiseId}
              onChange={(e) =>
                setBackupForm((p) => ({
                  ...p,
                  selectedFranchiseId: e.target.value,
                  scopeId: e.target.value,
                }))
              }
              className="border rounded px-2 py-2 w-full"
              disabled={backupSubmitting || Boolean(activeBackupId)}
            >
              <option value="">Select franchise</option>
              {franchiseOptions.map((franchise) => (
                <option key={franchise.id} value={franchise.id}>
                  {franchise.name}
                </option>
              ))}
            </select>
          )}
          {backupForm.scopeType === "cart" && (
            <>
              <select
                value={backupForm.selectedFranchiseId}
                onChange={(e) =>
                  setBackupForm((p) => ({
                    ...p,
                    selectedFranchiseId: e.target.value,
                    selectedCartId: "",
                    scopeId: "",
                  }))
                }
                className="border rounded px-2 py-2 w-full"
                disabled={backupSubmitting || Boolean(activeBackupId)}
              >
                <option value="">All franchises</option>
                {franchiseOptions.map((franchise) => (
                  <option key={franchise.id} value={franchise.id}>
                    {franchise.name}
                  </option>
                ))}
              </select>
              <select
                value={backupForm.selectedCartId}
                onChange={(e) =>
                  setBackupForm((p) => ({
                    ...p,
                    selectedCartId: e.target.value,
                    scopeId: e.target.value,
                  }))
                }
                className="border rounded px-2 py-2 w-full"
                disabled={backupSubmitting || Boolean(activeBackupId)}
              >
                <option value="">Select cart</option>
                {filteredCartOptions.map((cart) => (
                  <option key={cart.id} value={cart.id}>
                    {cart.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={backupForm.replaceDailyBackup}
              onChange={(e) => setBackupForm((p) => ({ ...p, replaceDailyBackup: e.target.checked }))}
              disabled={backupSubmitting || Boolean(activeBackupId)}
            />
            Replace daily backup
          </label>
          <textarea
            placeholder="Notes"
            value={backupForm.notes}
            onChange={(e) => setBackupForm((p) => ({ ...p, notes: e.target.value }))}
            className="border rounded px-2 py-2 w-full"
            disabled={backupSubmitting || Boolean(activeBackupId)}
          />
          <button
            className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-60 flex items-center gap-2"
            onClick={handleManualBackup}
            disabled={backupSubmitting || Boolean(activeBackupId)}
          >
            {(backupSubmitting || activeBackupId) && (
              <span className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            )}
            {backupSubmitting || activeBackupId ? "Backup in progress..." : "Start Backup"}
          </button>
          <div className="text-xs text-gray-500">
            Progress updates every 5 seconds while the monitor is visible. Large collections may take several minutes.
          </div>
        </div>
      )}

      {activeTab === "Scheduled Jobs" && (
        <div className="space-y-4">
          <div
            className={`rounded-lg border p-3 text-sm ${
              schedulerStatus?.enabled
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <div className="font-medium">
              Automatic scheduler: {schedulerStatus?.enabled ? "Enabled" : "Disabled"}
            </div>
            <div className="mt-1">
              {schedulerStatus?.enabled
                ? `Jobs run automatically at their scheduled IST time (checked every ${schedulerStatus.pollIntervalSeconds}s).`
                : `Set BACKUP_SCHEDULER_ENABLED=true in backend .env and restart the server to run jobs automatically.`}
            </div>
          </div>

          <div className="bg-white p-4 rounded shadow space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {editingJobId ? "Edit scheduled job" : "Create scheduled job"}
              </h2>
              {editingJobId && (
                <button
                  type="button"
                  className="text-sm text-gray-600 hover:text-gray-900"
                  onClick={resetJobForm}
                  disabled={jobSubmitting}
                >
                  Cancel edit
                </button>
              )}
            </div>

            <input
              placeholder="Job name (e.g. Nightly system backup)"
              value={jobForm.name}
              onChange={(e) => setJobForm((p) => ({ ...p, name: e.target.value }))}
              className="border rounded px-2 py-2 w-full"
              disabled={jobSubmitting}
            />

            <select
              value={jobForm.scopeType}
              onChange={(e) =>
                setJobForm((p) => ({
                  ...p,
                  scopeType: e.target.value,
                  scopeId: "",
                  selectedFranchiseId: "",
                  selectedCartId: "",
                }))
              }
              className="border rounded px-2 py-2 w-full"
              disabled={jobSubmitting}
            >
              <option value="system">Entire system</option>
              <option value="franchise">Franchise</option>
              <option value="cart">Cart</option>
            </select>

            {jobForm.scopeType === "franchise" && (
              <select
                value={jobForm.selectedFranchiseId}
                onChange={(e) =>
                  setJobForm((p) => ({
                    ...p,
                    selectedFranchiseId: e.target.value,
                    scopeId: e.target.value,
                  }))
                }
                className="border rounded px-2 py-2 w-full"
                disabled={jobSubmitting}
              >
                <option value="">Select franchise</option>
                {franchiseOptions.map((franchise) => (
                  <option key={franchise.id} value={franchise.id}>
                    {franchise.name}
                  </option>
                ))}
              </select>
            )}

            {jobForm.scopeType === "cart" && (
              <>
                <select
                  value={jobForm.selectedFranchiseId}
                  onChange={(e) =>
                    setJobForm((p) => ({
                      ...p,
                      selectedFranchiseId: e.target.value,
                      selectedCartId: "",
                      scopeId: "",
                    }))
                  }
                  className="border rounded px-2 py-2 w-full"
                  disabled={jobSubmitting}
                >
                  <option value="">All franchises</option>
                  {franchiseOptions.map((franchise) => (
                    <option key={franchise.id} value={franchise.id}>
                      {franchise.name}
                    </option>
                  ))}
                </select>
                <select
                  value={jobForm.selectedCartId}
                  onChange={(e) =>
                    setJobForm((p) => ({
                      ...p,
                      selectedCartId: e.target.value,
                      scopeId: e.target.value,
                    }))
                  }
                  className="border rounded px-2 py-2 w-full"
                  disabled={jobSubmitting}
                >
                  <option value="">Select cart</option>
                  {filteredJobCartOptions.map((cart) => (
                    <option key={cart.id} value={cart.id}>
                      {cart.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Schedule time (IST, 24h)</label>
                <input
                  type="time"
                  value={jobForm.scheduleTimeIST}
                  onChange={(e) => setJobForm((p) => ({ ...p, scheduleTimeIST: e.target.value }))}
                  className="border rounded px-2 py-2 w-full"
                  disabled={jobSubmitting}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Frequency</label>
                <select
                  value={jobForm.frequency}
                  onChange={(e) => setJobForm((p) => ({ ...p, frequency: e.target.value }))}
                  className="border rounded px-2 py-2 w-full"
                  disabled={jobSubmitting}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={jobForm.replaceDailyBackup}
                onChange={(e) => setJobForm((p) => ({ ...p, replaceDailyBackup: e.target.checked }))}
                disabled={jobSubmitting}
              />
              Replace daily backup in S3
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={jobForm.isEnabled}
                onChange={(e) => setJobForm((p) => ({ ...p, isEnabled: e.target.checked }))}
                disabled={jobSubmitting}
              />
              Job enabled
            </label>

            <button
              className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-60"
              onClick={handleSaveJob}
              disabled={jobSubmitting}
            >
              {jobSubmitting
                ? "Saving..."
                : editingJobId
                  ? "Update scheduled job"
                  : "Create scheduled job"}
            </button>
          </div>

          <div className="bg-white p-4 rounded shadow overflow-x-auto">
            <h2 className="text-lg font-semibold mb-3">Scheduled jobs</h2>
            <table className="w-full text-sm min-w-[960px]">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Name</th>
                  <th>Scope</th>
                  <th>Frequency</th>
                  <th>Time (IST)</th>
                  <th>Enabled</th>
                  <th>Last run</th>
                  <th>Last status</th>
                  <th>Next run</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-gray-500">
                      No scheduled jobs yet. Create one above.
                    </td>
                  </tr>
                )}
                {jobs.map((job) => (
                  <tr key={job._id} className="border-b align-top">
                    <td className="py-2 font-medium">{job.name}</td>
                    <td>{resolveScopeLabel(job, franchiseOptions, cartOptions)}</td>
                    <td className="capitalize">{job.frequency || "daily"}</td>
                    <td>{job.scheduleTimeIST}</td>
                    <td>
                      <button
                        type="button"
                        className={`px-2 py-0.5 rounded border text-xs ${
                          job.isEnabled
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-gray-100 text-gray-600 border-gray-200"
                        }`}
                        onClick={() => handleToggleJobEnabled(job)}
                        disabled={jobSubmitting}
                      >
                        {job.isEnabled ? "Enabled" : "Disabled"}
                      </button>
                    </td>
                    <td>{job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : "-"}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded border text-xs ${statusBadgeClass(job.lastStatus)}`}>
                        {job.lastStatus || "idle"}
                      </span>
                      {job.lastError && (
                        <div className="text-xs text-red-600 mt-1 max-w-[180px]">{job.lastError}</div>
                      )}
                    </td>
                    <td>{job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : "-"}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <button
                          className="px-2 py-1 rounded bg-blue-600 text-white text-xs disabled:opacity-60"
                          onClick={() => handleRunJobNow(job._id)}
                          disabled={jobSubmitting || job.lastStatus === "running"}
                        >
                          Run now
                        </button>
                        <button
                          className="px-2 py-1 rounded bg-gray-200 text-gray-800 text-xs disabled:opacity-60"
                          onClick={() => handleEditJob(job)}
                          disabled={jobSubmitting}
                        >
                          Edit
                        </button>
                        <button
                          className="px-2 py-1 rounded bg-red-600 text-white text-xs disabled:opacity-60"
                          onClick={() => handleDeleteJob(job._id)}
                          disabled={jobSubmitting}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "Backup History" && (
        <div className="bg-white p-4 rounded shadow overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Scope</th>
                <th>Type</th>
                <th>Status</th>
                <th>Size</th>
                <th>Created</th>
                <th>Completed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">
                    No backups yet.
                  </td>
                </tr>
              )}
              {backups.map((backup) => (
                <tr key={backup._id} className="border-b align-top">
                  <td className="py-2">
                    <div className="font-medium">
                      {backup.scopeType}
                      {backup.scopeId ? ` (${backup.scopeId})` : ""}
                    </div>
                    <div className="text-xs text-gray-500 break-all">{backup._id}</div>
                    {backup.errorMessage && (
                      <div className="text-xs text-red-600 mt-1 max-w-xs">{backup.errorMessage}</div>
                    )}
                  </td>
                  <td>{backup.backupType}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded border text-xs ${statusBadgeClass(backup.status)}`}>
                      {backup.status}
                    </span>
                    {ACTIVE_BACKUP_STATUSES.has(backup.status) && backup.progress?.phase && (
                      <div className="text-xs text-blue-700 mt-1">{phaseLabel(backup.progress.phase)}</div>
                    )}
                  </td>
                  <td>{formatBytes(backup.fileSize)}</td>
                  <td>{new Date(backup.createdAt).toLocaleString()}</td>
                  <td>{backup.completedAt ? new Date(backup.completedAt).toLocaleString() : "-"}</td>
                  <td>
                    {canDownloadBackup(backup) ? (
                      <button
                        className="px-2 py-1 rounded bg-indigo-600 text-white disabled:opacity-60"
                        onClick={() => handleDownloadBackup(backup)}
                        disabled={downloadingBackupId === backup._id}
                      >
                        {downloadingBackupId === backup._id ? "Preparing ZIP..." : "Download ZIP"}
                      </button>
                    ) : backup.status === "success" ? (
                      <span className="text-xs text-amber-700">Manifest unavailable</span>
                    ) : ACTIVE_BACKUP_STATUSES.has(backup.status) ? (
                      <span className="text-xs text-blue-700">In progress...</span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "Restore" && (
        <div className="bg-white p-4 rounded shadow space-y-3">
          <select
            value={restoreForm.backupId}
            onChange={(e) => setRestoreForm((p) => ({ ...p, backupId: e.target.value }))}
            className="border rounded px-2 py-2 w-full"
          >
            <option value="">Select backup</option>
            {backups
              .filter((b) => b.status === "success")
              .map((b) => (
                <option key={b._id} value={b._id}>
                  {b._id} - {b.scopeType} - {b.backupType}
                </option>
              ))}
          </select>

          <select
            value={restoreForm.targetScopeType}
            onChange={(e) => setRestoreForm((p) => ({ ...p, targetScopeType: e.target.value }))}
            className="border rounded px-2 py-2 w-full"
          >
            <option value="system">System</option>
            <option value="franchise">Franchise</option>
            <option value="cart">Cart</option>
          </select>

          {restoreForm.targetScopeType !== "system" && (
            <input
              placeholder="Target Scope ID"
              value={restoreForm.targetScopeId}
              onChange={(e) => setRestoreForm((p) => ({ ...p, targetScopeId: e.target.value }))}
              className="border rounded px-2 py-2 w-full"
            />
          )}

          <button
            className="px-4 py-2 rounded bg-orange-600 text-white disabled:opacity-60"
            onClick={handlePreviewRestore}
            disabled={pageLoading}
          >
            {pageLoading ? "Running preview..." : "Preview Restore"}
          </button>

          {restorePreview && (
            <div className="border rounded p-3 bg-gray-50 text-sm space-y-2">
              <div>
                Status: <strong>{restorePreview.status}</strong>
              </div>
              <div>Create: {restorePreview?.dryRunSummary?.recordsToCreate || 0}</div>
              <div>Update: {restorePreview?.dryRunSummary?.recordsToUpdate || 0}</div>
              <div>Conflicts: {restorePreview?.dryRunSummary?.conflicts || 0}</div>
            </div>
          )}

          <div className="text-sm text-red-700 font-medium">Restore requires typed confirmation phrase.</div>
          <input
            placeholder={
              restoreForm.targetScopeType === "system"
                ? "RESTORE system"
                : `RESTORE ${restoreForm.targetScopeType} <scopeId>`
            }
            value={restoreForm.confirmationPhrase}
            onChange={(e) => setRestoreForm((p) => ({ ...p, confirmationPhrase: e.target.value }))}
            className="border rounded px-2 py-2 w-full"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={restoreForm.acknowledgeRisk}
              onChange={(e) => setRestoreForm((p) => ({ ...p, acknowledgeRisk: e.target.checked }))}
            />
            I understand this is a high-risk production action.
          </label>
          <button
            className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-60"
            onClick={handleExecuteRestore}
            disabled={pageLoading}
          >
            {pageLoading ? "Starting restore..." : "Execute Restore"}
          </button>
        </div>
      )}

      {activeTab === "Audit Logs" && (
        <div className="bg-white p-4 rounded shadow overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Scope</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log._id} className="border-b">
                  <td className="py-2">{new Date(log.createdAt).toLocaleString()}</td>
                  <td>{log.actorRole}</td>
                  <td>{log.action}</td>
                  <td>{log.scopeType || "-"}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded border text-xs ${statusBadgeClass(log.status)}`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedBackup && (
        <div className="text-xs text-gray-500">
          Selected backup checksum: {selectedBackup.checksumSha256 || "N/A"}
        </div>
      )}
    </div>
  );
}

export default BackupRestore;
