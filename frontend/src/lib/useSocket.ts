'use client';
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken, getUser } from './auth';
import toast from 'react-hot-toast';
import {
  showBrowserNotification,
  canShowBrowserNotifications,
  requestBrowserNotificationPermission,
  getBrowserNotificationPermission,
} from '@/lib/browserNotifications';

let socket: Socket | null = null;

// Storage key for cross-tab unread count synchronization
const UNREAD_COUNT_STORAGE_KEY = 'notification_unread_count';
const NOTIFICATION_IDS_KEY = 'notification_ids';

function getNotificationUrl(notification: any) {
  switch (notification?.type) {
    case 'patient_discharge':
      return '/dashboard/nurse?tab=history';

    case 'critical_vitals':
      return '/dashboard/nurse?tab=vitals';

    case 'consultation':
      return '/dashboard/nurse?tab=history';

    case 'doctor_assignment':
      return '/dashboard/nurse?tab=history';

    case 'lab_result':
      return '/dashboard/nurse?tab=reports';

    case 'bed_update':
      return '/dashboard/nurse/beds';

    case 'prescription':
      return '/dashboard/pharmacist/prescriptions';

    case 'appointment':
      return '/dashboard/receptionist/appointments';

    case 'registration':
      return '/dashboard/management?tab=patients';

    default:
      return '/dashboard/nurse';
  }
}

// Load notification IDs from localStorage for idempotency
function getProcessedNotificationIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(NOTIFICATION_IDS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

// Save notification IDs to localStorage
function saveProcessedNotificationIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NOTIFICATION_IDS_KEY, JSON.stringify(Array.from(ids)));
  } catch (error) {
    console.error('Failed to save notification IDs:', error);
  }
}

// Load unread count from localStorage
function loadUnreadCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const stored = localStorage.getItem(UNREAD_COUNT_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

// Save unread count to localStorage
function saveUnreadCount(count: number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(UNREAD_COUNT_STORAGE_KEY, count.toString());
  } catch (error) {
    console.error('Failed to save unread count:', error);
  }
}

export function useSocket() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [notificationPermission, setNotificationPermission] = useState<ReturnType<typeof getBrowserNotificationPermission>>('default');
  const initialized = useRef(false);
  const processedIds = useRef<Set<string>>(getProcessedNotificationIds());
  const hasFetchedNotifications = useRef(false);

  // Sync unread count across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === UNREAD_COUNT_STORAGE_KEY && e.newValue !== null) {
        const newCount = parseInt(e.newValue, 10);
        setUnreadCount(newCount);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Initial load from localStorage
    const initialCount = loadUnreadCount();
    if (initialCount > 0) {
      setUnreadCount(initialCount);
    }

    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Check notification permission on mount
  useEffect(() => {
    setNotificationPermission(getBrowserNotificationPermission());
  }, []);

  // Fetch existing notifications from API on mount
  useEffect(() => {
    const fetchExistingNotifications = async () => {
      try {
        const token = getToken();
        if (!token) return;

        const response = await fetch('http://localhost:3001/api/notifications', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('📥 Fetched existing notifications from API:', data.length);
          
          if (Array.isArray(data) && data.length > 0) {
            setNotifications(data);
            
            // Calculate unread count from existing notifications
            const unread = data.filter((n: any) => !n.isRead).length;
            if (unread > 0) {
              setUnreadCount(unread);
              saveUnreadCount(unread);
            }
          }
        }
      } catch (error) {
        console.error('❌ Failed to fetch existing notifications:', error);
      }
    };

    // Fetch notifications once after connection is established
    if (connectionStatus === 'connected' && !hasFetchedNotifications.current) {
      hasFetchedNotifications.current = true;
      const fetchTimeout = setTimeout(() => {
        console.log('📡 Fetching existing notifications via API');
        fetchExistingNotifications();
      }, 1000);

      return () => clearTimeout(fetchTimeout);
    }
  }, [connectionStatus]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const token = getToken();
    const user = getUser();
    
    console.log('🔍 Socket initialization check:', {
      hasToken: !!token,
      hasUser: !!user,
      userId: user?.id,
      userRole: user?.role,
      socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL
    });
    
    if (!token || !user) {
      console.error('❌ Cannot initialize socket: missing token or user');
      return;
    }

    setConnectionStatus('connecting');

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    console.log('🌐 Connecting to socket:', socketUrl);

    socket = io(`${socketUrl}/notifications`, {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected', socket?.id);
      setConnectionStatus('connected');
      
      // Register user with role and userId for room-based targeting
      socket?.emit('register', { role: user.role, userId: user.id });
      
      console.log(`📝 Registered user ${user.id} with role ${user.role}`);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      setConnectionStatus('disconnected');
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
      setConnectionStatus('connected');
      
      // Re-register on reconnection
      socket?.emit('register', { role: user.role, userId: user.id });
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
      setConnectionStatus('connecting');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnectionStatus('disconnected');
    });

    socket.on('registered', (data: { success: boolean; userId: string; role: string }) => {
      console.log('✅ Socket registration successful:', data);
      if (!data.success) {
        console.error('❌ Socket registration failed');
        toast.error('Failed to register for notifications');
      }
    });

    socket.on('registration_error', (data: { success: boolean; error: string }) => {
      console.error('Socket registration failed:', data);
      toast.error('Failed to register for notifications');
    });

    socket.on('notification', ({ notification }: { notification: any }) => {
      console.log('🔔 Socket notification received:', notification);
      console.log('🎯 Target info:', {
        targetUserId: notification.targetUserId,
        targetRole: notification.targetRole,
        type: notification.type,
        currentUser: { id: user.id, role: user.role }
      });

      // Validate notification data
      if (!notification || (!notification.id && !notification.title)) {
        console.error('❌ Invalid notification data:', notification);
        return;
      }

      // Idempotency check - prevent duplicate processing
      if (notification.id && processedIds.current.has(notification.id)) {
        console.log('⚠️ Duplicate notification ignored:', notification.id);
        return;
      }

      // Add to processed IDs
      if (notification.id) {
        processedIds.current.add(notification.id);
        saveProcessedNotificationIds(processedIds.current);
      }

      // Prevent duplicate notification in state
      setNotifications((prev) => {
        const exists = prev.some(
          (n) => n.id && notification.id && n.id === notification.id
        );

        if (exists) {
          console.log('⚠️ Notification already in state:', notification.id);
          return prev;
        }

        console.log('✅ Adding new notification to state:', notification.id);
        return [notification, ...prev];
      });

      // Update unread count with persistence
      setUnreadCount((c) => {
        const newCount = c + 1;
        saveUnreadCount(newCount);
        console.log('📊 Unread count updated:', c, '→', newCount);
        return newCount;
      });

      const icons: Record<string, string> = {
        emergency: '🚨',
        prescription: '💊',
        appointment: '📅',
        registration: '🏥',
        warning: '⚠️',
        broadcast: '📢',

        // Add your hospital events
        patient_discharge: '🏥',
        critical_vitals: '🚨',
        consultation: '🩺',
        doctor_assignment: '👨‍⚕️',
        lab_result: '🧪',
        bed_update: '🛏️',
      };

      const icon = icons[notification.type] || '🔔';

      // Existing in-app toast
      toast(
        `${icon} ${notification.title}\n${notification.message}`,
        {
          duration:
            notification.type === 'critical_vitals' || notification.type === 'registration'
              ? 8000
              : 5000,
        }
      );

      // Chrome / Windows desktop notification
      if (canShowBrowserNotifications()) {
        showBrowserNotification(
          `${icon} ${notification.title || 'Hospital Notification'}`,
          notification.message || 'New hospital notification',
          {
            id: notification.id,
            type: notification.type,
            referenceId:
              notification.referenceId ||
              notification.entityId,
            url: getNotificationUrl(notification),
          }
        );
      }
    });

    return () => {
      socket?.disconnect();
      socket = null;
      initialized.current = false;
      setConnectionStatus('disconnected');
    };
  }, []);

  const markRead = () => {
    setUnreadCount(0);
    saveUnreadCount(0);
  };

  const clearNotifications = () => {
    setNotifications([]);
    processedIds.current.clear();
    saveProcessedNotificationIds(processedIds.current);
  };

  const requestPermission = async () => {
    const permission = await requestBrowserNotificationPermission();
    setNotificationPermission(permission);
    return permission;
  };

  return {
    notifications,
    unreadCount,
    markRead,
    clearNotifications,
    connectionStatus,
    notificationPermission,
    requestPermission,
    canShowNotifications: canShowBrowserNotifications(),
  };
}
