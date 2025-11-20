import { ApiResponse } from '../types/patientManagement';

export interface AppointmentType {
  type: string;
  name: string;
  description: string;
  duration: number;
  available: boolean;
}

export interface AvailableSlot {
  time: string;
  available: boolean;
  pharmacistId: string;
  pharmacistName?: string;
}

export interface BookingData {
  patientId: string;
  type: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  patientNotes?: string;
  notificationPreferences?: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
}

export interface PatientAppointment {
  _id: string;
  type: string;
  title: string;
  description?: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  status: string;
  confirmationStatus: string;
  pharmacistName?: string;
  locationName?: string;
  canReschedule: boolean;
  canCancel: boolean;
}

export interface DashboardStats {
  upcomingAppointments: number;
  activeMedications: number;
  unreadMessages: number;
  pendingRefills: number;
}

export interface CurrentMedication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  refillsRemaining: number;
  nextRefillDate: string | null;
  adherenceScore: number;
}

export interface RecentMessage {
  id: string;
  from: string;
  subject: string;
  preview: string;
  timestamp: string;
  isRead: boolean;
}

export interface VitalReading {
  type: 'blood_pressure' | 'weight' | 'glucose' | 'temperature';
  value: string;
  unit: string;
  date: string;
  status: 'normal' | 'high' | 'low';
}

export interface DashboardEducationalResource {
  id: string;
  title: string;
  description: string;
  slug: string;
  thumbnail?: string;
  category: string;
  mediaType: string;
  readingTime?: number;
  viewCount: number;
  rating: number;
}

export interface DashboardData {
  user: {
    firstName: string;
    lastName: string;
    workspaceName: string;
    onboardingCompleted: boolean;
  };
  stats: DashboardStats;
  upcomingAppointments: Array<{
    id: string;
    type: string;
    date: string;
    time: string;
    pharmacistName: string;
    status: string;
    duration: number;
  }>;
  currentMedications: CurrentMedication[];
  recentMessages: RecentMessage[];
  recentVitals: VitalReading[];
  recentHealthRecords: any[];
  educationalResources: DashboardEducationalResource[];
}

class PatientPortalService {
  /**
   * Base request method with error handling
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      // Import the configured API client
      const { default: apiClient } = await import('./apiClient');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
      };

      const response = await apiClient({
        url: url,
        method: options.method || 'GET',
        data: options.body ? JSON.parse(options.body as string) : undefined,
        headers,
        withCredentials: true, // Include httpOnly cookies for patient authentication
      });

      return response.data as T;
    } catch (error: any) {
      console.error('Patient Portal API Request failed:', error);
      throw new Error(
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'An error occurred'
      );
    }
  }

  /**
   * Get available appointment types
   */
  async getAppointmentTypes(workplaceId: string): Promise<ApiResponse<AppointmentType[]>> {
    return this.makeRequest<ApiResponse<AppointmentType[]>>(
      `/patient-portal/appointment-types?workplaceId=${workplaceId}`
    );
  }

  /**
   * Get available time slots for a specific date
   */
  async getAvailableSlots(params: {
    workplaceId: string;
    date: string;
    type?: string;
    duration?: number;
    pharmacistId?: string;
    locationId?: string;
  }): Promise<ApiResponse<{ slots: AvailableSlot[]; pharmacists: any[] }>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return this.makeRequest<ApiResponse<{ slots: AvailableSlot[]; pharmacists: any[] }>>(
      `/patient-portal/available-slots?${searchParams.toString()}`
    );
  }

  /**
   * Book a new appointment
   */
  async bookAppointment(bookingData: BookingData): Promise<ApiResponse<{
    appointment: PatientAppointment;
    confirmationCode: string;
  }>> {
    return this.makeRequest<ApiResponse<{
      appointment: PatientAppointment;
      confirmationCode: string;
    }>>(
      '/patient-portal/appointments',
      {
        method: 'POST',
        body: JSON.stringify(bookingData),
      }
    );
  }

  /**
   * Get patient's appointments
   */
  async getMyAppointments(params: {
    status?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    cursor?: string;
    includeCompleted?: boolean;
    includeCancelled?: boolean;
  } = {}): Promise<ApiResponse<{
    appointments: PatientAppointment[];
    hasMore: boolean;
    nextCursor?: string;
  }>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return this.makeRequest<ApiResponse<{
      appointments: PatientAppointment[];
      hasMore: boolean;
      nextCursor?: string;
    }>>(
      `/patient-portal/appointments?${searchParams.toString()}`
    );
  }

  /**
   * Reschedule an appointment
   */
  async rescheduleAppointment(
    appointmentId: string,
    rescheduleData: {
      newDate: string;
      newTime: string;
      reason: string;
      notifyPharmacist?: boolean;
    }
  ): Promise<ApiResponse<{ appointment: PatientAppointment }>> {
    return this.makeRequest<ApiResponse<{ appointment: PatientAppointment }>>(
      `/patient-portal/appointments/${appointmentId}/reschedule`,
      {
        method: 'POST',
        body: JSON.stringify(rescheduleData),
      }
    );
  }

  /**
   * Cancel an appointment
   */
  async cancelAppointment(
    appointmentId: string,
    cancelData: {
      reason: string;
      notifyPharmacist?: boolean;
    }
  ): Promise<ApiResponse<{ appointment: PatientAppointment }>> {
    return this.makeRequest<ApiResponse<{ appointment: PatientAppointment }>>(
      `/patient-portal/appointments/${appointmentId}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify(cancelData),
      }
    );
  }

  /**
   * Confirm an appointment
   */
  async confirmAppointment(
    appointmentId: string,
    confirmData: {
      confirmationToken?: string;
      patientNotes?: string;
      specialRequirements?: string;
    } = {}
  ): Promise<ApiResponse<{ appointment: PatientAppointment; message: string }>> {
    return this.makeRequest<ApiResponse<{ appointment: PatientAppointment; message: string }>>(
      `/patient-portal/appointments/${appointmentId}/confirm`,
      {
        method: 'POST',
        body: JSON.stringify(confirmData),
      }
    );
  }

  /**
   * Reserve a time slot temporarily (10-minute hold)
   */
  async reserveSlot(params: {
    workplaceId: string;
    date: string;
    time: string;
    type: string;
    pharmacistId?: string;
  }): Promise<ApiResponse<{
    reservationId: string;
    expiresAt: string;
  }>> {
    // This would be a custom endpoint for slot reservation
    // For now, we'll simulate it by returning a mock response
    return Promise.resolve({
      success: true,
      data: {
        reservationId: `res_${Date.now()}`,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
      message: 'Slot reserved successfully',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Release a reserved slot
   */
  async releaseSlot(reservationId: string): Promise<ApiResponse<{ released: boolean }>> {
    // This would be a custom endpoint for releasing slot reservation
    // For now, we'll simulate it
    return Promise.resolve({
      success: true,
      data: { released: true },
      message: 'Slot released successfully',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get comprehensive dashboard data
   * Returns stats, appointments, medications, messages, vitals, and health records
   */
  async getDashboardData(): Promise<ApiResponse<DashboardData>> {
    return this.makeRequest<ApiResponse<DashboardData>>(
      '/patient-portal/dashboard'
    );
  }
}

// Create a singleton instance
const patientPortalServiceInstance = new PatientPortalService();

// Export as a named export
export const patientPortalService = patientPortalServiceInstance;

// Also export as default
export default patientPortalServiceInstance;