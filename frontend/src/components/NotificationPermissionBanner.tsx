'use client';
import { useState, useEffect } from 'react';
import { getBrowserNotificationPermission, requestBrowserNotificationPermission, getPermissionHelpText, getPermissionStatusIcon } from '@/lib/browserNotifications';

export function NotificationPermissionBanner() {
  const [permission, setPermission] = useState<ReturnType<typeof getBrowserNotificationPermission>>('default');
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPermission(getBrowserNotificationPermission());
    
    // Check if user has previously dismissed
    const previouslyDismissed = localStorage.getItem('notification_banner_dismissed');
    if (previouslyDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleRequestPermission = async () => {
    setLoading(true);
    try {
      const newPermission = await requestBrowserNotificationPermission();
      setPermission(newPermission);
      
      if (newPermission === 'granted') {
        setDismissed(true);
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('notification_banner_dismissed', 'true');
  };

  if (dismissed || permission === 'granted' || permission === 'unsupported') {
    return null;
  }

  return (
    <div className="bg-blue-50 border-b border-blue-200 p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{getPermissionStatusIcon()}</span>
          <div>
            <p className="text-sm font-medium text-blue-900">
              Enable Notifications
            </p>
            <p className="text-xs text-blue-700">
              {getPermissionHelpText()}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {permission === 'default' && (
            <button
              onClick={handleRequestPermission}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Requesting...' : 'Enable'}
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="px-3 py-2 text-blue-700 text-sm hover:bg-blue-100 rounded-md"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}