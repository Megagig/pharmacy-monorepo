import { apiClient } from './client';

export interface CreateAppointmentFromMTRData {
  patientId: string;
  assignedTo: string;
  scheduledDate: string;
  scheduledTime: string;
  duration?: number;
  description?: string;
  locationId?: string;
}

export interface CreateMTRWithAppointmentData {
  patientId: string;
  assignedTo: string;
  scheduledDate: string;
  scheduledTime: string;
  duration?: number;
  description: string;
  objectives: string[];
  priority: 'high' | 'medium' | 'low';
  locationId?: string;
}

export interface LinkMTRFollowUpData {
  mtrFollowUpId: string;
  appointmentId: string;
}

export interface SyncStatusData {
  sourceId: string;
  sourceType: 'appointment' | 'mtr_followup';
  newStatus: string;
}

export interface MTRSessionWithAppointments {
  mtrSession: any;
  linkedAppointments: any[];
  followUps: any[];
}

export interface CreateFollowUpFromInterventionData {
  patientId: string;
  assignedTo: string;
  locationId?: string;
}

export interface InterventionWithEngagementData {
  intervention: any;
  followUpTasks: any[];
  appointments: any[];
}

export const engagementIntegrationApi = {
  /**
   * Create appointment from MTR session
   */
  async createAppointmentFromMTR(
    mtrSessionId: string,
    data: CreateAppointmentFromMTRData
  ): Promise<{ appointment: any; mtrSession: any }> {
    const response = await apiClient.post(
      `/engagement-integration/mtr/${mtrSessionId}/appointment`,
      data
    );
    return response.data.data;
  },

  /**
   * Link MTR follow-up to appointment
   */
  async linkMTRFollowUpToAppointment(
    data: LinkMTRFollowUpData
  ): Promise<{ mtrFollowUp: any; appointment: any }> {
    const response = await apiClient.post(
      '/engagement-integration/link-mtr-followup',
      data
    );
    return response.data.data;
  },

  /**
   * Create MTR follow-up with appointment
   */
  async createMTRWithAppointment(
    mtrSessionId: string,
    data: CreateMTRWithAppointmentData
  ): Promise<{ appointment: any; mtrFollowUp: any }> {
    const response = await apiClient.post(
      `/engagement-integration/mtr/${mtrSessionId}/schedule`,
      data
    );
    return response.data.data;
  },

  /**
   * Get MTR session with linked appointments
   */
  async getMTRSessionWithAppointment(
    mtrSessionId: string
  ): Promise<MTRSessionWithAppointments> {
    const response = await apiClient.get(
      `/engagement-integration/mtr/${mtrSessionId}`
    );
    return response.data.data;
  },

  /**
   * Sync status between MTR follow-up and appointment
   */
  async syncMTRFollowUpStatus(data: SyncStatusData): Promise<void> {
    await apiClient.post('/engagement-integration/sync-status', data);
  },

  /**
   * Create visit from completed appointment
   */
  async createVisitFromAppointment(appointmentId: string): Promise<{ visit: any }> {
    const response = await apiClient.post(
      `/engagement-integration/appointment/${appointmentId}/create-visit`
    );
    return response.data.data;
  },

  /**
   * Create follow-up task from clinical intervention
   */
  async createFollowUpFromIntervention(
    interventionId: string,
    data: CreateFollowUpFromInterventionData
  ): Promise<{ followUpTask: any; intervention: any }> {
    const response = await apiClient.post(
      `/engagement-integration/intervention/${interventionId}/create-followup`,
      data
    );
    return response.data.data;
  },

  /**
   * Update intervention status from completed follow-up
   */
  async updateInterventionFromFollowUp(
    followUpTaskId: string
  ): Promise<{ intervention: any; followUpTask: any }> {
    const response = await apiClient.post(
      `/engagement-integration/followup/${followUpTaskId}/update-intervention`
    );
    return response.data.data;
  },

  /**
   * Get clinical intervention with linked follow-up tasks and appointments
   */
  async getInterventionWithEngagementData(
    interventionId: string
  ): Promise<InterventionWithEngagementData> {
    const response = await apiClient.get(
      `/engagement-integration/intervention/${interventionId}`
    );
    return response.data.data;
  },

  /**
   * Create follow-up task from diagnostic case
   */
  async createFollowUpFromDiagnostic(
    diagnosticCaseId: string,
    data: {
      assignedTo?: string;
      locationId?: string;
    }
  ): Promise<{ followUpTask: any; diagnosticCase: any }> {
    const response = await apiClient.post(
      `/engagement-integration/diagnostic/${diagnosticCaseId}/create-followup`,
      data
    );
    return response.data.data;
  },

  /**
   * Get diagnostic case with linked follow-up tasks and appointments
   */
  async getDiagnosticWithEngagementData(
    diagnosticCaseId: string
  ): Promise<{
    diagnosticCase: any;
    followUpTasks: any[];
    appointments: any[];
  }> {
    const response = await apiClient.get(
      `/engagement-integration/diagnostic/${diagnosticCaseId}`
    );
    return response.data.data;
  },
};