export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'receptionist' | 'nurse' | 'pharmacist' | 'management' | 'patient' | 'doctor' | 'lab_technician' | 'lab';
  phone?: string;
  department?: string;
  profileImage?: string;
}

const TOKEN_KEY = 'hms_token';
const USER_KEY = 'hms_user';

function setCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; SameSite=Lax';
}

function removeCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  const sessionUser = sessionStorage.getItem(USER_KEY);
  if (sessionUser) {
    try {
      return JSON.parse(sessionUser);
    } catch { }
  }
  return null;
}

export function setAuth(token: string, user: User) {
  if (typeof window === 'undefined') return;
  // Tab-isolated storage
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));

  // Session cookie so Next.js server middleware permits dashboard access
  setCookie(TOKEN_KEY, token);
  setCookie(USER_KEY, JSON.stringify(user));

  // Clean up legacy localStorage
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  removeCookie(TOKEN_KEY);
  removeCookie(USER_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken() && !!getUser();
}
