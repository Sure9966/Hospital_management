'use client';
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken, getUser } from './auth';
import toast from 'react-hot-toast';

let socket: Socket | null = null;

export function useSocket() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const token = getToken();
    const user = getUser();
    if (!token || !user) return;

    socket = io(`${process.env.NEXT_PUBLIC_SOCKET_URL}/notifications`, {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      socket?.emit('register', { role: user.role, userId: user.id });
    });

    socket.on('notification', ({ notification }: { notification: any }) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((c) => c + 1);

      const icons: Record<string, string> = {
        emergency: '🚨',
        prescription: '💊',
        appointment: '📅',
        registration: '🏥',
        warning: '⚠️',
        broadcast: '📢',
      };
      const icon = icons[notification.type] || '🔔';
      toast(`${icon} ${notification.title}\n${notification.message}`, { duration: 5000 });
    });

    return () => { socket?.disconnect(); socket = null; initialized.current = false; };
  }, []);

  const markRead = () => setUnreadCount(0);
  const clearNotifications = () => setNotifications([]);

  return { notifications, unreadCount, markRead, clearNotifications };
}
