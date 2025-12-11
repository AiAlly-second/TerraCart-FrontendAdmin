import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { getSocket } from '../utils/socket';

const AttendanceManagement = () => {
  const [attendance, setAttendance] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('today'); // 'today', 'history', 'stats'
  const [currentTime, setCurrentTime] = useState(new Date()); // For real-time timer updates
  const socketRef = useRef(null);

  // Real-time timer that updates every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchTodayAttendance();
    
    // Set up Socket.IO for real-time updates
    const socket = getSocket();
    socketRef.current = socket;

    // Listen for attendance updates
    const handleAttendanceCheckedIn = (data) => {
      console.log('[AttendanceManagement] Socket: attendance:checked_in', data);
      // Immediately update the UI with new attendance data
      if (activeTab === 'today') {
        fetchTodayAttendance();
      }
    };

    const handleAttendanceCheckedOut = (data) => {
      console.log('[AttendanceManagement] Socket: attendance:checked_out', data);
      if (activeTab === 'today') {
        fetchTodayAttendance();
      }
    };

    const handleAttendanceUpdated = (data) => {
      console.log('[AttendanceManagement] Socket: attendance:updated', data);
      if (activeTab === 'today') {
        fetchTodayAttendance();
      }
    };

    socket.on('attendance:checked_in', handleAttendanceCheckedIn);
    socket.on('attendance:checked_out', handleAttendanceCheckedOut);
    socket.on('attendance:updated', handleAttendanceUpdated);

    return () => {
      socket.off('attendance:checked_in', handleAttendanceCheckedIn);
      socket.off('attendance:checked_out', handleAttendanceCheckedOut);
      socket.off('attendance:updated', handleAttendanceUpdated);
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchAttendance();
    } else if (activeTab === 'stats') {
      fetchStats();
    }
  }, [activeTab, selectedEmployee, startDate, endDate]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
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
      console.error('Error fetching employees:', error);
      setEmployees([]);
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      setLoading(true);
      const response = await api.get('/attendance/today');
      // Ensure todayAttendance is always an array
      let attendanceData = [];
      if (Array.isArray(response.data)) {
        attendanceData = response.data;
      } else if (response.data && Array.isArray(response.data.attendance)) {
        attendanceData = response.data.attendance;
      } else if (response.data && Array.isArray(response.data.data)) {
        attendanceData = response.data.data;
      }
      
      // Debug: Log attendance data
      console.log('[ATTENDANCE] Fetched today attendance:', attendanceData);
      console.log('[ATTENDANCE] Number of records:', attendanceData.length);
      
      setTodayAttendance(attendanceData);
    } catch (error) {
      console.error('Error fetching today attendance:', error);
      alert('Failed to fetch today attendance');
      setTodayAttendance([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedEmployee) params.employeeId = selectedEmployee;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await api.get('/attendance', { params });
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
      console.error('Error fetching attendance:', error);
      alert('Failed to fetch attendance records');
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedEmployee) params.employeeId = selectedEmployee;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await api.get('/attendance/stats', { params });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      alert('Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (employeeId) => {
    // Check if already checked in before showing confirmation
    const todayRecord = Array.isArray(todayAttendance) 
      ? todayAttendance.find((a) => 
          a.employeeId?._id === employeeId || 
          a.employeeId === employeeId ||
          (typeof a.employeeId === 'object' && a.employeeId?._id === employeeId)
        ) 
      : null;
    
    if (todayRecord?.checkIn?.time) {
      alert('This employee is already checked in today.');
      // Refresh to show current state
      fetchTodayAttendance();
      return;
    }
    
    if (!window.confirm('Mark this employee as checked in?')) return;
    try {
      const response = await api.post('/attendance/checkin', { employeeId });
      
      // Immediately update the UI with the response data
      if (response.data?.attendance) {
        setTodayAttendance(prev => {
          const updated = Array.isArray(prev) ? [...prev] : [];
          const existingIndex = updated.findIndex(a => {
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
      if (activeTab === 'history') fetchAttendance();
      
      alert('✅ Check-in successful!');
    } catch (error) {
      console.error('Error checking in:', error);
      const errorMessage = error.response?.data?.message || 'Failed to check in';
      
      // If error is about already checked in, refresh data and show info message
      if (errorMessage.toLowerCase().includes('already checked in')) {
        // Refresh immediately to show the existing attendance record
        await fetchTodayAttendance();
        alert('ℹ️ ' + errorMessage + '\n\nAttendance record refreshed.');
      } else {
        alert('❌ ' + errorMessage);
      }
    }
  };

  const handleStartBreak = async (attendanceId, employeeId) => {
    if (!window.confirm('Start break for this employee?')) return;
    try {
      const response = await api.post(`/attendance/${attendanceId}/start-break`);
      
      // Immediately update the UI
      if (response.data?.attendance) {
        setTodayAttendance(prev => {
          const updated = Array.isArray(prev) ? [...prev] : [];
          const index = updated.findIndex(a => {
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
      alert('✅ Break started!');
    } catch (error) {
      console.error('Error starting break:', error);
      const errorMessage = error.response?.data?.message || 'Failed to start break';
      alert('❌ ' + errorMessage);
      fetchTodayAttendance();
    }
  };

  const handleEndBreak = async (attendanceId, employeeId) => {
    if (!window.confirm('End break for this employee?')) return;
    try {
      const response = await api.post(`/attendance/${attendanceId}/end-break`);
      
      // Immediately update the UI
      if (response.data?.attendance) {
        setTodayAttendance(prev => {
          const updated = Array.isArray(prev) ? [...prev] : [];
          const index = updated.findIndex(a => {
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
      alert('✅ Break ended!');
    } catch (error) {
      console.error('Error ending break:', error);
      const errorMessage = error.response?.data?.message || 'Failed to end break';
      alert('❌ ' + errorMessage);
      fetchTodayAttendance();
    }
  };

  const handleCheckOut = async (employeeId) => {
    // Check if already checked out before showing confirmation
    const todayRecord = Array.isArray(todayAttendance) 
      ? todayAttendance.find((a) => 
          a.employeeId?._id === employeeId || 
          a.employeeId === employeeId ||
          (typeof a.employeeId === 'object' && a.employeeId?._id === employeeId)
        ) 
      : null;
    
    if (!todayRecord?.checkIn?.time) {
      alert('This employee has not checked in today.');
      fetchTodayAttendance();
      return;
    }
    
    if (todayRecord?.checkOut?.time) {
      alert('This employee is already checked out today.');
      fetchTodayAttendance();
      return;
    }
    
    if (!window.confirm('Mark this employee as checked out?')) return;
    try {
      const response = await api.post('/attendance/checkout', { employeeId });
      
      // Immediately update the UI with the response data
      if (response.data?.attendance) {
        setTodayAttendance(prev => {
          const updated = Array.isArray(prev) ? [...prev] : [];
          const existingIndex = updated.findIndex(a => {
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
      if (activeTab === 'history') fetchAttendance();
      
      alert('✅ Check-out successful!');
    } catch (error) {
      console.error('Error checking out:', error);
      const errorMessage = error.response?.data?.message || 'Failed to check out';
      
      // If error is about already checked out, refresh data and show info message
      if (errorMessage.toLowerCase().includes('already checked out')) {
        alert('ℹ️ ' + errorMessage + '\n\nRefreshing attendance data...');
        fetchTodayAttendance();
      } else {
        alert('❌ ' + errorMessage);
      }
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatHours = (minutes) => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const calculateRealTimeHours = (record) => {
    if (!record?.checkIn?.time) return '-';
    
    // Use currentTime state for real-time updates (updates every second)
    const now = currentTime;
    const checkInTime = new Date(record.checkIn.time);
    const breakMinutes = record.breakDuration || 0;
    
    // If on break, pause timer at break start
    let workingSeconds = 0;
    if (record.isOnBreak && record.breakStart) {
      // PAUSED: Working timer is frozen at the moment break started
      const breakStartTime = new Date(record.breakStart);
      const workingTimeUntilBreak = Math.floor((breakStartTime - checkInTime) / 1000); // seconds
      // breakDuration doesn't include current break, so subtract it (convert to seconds)
      workingSeconds = Math.max(0, workingTimeUntilBreak - (breakMinutes * 60));
    } else {
      // ACTIVE: Working timer is running
      const totalDurationSeconds = Math.floor((now - checkInTime) / 1000);
      // Subtract completed break time (convert to seconds)
      workingSeconds = Math.max(0, totalDurationSeconds - (breakMinutes * 60));
    }
    
    // Convert to hours and minutes with seconds for real-time display
    const hours = Math.floor(workingSeconds / 3600);
    const mins = Math.floor((workingSeconds % 3600) / 60);
    const secs = workingSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
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
      return `${hours}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const getStatusBadge = (status) => {
    const badges = {
      present: 'bg-green-100 text-green-800',
      absent: 'bg-red-100 text-red-800',
      late: 'bg-yellow-100 text-yellow-800',
      half_day: 'bg-orange-100 text-orange-800',
      on_leave: 'bg-blue-100 text-blue-800',
      sick: 'bg-purple-100 text-purple-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading && activeTab === 'today') {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Attendance Management</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex -mb-px min-w-max sm:min-w-0">
            <button
              onClick={() => setActiveTab('today')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'today'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Today's Attendance
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Attendance History
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'stats'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Statistics
            </button>
          </nav>
        </div>

        <div className="p-3 sm:p-4 md:p-6">
          {/* Today's Attendance Tab */}
          {activeTab === 'today' && (
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
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Employee</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Role</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Check-In</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Check-Out</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Working Hours</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Array.isArray(employees) && employees.map((employee) => {
                      // Find today's attendance record - check multiple possible employeeId formats
                      const todayRecord = Array.isArray(todayAttendance) 
                        ? todayAttendance.find((a) => {
                            // Handle different employeeId formats
                            const recordEmployeeId = a.employeeId?._id || a.employeeId;
                            const employeeIdStr = employee._id?.toString() || employee._id;
                            const match = recordEmployeeId?.toString() === employeeIdStr;
                            
                            // Debug logging
                            if (match) {
                              console.log('[ATTENDANCE] Found record for employee:', {
                                employeeId: employeeIdStr,
                                record: a,
                                hasCheckIn: !!a.checkIn?.time,
                                hasCheckOut: !!a.checkOut?.time
                              });
                            }
                            
                            return match;
                          })
                        : null;
                      
                      // Check if checked in - handle multiple formats
                      const hasCheckedIn = todayRecord?.checkIn?.time || 
                                          (todayRecord?.checkIn && typeof todayRecord.checkIn === 'string');
                      const hasCheckedOut = todayRecord?.checkOut?.time || 
                                           (todayRecord?.checkOut && typeof todayRecord.checkOut === 'string');
                      const isOnBreak = todayRecord?.isOnBreak || todayRecord?.breakStart;

                      return (
                        <tr key={employee._id}>
                          <td className="px-3 sm:px-6 py-2 sm:py-4">
                            <div className="font-medium text-xs sm:text-sm">{employee.name}</div>
                            <div className="text-[10px] sm:text-xs text-gray-500 sm:hidden capitalize">{employee.employeeRole}</div>
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap capitalize text-xs sm:text-sm hidden sm:table-cell">{employee.employeeRole}</td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4">
                            {hasCheckedIn ? (
                              <span className="text-green-600 font-medium text-xs sm:text-sm">
                                {formatTime(todayRecord.checkIn?.time || todayRecord.checkIn)}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs sm:text-sm">Not checked in</span>
                            )}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 hidden md:table-cell">
                            {hasCheckedOut ? (
                              <span className="text-blue-600 font-medium text-xs sm:text-sm">
                                {formatTime(todayRecord.checkOut?.time || todayRecord.checkOut)}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs sm:text-sm">Not checked out</span>
                            )}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4">
                            <div className="flex flex-col gap-1">
                              {todayRecord ? (
                                <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-full ${getStatusBadge(todayRecord.status)}`}>
                                  {todayRecord.status.replace('_', ' ').toUpperCase()}
                                </span>
                              ) : (
                                <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-full bg-gray-100 text-gray-800">ABSENT</span>
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
                              {todayRecord?.workingHours 
                                ? formatHours(Math.round(todayRecord.workingHours * 60))
                                : hasCheckedIn && !hasCheckedOut
                                ? (
                                    <div>
                                      <div className={todayRecord?.isOnBreak ? 'text-orange-600' : 'text-green-600'}>
                                        {calculateRealTimeHours(todayRecord)}
                                        {todayRecord?.isOnBreak && <span className="ml-1">(Paused)</span>}
                                      </div>
                                      {todayRecord?.isOnBreak && todayRecord?.breakStart && (
                                        <div className="text-orange-500 text-[10px]">
                                          Break: {calculateBreakTimer(todayRecord)}
                                        </div>
                                      )}
                                    </div>
                                  )
                                : '-'}
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm font-medium">
                            <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                              {!hasCheckedIn ? (
                                <button
                                  type="button"
                                  onClick={() => handleCheckIn(employee._id)}
                                  className="text-green-600 hover:text-green-900 text-[10px] sm:text-xs px-2 py-1 border border-green-600 rounded hover:bg-green-50"
                                >
                                  Check In
                                </button>
                              ) : !hasCheckedOut ? (
                                <>
                                  {todayRecord?.isOnBreak ? (
                                    <button
                                      type="button"
                                      onClick={() => handleEndBreak(todayRecord._id, employee._id)}
                                      className="text-orange-600 hover:text-orange-900 text-[10px] sm:text-xs px-2 py-1 border border-orange-600 rounded hover:bg-orange-50"
                                    >
                                      End Break
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleStartBreak(todayRecord._id, employee._id)}
                                      className="text-yellow-600 hover:text-yellow-900 text-[10px] sm:text-xs px-2 py-1 border border-yellow-600 rounded hover:bg-yellow-50"
                                    >
                                      Start Break
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleCheckOut(employee._id)}
                                    className="text-blue-600 hover:text-blue-900 text-[10px] sm:text-xs px-2 py-1 border border-blue-600 rounded hover:bg-blue-50"
                                  >
                                    Check Out
                                  </button>
                                </>
                              ) : (
                                <span className="text-gray-400">Completed</span>
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
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">All Employees</option>
                    {Array.isArray(employees) && employees.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-In</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-Out</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Working Hours</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Overtime</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {!Array.isArray(attendance) || attendance.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                            No attendance records found
                          </td>
                        </tr>
                      ) : (
                        attendance.map((record) => (
                          <tr key={record._id}>
                            <td className="px-6 py-4 whitespace-nowrap">{formatDate(record.date)}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{record.employeeId?.name || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{formatTime(record.checkIn?.time)}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{formatTime(record.checkOut?.time)}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(record.status)}`}>
                                {record.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {record.totalWorkingMinutes 
                                ? formatHours(record.totalWorkingMinutes)
                                : record.workingHours 
                                ? formatHours(Math.round(record.workingHours * 60))
                                : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">{formatHours(record.overtime || 0)}</td>
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
          {activeTab === 'stats' && (
            <div className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">All Employees</option>
                    {Array.isArray(employees) && employees.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={fetchStats}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Get Stats
                </button>
              </div>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : stats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-600">Total Days</h3>
                    <p className="text-3xl font-bold text-blue-900 mt-2">{stats.totalDays}</p>
                  </div>
                  <div className="bg-green-50 p-6 rounded-lg">
                    <h3 className="text-sm font-medium text-green-600">Present</h3>
                    <p className="text-3xl font-bold text-green-900 mt-2">{stats.present}</p>
                  </div>
                  <div className="bg-red-50 p-6 rounded-lg">
                    <h3 className="text-sm font-medium text-red-600">Absent</h3>
                    <p className="text-3xl font-bold text-red-900 mt-2">{stats.absent}</p>
                  </div>
                  <div className="bg-yellow-50 p-6 rounded-lg">
                    <h3 className="text-sm font-medium text-yellow-600">Late</h3>
                    <p className="text-3xl font-bold text-yellow-900 mt-2">{stats.late}</p>
                  </div>
                  <div className="bg-orange-50 p-6 rounded-lg">
                    <h3 className="text-sm font-medium text-orange-600">Half Day</h3>
                    <p className="text-3xl font-bold text-orange-900 mt-2">{stats.halfDay}</p>
                  </div>
                  <div className="bg-purple-50 p-6 rounded-lg">
                    <h3 className="text-sm font-medium text-purple-600">On Leave</h3>
                    <p className="text-3xl font-bold text-purple-900 mt-2">{stats.onLeave}</p>
                  </div>
                  <div className="bg-indigo-50 p-6 rounded-lg">
                    <h3 className="text-sm font-medium text-indigo-600">Total Working Hours</h3>
                    <p className="text-3xl font-bold text-indigo-900 mt-2">{formatHours(stats.totalWorkingHours)}</p>
                  </div>
                  <div className="bg-pink-50 p-6 rounded-lg">
                    <h3 className="text-sm font-medium text-pink-600">Total Overtime</h3>
                    <p className="text-3xl font-bold text-pink-900 mt-2">{formatHours(stats.totalOvertime)}</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceManagement;

