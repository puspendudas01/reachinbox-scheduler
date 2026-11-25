import { apiClient, API_BASE_URL } from './client';
import type { SlackStatus } from '../types';

export const slackApi = {
  getStatus: async (signal?: AbortSignal): Promise<SlackStatus> => {
    const response = await apiClient.get<SlackStatus>('/slack/status', { signal });
    return response.data;
  },

  getConnectUrl: (): string => {
    return `${API_BASE_URL}/slack/connect`;
  },

  disconnect: async (): Promise<void> => {
    await apiClient.post('/slack/disconnect');
  },
};
