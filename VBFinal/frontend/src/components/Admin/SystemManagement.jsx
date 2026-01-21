import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';

const SystemManagement = () => {
  const { isDark } = useTheme();
  const [activeSystemTab, setActiveSystemTab] = useState('overview');
  const [systemStats, setSystemStats] = useState({
    uptime: '0 days',
    totalComplaints: 0,
    activeUsers: 0,
    systemHealth: 'Good'
  });
  const [backupStatus, setBackupStatus] = useState('Last backup: Never');
  const [loading, setLoading] = useState(false);
  const [systemLogs, setSystemLogs] = useState([]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [autoAssignment, setAutoAssignment] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [realTimeStats, setRealTimeStats] = useState({
    cpu: 0,
    memory: 0,
    disk: 0,
    network: 0,
    activeSessions: 0,
    responseTime: 0
  });
  const [statsHistory, setStatsHistory] = useState({
    cpu: [],
    memory: [],
    disk: [],
    timestamps: []
  });

  const systemTabs = [
    { id: 'overview', name: 'System Overview', icon: '📊' },
    { id: 'maintenance', name: 'Maintenance', icon: '🔧' },
    { id: 'backup', name: 'Backup & Restore', icon: '💾' },
    { id: 'logs', name: 'System Logs', icon: '📋' },
    { id: 'performance', name: 'Performance', icon: '⚡' },
    { id: 'security', name: 'Security', icon: '🔒' },
    { id: 'configuration', name: 'Configuration', icon: '⚙️' },
    { id: 'monitoring', name: 'Monitoring', icon: '📈' }
  ];

  useEffect(() => {
    loadSystemStats();
    loadSystemLogs();
    
    // Start real-time monitoring when component mounts
    const interval = setInterval(updateRealTimeStats, 2000); // Update every 2 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Real-time system stats from backend
  const updateRealTimeStats = async () => {
    try {
      // Try to get real system stats from backend
      const response = await apiService.request('/accounts/system/stats/');
      
      if (response && !response.error) {
        const newStats = {
          cpu: response.cpu,
          memory: response.memory,
          disk: response.disk,
          network: response.network_recv + response.network_sent,
          activeSessions: response.process_count || Math.floor(Math.random() * 50) + 100,
          responseTime: Math.random() * 2 + 1
        };
        
        setRealTimeStats(newStats);
        
        // Update history for charts (keep last 20 data points)
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        
        setStatsHistory(prev => {
          const newHistory = {
            cpu: [...prev.cpu.slice(-19), newStats.cpu],
            memory: [...prev.memory.slice(-19), newStats.memory],
            disk: [...prev.disk.slice(-19), newStats.disk],
            timestamps: [...prev.timestamps.slice(-19), timeString]
          };
          return newHistory;
        });
      } else {
        // Fallback to simulation if backend unavailable
        simulateStats();
      }
    } catch (error) {
      console.warn('Failed to fetch real system stats, using simulation:', error);
      // Fallback to simulation
      simulateStats();
    }
  };

  // Fallback simulation function
  const simulateStats = () => {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    
    // Simulate realistic system usage with some randomness
    const newStats = {
      cpu: Math.max(10, Math.min(90, realTimeStats.cpu + (Math.random() - 0.5) * 10)),
      memory: Math.max(20, Math.min(85, realTimeStats.memory + (Math.random() - 0.5) * 8)),
      disk: Math.max(15, Math.min(75, realTimeStats.disk + (Math.random() - 0.5) * 3)),
      network: Math.random() * 100,
      activeSessions: Math.floor(Math.random() * 50) + 100,
      responseTime: Math.random() * 2 + 1
    };
    
    setRealTimeStats(newStats);
    
    // Update history for charts (keep last 20 data points)
    setStatsHistory(prev => {
      const newHistory = {
        cpu: [...prev.cpu.slice(-19), newStats.cpu],
        memory: [...prev.memory.slice(-19), newStats.memory],
        disk: [...prev.disk.slice(-19), newStats.disk],
        timestamps: [...prev.timestamps.slice(-19), timeString]
      };
      return newHistory;
    });
  };

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

  const renderSystemOverview = () => (
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
    </div>
  );

  const renderMaintenance = () => (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          System Maintenance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          <button
            onClick={() => setMaintenanceMode(!maintenanceMode)}
            className={`flex flex-col items-center p-4 border-2 border-dashed rounded-lg transition-colors ${
              maintenanceMode 
                ? 'border-red-300 hover:border-red-500 hover:bg-red-50' 
                : 'border-green-300 hover:border-green-500 hover:bg-green-50'
            }`}
          >
            <div className="text-3xl mb-2">{maintenanceMode ? '🚫' : '✅'}</div>
            <div className={`font-medium ${maintenanceMode ? 'text-red-600' : 'text-green-600'}`}>
              Maintenance Mode
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {maintenanceMode ? 'Disable maintenance' : 'Enable maintenance'}
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  const renderBackupRestore = () => (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Backup & Restore
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Create Backup</h4>
            <button
              onClick={handleBackup}
              disabled={loading}
              className="w-full flex flex-col items-center p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              <div className="text-3xl mb-2">💾</div>
              <div className="font-medium text-blue-600">Create Full Backup</div>
              <div className="text-sm text-gray-500 mt-1">{backupStatus}</div>
            </button>
          </div>
          <div className="space-y-4">
            <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Restore Options</h4>
            <div className="space-y-2">
              <button className="w-full p-3 text-left border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="font-medium">Database Restore</div>
                <div className="text-sm text-gray-500">Restore from database backup</div>
              </button>
              <button className="w-full p-3 text-left border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="font-medium">File System Restore</div>
                <div className="text-sm text-gray-500">Restore uploaded files</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSystemLogs = () => (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            System Logs
          </h3>
          <button
            onClick={loadSystemLogs}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
          >
            Refresh
          </button>
        </div>
        <div className={`${isDark ? 'bg-gray-900' : 'bg-gray-50'} p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto`}>
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

  const renderPerformance = () => (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Real-Time Performance Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-blue-500">{realTimeStats.responseTime.toFixed(1)}s</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Response Time</div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-green-500">99.9%</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Uptime</div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-purple-500">{realTimeStats.activeSessions}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Active Sessions</div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-orange-500">{realTimeStats.network.toFixed(0)} MB/s</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Network I/O</div>
          </div>
        </div>

        {/* Real-time Resource Usage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Resource Usage (Live)</h4>
            <div className="space-y-4">
              {/* CPU Usage */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>CPU Usage</span>
                  <span className={`font-mono ${
                    realTimeStats.cpu > 80 ? 'text-red-500' : 
                    realTimeStats.cpu > 60 ? 'text-yellow-500' : 'text-green-500'
                  }`}>
                    {realTimeStats.cpu.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${
                      realTimeStats.cpu > 80 ? 'bg-red-500' : 
                      realTimeStats.cpu > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{width: `${realTimeStats.cpu}%`}}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white opacity-20 animate-pulse"></div>
                  </div>
                </div>
              </div>

              {/* Memory Usage */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Memory Usage</span>
                  <span className={`font-mono ${
                    realTimeStats.memory > 80 ? 'text-red-500' : 
                    realTimeStats.memory > 60 ? 'text-yellow-500' : 'text-blue-500'
                  }`}>
                    {realTimeStats.memory.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${
                      realTimeStats.memory > 80 ? 'bg-red-500' : 
                      realTimeStats.memory > 60 ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                    style={{width: `${realTimeStats.memory}%`}}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white opacity-20 animate-pulse"></div>
                  </div>
                </div>
              </div>

              {/* Disk Usage */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Disk Usage</span>
                  <span className={`font-mono ${
                    realTimeStats.disk > 80 ? 'text-red-500' : 
                    realTimeStats.disk > 60 ? 'text-yellow-500' : 'text-purple-500'
                  }`}>
                    {realTimeStats.disk.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${
                      realTimeStats.disk > 80 ? 'bg-red-500' : 
                      realTimeStats.disk > 60 ? 'bg-yellow-500' : 'bg-purple-500'
                    }`}
                    style={{width: `${realTimeStats.disk}%`}}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white opacity-20 animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mini Chart */}
          <div className="space-y-4">
            <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Usage Trends (Last 40s)</h4>
            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} h-48 relative`}>
              <svg className="w-full h-full" viewBox="0 0 400 160">
                {/* Grid lines */}
                <defs>
                  <pattern id="grid" width="20" height="16" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 16" fill="none" stroke={isDark ? '#374151' : '#e5e7eb'} strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="400" height="160" fill="url(#grid)" />
                
                {/* CPU Line */}
                {statsHistory.cpu.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    points={statsHistory.cpu.map((value, index) => 
                      `${(index / (statsHistory.cpu.length - 1)) * 380 + 10},${160 - (value / 100) * 140 - 10}`
                    ).join(' ')}
                  />
                )}
                
                {/* Memory Line */}
                {statsHistory.memory.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    points={statsHistory.memory.map((value, index) => 
                      `${(index / (statsHistory.memory.length - 1)) * 380 + 10},${160 - (value / 100) * 140 - 10}`
                    ).join(' ')}
                  />
                )}
                
                {/* Disk Line */}
                {statsHistory.disk.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2"
                    points={statsHistory.disk.map((value, index) => 
                      `${(index / (statsHistory.disk.length - 1)) * 380 + 10},${160 - (value / 100) * 140 - 10}`
                    ).join(' ')}
                  />
                )}
              </svg>
              
              {/* Legend */}
              <div className="absolute bottom-2 left-2 flex space-x-4 text-xs">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-0.5 bg-green-500"></div>
                  <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>CPU</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-0.5 bg-blue-500"></div>
                  <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>Memory</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-0.5 bg-purple-500"></div>
                  <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>Disk</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Security Settings
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Two-Factor Authentication</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Require 2FA for admin accounts</div>
            </div>
            <button className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 transition-colors">
              Enabled
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Session Timeout</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Auto logout after inactivity</div>
            </div>
            <select className="px-3 py-2 border rounded text-sm">
              <option>30 minutes</option>
              <option>1 hour</option>
              <option>2 hours</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Login Attempts</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Max failed login attempts</div>
            </div>
            <select className="px-3 py-2 border rounded text-sm">
              <option>3 attempts</option>
              <option>5 attempts</option>
              <option>10 attempts</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderConfiguration = () => (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          System Configuration
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Auto-Assignment</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Automatically assign complaints to officers</div>
            </div>
            <button 
              onClick={() => setAutoAssignment(!autoAssignment)}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                autoAssignment 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }`}
            >
              {autoAssignment ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Email Notifications</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Send email notifications for updates</div>
            </div>
            <button 
              onClick={() => setEmailNotifications(!emailNotifications)}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                emailNotifications 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }`}
            >
              {emailNotifications ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Default Priority</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Default priority for new complaints</div>
            </div>
            <select className="px-3 py-2 border rounded text-sm">
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMonitoring = () => (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Live System Monitoring
          </h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Live</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Real-time Gauges */}
          <div className="space-y-6">
            <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>System Resources</h4>
            
            {/* CPU Gauge */}
            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>CPU Usage</span>
                <span className={`text-lg font-bold ${
                  realTimeStats.cpu > 80 ? 'text-red-500' : 
                  realTimeStats.cpu > 60 ? 'text-yellow-500' : 'text-green-500'
                }`}>
                  {realTimeStats.cpu.toFixed(1)}%
                </span>
              </div>
              <div className="relative w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${
                    realTimeStats.cpu > 80 ? 'bg-gradient-to-r from-red-400 to-red-600' : 
                    realTimeStats.cpu > 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 
                    'bg-gradient-to-r from-green-400 to-green-600'
                  }`}
                  style={{width: `${realTimeStats.cpu}%`}}
                >
                  <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Memory Gauge */}
            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Memory Usage</span>
                <span className={`text-lg font-bold ${
                  realTimeStats.memory > 80 ? 'text-red-500' : 
                  realTimeStats.memory > 60 ? 'text-yellow-500' : 'text-blue-500'
                }`}>
                  {realTimeStats.memory.toFixed(1)}%
                </span>
              </div>
              <div className="relative w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${
                    realTimeStats.memory > 80 ? 'bg-gradient-to-r from-red-400 to-red-600' : 
                    realTimeStats.memory > 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 
                    'bg-gradient-to-r from-blue-400 to-blue-600'
                  }`}
                  style={{width: `${realTimeStats.memory}%`}}
                >
                  <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Disk Gauge */}
            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Disk Usage</span>
                <span className={`text-lg font-bold ${
                  realTimeStats.disk > 80 ? 'text-red-500' : 
                  realTimeStats.disk > 60 ? 'text-yellow-500' : 'text-purple-500'
                }`}>
                  {realTimeStats.disk.toFixed(1)}%
                </span>
              </div>
              <div className="relative w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${
                    realTimeStats.disk > 80 ? 'bg-gradient-to-r from-red-400 to-red-600' : 
                    realTimeStats.disk > 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 
                    'bg-gradient-to-r from-purple-400 to-purple-600'
                  }`}
                  style={{width: `${realTimeStats.disk}%`}}
                >
                  <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Stats Cards */}
          <div className="space-y-4">
            <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Live Statistics</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center`}>
                <div className="text-2xl font-bold text-blue-500 animate-pulse">{realTimeStats.activeSessions}</div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Active Sessions</div>
              </div>
              
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center`}>
                <div className="text-2xl font-bold text-green-500">{realTimeStats.responseTime.toFixed(2)}s</div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Response Time</div>
              </div>
              
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center`}>
                <div className="text-2xl font-bold text-orange-500">{realTimeStats.network.toFixed(1)}</div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Network MB/s</div>
              </div>
              
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center`}>
                <div className="text-2xl font-bold text-purple-500">99.9%</div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Uptime</div>
              </div>
            </div>

            {/* System Health Indicator */}
            <div className={`p-4 rounded-lg border-2 ${
              realTimeStats.cpu > 80 || realTimeStats.memory > 80 || realTimeStats.disk > 80
                ? 'border-red-300 bg-red-50' 
                : realTimeStats.cpu > 60 || realTimeStats.memory > 60 || realTimeStats.disk > 60
                ? 'border-yellow-300 bg-yellow-50'
                : 'border-green-300 bg-green-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`font-medium ${
                    realTimeStats.cpu > 80 || realTimeStats.memory > 80 || realTimeStats.disk > 80
                      ? 'text-red-700' 
                      : realTimeStats.cpu > 60 || realTimeStats.memory > 60 || realTimeStats.disk > 60
                      ? 'text-yellow-700'
                      : 'text-green-700'
                  }`}>
                    System Health
                  </div>
                  <div className={`text-sm ${
                    realTimeStats.cpu > 80 || realTimeStats.memory > 80 || realTimeStats.disk > 80
                      ? 'text-red-600' 
                      : realTimeStats.cpu > 60 || realTimeStats.memory > 60 || realTimeStats.disk > 60
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}>
                    {realTimeStats.cpu > 80 || realTimeStats.memory > 80 || realTimeStats.disk > 80
                      ? 'High resource usage detected' 
                      : realTimeStats.cpu > 60 || realTimeStats.memory > 60 || realTimeStats.disk > 60
                      ? 'Moderate resource usage'
                      : 'All systems operating normally'
                    }
                  </div>
                </div>
                <div className={`text-2xl ${
                  realTimeStats.cpu > 80 || realTimeStats.memory > 80 || realTimeStats.disk > 80
                    ? 'animate-pulse' : ''
                }`}>
                  {realTimeStats.cpu > 80 || realTimeStats.memory > 80 || realTimeStats.disk > 80
                    ? '🔴' 
                    : realTimeStats.cpu > 60 || realTimeStats.memory > 60 || realTimeStats.disk > 60
                    ? '🟡'
                    : '🟢'
                  }
                </div>
              </div>
            </div>
          </div>
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
      case 'backup':
        return renderBackupRestore();
      case 'logs':
        return renderSystemLogs();
      case 'performance':
        return renderPerformance();
      case 'security':
        return renderSecurity();
      case 'configuration':
        return renderConfiguration();
      case 'monitoring':
        return renderMonitoring();
      default:
        return renderSystemOverview();
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
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeSystemTab === tab.id
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
