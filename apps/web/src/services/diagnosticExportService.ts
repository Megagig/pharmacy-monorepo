import { apiClient } from './apiClient';
import { DiagnosticHistoryItem } from './diagnosticHistoryService';

export interface ExportOptions {
  format: 'pdf' | 'docx' | 'json';
  purpose: 'referral' | 'patient_record' | 'consultation' | 'audit';
  includeNotes?: boolean;
  includeImages?: boolean;
  watermark?: boolean;
}

export interface ShareOptions {
  method: 'email' | 'secure_link' | 'fax';
  recipients: string[];
  message?: string;
  expiresIn?: number; // hours
  requirePassword?: boolean;
}

export interface PrintOptions {
  layout: 'portrait' | 'landscape';
  paperSize: 'A4' | 'Letter';
  includeHeader?: boolean;
  includeFooter?: boolean;
  sections: {
    summary: boolean;
    diagnosis: boolean;
    recommendations: boolean;
    notes: boolean;
    timeline: boolean;
  };
}

class DiagnosticExportService {
  /**
   * Export diagnostic history as PDF
   */
  async exportAsPDF(
    historyId: string,
    options: Partial<ExportOptions> = {}
  ): Promise<Blob> {
    const response = await apiClient.get(
      `/diagnostics/history/${historyId}/export/pdf`,
      {
        params: {
          purpose: options.purpose || 'patient_record',
          includeNotes: options.includeNotes ?? true,
          includeImages: options.includeImages ?? false,
          watermark: options.watermark ?? false,
        },
        responseType: 'blob',
        timeout: 60000,
      }
    );
    
    return response.data;
  }

  /**
   * Export diagnostic history as Word document
   */
  async exportAsWord(
    historyId: string,
    options: Partial<ExportOptions> = {}
  ): Promise<Blob> {
    const response = await apiClient.get(
      `/diagnostics/history/${historyId}/export/docx`,
      {
        params: {
          purpose: options.purpose || 'patient_record',
          includeNotes: options.includeNotes ?? true,
          includeImages: options.includeImages ?? false,
        },
        responseType: 'blob',
        timeout: 60000,
      }
    );
    
    return response.data;
  }

  /**
   * Export diagnostic history as JSON
   */
  async exportAsJSON(
    historyId: string,
    options: Partial<ExportOptions> = {}
  ): Promise<any> {
    const response = await apiClient.get(
      `/diagnostics/history/${historyId}/export/json`,
      {
        params: {
          purpose: options.purpose || 'audit',
          includeNotes: options.includeNotes ?? true,
        },
        timeout: 30000,
      }
    );
    
    return response.data.data;
  }

  /**
   * Generate print-optimized version
   */
  async generatePrintVersion(
    historyId: string,
    options: Partial<PrintOptions> = {}
  ): Promise<string> {
    const response = await apiClient.post(
      `/diagnostics/history/${historyId}/print`,
      {
        layout: options.layout || 'portrait',
        paperSize: options.paperSize || 'A4',
        includeHeader: options.includeHeader ?? true,
        includeFooter: options.includeFooter ?? true,
        sections: options.sections || {
          summary: true,
          diagnosis: true,
          recommendations: true,
          notes: true,
          timeline: false,
        },
      },
      {
        timeout: 30000,
      }
    );
    
    return response.data.data.printUrl;
  }

  /**
   * Share diagnostic history
   */
  async shareHistory(
    historyId: string,
    options: ShareOptions
  ): Promise<{
    shareId: string;
    shareUrl?: string;
    expiresAt: string;
  }> {
    const response = await apiClient.post(
      `/diagnostics/history/${historyId}/share`,
      {
        method: options.method,
        recipients: options.recipients,
        message: options.message,
        expiresIn: options.expiresIn || 24,
        requirePassword: options.requirePassword ?? false,
      },
      {
        timeout: 30000,
      }
    );
    
    return response.data.data;
  }

  /**
   * Generate referral document
   */
  async generateReferralDocument(
    historyId: string,
    specialty?: string
  ): Promise<{
    documentUrl: string;
    referralId: string;
  }> {
    const response = await apiClient.post(
      `/diagnostics/history/${historyId}/referral/generate`,
      {
        specialty,
      },
      {
        timeout: 30000,
      }
    );
    
    return response.data.data;
  }

  /**
   * Bulk export multiple histories
   */
  async bulkExport(
    historyIds: string[],
    format: 'pdf' | 'zip',
    options: Partial<ExportOptions> = {}
  ): Promise<Blob> {
    const response = await apiClient.post(
      '/diagnostics/history/bulk-export',
      {
        historyIds,
        format,
        purpose: options.purpose || 'patient_record',
        includeNotes: options.includeNotes ?? true,
      },
      {
        responseType: 'blob',
        timeout: 120000, // 2 minutes for bulk operations
      }
    );
    
    return response.data;
  }

  /**
   * Download file with proper filename
   */
  downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Generate filename based on history data
   */
  generateFilename(
    history: DiagnosticHistoryItem,
    format: string,
    purpose: string
  ): string {
    const date = new Date(history.createdAt).toISOString().split('T')[0];
    const patientName = `${history.patientId}`.replace(/[^a-zA-Z0-9]/g, '_');
    const caseId = history.caseId.replace(/[^a-zA-Z0-9]/g, '_');
    
    return `diagnostic_${purpose}_${patientName}_${caseId}_${date}.${format}`;
  }

  /**
   * Print diagnostic history
   */
  async printHistory(
    historyId: string,
    options: Partial<PrintOptions> = {}
  ): Promise<void> {
    const printUrl = await this.generatePrintVersion(historyId, options);
    
    // Open print dialog
    const printWindow = window.open(printUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  /**
   * Email diagnostic history
   */
  async emailHistory(
    historyId: string,
    recipients: string[],
    message?: string
  ): Promise<void> {
    await this.shareHistory(historyId, {
      method: 'email',
      recipients,
      message,
      expiresIn: 72, // 3 days
    });
  }

  /**
   * Create secure sharing link
   */
  async createSecureLink(
    historyId: string,
    expiresIn: number = 24,
    requirePassword: boolean = true
  ): Promise<string> {
    const result = await this.shareHistory(historyId, {
      method: 'secure_link',
      recipients: [],
      expiresIn,
      requirePassword,
    });
    
    return result.shareUrl || '';
  }

  /**
   * Generate comparison report
   */
  async generateComparisonReport(
    historyId1: string,
    historyId2: string,
    format: 'pdf' | 'docx' = 'pdf'
  ): Promise<Blob> {
    const response = await apiClient.post(
      '/diagnostics/history/compare/export',
      {
        historyId1,
        historyId2,
        format,
      },
      {
        responseType: 'blob',
        timeout: 60000,
      }
    );
    
    return response.data;
  }

  /**
   * Generate patient diagnostic timeline
   */
  async generateTimeline(
    patientId: string,
    format: 'pdf' | 'png' = 'pdf',
    dateRange?: {
      from: string;
      to: string;
    }
  ): Promise<Blob> {
    const response = await apiClient.post(
      `/diagnostics/patients/${patientId}/timeline/export`,
      {
        format,
        dateRange,
      },
      {
        responseType: 'blob',
        timeout: 60000,
      }
    );
    
    return response.data;
  }
}

export const diagnosticExportService = new DiagnosticExportService();
export default diagnosticExportService;