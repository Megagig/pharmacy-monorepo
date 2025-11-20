import { apiClient } from './apiClient';
import {
  FollowUpTask,
  FollowUpFilters,
  FollowUpFormData,
  FollowUpSummary,
} from '../stores/followUpTypes';

export interface FollowUpResponse {
  success: boolean;
  data: {
    tasks: FollowUpTask[];
    summary?: FollowUpSummary;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  message?: string;
}

export interface SingleFollowUpResponse {
  success: boolean;
  data: {
    task: FollowUpTask;
    patient?: any;
    assignedPharmacist?: any;
    relatedRecords?: any;
  };
  message?: string;
}

export interface CompleteFollowUpData {
  outcome: {
    status: 'successful' | 'partially_successful' | 'unsuccessful';
    notes: string;
    nextActions: string[];
    appointmentCreated?: boolean;
    appointmentId?: string;
  };
}

export interface ConvertToAppointmentData {
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  type: string;
  description?: string;
}

export interface EscalateFollowUpData {
  newPriority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  reason: string;
}

class FollowUpService {
  private baseUrl = '/follow-ups';

  /**
   * Get follow-up tasks with filtering and pagination
   */
  async getFollowUpTasks(filters: FollowUpFilters = {}): Promise<FollowUpResponse> {
    const params = new URLSearchParams();
    
    // Add filters to query params
    if (filters.search) params.append('search', filters.search);
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        filters.status.forEach(s => params.append('status', s));
      } else {
        params.append('status', filters.status);
      }
    }
    if (filters.priority) {
      if (Array.isArray(filters.priority)) {
        filters.priority.forEach(p => params.append('priority', p));
      } else {
        params.append('priority', filters.priority);
      }
    }
    if (filters.type) {
      if (Array.isArray(filters.type)) {
        filters.type.forEach(t => params.append('type', t));
      } else {
        params.append('type', filters.type);
      }
    }
    if (filters.patientId) params.append('patientId', filters.patientId);
    if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
    if (filters.locationId) params.append('locationId', filters.locationId);
    if (filters.dueDateFrom) params.append('dueDateFrom', filters.dueDateFrom.toISOString());
    if (filters.dueDateTo) params.append('dueDateTo', filters.dueDateTo.toISOString());
    if (filters.overdue !== undefined) params.append('overdue', filters.overdue.toString());
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await apiClient.get(`${this.baseUrl}?${params.toString()}`);
    return response.data;
  }

  /**
   * Get single follow-up task by ID
   */
  async getFollowUpTask(taskId: string): Promise<SingleFollowUpResponse> {
    const response = await apiClient.get(`${this.baseUrl}/${taskId}`);
    return response.data;
  }

  /**
   * Create new follow-up task
   */
  async createFollowUpTask(taskData: FollowUpFormData): Promise<SingleFollowUpResponse> {
    const response = await apiClient.post(this.baseUrl, taskData);
    return response.data;
  }

  /**
   * Update follow-up task
   */
  async updateFollowUpTask(
    taskId: string, 
    updates: Partial<FollowUpFormData>
  ): Promise<SingleFollowUpResponse> {
    const response = await apiClient.put(`${this.baseUrl}/${taskId}`, updates);
    return response.data;
  }

  /**
   * Complete follow-up task
   */
  async completeFollowUpTask(
    taskId: string, 
    completionData: CompleteFollowUpData
  ): Promise<SingleFollowUpResponse> {
    const response = await apiClient.post(`${this.baseUrl}/${taskId}/complete`, completionData);
    return response.data;
  }

  /**
   * Convert follow-up task to appointment
   */
  async convertToAppointment(
    taskId: string, 
    appointmentData: ConvertToAppointmentData
  ): Promise<{
    success: boolean;
    data: {
      appointment: any;
      task: FollowUpTask;
    };
    message?: string;
  }> {
    const response = await apiClient.post(
      `${this.baseUrl}/${taskId}/convert-to-appointment`, 
      appointmentData
    );
    return response.data;
  }

  /**
   * Escalate follow-up task priority
   */
  async escalateFollowUpTask(
    taskId: string, 
    escalationData: EscalateFollowUpData
  ): Promise<SingleFollowUpResponse> {
    const response = await apiClient.post(`${this.baseUrl}/${taskId}/escalate`, escalationData);
    return response.data;
  }

  /**
   * Get overdue follow-up tasks
   */
  async getOverdueFollowUps(assignedTo?: string): Promise<FollowUpResponse> {
    const params = new URLSearchParams();
    if (assignedTo) params.append('assignedTo', assignedTo);
    
    const response = await apiClient.get(`${this.baseUrl}/overdue?${params.toString()}`);
    return response.data;
  }

  /**
   * Get follow-up tasks by patient
   */
  async getPatientFollowUps(
    patientId: string,
    params: { status?: string; limit?: number; page?: number } = {}
  ): Promise<FollowUpResponse> {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.page) queryParams.append('page', params.page.toString());

    const response = await apiClient.get(
      `${this.baseUrl}/patient/${patientId}?${queryParams.toString()}`
    );
    return response.data;
  }

  /**
   * Cancel follow-up task
   */
  async cancelFollowUpTask(
    taskId: string, 
    reason: string
  ): Promise<SingleFollowUpResponse> {
    const response = await apiClient.post(`${this.baseUrl}/${taskId}/cancel`, { reason });
    return response.data;
  }

  /**
   * Assign follow-up task to pharmacist
   */
  async assignFollowUpTask(
    taskId: string, 
    assignedTo: string
  ): Promise<SingleFollowUpResponse> {
    const response = await apiClient.post(`${this.baseUrl}/${taskId}/assign`, { assignedTo });
    return response.data;
  }

  /**
   * Get follow-up analytics
   */
  async getFollowUpAnalytics(params: {
    startDate?: string;
    endDate?: string;
    pharmacistId?: string;
    locationId?: string;
  } = {}): Promise<{
    success: boolean;
    data: {
      summary: {
        totalTasks: number;
        completionRate: number;
        averageTimeToCompletion: number;
        overdueCount: number;
      };
      byType: Record<string, any>;
      byPriority: Record<string, any>;
      byTrigger: Record<string, any>;
      trends: any;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.pharmacistId) queryParams.append('pharmacistId', params.pharmacistId);
    if (params.locationId) queryParams.append('locationId', params.locationId);

    const response = await apiClient.get(`${this.baseUrl}/analytics?${queryParams.toString()}`);
    return response.data;
  }
}

export const followUpService = new FollowUpService();