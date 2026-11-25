import { apiClient } from './client';
import type { ScheduleCampaignPayload, ScheduleCampaignResult } from '../types';

export const campaignsApi = {
  schedule: async (payload: ScheduleCampaignPayload): Promise<ScheduleCampaignResult> => {
    const response = await apiClient.post<ScheduleCampaignResult>(
      '/campaigns/schedule',
      payload
    );
    return response.data;
  },
};
