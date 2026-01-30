import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const MaintenanceNotification = () => {
  const { isDark } = useTheme();
  const [notification, setNotification] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkMaintenanceSchedule();
    const interval = setInterval(checkMaintenanceSchedule, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const checkMaintenanceSchedule = () => {
    try {
      const maintenanceData = localStorage.getItem('scheduled_maintenance');
      if (maintenanceData) {
        const maintenance = JSON.parse(maintenanceData);
        const scheduledTime = new Date(maintenance.scheduled_time);
        const now = new Date();
        const timeDiff = scheduledTime - now;
        
        // Show notification if maintenance is within 24 hours
        if (timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000) {
          setNotification({
            scheduledTime,
            message: maintenance.message || 'Scheduled maintenance',
            timeUntil: formatTimeUntil(timeDiff)
          });
        } else {
          setNotification(null);
        }
      }
    } catch (error) {
      console.error('Error checking maintenance schedule:', error);
    }
  };

  const formatTimeUntil = (milliseconds) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (!notification || dismissed) return null;

  return (
    <div className={`${isDark ? 'bg-yellow-900 border-yellow-700' : 'bg-yellow-50 border-yellow-200'} border-l-4 p-4 mb-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="text-yellow-600 text-xl">⚠️</span>
          </div>
          <div className="ml-3">
            <p className={`text-sm font-medium ${isDark ? 'text-yellow-200' : 'text-yellow-800'}`}>
              Scheduled Maintenance Notice
            </p>
            <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
              System maintenance scheduled for {notification.scheduledTime.toLocaleString()}
              {' '}(in {notification.timeUntil})
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
              {notification.message}
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className={`${isDark ? 'text-yellow-300 hover:text-yellow-100' : 'text-yellow-500 hover:text-yellow-700'} text-lg`}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default MaintenanceNotification;
