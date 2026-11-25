import { apiClient } from './client';
import type { Email, SearchEmailsParams } from '../types';

export const emailsApi = {
  getScheduled: async (signal?: AbortSignal): Promise<Email[]> => {
    const response = await apiClient.get<Email[]>('/emails/scheduled', { signal });
    return response.data;
  },

  getSent: async (signal?: AbortSignal): Promise<Email[]> => {
    const response = await apiClient.get<Email[]>('/emails/sent', { signal });
    return response.data;
  },

  search: async (params: SearchEmailsParams, signal?: AbortSignal): Promise<Email[]> => {
    const response = await apiClient.get<Email[]>('/emails/search', {
      params,
      signal,
    });
    return response.data;
  },

  cancel: async (id: string): Promise<void> => {
    await apiClient.post(`/emails/${encodeURIComponent(id)}/cancel`);
  },
};
