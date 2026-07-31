import axios from 'axios';
import { getToken, clearAuth } from './auth';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token from cookies/storage
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor to handle network errors and authentication failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        // Network Error or Server Offline
        console.error('🌐 Network Error: Backend server is unreachable (http://localhost:3001)');
        return Promise.reject({
          response: {
            data: {
              message: 'Network Error: Cannot reach server. Please check backend connection.',
            },
          },
        });
      }

      if (error.response.status === 401) {
        // Unauthorized - clear cookies and redirect to login
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          clearAuth();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;
