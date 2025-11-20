import api from '../lib/api';
import {
  ClinicalNote,
  ClinicalNoteFormData,
  ClinicalNoteFilters,
  ClinicalNotesResponse,
  BulkUpdateData,
  NoteStatistics,
  Attachment
} from '../types/clinicalNote';

class ClinicalNoteService {
  private readonly baseUrl = '/notes';

  /**
   * Get notes with enhanced filtering and pagination
   */
  async getNotes(filters: ClinicalNoteFilters = {}): Promise<ClinicalNotesResponse> {
    try {
      const searchParams = new URLSearchParams();

      // Add all filter parameters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(item => searchParams.append(key, item.toString()));
          } else {
            searchParams.append(key, value.toString());
          }
        }
      });

      const response = await api.get<ClinicalNotesResponse>(
        `${this.baseUrl}?${searchParams.toString()}`
      );
      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to fetch clinical notes');
    }
  }

  /**
   * Search notes with full-text search
   */
  async searchNotes(query: string, filters: Omit<ClinicalNoteFilters, 'search'> = {}): Promise<ClinicalNotesResponse> {
    try {
      const searchParams = new URLSearchParams({ query });

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(item => searchParams.append(key, item.toString()));
          } else {
            searchParams.append(key, value.toString());
          }
        }
      });

      const response = await api.get<ClinicalNotesResponse>(
        `${this.baseUrl}/search?${searchParams.toString()}`
      );
      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to search clinical notes');
    }
  }

  /**
   * Get notes with advanced filtering
   */
  async getNotesWithFilters(filters: ClinicalNoteFilters): Promise<ClinicalNotesResponse> {
    try {
      const searchParams = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(item => searchParams.append(key, item.toString()));
          } else {
            searchParams.append(key, value.toString());
          }
        }
      });

      const response = await api.get<ClinicalNotesResponse>(
        `${this.baseUrl}/filter?${searchParams.toString()}`
      );
      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to filter clinical notes');
    }
  }

  /**
   * Get a single note by ID
   */
  async getNote(id: string): Promise<{ note: ClinicalNote }> {
    try {
      const response = await api.get<{ note: ClinicalNote }>(`${this.baseUrl}/${id}`);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to fetch clinical note');
    }
  }

  /**
   * Create a new clinical note
   */
  async createNote(data: ClinicalNoteFormData): Promise<{ note: ClinicalNote }> {
    try {
      const response = await api.post<{ note: ClinicalNote }>(`${this.baseUrl}`, data);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to create clinical note');
    }
  }

  /**
   * Update an existing clinical note
   */
  async updateNote(id: string, data: Partial<ClinicalNoteFormData>): Promise<{ note: ClinicalNote }> {
    try {
      const response = await api.put<{ note: ClinicalNote }>(`${this.baseUrl}/${id}`, data);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to update clinical note');
    }
  }

  /**
   * Delete a clinical note (soft delete)
   */
  async deleteNote(id: string): Promise<{ message: string }> {
    try {
      const response = await api.delete<{ message: string }>(`${this.baseUrl}/${id}`);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to delete clinical note');
    }
  }

  /**
   * Get notes for a specific patient
   */
  async getPatientNotes(patientId: string, filters: Omit<ClinicalNoteFilters, 'patientId'> = {}): Promise<ClinicalNotesResponse> {
    try {
      const searchParams = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(item => searchParams.append(key, item.toString()));
          } else {
            searchParams.append(key, value.toString());
          }
        }
      });

      const url = `${this.baseUrl}/patient/${patientId}?${searchParams.toString()}`;

      const response = await api.get<ClinicalNotesResponse>(url);

      return response.data;
    } catch (error: any) {
      console.error('Clinical Notes Service: Failed to fetch patient notes', {
        patientId,
        error: error.message,
        status: error.response?.status
      });
      throw this.handleError(error, 'Failed to fetch patient notes');
    }
  }

  /**
   * Bulk update multiple notes
   */
  async bulkUpdateNotes(data: BulkUpdateData): Promise<{
    message: string;
    modifiedCount: number;
    matchedCount: number;
    notes: ClinicalNote[];
  }> {
    try {
      const response = await api.post<{
        message: string;
        modifiedCount: number;
        matchedCount: number;
        notes: ClinicalNote[];
      }>(`${this.baseUrl}/bulk/update`, data);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to bulk update notes');
    }
  }

  /**
   * Bulk delete multiple notes
   */
  async bulkDeleteNotes(noteIds: string[]): Promise<{
    message: string;
    deletedCount: number;
  }> {
    try {
      const response = await api.post<{
        message: string;
        deletedCount: number;
      }>(`${this.baseUrl}/bulk/delete`, { noteIds });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to bulk delete notes');
    }
  }

  /**
   * Upload attachment to a note
   */
  async uploadAttachment(noteId: string, files: File[]): Promise<{
    message: string;
    attachments: Attachment[];
    note: ClinicalNote;
  }> {
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await api.post<{
        message: string;
        attachments: Attachment[];
        note: ClinicalNote;
      }>(`${this.baseUrl}/${noteId}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to upload attachment');
    }
  }

  /**
   * Delete attachment from a note
   */
  async deleteAttachment(noteId: string, attachmentId: string): Promise<{
    message: string;
    note: ClinicalNote;
  }> {
    try {
      const response = await api.delete<{
        message: string;
        note: ClinicalNote;
      }>(`${this.baseUrl}/${noteId}/attachments/${attachmentId}`);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to delete attachment');
    }
  }

  /**
   * Download attachment from a note
   */
  async downloadAttachment(noteId: string, attachmentId: string): Promise<Blob> {
    try {
      const response = await api.get(`${this.baseUrl}/${noteId}/attachments/${attachmentId}/download`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to download attachment');
    }
  }

  /**
   * Get note statistics
   */
  async getNoteStatistics(filters: { dateFrom?: string; dateTo?: string } = {}): Promise<NoteStatistics> {
    try {
      const searchParams = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString());
        }
      });

      const response = await api.get<NoteStatistics>(
        `${this.baseUrl}/statistics?${searchParams.toString()}`
      );
      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to fetch note statistics');
    }
  }

  /**
   * Handle API errors with proper error transformation
   */
  private handleError(error: any, defaultMessage: string): Error {
    console.error('Clinical Notes Service Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      url: error.config?.url,
      method: error.config?.method
    });

    // Create enhanced error with response details
    const enhancedError = new Error(
      error.response?.data?.message || error.message || defaultMessage
    ) as any;

    // Preserve response details for better error handling
    enhancedError.response = error.response;
    enhancedError.status = error.response?.status;

    return enhancedError;
  }

  /**
   * Retry logic for failed requests
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        lastError = error;

        // Don't retry on client errors (4xx)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          throw error;
        }

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Get notes with retry logic
   */
  async getNotesWithRetry(filters: ClinicalNoteFilters = {}): Promise<ClinicalNotesResponse> {
    return this.withRetry(() => this.getNotes(filters));
  }

  /**
   * Create note with retry logic
   */
  async createNoteWithRetry(data: ClinicalNoteFormData): Promise<{ note: ClinicalNote }> {
    return this.withRetry(() => this.createNote(data));
  }

  /**
   * Update note with retry logic
   */
  async updateNoteWithRetry(id: string, data: Partial<ClinicalNoteFormData>): Promise<{ note: ClinicalNote }> {
    return this.withRetry(() => this.updateNote(id, data));
  }
}

// Utility functions for working with clinical notes
export const clinicalNoteUtils = {
  /**
   * Format note content for display
   */
  formatNoteContent(content: ClinicalNote['content']): string {
    const sections = [];
    if (content.subjective) sections.push(`**Subjective:** ${content.subjective}`);
    if (content.objective) sections.push(`**Objective:** ${content.objective}`);
    if (content.assessment) sections.push(`**Assessment:** ${content.assessment}`);
    if (content.plan) sections.push(`**Plan:** ${content.plan}`);
    return sections.join('\n\n');
  },

  /**
   * Get note type display name
   */
  getTypeDisplayName(type: ClinicalNote['type']): string {
    const typeMap = {
      consultation: 'Consultation',
      medication_review: 'Medication Review',
      follow_up: 'Follow-up',
      adverse_event: 'Adverse Event',
      other: 'Other'
    };
    return typeMap[type] || type;
  },

  /**
   * Get priority display name and color
   */
  getPriorityInfo(priority: ClinicalNote['priority']): { name: string; color: string } {
    const priorityMap = {
      low: { name: 'Low', color: '#4caf50' },
      medium: { name: 'Medium', color: '#ff9800' },
      high: { name: 'High', color: '#f44336' }
    };
    return priorityMap[priority] || { name: priority, color: '#757575' };
  },

  /**
   * Check if note has attachments
   */
  hasAttachments(note: ClinicalNote): boolean {
    return note.attachments && note.attachments.length > 0;
  },

  /**
   * Get attachment count
   */
  getAttachmentCount(note: ClinicalNote): number {
    return note.attachments?.length || 0;
  },

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Validate note form data
   */
  validateNoteData(data: ClinicalNoteFormData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.patient) errors.push('Patient is required');
    if (!data.title?.trim()) errors.push('Title is required');
    if (!data.type) errors.push('Note type is required');

    // Validate content has at least one section
    const hasContent = data.content && (
      data.content.subjective?.trim() ||
      data.content.objective?.trim() ||
      data.content.assessment?.trim() ||
      data.content.plan?.trim()
    );
    if (!hasContent) errors.push('At least one content section is required');

    // Validate follow-up date if follow-up is required
    if (data.followUpRequired && !data.followUpDate) {
      errors.push('Follow-up date is required when follow-up is marked as required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Create empty note form data
   */
  createEmptyNoteData(patientId?: string): ClinicalNoteFormData {
    return {
      patient: patientId || '',
      type: 'consultation',
      title: '',
      content: {
        subjective: '',
        objective: '',
        assessment: '',
        plan: ''
      },
      medications: [],
      laborResults: [],
      recommendations: [],
      followUpRequired: false,
      priority: 'medium',
      isConfidential: false,
      tags: []
    };
  },

  /**
   * Check if user can edit note
   */
  canEditNote(note: ClinicalNote, currentUserId: string): boolean {
    return note.pharmacist._id === currentUserId && !note.deletedAt;
  },

  /**
   * Check if user can delete note
   */
  canDeleteNote(note: ClinicalNote, currentUserId: string): boolean {
    return note.pharmacist._id === currentUserId && !note.deletedAt;
  }
};

// Create and export service instance
export const clinicalNoteService = new ClinicalNoteService();
export default clinicalNoteService;