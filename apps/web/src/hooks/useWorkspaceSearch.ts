import { useState, useCallback } from 'react';
import { publicApiClient } from '../services/publicApiClient';

export interface Workspace {
  _id: string;
  name: string;
  type: string;
  address: string;
  state: string;
  lga: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  operatingHours: string;
  services: string[];
}

export interface WorkspaceSearchParams {
  search?: string;
  state?: string;
  lga?: string;
  limit?: number;
  page?: number;
}

export interface WorkspaceSearchResult {
  workspaces: Workspace[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const useWorkspaceSearch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchWorkspaces = useCallback(async (params: WorkspaceSearchParams): Promise<WorkspaceSearchResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();

      if (params.search) searchParams.append('search', params.search);
      if (params.state) searchParams.append('state', params.state);
      if (params.lga) searchParams.append('lga', params.lga);
      if (params.limit) searchParams.append('limit', params.limit.toString());
      if (params.page) searchParams.append('page', params.page.toString());

      const response = await publicApiClient.get(`/public/workspaces/search?${searchParams}`);

      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Search failed');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to search workspaces';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getWorkspaceInfo = useCallback(async (workspaceId: string): Promise<Workspace | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await publicApiClient.get(`/public/workspaces/${workspaceId}/info`);

      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to get workspace info');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to get workspace information';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAvailableStates = useCallback(async (): Promise<string[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await publicApiClient.get('/public/workspaces/states');

      if (response.data.success) {
        return response.data.data || [];
      } else {
        throw new Error(response.data.message || 'Failed to get states');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to get available states';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    searchWorkspaces,
    getWorkspaceInfo,
    getAvailableStates,
  };
};