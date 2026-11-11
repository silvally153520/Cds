import axios from 'axios';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const apiBaseUrl = configuredApiUrl || (
  import.meta.env.DEV
    ? 'http://localhost:5001/api'
    : 'https://sieuech-api.onrender.com/api'
);

export const api = axios.create({
  baseURL: apiBaseUrl.replace(/\/+$/, ''),
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getAuthToken = () => localStorage.getItem('sieuechxanh-token');

export const setAuthSession = (token: string, user: Record<string, unknown>) => {
  localStorage.setItem('sieuechxanh-token', token);
  localStorage.setItem('sieuechxanh-user', JSON.stringify(user));
  window.dispatchEvent(new Event('sieuechxanh-auth-change'));
};

export const clearAuthSession = () => {
  localStorage.removeItem('sieuechxanh-token');
  localStorage.removeItem('sieuechxanh-user');
  window.dispatchEvent(new Event('sieuechxanh-auth-change'));
};

export const getStoredUser = () => {
  const raw = localStorage.getItem('sieuechxanh-user');
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
