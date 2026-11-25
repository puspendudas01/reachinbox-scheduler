import { apiClient, API_BASE_URL } from './client';
import type { User } from '../types';

export const authApi = {
  getMe: async (signal?: AbortSignal): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me', { signal });
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getGoogleLoginUrl: (): string => {
    return `${API_BASE_URL}/auth/google`;
  },
};
