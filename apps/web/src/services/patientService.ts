import axios from 'axios';
import {
  Patient,
  Allergy,
  Condition,
  MedicationRecord,
  ClinicalAssessment,
  DrugTherapyProblem,
  CarePlan,
  Visit,
  PatientSummary,
  ApiResponse,
  PaginatedResponse,
  PatientSearchParams,
  AllergySearchParams,
  MedicationSearchParams,
  DTPSearchParams,
  CreatePatientData,
  UpdatePatientData,
  CreateAllergyData,
  UpdateAllergyData,
  CreateConditionData,
  UpdateConditionData,
  CreateMedicationData,
  UpdateMedicationData,
  CreateAssessmentData,
  UpdateAssessmentData,
  CreateDTPData,
  UpdateDTPData,
  CreateCarePlanData,
  UpdateCarePlanData,
  CreateVisitData,
  UpdateVisitData,
  VisitAttachment,
} from '../types/patientManagement';

// Use Vite proxy in development (same origin for cookies)
const API_BASE_URL = '/api';

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

class PatientService {
  /**
   * Base request method with error handling and authentication
   */
  private async makeRequest<T>(
    url: string,
    options: RequestOptions = {}
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
      console.error('API Request failed:', error);
      throw new Error(
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'An error occurred'
      );
    }
  }

  // =============================================
  // PATIENT MANAGEMENT CORE
  // =============================================

  /**
   * Get paginated list of patients with search and filtering
   */
  async getPatients(
    params: PatientSearchParams = {}
  ): Promise<PaginatedResponse<Patient>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    try {
      const result = await this.makeRequest<any>(
        `/patients?${searchParams.toString()}`
      );

      // Debug logging


      // Handle the backend response structure
      // Backend returns: { success: true, data: { results: [...] }, meta: {...} }
      // We need to restructure this to match our expected PaginatedResponse format
      const response = {
        data: result.data || { results: [] },
        meta: result.meta || {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
        success: result.success || false,
        timestamp: result.timestamp || new Date().toISOString(),
      };

      return response;
    } catch (error) {
      console.error('PatientService.getPatients error:', error);
      throw error;
    }
  }

  /**
   * Get patient details by ID
   */
  async getPatient(
    patientId: string
  ): Promise<ApiResponse<{ patient: Patient }>> {
    return this.makeRequest<ApiResponse<{ patient: Patient }>>(
      `/patients/${patientId}`
    );
  }

  /**
   * Get patient summary with counts
   */
  async getPatientSummary(
    patientId: string
  ): Promise<ApiResponse<PatientSummary>> {
    return this.makeRequest<ApiResponse<PatientSummary>>(
      `/patients/${patientId}/summary`
    );
  }

  /**
   * Create new patient
   */
  async createPatient(
    patientData: CreatePatientData
  ): Promise<ApiResponse<{ patient: Patient }>> {
    return this.makeRequest<ApiResponse<{ patient: Patient }>>('/patients', {
      method: 'POST',
      body: JSON.stringify(patientData),
    });
  }

  /**
   * Update existing patient
   */
  async updatePatient(
    patientId: string,
    patientData: UpdatePatientData
  ): Promise<ApiResponse<{ patient: Patient }>> {
    return this.makeRequest<ApiResponse<{ patient: Patient }>>(
      `/patients/${patientId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patientData),
      }
    );
  }

  /**
   * Delete patient (soft delete)
   */
  async deletePatient(patientId: string): Promise<ApiResponse<null>> {
    return this.makeRequest<ApiResponse<null>>(`/patients/${patientId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Search patients with query string
   */
  async searchPatients(query: string): Promise<unknown> {
    try {
      if (!query || query.trim().length < 2) {
        return { patients: [], total: 0, query: '' };
      }

      // Log the search request

      const result = await this.makeRequest<any>(
        `/patients/search?q=${encodeURIComponent(query)}`
      );

      // Debug the response structure

      // Handle the backend response structure
      // Backend returns: { success: true, data: { patients: [...], total: X, query: "..." } }
      // Return the data portion directly for the search hook to process
      const searchData = result.data || { patients: [], total: 0, query: query };

      // Fix missing _id fields by using mrn as fallback
      if (searchData.patients && Array.isArray(searchData.patients)) {
        searchData.patients = searchData.patients.map((patient: any) => {
          // If _id is missing but mrn exists, use mrn as _id
          if (!patient._id && patient.mrn) {

            patient._id = patient.mrn;
          }
          return patient;
        });
      }

      // Debug the actual patient data being returned

      return searchData;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  /**
   * Search patients with query string - typed version
   */
  async searchPatientsTyped(query: string): Promise<{ patients: any[]; total: number; query: string }> {
    try {
      if (!query || query.trim().length < 2) {
        return { patients: [], total: 0, query: '' };
      }

      // Log the search request

      const result = await this.makeRequest<any>(
        `/patients/search?q=${encodeURIComponent(query)}`
      );

      // Debug the response structure

      // Handle different response structures
      const patients = (result as any)?.data?.patients || (result as any)?.patients || [];
      const total = (result as any)?.data?.total || (result as any)?.total || patients.length;

      return {
        patients,
        total,
        query,
      };
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  // =============================================
  // ALLERGY MANAGEMENT
  // =============================================

  /**
   * Get patient allergies
   */
  async getAllergies(
    patientId: string,
    params: AllergySearchParams = {}
  ): Promise<PaginatedResponse<Allergy>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return this.makeRequest<PaginatedResponse<Allergy>>(
      `/patients/${patientId}/allergies?${searchParams.toString()}`
    );
  }

  /**
   * Get critical allergies (severe) for patient
   */
  async getCriticalAllergies(
    patientId: string
  ): Promise<ApiResponse<{ allergies: Allergy[]; summary: unknown }>> {
    return this.makeRequest<
      ApiResponse<{ allergies: Allergy[]; summary: unknown }>
    >(`/patients/${patientId}/allergies/critical`);
  }

  /**
   * Create new allergy
   */
  async createAllergy(
    patientId: string,
    allergyData: CreateAllergyData
  ): Promise<ApiResponse<{ allergy: Allergy }>> {
    return this.makeRequest<ApiResponse<{ allergy: Allergy }>>(
      `/patients/${patientId}/allergies`,
      {
        method: 'POST',
        body: JSON.stringify(allergyData),
      }
    );
  }

  /**
   * Update allergy
   */
  async updateAllergy(
    allergyId: string,
    allergyData: UpdateAllergyData
  ): Promise<ApiResponse<{ allergy: Allergy }>> {
    return this.makeRequest<ApiResponse<{ allergy: Allergy }>>(
      `/allergies/${allergyId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(allergyData),
      }
    );
  }

  /**
   * Delete allergy
   */
  async deleteAllergy(allergyId: string): Promise<ApiResponse<null>> {
    return this.makeRequest<ApiResponse<null>>(`/allergies/${allergyId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Search allergies by substance
   */
  async searchAllergies(
    substance: string,
    limit = 10
  ): Promise<ApiResponse<{ results: unknown[] }>> {
    return this.makeRequest<ApiResponse<{ results: unknown[] }>>(
      `/allergies/search?substance=${encodeURIComponent(
        substance
      )}&limit=${limit}`
    );
  }

  // =============================================
  // CONDITION MANAGEMENT
  // =============================================

  /**
   * Get patient conditions
   */
  async getConditions(
    patientId: string,
    params: { status?: string; page?: number; limit?: number } = {}
  ): Promise<PaginatedResponse<Condition>> {
    try {
      const searchParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });

      // Add defensive URL encoding for patientId
      const encodedPatientId = encodeURIComponent(patientId);
      const queryString = searchParams.toString();
      const url = `/patients/${encodedPatientId}/conditions${queryString ? `?${queryString}` : ''
        }`;

      return await this.makeRequest<PaginatedResponse<Condition>>(url);
    } catch (error) {
      console.error('Error fetching conditions:', error);
      // Return empty data structure instead of throwing with proper structure
      return {
        data: { results: [] },
        meta: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
        success: true,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Create new condition
   */
  async createCondition(
    patientId: string,
    conditionData: CreateConditionData
  ): Promise<ApiResponse<{ condition: Condition }>> {
    try {

      const response = await this.makeRequest<
        ApiResponse<{ condition: Condition }>
      >(`/patients/${patientId}/conditions`, {
        method: 'POST',
        body: JSON.stringify(conditionData),
      });

      return response;
    } catch (error) {
      console.error('Error creating condition:', error);
      throw error;
    }
  }

  /**
   * Update condition
   */
  async updateCondition(
    conditionId: string,
    conditionData: UpdateConditionData
  ): Promise<ApiResponse<{ condition: Condition }>> {
    return this.makeRequest<ApiResponse<{ condition: Condition }>>(
      `/conditions/${conditionId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(conditionData),
      }
    );
  }

  /**
   * Delete condition
   */
  async deleteCondition(conditionId: string): Promise<ApiResponse<null>> {
    return this.makeRequest<ApiResponse<null>>(`/conditions/${conditionId}`, {
      method: 'DELETE',
    });
  }

  // =============================================
  // MEDICATION MANAGEMENT
  // =============================================

  /**
   * Get patient medications
   */
  async getMedications(
    patientId: string,
    params: MedicationSearchParams = {}
  ): Promise<PaginatedResponse<MedicationRecord>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return this.makeRequest<PaginatedResponse<MedicationRecord>>(
      `/patients/${patientId}/medications?${searchParams.toString()}`
    );
  }

  /**
   * Create new medication
   */
  async createMedication(
    patientId: string,
    medicationData: CreateMedicationData
  ): Promise<ApiResponse<{ medication: MedicationRecord }>> {
    try {

      const response = await this.makeRequest<
        ApiResponse<{ medication: MedicationRecord }>
      >(`/patients/${patientId}/medications`, {
        method: 'POST',
        body: JSON.stringify(medicationData),
      });

      return response;
    } catch (error) {
      console.error('Error creating medication:', error);
      throw error;
    }
  }

  /**
   * Update medication
   */
  async updateMedication(
    medicationId: string,
    medicationData: UpdateMedicationData
  ): Promise<ApiResponse<{ medication: MedicationRecord }>> {
    return this.makeRequest<ApiResponse<{ medication: MedicationRecord }>>(
      `/medications/${medicationId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(medicationData),
      }
    );
  }

  /**
   * Delete medication
   */
  async deleteMedication(medicationId: string): Promise<ApiResponse<null>> {
    return this.makeRequest<ApiResponse<null>>(`/medications/${medicationId}`, {
      method: 'DELETE',
    });
  }

  // =============================================
  // CLINICAL ASSESSMENT MANAGEMENT
  // =============================================

  /**
   * Get patient clinical assessments
   */
  async getAssessments(
    patientId: string,
    params: { page?: number; limit?: number } = {}
  ): Promise<PaginatedResponse<ClinicalAssessment>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return this.makeRequest<PaginatedResponse<ClinicalAssessment>>(
      `/patients/${patientId}/assessments?${searchParams.toString()}`
    );
  }

  /**
   * Create new clinical assessment
   */
  async createAssessment(
    patientId: string,
    assessmentData: CreateAssessmentData
  ): Promise<ApiResponse<{ assessment: ClinicalAssessment }>> {
    try {

      const response = await this.makeRequest<
        ApiResponse<{ assessment: ClinicalAssessment }>
      >(`/patients/${patientId}/assessments`, {
        method: 'POST',
        body: JSON.stringify(assessmentData),
      });

      return response;
    } catch (error) {
      console.error('Error creating assessment:', error);
      throw error;
    }
  }

  /**
   * Update clinical assessment
   */
  async updateAssessment(
    assessmentId: string,
    assessmentData: UpdateAssessmentData
  ): Promise<ApiResponse<{ assessment: ClinicalAssessment }>> {
    return this.makeRequest<ApiResponse<{ assessment: ClinicalAssessment }>>(
      `/assessments/${assessmentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(assessmentData),
      }
    );
  }

  // =============================================
  // DRUG THERAPY PROBLEM (DTP) MANAGEMENT
  // =============================================

  /**
   * Get patient DTPs
   */
  async getDTPs(
    patientId: string,
    params: DTPSearchParams = {}
  ): Promise<PaginatedResponse<DrugTherapyProblem>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return this.makeRequest<PaginatedResponse<DrugTherapyProblem>>(
      `/patients/${patientId}/dtps?${searchParams.toString()}`
    );
  }

  /**
   * Create new DTP
   */
  async createDTP(
    patientId: string,
    dtpData: CreateDTPData
  ): Promise<ApiResponse<{ dtp: DrugTherapyProblem }>> {
    try {

      const response = await this.makeRequest<
        ApiResponse<{ dtp: DrugTherapyProblem }>
      >(`/patients/${patientId}/dtps`, {
        method: 'POST',
        body: JSON.stringify(dtpData),
      });

      return response;
    } catch (error) {
      console.error('Error saving DTP:', error);
      throw error;
    }
  }

  /**
   * Update DTP
   */
  async updateDTP(
    dtpId: string,
    dtpData: UpdateDTPData
  ): Promise<ApiResponse<{ dtp: DrugTherapyProblem }>> {
    return this.makeRequest<ApiResponse<{ dtp: DrugTherapyProblem }>>(
      `/dtps/${dtpId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(dtpData),
      }
    );
  }

  // =============================================
  // CARE PLAN MANAGEMENT
  // =============================================

  /**
   * Get patient care plans
   */
  async getCarePlans(
    patientId: string,
    params: { page?: number; limit?: number } = {}
  ): Promise<PaginatedResponse<CarePlan>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return this.makeRequest<PaginatedResponse<CarePlan>>(
      `/patients/${patientId}/careplans?${searchParams.toString()}`
    );
  }

  /**
   * Create new care plan
   */
  async createCarePlan(
    patientId: string,
    carePlanData: CreateCarePlanData
  ): Promise<ApiResponse<{ carePlan: CarePlan }>> {
    return this.makeRequest<ApiResponse<{ carePlan: CarePlan }>>(
      `/patients/${patientId}/careplans`,
      {
        method: 'POST',
        body: JSON.stringify(carePlanData),
      }
    );
  }

  /**
   * Update care plan
   */
  async updateCarePlan(
    carePlanId: string,
    carePlanData: UpdateCarePlanData
  ): Promise<ApiResponse<{ carePlan: CarePlan }>> {
    return this.makeRequest<ApiResponse<{ carePlan: CarePlan }>>(
      `/careplans/${carePlanId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(carePlanData),
      }
    );
  }

  // =============================================
  // VISIT MANAGEMENT
  // =============================================

  /**
   * Get patient visits
   */
  async getVisits(
    patientId: string,
    params: { page?: number; limit?: number } = {}
  ): Promise<PaginatedResponse<Visit>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return this.makeRequest<PaginatedResponse<Visit>>(
      `/patients/${patientId}/visits?${searchParams.toString()}`
    );
  }

  /**
   * Get visit details
   */
  async getVisit(visitId: string): Promise<ApiResponse<{ visit: Visit }>> {
    return this.makeRequest<ApiResponse<{ visit: Visit }>>(
      `/visits/${visitId}`
    );
  }

  /**
   * Create new visit
   */
  async createVisit(
    patientId: string,
    visitData: CreateVisitData
  ): Promise<ApiResponse<{ visit: Visit }>> {
    return this.makeRequest<ApiResponse<{ visit: Visit }>>(
      `/patients/${patientId}/visits`,
      {
        method: 'POST',
        body: JSON.stringify(visitData),
      }
    );
  }

  /**
   * Update visit
   */
  async updateVisit(
    visitId: string,
    visitData: UpdateVisitData
  ): Promise<ApiResponse<{ visit: Visit }>> {
    return this.makeRequest<ApiResponse<{ visit: Visit }>>(
      `/visits/${visitId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(visitData),
      }
    );
  }

  /**
   * Add attachment to visit
   */
  async addVisitAttachment(
    visitId: string,
    attachmentData: Omit<VisitAttachment, 'uploadedAt'>
  ): Promise<ApiResponse<{ visit: Visit }>> {
    return this.makeRequest<ApiResponse<{ visit: Visit }>>(
      `/visits/${visitId}/attachments`,
      {
        method: 'POST',
        body: JSON.stringify(attachmentData),
      }
    );
  }

  /**
   * Create visit from appointment data
   */
  async createVisitFromAppointment(
    patientId: string,
    appointmentId: string,
    appointmentData: {
      type: string;
      notes?: string;
      nextActions?: string[];
      scheduledDate: string;
      scheduledTime: string;
    }
  ): Promise<ApiResponse<{ visit: Visit }>> {
    const visitData: CreateVisitData = {
      date: new Date().toISOString(), // Current date/time for the visit
      soap: {
        subjective: '', // Will be filled by pharmacist
        objective: '', // Will be filled by pharmacist
        assessment: appointmentData.notes || '', // Pre-populate with appointment outcome notes
        plan: appointmentData.nextActions?.join('; ') || '', // Pre-populate with next actions
      },
      attachments: [],
    };

    return this.makeRequest<ApiResponse<{ visit: Visit }>>(
      `/patients/${patientId}/visits`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...visitData,
          appointmentId, // Link to the appointment
        }),
      }
    );
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  // =============================================
  // CLINICAL INTERVENTION INTEGRATION
  // =============================================

  /**
   * Get patient interventions
   */
  async getPatientInterventions(
    patientId: string,
    params: {
      page?: number;
      limit?: number;
      status?: string;
      category?: string;
    } = {}
  ): Promise<PaginatedResponse<any>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return this.makeRequest<PaginatedResponse<any>>(
      `/patients/${patientId}/interventions?${searchParams.toString()}`
    );
  }

  /**
   * Search patients with intervention context
   */
  async searchPatientsWithInterventions(
    query: string,
    limit = 10
  ): Promise<
    ApiResponse<{
      patients: Array<{
        _id: string;
        firstName: string;
        lastName: string;
        mrn: string;
        displayName: string;
        age?: number;
        interventionCount: number;
        activeInterventionCount: number;
        lastInterventionDate?: string;
      }>;
    }>
  > {
    return this.makeRequest<
      ApiResponse<{
        patients: Array<{
          _id: string;
          firstName: string;
          lastName: string;
          mrn: string;
          displayName: string;
          age?: number;
          interventionCount: number;
          activeInterventionCount: number;
          lastInterventionDate?: string;
        }>;
      }>
    >(
      `/patients/search-with-interventions?q=${encodeURIComponent(
        query
      )}&limit=${limit}`
    );
  }

  /**
   * Upload file and return URL (for attachments, etc.)
   */
  async uploadFile(
    file: File
  ): Promise<{ url: string; fileName: string; fileSize: number }> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return {
        url: response.data.url,
        fileName: file.name,
        fileSize: file.size,
      };
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error?.message || 'File upload failed'
      );
    }
  }

  /**
   * Get patients for dashboard with proper typing
   */
  async getDashboardPatients(limit = 10): Promise<{ patients: Patient[]; total: number }> {
    try {
      const result = await this.getPatients({ limit, page: 1 });

      return {
        patients: result.data?.results || [],
        total: result.meta?.total || 0,
      };
    } catch (error) {
      console.error('Error fetching dashboard patients:', error);
      return {
        patients: [],
        total: 0,
      };
    }
  }
}

// Create a singleton instance
const patientServiceInstance = new PatientService();

// Export as a named export
export const patientService = patientServiceInstance;

// Also export as default
export default patientServiceInstance;
