import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useMaintenanceMode } from '../../contexts/MaintenanceContext';
import apiService from '../../services/api';
import systemLogger from '../../services/systemLogger';

const MAINTENANCE_SCHEDULE_STORAGE_KEY = 'cmfs_maintenance_schedules_v1';

const toDateTimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

const getDurationMinutes = (startIso, endIso, fallback = 30) => {
  if (!startIso || !endIso) return fallback;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return fallback;
  return Math.max(1, Math.round((end - start) / 60000));
};

const parseStoredSchedules = () => {
  try {
    const raw = localStorage.getItem(MAINTENANCE_SCHEDULE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};


const SystemManagement = () => {
  const { isDark } = useTheme();
  const {
    isMaintenanceMode,
    maintenanceEndTime,
    maintenanceMessage: currentMaintenanceMessage,
    enableMaintenanceMode,
    disableMaintenanceMode,
    updateMaintenanceConfiguration,
    scheduleMaintenanceMode
  } = useMaintenanceMode();
  const [activeSystemTab, setActiveSystemTab] = useState('overview');
  const [systemStats, setSystemStats] = useState({
    uptime: '0 days',
    totalComplaints: 0,
    activeUsers: 0,
    database: {
      size: 'N/A',
      active_connections: 0,
      total_queries: 0
    },
    django: {
      total_complaints: 0,
      pending_complaints: 0,
      total_users: 0,
      active_users: 0,
      recent_complaints: 0
    }
  });
  const [scheduledMaintenanceTime, setScheduledMaintenanceTime] = useState('');
  const [maintenanceMessage, setMaintenanceMessage] = useState('System is under maintenance. Please try again later.');
  const [maintenanceDuration, setMaintenanceDuration] = useState(30);
  const [maintenanceSchedules, setMaintenanceSchedules] = useState([]);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [jwtSessionTimeout, setJwtSessionTimeout] = useState(30);
  const [availableTimeouts, setAvailableTimeouts] = useState([15, 30, 60, 120, 240]);

  const systemTabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'maintenance', name: 'Maintenance', icon: '🔧' },
    { id: 'security', name: 'Security & Configuration', icon: '🔒' }
  ];

  const loadSystemStats = useCallback(async () => {
    try {
      const [complaintsData, usersData] = await Promise.all([
        apiService.getComplaints(),
        apiService.getAllUsers()
      ]);

      const complaints = complaintsData.results || complaintsData;
      const users = usersData.results || usersData;

      setSystemStats((prev) => ({
        ...prev,
        totalComplaints: complaints.length,
        activeUsers: users.length
      }));
    } catch (error) {
      console.error('Failed to load system stats:', error);
    }
  }, []);

  const loadJwtConfig = useCallback(async () => {
    try {
      const response = await apiService.getJwtConfig();
      if (response) {
        setJwtSessionTimeout(response.session_timeout_minutes);
        setAvailableTimeouts(response.available_options);
      }
    } catch (error) {
      console.error('Failed to load JWT config:', error);
    }
  }, []);

  useEffect(() => {
    loadSystemStats();

    loadJwtConfig();

    return () => {
    };
  }, [loadJwtConfig, loadSystemStats]);

  useEffect(() => {
    setMaintenanceMessage(currentMaintenanceMessage || 'System is under maintenance. Please try again later.');
  }, [currentMaintenanceMessage]);

  useEffect(() => {
    setMaintenanceSchedules(parseStoredSchedules());
  }, []);

  useEffect(() => {
    localStorage.setItem(MAINTENANCE_SCHEDULE_STORAGE_KEY, JSON.stringify(maintenanceSchedules));
  }, [maintenanceSchedules]);

  useEffect(() => {
    if (!maintenanceEndTime) {
      return;
    }

    const hasExisting = maintenanceSchedules.some((schedule) => schedule.source === 'backend-live');
    if (hasExisting) {
      return;
    }

    const startIso = new Date().toISOString();
    const durationMinutes = getDurationMinutes(startIso, maintenanceEndTime, maintenanceDuration);

    setMaintenanceSchedules((prev) => [
      {
        id: `backend-live-${Date.now()}`,
        source: 'backend-live',
        title: 'Active Maintenance Window',
        scheduled_start: startIso,
        scheduled_end: maintenanceEndTime,
        message: currentMaintenanceMessage || maintenanceMessage,
        duration_minutes: durationMinutes,
        status: 'active',
      },
      ...prev,
    ]);
  }, [currentMaintenanceMessage, maintenanceDuration, maintenanceEndTime, maintenanceMessage, maintenanceSchedules]);

  // Real-time system stats from backend
  const updateJwtTimeout = async (timeoutMinutes) => {
    try {
      const response = await apiService.updateJwtTimeout(timeoutMinutes);
      if (response.success) {
        setJwtSessionTimeout(timeoutMinutes);
        alert(response.message);
      }
    } catch (error) {
      console.error('Failed to update JWT timeout:', error);
      alert('Failed to update session timeout');
    }
  };


  const handleMaintenanceToggle = async () => {
    if (isMaintenanceMode) {
      if (confirm('Are you sure you want to disable maintenance mode? Users will be able to access the system.')) {
        try {
          await disableMaintenanceMode();
          systemLogger.info('Maintenance mode disabled by admin', 'MAINTENANCE');
          alert('Maintenance mode disabled. System is now accessible to all users.');
        } catch (error) {
          alert(`Failed to disable maintenance mode: ${error.message}`);
        }
      }
    } else {
      if (confirm(`Are you sure you want to enable maintenance mode for ${maintenanceDuration} minutes? This will prevent non-admin users from accessing the system.`)) {
        try {
          await enableMaintenanceMode(maintenanceMessage, maintenanceDuration);
          systemLogger.warn(`Maintenance mode enabled by admin for ${maintenanceDuration} minutes`, 'MAINTENANCE');
          alert(`Maintenance mode enabled for ${maintenanceDuration} minutes. Only administrators can access the system.`);
        } catch (error) {
          alert(`Failed to enable maintenance mode: ${error.message}`);
        }
      }
    }
  };

  const handleScheduleMaintenance = async () => {
    if (!scheduledMaintenanceTime) {
      alert('Please select a date and time for scheduled maintenance.');
      return;
    }

    const scheduledTime = new Date(scheduledMaintenanceTime);
    const now = new Date();

    if (scheduledTime <= now) {
      alert('Please select a future date and time.');
      return;
    }

    const nextSchedule = {
      id: editingScheduleId || `schedule-${Date.now()}`,
      source: 'local',
      title: `Scheduled Maintenance (${maintenanceDuration} min)`,
      scheduled_start: scheduledTime.toISOString(),
      scheduled_end: new Date(scheduledTime.getTime() + maintenanceDuration * 60 * 1000).toISOString(),
      message: maintenanceMessage,
      duration_minutes: maintenanceDuration,
      status: 'scheduled',
    };

    setMaintenanceSchedules((prev) => {
      if (!editingScheduleId) {
        return [nextSchedule, ...prev].sort(
          (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
        );
      }
      return prev
        .map((item) => (item.id === editingScheduleId ? nextSchedule : item))
        .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());
    });

    setScheduledMaintenanceTime('');
    setEditingScheduleId(null);
    alert(editingScheduleId ? 'Maintenance schedule updated.' : 'Maintenance schedule saved.');
  };

  const handleEditSchedule = (schedule) => {
    setEditingScheduleId(schedule.id);
    setScheduledMaintenanceTime(toDateTimeLocalValue(schedule.scheduled_start));
    setMaintenanceDuration(schedule.duration_minutes || getDurationMinutes(schedule.scheduled_start, schedule.scheduled_end, 30));
    setMaintenanceMessage(schedule.message || 'System is under maintenance. Please try again later.');
    setActiveSystemTab('maintenance');
  };

  const handleDeleteSchedule = (scheduleId) => {
    if (!confirm('Delete this maintenance schedule?')) {
      return;
    }
    setMaintenanceSchedules((prev) => prev.filter((item) => item.id !== scheduleId));
    if (editingScheduleId === scheduleId) {
      setEditingScheduleId(null);
      setScheduledMaintenanceTime('');
    }
  };

  const handleApplySchedule = async (schedule) => {
    try {
      await scheduleMaintenanceMode(
        schedule.scheduled_start,
        schedule.message,
        schedule.duration_minutes || getDurationMinutes(schedule.scheduled_start, schedule.scheduled_end, 30)
      );

      setMaintenanceSchedules((prev) =>
        prev.map((item) => ({
          ...item,
          status: item.id === schedule.id ? 'applied' : item.status,
        }))
      );

      alert(`Scheduled maintenance synced to backend for ${new Date(schedule.scheduled_start).toLocaleString()}.`);
    } catch (error) {
      alert(`Failed to apply schedule: ${error.message}`);
    }
  };

  const handleRunScheduleNow = async (schedule) => {
    try {
      const duration = schedule.duration_minutes || getDurationMinutes(schedule.scheduled_start, schedule.scheduled_end, 30);
      await enableMaintenanceMode(schedule.message, duration);
      setMaintenanceSchedules((prev) =>
        prev.map((item) => ({
          ...item,
          status: item.id === schedule.id ? 'active' : item.status,
        }))
      );
      alert('Maintenance started immediately using selected schedule.');
    } catch (error) {
      alert(`Failed to start maintenance now: ${error.message}`);
    }
  };

  const handleCancelBackendSchedule = async () => {
    if (!confirm('Cancel the currently configured backend maintenance schedule?')) {
      return;
    }

    try {
      await updateMaintenanceConfiguration({
        is_enabled: false,
        scheduled_start: null,
        scheduled_end: null,
      });
      alert('Backend maintenance schedule cancelled.');
    } catch (error) {
      alert(`Failed to cancel backend schedule: ${error.message}`);
    }
  };

  const renderSystemOverview = () => (
    <div className="space-y-6">
      {/* System Overview */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          System Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-green-500">{systemStats.django.total_complaints || systemStats.totalComplaints}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Complaints</div>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
              {systemStats.django.pending_complaints || 0} pending
            </div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-blue-500">{systemStats.django.active_users || systemStats.activeUsers}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Active Users</div>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
              {systemStats.django.total_users || 0} total
            </div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-purple-500">{systemStats.uptime}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>System Uptime</div>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
              {systemStats.django.recent_complaints || 0} recent complaints
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMaintenance = () => (
    <div className="space-y-6">
      {/* Maintenance Mode Status */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Maintenance Mode Status
        </h3>
        <div className={`p-4 rounded-lg border-2 ${isMaintenanceMode
          ? isDark ? 'border-red-500 bg-red-900/20' : 'border-red-300 bg-red-50'
          : isDark ? 'border-green-500 bg-green-900/20' : 'border-green-300 bg-green-50'
          }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`text-3xl ${isMaintenanceMode ? 'animate-pulse' : ''}`}>
                {isMaintenanceMode ? '🚫' : '✅'}
              </div>
              <div>
                <div className={`font-medium ${isMaintenanceMode ? 'text-red-600' : 'text-green-600'
                  }`}>
                  Maintenance Mode: {isMaintenanceMode ? 'ENABLED' : 'DISABLED'}
                </div>
                <div className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {isMaintenanceMode
                    ? 'Only administrators can access the system'
                    : 'System is accessible to all users'
                  }
                </div>
                {isMaintenanceMode && maintenanceEndTime && (
                  <div className={`text-xs mt-1 ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                    Auto-disable: {new Date(maintenanceEndTime).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleMaintenanceToggle}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${isMaintenanceMode
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-red-500 text-white hover:bg-red-600'
                }`}
            >
              {isMaintenanceMode ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>
      </div>

      {/* Maintenance Duration */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Maintenance Duration
        </h3>
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              Duration (minutes)
            </label>
            <select
              value={maintenanceDuration}
              onChange={(e) => setMaintenanceDuration(parseInt(e.target.value))}
              disabled={isMaintenanceMode}
              className={`w-full p-3 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} disabled:opacity-50`}
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={240}>4 hours</option>
              <option value={480}>8 hours</option>
            </select>
            <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Maintenance mode will automatically disable after this duration
            </p>
          </div>
        </div>
      </div>

      {/* Maintenance Message */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Maintenance Message
        </h3>
        <div className="space-y-4">
          <textarea
            value={maintenanceMessage}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
            className={`w-full p-3 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            rows="3"
            placeholder="Enter message to display to users during maintenance..."
          />
          <button
            onClick={async () => {
              if (isMaintenanceMode) {
                try {
                  await updateMaintenanceConfiguration({ message: maintenanceMessage });
                  alert('Maintenance message updated!');
                } catch (error) {
                  alert(`Failed to update maintenance message: ${error.message}`);
                }
              }
            }}
            disabled={!isMaintenanceMode}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Update Message
          </button>
        </div>
      </div>

      {/* Schedule Maintenance */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Schedule Maintenance
        </h3>
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              Scheduled Date & Time
            </label>
            <input
              type="datetime-local"
              value={scheduledMaintenanceTime}
              onChange={(e) => setScheduledMaintenanceTime(e.target.value)}
              className={`w-full p-3 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleScheduleMaintenance}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              {editingScheduleId ? 'Update Schedule' : 'Add Schedule'}
            </button>
            {editingScheduleId && (
              <button
                onClick={() => {
                  setEditingScheduleId(null);
                  setScheduledMaintenanceTime('');
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel Edit
              </button>
            )}
            <button
              onClick={handleCancelBackendSchedule}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Cancel Backend Schedule
            </button>
          </div>
        </div>
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Maintenance Schedule Manager
        </h3>

        {maintenanceSchedules.length === 0 ? (
          <div className={`p-4 rounded-lg text-sm ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
            No schedules yet. Add your first maintenance schedule above.
          </div>
        ) : (
          <div className="space-y-3">
            {maintenanceSchedules
              .slice()
              .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
              .map((schedule) => (
                <div
                  key={schedule.id}
                  className={`p-4 rounded-lg border ${isDark ? 'border-gray-700 bg-gray-700/40' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {schedule.title || 'Maintenance Window'}
                      </div>
                      <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {new Date(schedule.scheduled_start).toLocaleString()} - {new Date(schedule.scheduled_end).toLocaleString()}
                      </div>
                      <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Duration: {schedule.duration_minutes || getDurationMinutes(schedule.scheduled_start, schedule.scheduled_end, 30)} min | Source: {schedule.source === 'backend-live' ? 'Backend' : 'Local'}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${schedule.status === 'active'
                      ? 'bg-red-100 text-red-700'
                      : schedule.status === 'applied'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                      }`}>
                      {(schedule.status || 'scheduled').toUpperCase()}
                    </span>
                  </div>

                  <div className={`text-sm mt-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {schedule.message}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleApplySchedule(schedule)}
                      className="px-3 py-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 text-sm"
                    >
                      Apply to Backend
                    </button>
                    <button
                      onClick={() => handleRunScheduleNow(schedule)}
                      className="px-3 py-1.5 rounded bg-orange-500 text-white hover:bg-orange-600 text-sm"
                    >
                      Run Now
                    </button>
                    <button
                      onClick={() => handleEditSchedule(schedule)}
                      className="px-3 py-1.5 rounded bg-emerald-500 text-white hover:bg-emerald-600 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      className="px-3 py-1.5 rounded bg-rose-500 text-white hover:bg-rose-600 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          System Actions
        </h3>
        <div className={`p-4 rounded-lg text-sm ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
          Service-level actions are now managed from the backend. This panel focuses on maintenance, logs, sessions, and configuration.
        </div>
      </div>
    </div >
  );



  const renderSecurity = () => (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Security & Configuration
        </h3>
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              JWT Session Timeout
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={jwtSessionTimeout}
                onChange={(e) => setJwtSessionTimeout(parseInt(e.target.value, 10))}
                className={`w-full sm:w-72 p-3 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                {availableTimeouts.map((timeout) => (
                  <option key={timeout} value={timeout}>
                    {timeout} minutes
                  </option>
                ))}
              </select>
              <button
                onClick={() => updateJwtTimeout(jwtSessionTimeout)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Update Timeout
              </button>
            </div>
          </div>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Changes apply to new sessions and help enforce consistent admin session security.
          </p>
        </div>
      </div>

    </div>
  );

  const renderTabContent = () => {
    switch (activeSystemTab) {
      case 'overview':
        return renderSystemOverview();
      case 'maintenance':
        return renderMaintenance();
      case 'security':
        return renderSecurity();
      default:
        return renderMaintenance();
    }
  };

  return (
    <div className="space-y-6">
      {/* System Tabs */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow`}>
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto px-6">
            {systemTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSystemTab(tab.id)}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${activeSystemTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : `border-transparent ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'} hover:border-gray-300`
                  }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
};

export default SystemManagement;
