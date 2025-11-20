import { apiClient } from './api';

export interface LicenseUpload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseType: 'pharmacist' | 'intern_pharmacist' | 'pharmacy_technician';
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  specializations?: string[];
  licenseDocument: File;
}

export interface LicenseStatus {
  _id: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  licenseNumber: string;
  licenseType: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  specializations: string[];
  licenseDocument: {
    fileName: string;
    uploadedAt: string;
  };
  reviewNotes?: string;
  reviewedBy?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseValidationResult {
  isValid: boolean;
  licenseNumber: string;
  holderName: string;
  licenseType: string;
  issueDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'suspended' | 'revoked';
  issuingAuthority: string;
  specializations: string[];
  validationSource: 'manual' | 'api' | 'database';
  validatedAt: string;
}

export const licenseService = {
  // Upload license for verification
  async uploadLicense(licenseData: LicenseUpload) {
    const formData = new FormData();

    // Append all text fields
    Object.entries(licenseData).forEach(([key, value]) => {
      if (key === 'licenseDocument') {
        formData.append('licenseDocument', value as File);
      } else if (key === 'specializations' && Array.isArray(value)) {
        formData.append('specializations', JSON.stringify(value));
      } else {
        formData.append(key, value as string);
      }
    });

    const response = await apiClient.post('/license/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get current user's license status
  async getLicenseStatus() {
    const response = await apiClient.get('/license/status');
    return response.data;
  },

  // Resubmit license after rejection
  async resubmitLicense(licenseData: Partial<LicenseUpload>) {
    const formData = new FormData();

    Object.entries(licenseData).forEach(([key, value]) => {
      if (key === 'licenseDocument' && value instanceof File) {
        formData.append('licenseDocument', value);
      } else if (key === 'specializations' && Array.isArray(value)) {
        formData.append('specializations', JSON.stringify(value));
      } else if (value !== undefined) {
        formData.append(key, value as string);
      }
    });

    const response = await apiClient.put('/license/resubmit', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Download license document
  async downloadLicenseDocument(licenseId?: string) {
    const endpoint = licenseId
      ? `/license/document/${licenseId}`
      : '/license/document';

    const response = await apiClient.get(endpoint, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Get license verification requirements
  async getVerificationRequirements() {
    const response = await apiClient.get('/license/requirements');
    return response.data;
  },

  // Validate license number (external API check)
  async validateLicenseNumber(licenseNumber: string, licenseType: string) {
    const response = await apiClient.post('/license/validate', {
      licenseNumber,
      licenseType
    });
    return response.data;
  },

  // Get license types and authorities
  async getLicenseTypes() {
    const response = await apiClient.get('/license/types');
    return response.data;
  },

  // Get issuing authorities
  async getIssuingAuthorities() {
    const response = await apiClient.get('/license/authorities');
    return response.data;
  },

  // Get license statistics (for dashboard)
  async getLicenseStatistics() {
    const response = await apiClient.get('/license/statistics');
    return response.data;
  },

  // Submit additional documentation
  async submitAdditionalDocs(documents: File[], notes?: string) {
    const formData = new FormData();

    documents.forEach((doc) => {
      formData.append(`documents`, doc);
    });

    if (notes) {
      formData.append('notes', notes);
    }

    const response = await apiClient.post('/license/additional-docs', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get license renewal information
  async getRenewalInfo() {
    const response = await apiClient.get('/license/renewal');
    return response.data;
  },

  // Submit license renewal
  async submitRenewal(renewalData: {
    newExpiryDate: string;
    renewalCertificate: File;
    continuingEducationHours?: number;
    renewalFeeReceipt?: File;
  }) {
    const formData = new FormData();

    formData.append('newExpiryDate', renewalData.newExpiryDate);
    formData.append('renewalCertificate', renewalData.renewalCertificate);

    if (renewalData.continuingEducationHours) {
      formData.append('continuingEducationHours', renewalData.continuingEducationHours.toString());
    }

    if (renewalData.renewalFeeReceipt) {
      formData.append('renewalFeeReceipt', renewalData.renewalFeeReceipt);
    }

    const response = await apiClient.post('/license/renewal/submit', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get license history
  async getLicenseHistory() {
    const response = await apiClient.get('/license/history');
    return response.data;
  },

  // Report license issues
  async reportLicenseIssue(issue: {
    type: 'lost' | 'damaged' | 'name_change' | 'address_change' | 'other';
    description: string;
    supportingDocuments?: File[];
  }) {
    const formData = new FormData();

    formData.append('type', issue.type);
    formData.append('description', issue.description);

    if (issue.supportingDocuments) {
      issue.supportingDocuments.forEach((doc) => {
        formData.append('supportingDocuments', doc);
      });
    }

    const response = await apiClient.post('/license/report-issue', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Check license expiry alerts
  async getExpiryAlerts() {
    const response = await apiClient.get('/license/expiry-alerts');
    return response.data;
  },

  // Update license preferences
  async updateLicensePreferences(preferences: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    reminderDays: number[];
    autoRenewalReminder: boolean;
  }) {
    const response = await apiClient.put('/license/preferences', preferences);
    return response.data;
  }
};