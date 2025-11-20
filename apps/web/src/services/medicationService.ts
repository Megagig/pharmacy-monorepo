import api, { ApiResponse } from './api';

export interface Medication {
  _id: string;
  patientId: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  startDate: string;
  endDate?: string;
  prescribedBy: string;
  instructions: string;
  status: 'active' | 'completed' | 'discontinued' | 'paused';
  sideEffects: string[];
  interactions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MedicationCreateData {
  patientId: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  startDate: string;
  endDate?: string;
  prescribedBy: string;
  instructions: string;
  sideEffects?: string[];
  interactions?: string[];
}

export interface MedicationsResponse {
  medications: Medication[];
  total: number;
  page: number;
  limit: number;
}

class MedicationService {
  async getMedications(params?: {
    patientId?: string;
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.patientId) searchParams.append('patientId', params.patientId);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);

    const response = await api.get<ApiResponse<MedicationsResponse>>(
      `/medications?${searchParams.toString()}`
    );
    return response.data;
  }

  async getMedication(id: string) {
    const response = await api.get<ApiResponse<Medication>>(`/medications/${id}`);
    return response.data;
  }

  async createMedication(data: MedicationCreateData) {
    const response = await api.post<ApiResponse<Medication>>('/medications', data);
    return response.data;
  }

  async updateMedication(id: string, data: Partial<MedicationCreateData>) {
    const response = await api.put<ApiResponse<Medication>>(`/medications/${id}`, data);
    return response.data;
  }

  async deleteMedication(id: string) {
    const response = await api.delete<ApiResponse<void>>(`/medications/${id}`);
    return response.data;
  }

  async getMedicationsByPatient(patientId: string) {
    const response = await api.get<ApiResponse<Medication[]>>(
      `/medications/patient/${patientId}`
    );
    return response.data;
  }

  async updateMedicationStatus(id: string, status: 'active' | 'completed' | 'discontinued' | 'paused') {
    const response = await api.patch<ApiResponse<Medication>>(`/medications/${id}/status`, { status });
    return response.data;
  }
}

export const medicationService = new MedicationService();
export default medicationService;