import axios from 'axios';

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL?.trim() || 'http://localhost:4000/api'
).replace(/\/+$/, '');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15_000,
});

export function isUnauthorized(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

export function apiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: unknown }>(error)) {
    const message = error.response?.data?.error;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
