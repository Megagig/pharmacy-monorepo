import { Patient } from '../stores/types';

export interface StorePatient {
  _id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  medicalHistory?: string[];
  allergies?: string[];
  currentMedications?: string[];
  createdAt: string;
  updatedAt: string;
}

export const convertPatientToStoreType = (patient: Patient): StorePatient => {
  return {
    _id: patient._id,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: typeof patient.dateOfBirth === 'string' 
      ? new Date(patient.dateOfBirth) 
      : patient.dateOfBirth,
    email: patient.email,
    phone: patient.phone || '',
    address: patient.address,
    medicalHistory: patient.medicalHistory ? [patient.medicalHistory] : [],
    allergies: patient.allergies || [],
    currentMedications: [],
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  };
};

export const formatPatientName = (patient: Patient | StorePatient): string => {
  return `${patient.firstName} ${patient.lastName}`;
};

export const formatPatientAge = (dateOfBirth: Date | string): number => {
  const birthDate = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

export const formatPatientDisplay = (patient: Patient | StorePatient): string => {
  const age = formatPatientAge(patient.dateOfBirth);
  return `${formatPatientName(patient)} (Age: ${age})`;
};

export const convertStorePatientToPatient = (storePatient: StorePatient): Patient => {
  return {
    _id: storePatient._id,
    firstName: storePatient.firstName,
    lastName: storePatient.lastName,
    email: storePatient.email,
    phone: storePatient.phone || '',
    dateOfBirth: typeof storePatient.dateOfBirth === 'string' 
      ? storePatient.dateOfBirth 
      : storePatient.dateOfBirth.toISOString().split('T')[0],
    address: storePatient.address,
    medicalHistory: storePatient.medicalHistory?.[0],
    allergies: storePatient.allergies,
    emergencyContact: undefined,
    createdAt: storePatient.createdAt,
    updatedAt: storePatient.updatedAt,
  };
};