import React, { useState, useEffect, useRef } from "react";
// Removed socket import - using HTTP polling instead
import { confirm } from "../utils/confirm";

const AttendanceManagement = () => {
  // Use dynamic imports to avoid circular dependency issues during bundling
  // Use refs instead of state to avoid closure issues
  const apiRef = useRef(null);
  const [dependenciesLoaded, setDependenciesLoaded] = useState(false);

  // Load api dynamically on mount
  useEffect(() => {
    const loadDependencies = async () => {
      try {
        const apiModule = await import("../utils/api");
        apiRef.current = apiModule.default;
        setDependenciesLoaded(true);
      } catch (error) {
        console.error("Failed to load dependency:", error);
      }
    };
    loadDependencies();
  }, []);
  const [attendance, setAttendance] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [carts, setCarts] = useState([]);
  const [selectedCart, setSelectedCart] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toLocaleDateString('en-CA') // Local YYYY-MM-DD
  );
  const [endDate, setEndDate] = useState(
    new Date().toLocaleDateString('en-CA') // Local YYYY-MM-DD
  );
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState("today"); // 'today', 'history', 'stats'
  const [currentTime, setCurrentTime] = useState(new Date()); // For real-time timer updates
  const pollingIntervalRef = useRef(null); // For HTTP polling interval
  const [processingAction, setProcessingAction] = useState(null); // Track which action is being processed
  
  // Use auth context
  // We need to import useAuth dynamically or assume it's available via context if we can't import easily
  // But wait, we can't easy dynamic import hooks.
  // Let's assume passed via props or context.
  // Since we can't change imports easily in this file without full re-write, we will try to use local state for role if possible or just rely on the API response structure.
  // Actually, we can check localStorage for role as a fallback since we are in a component
  
  const [userRole, setUserRole] = useState("");
  const [isMultiCartAdmin, setIsMultiCartAdmin] = useState(false);

  useEffect(() => {
    // Get user role from local storage or cached user object
    try {
        const superAdminUser = localStorage.getItem("superAdminUser");
        if (superAdminUser) {
            setUserRole("super_admin");
            setIsMultiCartAdmin(true);
            return;
        }
        const franchiseAdminUser = localStorage.getItem("franchiseAdminUser");
        if (franchiseAdminUser) {
            setUserRole("franchise_admin");
            setIsMultiCartAdmin(true);
            return;
        }
        const adminUser = localStorage.getItem("adminUser");
        if (adminUser) {
            setUserRole("admin");
            setIsMultiCartAdmin(false);
            return;
        }
    } catch (e) {
        console.error("Error reading user role", e);
    }
  }, []);

  // Real-time timer that updates every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!dependenciesLoaded || !apiRef.current) return; // Wait for dependencies to load

    fetchEmployees();
    // Only fetch carts if user is NOT a simple admin (cart admin)
    // Cart admins don't need the cart selector as they are bound to their cart
    if (userRole && userRole !== "admin") {
      fetchCarts();
    }
    fetchTodayAttendance();

    // Removed automatic polling as per user request
    pollingIntervalRef.current = null;

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [activeTab, dependenciesLoaded, selectedCart, userRole]);

  useEffect(() => {
    if (!dependenciesLoaded || !apiRef.current) return; // Wait for api to load
    if (activeTab === "history") {
      fetchAttendance();
    }
  }, [activeTab, selectedEmployee, startDate, endDate, dependenciesLoaded, selectedCart]);

  const fetchEmployees = async () => {
    if (!apiRef.current) return;
    try {
      const response = await apiRef.current.get("/employees");
      // Ensure employees is always an array
      let employeesData = [];
      if (Array.isArray(response.data)) {
        employeesData = response.data;
      } else if (response.data && Array.isArray(response.data.employees)) {
        employeesData = response.data.employees;
      } else if (response.data && Array.isArray(response.data.data)) {
        employeesData = response.data.data;
      }
      setEmployees(employeesData);
    } catch (error) {
      console.error("Error fetching employees:", error);
      setEmployees([]);
    }
  };

  const fetchCarts = async () => {
    // Double check role prevents unnecessary calls even if called manually
    if (!apiRef.current || (userRole === "admin")) return;
    try {
      const response = await apiRef.current.get("/users");
      const allUsers = response.data || [];
      
      // Filter for cart admins (role: "admin")  
      const cartAdmins = allUsers.filter((u) => u.role === "admin");
      
      setCarts(cartAdmins);
      
      // If there's only one cart (or we are editing the existing list), maybe auto-select?
      // But usually user selects manually.
    } catch (error) {
      console.error("Error fetching carts:", error);
      setCarts([]);
    }
  };


  const fetchTodayAttendance = async () => {
    if (!apiRef.current) return;
    try {
      setLoading(true);
      const params = {};
      if (selectedCart) params.cartId = selectedCart;
      
      const response = await apiRef.current.get("/attendance/today", { params });
      // Ensure todayAttendance is always an array
      let attendanceData = [];
      if (Array.isArray(response.data)) {
        attendanceData = response.data;
      } else if (response.data && Array.isArray(response.data.attendance)) {
        attendanceData = response.data.attendance;
      } else if (response.data && Array.isArray(response.data.data)) {
        attendanceData = response.data.data;
      }

      // Log attendance data (development only)
      if (import.meta.env.DEV) {
        console.log("[ATTENDANCE] Fetched today attendance:", attendanceData);
        console.log("[ATTENDANCE] Number of records:", attendanceData.length);
      }

      setTodayAttendance(attendanceData);
    } catch (error) {
      console.error("Error fetching today attendance:", error);
      alert("Failed to fetch today attendance");
      setTodayAttendance([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    if (!apiRef.current) return;
    try {
      setLoading(true);
      const params = {};
      if (selectedEmployee) params.employeeId = selectedEmployee;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (selectedCart) params.cartId = selectedCart;

      const response = await apiRef.current.get("/attendance", { params });
      // Ensure attendance is always an array
      let attendanceData = [];
      if (Array.isArray(response.data)) {
        attendanceData = response.data;
      } else if (response.data && Array.isArray(response.data.attendance)) {
        attendanceData = response.data.attendance;
      } else if (response.data && Array.isArray(response.data.data)) {
        attendanceData = response.data.data;
      }
      setAttendance(attendanceData);
    } catch (error) {
      console.error("Error fetching attendance:", error);
      alert("Failed to fetch attendance records");
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!apiRef.current) return;
    try {
      setLoading(true);
      const params = {};
      if (selectedEmployee) params.employeeId = selectedEmployee;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (selectedCart) params.cartId = selectedCart;

      const response = await apiRef.current.get("/attendance/stats", {
        params,
      });
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
      alert("Failed to fetch statistics");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (employeeId, event) => {
    // Prevent event propagation and default behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Prevent multiple simultaneous clicks
    const actionKey = `checkin-${employeeId}`;
    if (processingAction === actionKey) {
      return; // Already processing
    }

    // Check if already checked in before showing confirmation
    const todayRecord = Array.isArray(todayAttendance)
      ? todayAttendance.find(
          (a) =>
            a.employeeId?._id === employeeId ||
            a.employeeId === employeeId ||
            (typeof a.employeeId === "object" &&
              a.employeeId?._id === employeeId)
        )
      : null;

    if (todayRecord?.checkIn?.time) {
      alert("This employee is already checked in today.");
      // Refresh to show current state
      fetchTodayAttendance();
      return;
    }

    // Use custom confirm dialog and await the result
    const confirmed = await confirm("Mark this employee as checked in?");
    if (!confirmed) return;

    // Set processing state to prevent duplicate calls
    setProcessingAction(actionKey);
    if (!apiRef.current) {
      alert("System is still loading. Please wait a moment and try again.");
      return;
    }
    try {
      const response = await apiRef.current.post("/attendance/checkin", {
        employeeId,
      });

      // Immediately update the UI with the response data
      if (response.data?.attendance) {
        setTodayAttendance((prev) => {
          const updated = Array.isArray(prev) ? [...prev] : [];
          const existingIndex = updated.findIndex((a) => {
            const recordEmployeeId = a.employeeId?._id || a.employeeId;
            return recordEmployeeId?.toString() === employeeId?.toString();
          });

          if (existingIndex >= 0) {
            updated[existingIndex] = response.data.attendance;
          } else {
            updated.push(response.data.attendance);
          }

          return updated;
        });
      }

      // Also fetch latest data to ensure consistency
      fetchTodayAttendance();
      if (activeTab === "history") fetchAttendance();

      alert("✅ Check-in successful!");
    } catch (error) {
      console.error("Error checking in:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to check in";

      // If error is about already checked in, refresh data and show info message
      if (errorMessage.toLowerCase().includes("already checked in")) {
        // Refresh immediately to show the existing attendance record
        await fetchTodayAttendance();
        alert("ℹ️ " + errorMessage + "\n\nAttendance record refreshed.");
      } else {
        alert("❌ " + errorMessage);
      }
    } finally {
      // Clear processing state
      setProcessingAction(null);
    }
  };

  const handleStartBreak = async (attendanceId, employeeId, event) => {
    // Prevent event propagation and default behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Prevent multiple simultaneous clicks
    const actionKey = `startbreak-${attendanceId}`;
    if (processingAction === actionKey) {
      return; // Already processing
    }

    if (!apiRef.current) {
      alert("System is still loading. Please wait a moment and try again.");
      return;
    }

    // Use custom confirm dialog and await the result
    const confirmed = await confirm("Start break for this employee?");
    if (!confirmed) return;

    // Set processing state to prevent duplicate calls
    setProcessingAction(actionKey);
    try {
      const response = await apiRef.current.post(
        `/attendance/${attendanceId}/start-break`
      );

      // Immediately update the UI
      if (response.data?.attendance) {
        setTodayAttendance((prev) => {
          const updated = Array.isArray(prev) ? [...prev] : [];
          const index = updated.findIndex((a) => {
            const recordEmployeeId = a.employeeId?._id || a.employeeId;
            return recordEmployeeId?.toString() === employeeId?.toString();
          });

          if (index >= 0) {
            updated[index] = response.data.attendance;
          }

          return updated;
        });
      }

      fetchTodayAttendance();
      alert("✅ Break started!");
    } catch (error) {
      console.error("Error starting break:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to start break";
      alert("❌ " + errorMessage);
      fetchTodayAttendance();
    } finally {
      // Clear processing state
      setProcessingAction(null);
    }
  };

  const handleEndBreak = async (attendanceId, employeeId, event) => {
    // Prevent event propagation and default behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Prevent multiple simultaneous clicks
    const actionKey = `endbreak-${attendanceId}`;
    if (processingAction === actionKey) {
      return; // Already processing
    }

    if (!apiRef.current) {
      alert("System is still loading. Please wait a moment and try again.");
      return;
    }

    // Use custom confirm dialog and await the result
    const confirmed = await confirm("End break for this employee?");
    if (!confirmed) return;

    // Set processing state to prevent duplicate calls
    setProcessingAction(actionKey);
    try {
      const response = await apiRef.current.post(
        `/attendance/${attendanceId}/end-break`
      );

      // Immediately update the UI
      if (response.data?.attendance) {
        setTodayAttendance((prev) => {
          const updated = Array.isArray(prev) ? [...prev] : [];
          const index = updated.findIndex((a) => {
            const recordEmployeeId = a.employeeId?._id || a.employeeId;
            return recordEmployeeId?.toString() === employeeId?.toString();
          });

          if (index >= 0) {
            updated[index] = response.data.attendance;
          }

          return updated;
        });
      }

      fetchTodayAttendance();
      alert("✅ Break ended!");
    } catch (error) {
      console.error("Error ending break:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to end break";
      alert("❌ " + errorMessage);
      fetchTodayAttendance();
    } finally {
      // Clear processing state
      setProcessingAction(null);
    }
  };

  const handleCheckOut = async (employeeId, event) => {
    // Prevent event propagation and default behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Prevent multiple simultaneous clicks
    const actionKey = `checkout-${employeeId}`;
    if (processingAction === actionKey) {
      return; // Already processing
    }

    // Check if already checked out before showing confirmation
    const todayRecord = Array.isArray(todayAttendance)
      ? todayAttendance.find(
          (a) =>
            a.employeeId?._id === employeeId ||
            a.employeeId === employeeId ||
            (typeof a.employeeId === "object" &&
              a.employeeId?._id === employeeId)
        )
      : null;

    if (!todayRecord?.checkIn?.time) {
      alert("This employee has not checked in today.");
      fetchTodayAttendance();
      return;
    }

    if (todayRecord?.checkOut?.time) {
      alert("This employee is already checked out today.");
      fetchTodayAttendance();
      return;
    }

    // Use custom confirm dialog and await the result
    const confirmed = await confirm("Mark this employee as checked out?");
    if (!confirmed) return;

    if (!apiRef.current) {
      alert("System is still loading. Please wait a moment and try again.");
      return;
    }

    // Set processing state to prevent duplicate calls
    setProcessingAction(actionKey);
    try {
      const response = await apiRef.current.post("/attendance/checkout", {
        employeeId,
      });

      // Immediately update the UI with the response data
      if (response.data?.attendance) {
        setTodayAttendance((prev) => {
          const updated = Array.isArray(prev) ? [...prev] : [];
          const existingIndex = updated.findIndex((a) => {
            const recordEmployeeId = a.employeeId?._id || a.employeeId;
            return recordEmployeeId?.toString() === employeeId?.toString();
          });

          if (existingIndex >= 0) {
            updated[existingIndex] = response.data.attendance;
          }

          return updated;
        });
      }

      // Also fetch latest data to ensure consistency
      fetchTodayAttendance();
      if (activeTab === "history") fetchAttendance();

      alert("✅ Check-out successful!");
    } catch (error) {
      console.error("Error checking out:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to check out";

      // If error is about already checked out, refresh data and show info message
      if (errorMessage.toLowerCase().includes("already checked out")) {
        alert("ℹ️ " + errorMessage + "\n\nRefreshing attendance data...");
        fetchTodayAttendance();
      } else {
        alert("❌ " + errorMessage);
        fetchTodayAttendance();
      }
    } finally {
      // Clear processing state
      setProcessingAction(null);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatHours = (minutes) => {
    if (minutes === null || minutes === undefined) return "-";
    const totalMins = Math.round(Number(minutes));
    if (totalMins <= 0) return "0m";
    
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const calculateRealTimeHours = (record) => {
    if (!record?.checkIn?.time) return "-";

    // Use currentTime state for real-time updates (updates every second)
    const now = currentTime;
    const checkInTime = new Date(record.checkIn.time);
    const breakMinutes = record.breakDuration || 0;

    // If on break, pause timer at break start
    let workingSeconds = 0;
    if (record.isOnBreak && record.breakStart) {
      // PAUSED: Working timer is frozen at the moment break started
      const breakStartTime = new Date(record.breakStart);
      const workingTimeUntilBreak = Math.floor(
        (breakStartTime - checkInTime) / 1000
      ); // seconds
      // breakDuration doesn't include current break, so subtract it (convert to seconds)
      workingSeconds = Math.max(0, workingTimeUntilBreak - breakMinutes * 60);
    } else {
      // ACTIVE: Working timer is running
      const totalDurationSeconds = Math.floor((now - checkInTime) / 1000);
      // Subtract completed break time (convert to seconds)
      workingSeconds = Math.max(0, totalDurationSeconds - breakMinutes * 60);
    }

    // Convert to hours and minutes with seconds for real-time display
    const hours = Math.floor(workingSeconds / 3600);
    const mins = Math.floor((workingSeconds % 3600) / 60);
    const secs = workingSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${mins.toString().padStart(2, "0")}m ${secs
        .toString()
        .padStart(2, "0")}s`;
    }
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  const calculateBreakTimer = (record) => {
    if (!record?.isOnBreak || !record?.breakStart) return null;

    const now = currentTime;
    const breakStartTime = new Date(record.breakStart);
    const breakSeconds = Math.floor((now - breakStartTime) / 1000);

    const hours = Math.floor(breakSeconds / 3600);
    const mins = Math.floor((breakSeconds % 3600) / 60);
    const secs = breakSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${mins.toString().padStart(2, "0")}m ${secs
        .toString()
        .padStart(2, "0")}s`;
    }
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  const getStatusBadge = (status) => {
    const badges = {
      present: "bg-green-100 text-green-800",
      absent: "bg-red-100 text-red-800",
      late: "bg-yellow-100 text-yellow-800",
      half_day: "bg-orange-100 text-orange-800",
      on_leave: "bg-blue-100 text-blue-800",
      sick: "bg-purple-100 text-purple-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
  };

  if (loading && activeTab === "today") {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">
          Attendance Management
        </h1>
        
        {/* Cart Selector for Multi-Cart Admins */}
        {isMultiCartAdmin && carts.length > 0 && (
          <div className="w-full sm:w-64">
             <select
              value={selectedCart}
              onChange={(e) => {
                  setSelectedCart(e.target.value);
                  // Refresh data when cart changes
                  // We rely on the useEffect dependency or manual refresh
                  // To be safe, we can manually trigger refresh logic via useEffect dependency on activeTab
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Carts</option>
              {carts.map((cart) => (
                <option key={cart._id} value={cart._id}>
                  {cart.cartName || cart.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex -mb-px min-w-max sm:min-w-0">
            <button
              onClick={() => setActiveTab("today")}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === "today"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Today's Attendance
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === "history"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Attendance History
            </button>
          </nav>
        </div>

        <div className="p-3 sm:p-4 md:p-6">
          {/* Today's Attendance Tab */}
          {activeTab === "today" && (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={fetchTodayAttendance}
                  className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base"
                >
                  Refresh
                </button>
              </div>
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                        Employee
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                        Role
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                        Check-In
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                        Check-Out
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                        Working Hours
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Array.isArray(employees) &&
                      employees.map((employee) => {
                        // Find today's attendance record - check multiple possible employeeId formats
                        const todayRecord = Array.isArray(todayAttendance)
                          ? todayAttendance.find((a) => {
                              // Handle different employeeId formats
                              const recordEmployeeId =
                                a.employeeId?._id || a.employeeId;
                              const employeeIdStr =
                                employee._id?.toString() || employee._id;
                              const match = recordEmployeeId?.toString() === employeeIdStr;
                              return match;
                            })
                          : null;

                        // Check if checked in - handle multiple formats
                        const hasCheckedIn =
                          todayRecord?.checkIn?.time ||
                          (todayRecord?.checkIn &&
                            typeof todayRecord.checkIn === "string");
                        const hasCheckedOut =
                          todayRecord?.checkOut?.time ||
                          (todayRecord?.checkOut &&
                            typeof todayRecord.checkOut === "string");
                        const isOnBreak =
                          todayRecord?.isOnBreak || todayRecord?.breakStart;

                        return (
                          <tr key={employee._id}>
                            <td className="px-3 sm:px-6 py-2 sm:py-4">
                              <div className="font-medium text-xs sm:text-sm">
                                {employee.name}
                              </div>
                              <div className="text-[10px] sm:text-xs text-gray-500 sm:hidden capitalize">
                                {employee.employeeRole}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap capitalize text-xs sm:text-sm hidden sm:table-cell">
                              {employee.employeeRole}
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-4">
                              {hasCheckedIn ? (
                                <span className="text-green-600 font-medium text-xs sm:text-sm">
                                  {formatTime(
                                    todayRecord.checkIn?.time ||
                                      todayRecord.checkIn
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs sm:text-sm">
                                  Not checked in
                                </span>
                              )}
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-4 hidden md:table-cell">
                              {hasCheckedOut ? (
                                <span className="text-blue-600 font-medium text-xs sm:text-sm">
                                  {formatTime(
                                    todayRecord.checkOut?.time ||
                                      todayRecord.checkOut
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs sm:text-sm">
                                  Not checked out
                                </span>
                              )}
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-4">
                              <div className="flex flex-col gap-1">
                                {todayRecord ? (
                                  <span
                                    className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-full ${getStatusBadge(
                                      todayRecord.status
                                    )}`}
                                  >
                                    {todayRecord.status
                                      .replace("_", " ")
                                      .toUpperCase()}
                                  </span>
                                ) : (
                                  <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-full bg-gray-100 text-gray-800">
                                    ABSENT
                                  </span>
                                )}
                                {isOnBreak && (
                                  <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-full bg-orange-100 text-orange-800">
                                    ON BREAK
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-4 hidden lg:table-cell text-xs sm:text-sm">
                              <div className="space-y-1">
                                {todayRecord?.workingHours ? (
                                  formatHours(
                                    Math.round(todayRecord.workingHours * 60)
                                  )
                                ) : hasCheckedIn && !hasCheckedOut ? (
                                  <div>
                                    <div
                                      className={
                                        todayRecord?.isOnBreak
                                          ? "text-orange-600"
                                          : "text-green-600"
                                      }
                                    >
                                      {calculateRealTimeHours(todayRecord)}
                                      {todayRecord?.isOnBreak && (
                                        <span className="ml-1">(Paused)</span>
                                      )}
                                    </div>
                                    {todayRecord?.isOnBreak &&
                                      todayRecord?.breakStart && (
                                        <div className="text-orange-500 text-[10px]">
                                          Break:{" "}
                                          {calculateBreakTimer(todayRecord)}
                                        </div>
                                      )}
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm font-medium">
                              <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                                {!hasCheckedIn ? (
                                  <button
                                    type="button"
                                    onClick={(e) => handleCheckIn(employee._id, e)}
                                    className="text-green-600 hover:text-green-900 text-[10px] sm:text-xs px-2 py-1 border border-green-600 rounded hover:bg-green-50"
                                  >
                                    Check In
                                  </button>
                                ) : !hasCheckedOut ? (
                                  <>
                                    {todayRecord?.isOnBreak ? (
                                      <button
                                        type="button"
                                        onClick={(e) =>
                                          handleEndBreak(
                                            todayRecord._id,
                                            employee._id,
                                            e
                                          )
                                        }
                                        className="text-orange-600 hover:text-orange-900 text-[10px] sm:text-xs px-2 py-1 border border-orange-600 rounded hover:bg-orange-50"
                                      >
End Break
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) =>
                                          handleStartBreak(
                                            todayRecord._id,
                                            employee._id,
                                            e
                                          )
                                        }
                                        className="text-yellow-600 hover:text-yellow-900 text-[10px] sm:text-xs px-2 py-1 border border-yellow-600 rounded hover:bg-yellow-50"
                                      >
                                        Start Break
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) =>
                                        handleCheckOut(employee._id, e)
                                      }
                                      className="text-blue-600 hover:text-blue-900 text-[10px] sm:text-xs px-2 py-1 border border-blue-600 rounded hover:bg-blue-50"
                                    >
                                      Check Out
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-gray-400">
                                    Completed
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Attendance History Tab */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employee
                  </label>
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">All Employees</option>
                    {Array.isArray(employees) &&
                      employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={fetchAttendance}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Search
                </button>
              </div>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Employee
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Check-In
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Check-Out
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Working Hours
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Overtime
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {!Array.isArray(attendance) || attendance.length === 0 ? (
                        <tr>
                          <td
                            colSpan="7"
                            className="px-6 py-4 text-center text-gray-500"
                          >
                            No attendance records found
                          </td>
                        </tr>
                      ) : (
                        attendance.map((record) => (
                          <tr key={record._id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {formatDate(record.date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {record.employeeId?.name || "N/A"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {formatTime(record.checkIn?.time)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {formatTime(record.checkOut?.time)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(
                                  record.status
                                )}`}
                              >
                                {record.status.replace("_", " ").toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {record.totalWorkingMinutes
                                ? formatHours(record.totalWorkingMinutes)
                                : record.workingHours
                                ? formatHours(
                                    Math.round(record.workingHours * 60)
                                  )
                                : "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {formatHours(record.overtime || 0)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Statistics Tab */}
        </div>
      </div>
    </div>
  );
};

export default AttendanceManagement;

