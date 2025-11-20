import {
  Appointment,
  AppointmentFilters,
  AppointmentFormData,
  AppointmentSummary,
  AvailableSlot,
} from '../stores/appointmentTypes';
import { ApiResponse, PaginatedResponse } from '../types/patientManagement';

class AppointmentService {
  /**
   * Base request method with error handling and authentication
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      // Import the configured API client with direct backend URL
      const { default: apiClient } = await import('./apiClient');

      const response = await apiClient({
        url: url,
        method: options.method || 'GET',
        data: options.body ? JSON.parse(options.body as string) : undefined,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      return response.data as T;
    } catch (error: any) {
      console.error('Appointment API Request failed:', error);
      
      // Preserve the original error structure for proper error handling
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        
        // Handle validation errors with details
        let errorMessage = error.response?.data?.error?.message ||
          error.response?.data?.message ||
          error.message ||
          'An error occurred';
        
        if (error.response?.data?.error?.code === 'VALIDATION_ERROR' && error.response?.data?.error?.details) {
          const validationDetails = error.response.data.error.details
            .map((d: any) => `${d.field}: ${d.message}`)
            .join('; ');
          errorMessage = `${errorMessage} - ${validationDetails}`;
        }
        
        const enhancedError = new Error(errorMessage);
        // Preserve the response for status code checking
        (enhancedError as any).response = error.response;
        throw enhancedError;
      } else {
        // Something happened in setting up the request that triggered an Error
        throw error;
      }
    }
  }

  // =============================================
  // APPOINTMENT MANAGEMENT
  // =============================================

  /**
   * Get paginated list of appointments with filtering
   */
  async getAppointments(
    filters: AppointmentFilters = {}
  ): Promise<PaginatedResponse<Appointment> & { summary?: AppointmentSummary }> {
    const searchParams = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, String(v)));
        } else if (value instanceof Date) {
          searchParams.append(key, value.toISOString());
        } else {
          searchParams.append(key, String(value));
        }
      }
    });

    try {
      const result = await this.makeRequest<any>(
        `/appointments?${searchParams.toString()}`
      );

      // Handle the backend response structure
      const response = {
        data: result.data || { results: [] },
        meta: result.meta || {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
        summary: result.summary,
        success: result.success || false,
        timestamp: result.timestamp || new Date().toISOString(),
      };

      return response;
    } catch (error) {
      console.error('AppointmentService.getAppointments error:', error);
      throw error;
    }
  }

  /**
   * Get calendar view of appointments
   */
  async getCalendarAppointments(params: {
    view: 'day' | 'week' | 'month';
    date: string;
    pharmacistId?: string;
    locationId?: string;
  }): Promise<ApiResponse<{ appointments: Appointment[]; summary: AppointmentSummary }>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return this.makeRequest<ApiResponse<{ appointments: Appointment[]; summary: AppointmentSummary }>>(
      `/appointments/calendar?${searchParams.toString()}`
    );
  }

  /**
   * Get single appointment by ID
   */
  async getAppointment(
    appointmentId: string
  ): Promise<ApiResponse<{ 
    appointment: Appointment; 
    patient: any; 
    assignedPharmacist: any; 
    relatedRecords: any; 
  }>> {
    return this.makeRequest<ApiResponse<{ 
      appointment: Appointment; 
      patient: any; 
      assignedPharmacist: any; 
      relatedRecords: any; 
    }>>(
      `/appointments/${appointmentId}`
    );
  }

  /**
   * Create new appointment
   */
  async createAppointment(
    appointmentData: AppointmentFormData
  ): Promise<ApiResponse<{ appointment: Appointment; reminders: any[] }>> {
    return this.makeRequest<ApiResponse<{ appointment: Appointment; reminders: any[] }>>(
      '/appointments',
      {
        method: 'POST',
        body: JSON.stringify(appointmentData),
      }
    );
  }

  /**
   * Update appointment
   */
  async updateAppointment(
    appointmentId: string,
    updates: Partial<AppointmentFormData> & {
      updateType?: 'this_only' | 'this_and_future';
    }
  ): Promise<ApiResponse<{ appointment: Appointment; affectedAppointments?: Appointment[] }>> {
    return this.makeRequest<ApiResponse<{ appointment: Appointment; affectedAppointments?: Appointment[] }>>(
      `/appointments/${appointmentId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );
  }

  /**
   * Update appointment status
   */
  async updateAppointmentStatus(
    appointmentId: string,
    statusData: {
      status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
      reason?: string;
      outcome?: {
        status: 'successful' | 'partially_successful' | 'unsuccessful';
        notes: string;
        nextActions: string[];
        visitCreated?: boolean;
        visitId?: string;
      };
    }
  ): Promise<ApiResponse<{ appointment: Appointment }>> {
    return this.makeRequest<ApiResponse<{ appointment: Appointment }>>(
      `/appointments/${appointmentId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify(statusData),
      }
    );
  }

  /**
   * Reschedule appointment
   */
  async rescheduleAppointment(
    appointmentId: string,
    rescheduleData: {
      newDate: string;
      newTime: string;
      reason: string;
      notifyPatient?: boolean;
    }
  ): Promise<ApiResponse<{ appointment: Appointment; notificationSent: boolean }>> {
    return this.makeRequest<ApiResponse<{ appointment: Appointment; notificationSent: boolean }>>(
      `/appointments/${appointmentId}/reschedule`,
      {
        method: 'POST',
        body: JSON.stringify(rescheduleData),
      }
    );
  }

  /**
   * Cancel appointment
   */
  async cancelAppointment(
    appointmentId: string,
    cancelData: {
      reason: string;
      notifyPatient?: boolean;
      cancelType?: 'this_only' | 'all_future';
    }
  ): Promise<ApiResponse<{ appointment: Appointment; cancelledCount: number }>> {
    return this.makeRequest<ApiResponse<{ appointment: Appointment; cancelledCount: number }>>(
      `/appointments/${appointmentId}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify(cancelData),
      }
    );
  }

  /**
   * Get available time slots with enhanced response
   */
  async getAvailableSlots(params: {
    date: string;
    pharmacistId?: string;
    duration?: number;
    type?: string;
    includeUnavailable?: boolean;
  }): Promise<ApiResponse<{ 
    slots: AvailableSlot[]; 
    pharmacists: any[];
    summary: {
      totalSlots: number;
      availableSlots: number;
      unavailableSlots: number;
      utilizationRate: number;
    };
    totalAvailable: number;
    message?: string;
  }>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return this.makeRequest<ApiResponse<{ 
      slots: AvailableSlot[]; 
      pharmacists: any[];
      summary: {
        totalSlots: number;
        availableSlots: number;
        unavailableSlots: number;
        utilizationRate: number;
      };
      totalAvailable: number;
      message?: string;
    }>>(
      `/appointments/available-slots?${searchParams.toString()}`
    );
  }

  /**
   * Get patient appointments
   */
  async getPatientAppointments(
    patientId: string,
    params: {
      status?: string;
      limit?: number;
      page?: number;
    } = {}
  ): Promise<PaginatedResponse<Appointment>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return this.makeRequest<PaginatedResponse<Appointment>>(
      `/appointments/patient/${patientId}?${searchParams.toString()}`
    );
  }

  /**
   * Confirm appointment (for patient portal or reminder links)
   */
  async confirmAppointment(
    appointmentId: string,
    confirmationData: {
      confirmationToken?: string;
    } = {}
  ): Promise<ApiResponse<{ appointment: Appointment; message: string }>> {
    return this.makeRequest<ApiResponse<{ appointment: Appointment; message: string }>>(
      `/appointments/${appointmentId}/confirm`,
      {
        method: 'POST',
        body: JSON.stringify(confirmationData),
      }
    );
  }

  // =============================================
  // WAITLIST MANAGEMENT
  // =============================================

  /**
   * Get waitlist entries with filtering
   */
  async getWaitlist(filters: {
    status?: 'active' | 'fulfilled' | 'expired' | 'cancelled';
    urgencyLevel?: 'low' | 'medium' | 'high' | 'urgent' | '';
    appointmentType?: string;
    search?: string;
  } = {}): Promise<ApiResponse<{ 
    entries: any[]; 
    total: number; 
  }>> {
    const searchParams = new URLSearchParams();

    // Only add non-empty values to query params
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });

    return this.makeRequest<ApiResponse<{ 
      entries: any[]; 
      total: number; 
    }>>(
      `/appointments/waitlist?${searchParams.toString()}`
    );
  }

  /**
   * Get waitlist statistics
   */
  async getWaitlistStats(): Promise<ApiResponse<{
    totalActive: number;
    byUrgency: Record<string, number>;
    byAppointmentType: Record<string, number>;
    averageWaitTime: number;
    fulfillmentRate: number;
  }>> {
    return this.makeRequest<ApiResponse<{
      totalActive: number;
      byUrgency: Record<string, number>;
      byAppointmentType: Record<string, number>;
      averageWaitTime: number;
      fulfillmentRate: number;
    }>>(
      '/appointments/waitlist/stats'
    );
  }

  /**
   * Add patient to waitlist
   */
  async addToWaitlist(waitlistData: {
    patientId: string;
    appointmentType: string;
    duration: number;
    urgencyLevel: 'low' | 'medium' | 'high' | 'urgent';
    maxWaitDays: number;
    preferredPharmacistId?: string;
    preferredTimeSlots?: string[];
    preferredDays?: number[];
    notificationPreferences: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
  }): Promise<ApiResponse<{ waitlistEntry: any }>> {
    return this.makeRequest<ApiResponse<{ waitlistEntry: any }>>(
      '/appointments/waitlist',
      {
        method: 'POST',
        body: JSON.stringify(waitlistData),
      }
    );
  }

  /**
   * Cancel waitlist entry
   */
  async cancelWaitlistEntry(entryId: string): Promise<ApiResponse<{ message: string }>> {
    return this.makeRequest<ApiResponse<{ message: string }>>(
      `/appointments/waitlist/${entryId}/cancel`,
      {
        method: 'POST',
      }
    );
  }

  /**
   * Process waitlist - check for available slots and notify patients
   */
  async processWaitlist(): Promise<ApiResponse<{
    processed: number;
    notified: number;
    fulfilled: number;
    expired: number;
  }>> {
    return this.makeRequest<ApiResponse<{
      processed: number;
      notified: number;
      fulfilled: number;
      expired: number;
    }>>(
      '/appointments/waitlist/process',
      {
        method: 'POST',
      }
    );
  }

  /**
   * Notify waitlist patient of available slots
   */
  async notifyWaitlistPatient(entryId: string): Promise<ApiResponse<{ message: string }>> {
    return this.makeRequest<ApiResponse<{ message: string }>>(
      `/appointments/waitlist/${entryId}/notify`,
      {
        method: 'POST',
      }
    );
  }

  /**
   * Get patients for waitlist autocomplete
   */
  async getPatients(search?: string): Promise<any[]> {
    try {
      const searchParams = new URLSearchParams();
      if (search) {
        searchParams.append('search', search);
      }
      // Add limit for autocomplete
      searchParams.append('limit', '50');
      searchParams.append('page', '1');

      const response = await this.makeRequest<any>(
        `/patients?${searchParams.toString()}`
      );
      
      // Handle different response structures
      const patients = response.data?.results || response.data?.patients || response.data || [];
      return Array.isArray(patients) ? patients : [];
    } catch (error) {
      console.error('Error fetching patients:', error);
      return [];
    }
  }

  /**
   * Get upcoming appointments
   */
  async getUpcomingAppointments(params: {
    days?: number;
    pharmacistId?: string;
  } = {}): Promise<ApiResponse<{
    appointments: Appointment[];
    summary: {
      total: number;
      thisWeek: number;
      nextWeek: number;
      byStatus: Record<string, number>;
    };
  }>> {
    const searchParams = new URLSearchParams();
    
    // Provide default values to avoid validation errors
    const days = params.days || 7;
    searchParams.append('days', String(days));
    
    if (params.pharmacistId) {
      searchParams.append('pharmacistId', params.pharmacistId);
    }

    return this.makeRequest<ApiResponse<{
      appointments: Appointment[];
      summary: {
        total: number;
        thisWeek: number;
        nextWeek: number;
        byStatus: Record<string, number>;
      };
    }>>(`/appointments/upcoming?${searchParams.toString()}`);
  }

  /**
   * Get pharmacists for waitlist selection
   */
  async getPharmacists(): Promise<any[]> {
    try {
      // Try multiple endpoints in fallback order
      try {
        // First try: workspace team members endpoint
        const response = await this.makeRequest<any>(
          '/workspace/team/members?role=Pharmacist&status=active&limit=100'
        );
        const members = response.data?.members || response.members || [];
        return members.map((member: any) => ({
          _id: member._id,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          specialties: member.specialties || [],
        }));
      } catch (workspaceError) {
        console.warn('Workspace members endpoint failed, trying users endpoint:', workspaceError);
        
        // Fallback: Try users endpoint filtered by role
        const response = await this.makeRequest<any>(
          '/users?role=pharmacist&limit=100'
        );
        const users = response.data?.users || response.users || response.data || [];
        return users.map((user: any) => ({
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          specialties: user.specialties || [],
        }));
      }
    } catch (error) {
      console.error('Error fetching pharmacists from all endpoints:', error);
      return [];
    }
  }
}

// Create a singleton instance
const appointmentServiceInstance = new AppointmentService();

// Export as a named export
export const appointmentService = appointmentServiceInstance;

// Also export as default
export default appointmentServiceInstance;