// frontend/src/lib/browserNotifications.ts

export type BrowserNotificationPermission =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

export function getBrowserNotificationPermission():
  BrowserNotificationPermission {

  if (typeof window === 'undefined') {
    return 'unsupported';
  }

  if (!('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.permission;
}

export async function requestBrowserNotificationPermission():
  Promise<BrowserNotificationPermission> {

  if (typeof window === 'undefined') {
    return 'unsupported';
  }

  if (!('Notification' in window)) {
    return 'unsupported';
  }

  // Already allowed
  if (Notification.permission === 'granted') {
    return 'granted';
  }

  // User previously blocked it
  if (Notification.permission === 'denied') {
    return 'denied';
  }

  try {
    const permission =
      await Notification.requestPermission();

    return permission;
  } catch (error) {
    console.error(
      '[Browser Notification] Permission error:',
      error
    );

    return 'denied';
  }
}

export function canShowBrowserNotifications(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!('Notification' in window)) {
    return false;
  }

  return Notification.permission === 'granted';
}

export function showBrowserNotification(
  title: string,
  message: string,
  options?: {
    id?: string;
    type?: string;
    referenceId?: string;
    url?: string;
  }
): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!('Notification' in window)) {
    console.warn(
      '[Browser Notification] Notification API unsupported'
    );
    return false;
  }

  if (Notification.permission !== 'granted') {
    console.warn(
      '[Browser Notification] Permission not granted:',
      Notification.permission
    );
    return false;
  }

  try {
    const notification = new Notification(
      title || 'Hospital Notification',
      {
        body:
          message ||
          'You have received a new hospital notification.',

        // Add this image later if you have it
        // icon: '/hospital-icon.png',

        tag:
          options?.id ||
          options?.referenceId ||
          `${options?.type || 'hospital'}-${Date.now()}`,

        requireInteraction:
          options?.type === 'patient_discharge' ||
          options?.type === 'critical_vitals' ||
          options?.type === 'registration',

        data: {
          type: options?.type,
          referenceId: options?.referenceId,
          url: options?.url,
        },
      }
    );

    notification.onclick = () => {
      window.focus();

      if (options?.url) {
        window.location.href = options.url;
      }

      notification.close();
    };

    // Automatically close ordinary notifications
    // Critical/discharge alerts stay until user handles them
    if (
      options?.type !== 'patient_discharge' &&
      options?.type !== 'critical_vitals'
    ) {
      setTimeout(() => {
        notification.close();
      }, 8000);
    }

    return true;
  } catch (error) {
    console.error(
      '[Browser Notification] Display error:',
      error
    );
    return false;
  }
}

export function getPermissionHelpText(): string {
  const permission = getBrowserNotificationPermission();
  
  switch (permission) {
    case 'granted':
      return 'Notifications are enabled';
    case 'denied':
      return 'Notifications are blocked. Please enable them in your browser settings to receive alerts.';
    case 'default':
      return 'Click here to enable notifications for important alerts';
    case 'unsupported':
      return 'Your browser does not support notifications. Please use a modern browser.';
    default:
      return 'Unknown permission status';
  }
}

export function getPermissionStatusIcon(): string {
  const permission = getBrowserNotificationPermission();
  
  switch (permission) {
    case 'granted':
      return '✅';
    case 'denied':
      return '❌';
    case 'default':
      return '🔔';
    case 'unsupported':
      return '⚠️';
    default:
      return '❓';
  }
}