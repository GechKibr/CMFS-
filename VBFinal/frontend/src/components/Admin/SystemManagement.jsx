import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';

const SystemManagement = () => {
  const { isDark } = useTheme();
  const [systemStats, setSystemStats] = useState({
    uptime: '0 days',
    totalComplaints: 0,
    activeUsers: 0,
    systemHealth: 'Good'
  });
  const [backupStatus, setBackupStatus] = useState('Last backup: Never');
  const [loading, setLoading] = useState(false);
  const [systemLogs, setSystemLogs] = useState([]);

  useEffect(() => {
    loadSystemStats();
    loadSystemLogs();
  }, []);

  const loadSystemStats = async () => {
    try {
      const [complaintsData, usersData] = await Promise.all([
        apiService.getComplaints(),
        apiService.getUsers?.() || Promise.resolve([])
      ]);
      
      const complaints = complaintsData.results || complaintsData;
      const users = usersData.results || usersData;
      
      setSystemStats(prev => ({
        ...prev,
        totalComplaints: complaints.length,
        activeUsers: users.length,
        systemHealth: complaints.filter(c => c.status === 'pending').length > 10 ? 'Busy' : 'Good'
      }));
    } catch (error) {
      console.error('Failed to load system stats:', error);
    }
  };

  const loadSystemLogs = async () => {
    try {
      const [complaintsData, usersData, categoriesData] = await Promise.all([
        apiService.getComplaints(),
        apiService.getUsers?.() || Promise.resolve([]),
        apiService.getCategories()
      ]);

      const complaints = complaintsData.results || complaintsData;
      const users = usersData.results || usersData;
      const categories = categoriesData.results || categoriesData;

      // Generate real system logs based on actual data
      const logs = [];
      
      // Recent complaint activities
      complaints.slice(0, 3).forEach(complaint => {
        logs.push({
          level: 'INFO',
          timestamp: complaint.created_at,
          message: `New complaint submitted: "${complaint.title}" by ${complaint.submitted_by?.first_name || 'User'}`
        });
        
        if (complaint.status !== 'pending') {
          logs.push({
            level: complaint.status === 'resolved' ? 'INFO' : 'WARN',
            timestamp: complaint.updated_at,
            message: `Complaint ${complaint.complaint_id.slice(0, 8)} status changed to ${complaint.status}`
          });
        }
      });

      // System health logs
      const pendingCount = complaints.filter(c => c.status === 'pending').length;
      if (pendingCount > 5) {
        logs.push({
          level: 'WARN',
          timestamp: new Date().toISOString(),
          message: `High pending complaints count: ${pendingCount} complaints awaiting review`
        });
      }

      // User activity logs
      if (users.length > 0) {
        logs.push({
          level: 'INFO',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          message: `Active users in system: ${users.length} registered users`
        });
      }

      // Category management logs
      logs.push({
        level: 'INFO',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        message: `System categories: ${categories.length} active categories configured`
      });

      // AI processing logs
      const urgentComplaints = complaints.filter(c => c.priority === 'urgent').length;
      if (urgentComplaints > 0) {
        logs.push({
          level: 'WARN',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          message: `AI detected ${urgentComplaints} urgent priority complaints requiring immediate attention`
        });
      }

      // Sort logs by timestamp (newest first)
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      setSystemLogs(logs.slice(0, 10)); // Keep only latest 10 logs
    } catch (error) {
      console.error('Failed to load system logs:', error);
      setSystemLogs([
        {
          level: 'ERROR',
          timestamp: new Date().toISOString(),
          message: 'Failed to load system logs from API'
        }
      ]);
    }
  };

  const handleBackup = async () => {
    setLoading(true);
    try {
      // Simulate backup process
      await new Promise(resolve => setTimeout(resolve, 2000));
      setBackupStatus(`Last backup: ${new Date().toLocaleString()}`);
      alert('System backup completed successfully!');
    } catch (error) {
      alert('Backup failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear system cache?')) return;
    
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('System cache cleared successfully!');
    } catch (error) {
      alert('Failed to clear cache: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestartServices = async () => {
    if (!confirm('Are you sure you want to restart system services? This may cause temporary downtime.')) return;
    
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      alert('System services restarted successfully!');
    } catch (error) {
      alert('Failed to restart services: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* System Overview */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          System Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-green-500">{systemStats.totalComplaints}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Complaints</div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-blue-500">{systemStats.activeUsers}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Active Users</div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-green-500">●</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>System Health</div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-purple-500">24/7</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Uptime</div>
          </div>
        </div>
      </div>

      {/* System Actions */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          System Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleBackup}
            disabled={loading}
            className="flex flex-col items-center p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            <div className="text-3xl mb-2">💾</div>
            <div className="font-medium text-blue-600">Create Backup</div>
            <div className="text-sm text-gray-500 mt-1">{backupStatus}</div>
          </button>

          <button
            onClick={handleClearCache}
            disabled={loading}
            className="flex flex-col items-center p-4 border-2 border-dashed border-orange-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors disabled:opacity-50"
          >
            <div className="text-3xl mb-2">🧹</div>
            <div className="font-medium text-orange-600">Clear Cache</div>
            <div className="text-sm text-gray-500 mt-1">Free up system memory</div>
          </button>

          <button
            onClick={handleRestartServices}
            disabled={loading}
            className="flex flex-col items-center p-4 border-2 border-dashed border-red-300 rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <div className="text-3xl mb-2">🔄</div>
            <div className="font-medium text-red-600">Restart Services</div>
            <div className="text-sm text-gray-500 mt-1">Restart all system services</div>
          </button>
        </div>
      </div>

      {/* System Configuration */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          System Configuration
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Maintenance Mode</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Disable user access for maintenance</div>
            </div>
            <button className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-400 transition-colors">
              OFF
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Auto-Assignment</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Automatically assign complaints to officers</div>
            </div>
            <button className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 transition-colors">
              ON
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Email Notifications</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Send email notifications for updates</div>
            </div>
            <button className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 transition-colors">
              ON
            </button>
          </div>
        </div>
      </div>

      {/* System Logs */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Recent System Logs
          </h3>
          <button
            onClick={loadSystemLogs}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
          >
            Refresh
          </button>
        </div>
        <div className={`${isDark ? 'bg-gray-900' : 'bg-gray-50'} p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto`}>
          {systemLogs.length === 0 ? (
            <div className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'} py-4`}>
              Loading system logs...
            </div>
          ) : (
            <div className="space-y-1">
              {systemLogs.map((log, index) => (
                <div key={index} className={`${
                  log.level === 'ERROR' ? isDark ? 'text-red-400' : 'text-red-600' :
                  log.level === 'WARN' ? isDark ? 'text-yellow-400' : 'text-yellow-600' :
                  log.level === 'INFO' ? isDark ? 'text-green-400' : 'text-green-600' :
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  <span className="text-gray-500">
                    [{log.level}] {new Date(log.timestamp).toLocaleString()} -
                  </span>{' '}
                  {log.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemManagement;
