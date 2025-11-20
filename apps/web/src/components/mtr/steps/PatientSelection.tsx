import React from 'react';
import { Patient } from '../../../stores/types';
import MainPatientSelection from '../../PatientSelection';
import type { Patient as PatientManagementPatient } from '../../../types/patientManagement';

interface PatientSelectionProps {
  onPatientSelect: (patient: Patient) => void;
  onNext?: () => void;
  selectedPatient?: Patient | null;
}

const PatientSelection: React.FC<PatientSelectionProps> = ({
  onPatientSelect,
  onNext,
  selectedPatient,
}) => {
  const handlePatientSelect = (patient: PatientManagementPatient) => {
    // Convert from patientManagement.Patient to stores.Patient
    const storePatient: Patient = {
      _id: patient._id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.email,
      phone: patient.phone || '', // Ensure phone is never undefined
      dateOfBirth: patient.dob || '', // Map dob to dateOfBirth, ensure it's never undefined
      address: {
        street: patient.address || '',
        city: '',
        state: patient.state || '',
        zipCode: '',
      },
      medicalHistory: '',
      allergies: [],
      emergencyContact: {
        name: '',
        phone: '',
        relationship: '',
      },
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt,
    };
    onPatientSelect(storePatient);
  };

  // Convert selectedPatient back to patientManagement.Patient if needed
  const convertedSelectedPatient: PatientManagementPatient | null = selectedPatient ? {
    _id: selectedPatient._id,
    pharmacyId: 'default' as any,
    firstName: selectedPatient.firstName,
    lastName: selectedPatient.lastName,
    otherNames: '',
    mrn: selectedPatient._id,
    dob: selectedPatient.dateOfBirth,
    email: selectedPatient.email,
    phone: selectedPatient.phone,
    address: selectedPatient.address?.street || '',
    state: selectedPatient.address?.state as any,
    createdAt: selectedPatient.createdAt,
    updatedAt: selectedPatient.updatedAt,
    createdBy: '',
    updatedBy: '',
  } : null;

  return (
    <MainPatientSelection
      onPatientSelect={handlePatientSelect}
      selectedPatient={convertedSelectedPatient}
      onNext={onNext}
    />
  );
};

export default PatientSelection;