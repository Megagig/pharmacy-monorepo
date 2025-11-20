import apiClient from './apiClient';

export interface WorkspaceEducationalResource {
  id: string;
  title: string;
  description: string;
  slug: string;
  thumbnail?: string;
  category: string;
  mediaType: string;
  viewCount: number;
  rating: number;
  createdAt: string;
  isPinned: boolean;
}

export const workspaceDashboardService = {
  /**
   * Get educational resources for workspace dashboard
   */
  async getEducationalResources(): Promise<WorkspaceEducationalResource[]> {
    try {
      const response = await apiClient.get('/educational-resources/dashboard/workspace');
      return response.data.data.resources || [];
    } catch (error) {
      console.error('Failed to fetch workspace dashboard resources:', error);
      return [];
    }
  }
};

export default workspaceDashboardService;
