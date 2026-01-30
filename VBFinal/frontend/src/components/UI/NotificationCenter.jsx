import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';

const NotificationCenter = ({ userId }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/api/notifications/');
      setNotifications(response);
      
      // Count unread
      const unread = response.filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUnreadNotifications = async () => {
    try {
      const response = await apiService.get('/api/notifications/unread/');
      return response.notifications;
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
      return [];
    }
  };

  const getEscalationNotifications = async () => {
    try {
      const response = await apiService.get('/api/notifications/escalations/');
      return response.notifications;
    } catch (error) {
      console.error('Error fetching escalation notifications:', error);
      return [];
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await apiService.post(`/api/notifications/${notificationId}/mark-as-read/`, {});
      
      // Update local state
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      ));
      
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiService.post('/api/notifications/mark-all-as-read/', {});
      
      // Update local state
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getNotificationColor = (type) => {
    switch(type) {
      case 'escalation_assigned':
        return 'border-l-4 border-red-500 bg-red-50';
      case 'escalation_update':
        return 'border-l-4 border-orange-500 bg-orange-50';
      case 'max_escalation':
        return 'border-l-4 border-red-600 bg-red-100';
      case 'new_assignment':
        return 'border-l-4 border-blue-500 bg-blue-50';
      case 'resolution_reminder':
        return 'border-l-4 border-yellow-500 bg-yellow-50';
      default:
        return 'border-l-4 border-gray-500 bg-gray-50';
    }
  };

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'escalation_assigned':
        return '⚡';
      case 'escalation_update':
        return '📤';
      case 'max_escalation':
        return '🚨';
      case 'new_assignment':
        return '📋';
      case 'resolution_reminder':
        return '⏰';
      default:
        return '📬';
    }
  };

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
        title="Notifications"
      >
        <svg 
          className="w-6 h-6" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
          />
        </svg>
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 z-50 w-80 mt-2 bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-gray-500 text-center">
                  <div className="text-3xl mb-2">📭</div>
                  <div>No notifications</div>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 cursor-pointer transition ${getNotificationColor(notification.notification_type)} ${
                      notification.is_read ? 'opacity-60' : 'opacity-100'
                    }`}
                    onClick={() => !notification.is_read && markAsRead(notification.id)}
                  >
                    <div className="flex items-start">
                      <span className="text-2xl mr-3">
                        {getNotificationIcon(notification.notification_type)}
                      </span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800 text-sm">
                          {notification.title}
                        </h4>
                        <p className="text-gray-600 text-sm mt-1">
                          {notification.message}
                        </p>
                        {notification.complaint_id && (
                          <p className="text-xs text-gray-500 mt-2">
                            Complaint ID: {notification.complaint_id.slice(0, 8)}...
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500">
                            {new Date(notification.created_at).toLocaleDateString()} 
                            {' '} 
                            {new Date(notification.created_at).toLocaleTimeString()}
                          </span>
                          {!notification.is_read && (
                            <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-4 border-t text-center">
              <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default NotificationCenter;
