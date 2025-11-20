import { apiClient } from './apiClient';

export interface PharmacistSchedule {
  _id: string;
  workplaceId: string;
  locationId?: string;
  pharmacistId: string;
  workingHours: Array<{
    dayOfWeek: number;
    isWorkingDay: boolean;
    shifts: Array<{
      startTime: string;
      endTime: string;
      breakStart?: string;
      breakEnd?: string;
    }>;
  }>;
  timeOff: Array<{
    _id?: string;
    startDate: string;
    endDate: string;
    reason: string;
    type: 'vacation' | 'sick_leave' | 'personal' | 'training' | 'other';
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: string;
  }>;
  appointmentPreferences: {
    maxAppointmentsPerDay?: number;
    maxConcurrentAppointments?: number;
    appointmentTypes: string[];
    defaultDuration: number;
    bufferBetweenAppointments?: number;
  };
  capacityStats: {
    totalSlotsAvailable: number;
    slotsBooked: number;
    utilizationRate: number;
    lastCalculatedAt: string;
  };
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  pharmacist?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TimeOffRequest {
  startDate: string;
  endDate: string;
  reason: string;
  type: 'vacation' | 'sick_leave' | 'personal' | 'training' | 'other';
}

export interface ScheduleUpdateData {
  workingHours?: PharmacistSchedule['workingHours'];
  appointmentPreferences?: PharmacistSchedule['appointmentPreferences'];
  locationId?: string;
  isActive?: boolean;
}

export interface CapacityReport {
  overall: {
    totalSlots: number;
    bookedSlots: number;
    utilizationRate: number;
  };
  byPharmacist: Array<{
    pharmacistId: string;
    pharmacistName: string;
    totalSlots: number;
    bookedSlots: number;
    utilizationRate: number;
  }>;
  byDay: Array<{
    date: string;
    dayName: string;
    totalSlots: number;
    bookedSlots: number;
    utilizationRate: number;
  }>;
  recommendations: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class PharmacistScheduleService {
  /**
   * Get pharmacist schedule
   */
  async getPharmacistSchedule(pharmacistId: string): Promise<ApiResponse<{
    schedule: PharmacistSchedule;
    upcomingTimeOff: PharmacistSchedule['timeOff'];
    utilizationRate: number;
  }>> {
    const response = await apiClient.get(`/schedules/pharmacist/${pharmacistId}`);
    return response.data;
  }

  /**
   * Update pharmacist schedule
   */
  async updatePharmacistSchedule(
    pharmacistId: string,
    scheduleData: ScheduleUpdateData
  ): Promise<ApiResponse<{ schedule: PharmacistSchedule }>> {
    const response = await apiClient.put(`/schedules/pharmacist/${pharmacistId}`, scheduleData);
    return response.data;
  }

  /**
   * Request time off
   */
  async requestTimeOff(
    pharmacistId: string,
    timeOffData: TimeOffRequest
  ): Promise<ApiResponse<{
    timeOff: PharmacistSchedule['timeOff'][0];
    affectedAppointments: Array<{
      _id: string;
      scheduledDate: string;
      scheduledTime: string;
      patientId: string;
      type: string;
    }>;
  }>> {
    const response = await apiClient.post(`/schedules/pharmacist/${pharmacistId}/time-off`, timeOffData);
    return response.data;
  }

  /**
   * Update time-off status (approve/reject)
   */
  async updateTimeOffStatus(
    pharmacistId: string,
    timeOffId: string,
    status: 'approved' | 'rejected',
    reason?: string
  ): Promise<ApiResponse<{
    timeOff: PharmacistSchedule['timeOff'][0];
  }>> {
    const response = await apiClient.patch(
      `/schedules/pharmacist/${pharmacistId}/time-off/${timeOffId}`,
      { status, reason }
    );
    return response.data;
  }

  /**
   * Get capacity report
   */
  async getCapacityReport(params: {
    startDate: string;
    endDate: string;
    pharmacistId?: string;
    locationId?: string;
  }): Promise<ApiResponse<CapacityReport>> {
    const response = await apiClient.get('/schedules/capacity', { params });
    return response.data;
  }

  /**
   * Get all pharmacist schedules for the workplace
   */
  async getAllPharmacistSchedules(locationId?: string): Promise<ApiResponse<{
    schedules: PharmacistSchedule[];
  }>> {
    const params = locationId ? { locationId } : {};
    const response = await apiClient.get('/schedules/pharmacists', { params });
    return response.data;
  }
}

export const pharmacistScheduleService = new PharmacistScheduleService();