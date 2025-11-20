import {
  Patient as StorePatient,
  PatientFormData as StorePatientFormData,
} from '../stores/types';
import {
  Patient as ApiPatient,
  CreatePatientData as ApiCreatePatientData,
} from '../types/patientManagement';

/**
 * Converts the API Patient model to the Store Patient model
 */
export const apiToStorePatient = (apiPatient: ApiPatient): StorePatient => {
  return {
    _id: apiPatient._id.toString(),
    firstName: apiPatient.firstName,
    lastName: apiPatient.lastName,
    email: apiPatient.email,
    phone: apiPatient.phone || '',
    dateOfBirth: apiPatient.dob || '',
    address: apiPatient.address
      ? {
        street: apiPatient.address,
        city: '',
        state: apiPatient.state || '',
        zipCode: '',
      }
      : undefined,
    medicalHistory: '',
    allergies: [],
    createdAt: apiPatient.createdAt || new Date().toISOString(),
    updatedAt: apiPatient.updatedAt || new Date().toISOString(),
  };
};

/**
 * Converts a collection of API Patient models to Store Patient models
 */
export const apiToStorePatients = (
  apiPatients: ApiPatient[]
): StorePatient[] => {
  return apiPatients.map(apiToStorePatient);
};

/**
 * Converts the API Patient response with wrapper to Store Patient
 */
export const apiResponseToStorePatient = (response: {
  patient: ApiPatient;
}): StorePatient => {
  return apiToStorePatient(response.patient);
};

/**
 * Converts Store PatientFormData to API CreatePatientData
 */
export const storeFormToApiCreateData = (
  formData: StorePatientFormData
): ApiCreatePatientData => {
  // Concatenate address fields into a single string
  const address = formData.address
    ? [
      formData.address.street,
      formData.address.city,
      formData.address.state,
      formData.address.zipCode,
    ]
      .filter(Boolean)
      .join(', ')
    : undefined;

  // Convert dateOfBirth to ISO datetime string if it's a valid date
  let dobIso: string | undefined;
  if (formData.dateOfBirth) {
    try {
      const dateObj = new Date(formData.dateOfBirth);
      // Check if date is valid
      if (!isNaN(dateObj.getTime())) {
        dobIso = dateObj.toISOString();
      }
    } catch (error) {
      console.error('Invalid date format:', formData.dateOfBirth);
    }
  }

  // Format phone number to Nigerian E.164 format if provided
  let formattedPhone: string | undefined;
  if (formData.phone) {
    const phone = formData.phone.trim();
    // If phone doesn't start with +234, try to format it
    if (phone && !phone.startsWith('+234')) {
      // Remove any non-digit characters
      const digits = phone.replace(/\D/g, '');
      // If starts with 0, replace with +234
      if (digits.startsWith('0') && digits.length === 11) {
        formattedPhone = '+234' + digits.substring(1);
      } else if (digits.startsWith('234') && digits.length === 13) {
        formattedPhone = '+' + digits;
      } else if (digits.length === 10) {
        formattedPhone = '+234' + digits;
      } else {
        // Keep original if we can't format it
        formattedPhone = phone;
      }
    } else {
      formattedPhone = phone;
    }
  }

  return {
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email || undefined,
    phone: formattedPhone,
    dob: dobIso,
    address,
    // Map other fields as needed
  };
};
