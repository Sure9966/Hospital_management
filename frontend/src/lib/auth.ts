export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'receptionist' | 'nurse' | 'pharmacist' | 'management' | 'patient';
  phone?: string;
  department?: string;
  profileImage?: string;
}

const TOKEN_KEY = 'hms_token';
const USER_KEY = 'hms_user';

// Pure 0-dependency Cookie helpers (safe for Next.js SSR & Client environment)
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      try {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      } catch {
        return c.substring(nameEQ.length, c.length);
      }
    }
  }
  return null;
}

function setCookie(name: string, value: string, days = 7) {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = '; expires=' + date.toUTCString();
  document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
}

function removeCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  // Check cookie first
  const cookieToken = getCookie(TOKEN_KEY);
  if (cookieToken) return cookieToken;

  // Fallback to localStorage
  const localToken = localStorage.getItem(TOKEN_KEY);
  if (localToken) {
    setCookie(TOKEN_KEY, localToken);
    return localToken;
  }
  return null;
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  // Check cookie first
  const cookieUser = getCookie(USER_KEY);
  if (cookieUser) {
    try { return JSON.parse(cookieUser); } catch {}
  }

  // Fallback to localStorage
  const localUser = localStorage.getItem(USER_KEY);
  if (localUser) {
    try {
      const parsed = JSON.parse(localUser);
      setCookie(USER_KEY, JSON.stringify(parsed));
      return parsed;
    } catch {}
  }
  return null;
}

export function setAuth(token: string, user: User) {
  if (typeof window === 'undefined') return;
  setCookie(TOKEN_KEY, token, 7);
  setCookie(USER_KEY, JSON.stringify(user), 7);
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  removeCookie(TOKEN_KEY);
  removeCookie(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken() && !!getUser();
}
