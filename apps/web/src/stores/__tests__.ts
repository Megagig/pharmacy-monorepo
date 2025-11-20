// Simple test to validate Zustand store implementation
// This file demonstrates how the stores work and can be used for testing

import { 
  usePatientStore, 
  useMedicationStore, 
  useClinicalNoteStore, 
  useUIStore 
} from '../stores';

// Test patient store functionality
export const testPatientStore = () => {
  console.log('Testing Patient Store...');
  
  const patientStore = usePatientStore.getState();
  
  // Test adding a patient to state
  const testPatient = {
    _id: 'test-1',
    firstName: 'John',
    lastName: 'Doe',
    phone: '123-456-7890',
    dateOfBirth: '1990-01-01',
    address: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '12345'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  patientStore.addPatientToState(testPatient);
  
  const { patients } = usePatientStore.getState();
  console.log('Patients after adding:', patients.length);
  
  return patients.length > 0;
};

// Test medication store functionality
export const testMedicationStore = () => {
  console.log('Testing Medication Store...');
  
  const medicationStore = useMedicationStore.getState();
  
  // Test adding a medication to state
  const testMedication = {
    _id: 'med-1',
    patientId: 'test-1',
    name: 'Aspirin',
    dosage: '81mg',
    frequency: 'Once daily',
    instructions: 'Take with food',
    prescribedDate: new Date().toISOString(),
    status: 'active' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  medicationStore.addMedicationToState(testMedication);
  
  const { medications } = useMedicationStore.getState();
  console.log('Medications after adding:', medications.length);
  
  // Test analytics function
  const activeCount = medicationStore.getActiveMedicationsCount();
  console.log('Active medications count:', activeCount);
  
  return medications.length > 0 && activeCount === 1;
};

// Test clinical note store functionality
export const testClinicalNoteStore = () => {
  console.log('Testing Clinical Note Store...');
  
  const noteStore = useClinicalNoteStore.getState();
  
  // Test adding a note to state
  const testNote = {
    _id: 'note-1',
    patientId: 'test-1',
    title: 'Initial Consultation',
    content: 'Patient presents with...',
    type: 'consultation' as const,
    tags: ['consultation', 'initial'],
    isPrivate: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  noteStore.addNoteToState(testNote);
  
  const { notes } = useClinicalNoteStore.getState();
  console.log('Notes after adding:', notes.length);
  
  // Test analytics function
  const allTags = noteStore.getAllTags();
  console.log('All tags:', allTags);
  
  return notes.length > 0 && allTags.length > 0;
};

// Test UI store functionality
export const testUIStore = () => {
  console.log('Testing UI Store...');
  
  const uiStore = useUIStore.getState();
  
  // Test adding a notification
  uiStore.addNotification({
    type: 'success',
    title: 'Test Notification',
    message: 'This is a test notification',
  });
  
  const { notifications } = useUIStore.getState();
  console.log('Notifications after adding:', notifications.length);
  
  // Test modal management
  uiStore.openModal('testModal');
  const { modals } = useUIStore.getState();
  console.log('Modal state:', modals.testModal);
  
  return notifications.length > 0 && modals.testModal === true;
};

// Run all tests
export const runAllStoreTests = () => {
  console.log('Running Zustand Store Tests...');
  
  const results = {
    patient: testPatientStore(),
    medication: testMedicationStore(),
    clinicalNote: testClinicalNoteStore(),
    ui: testUIStore(),
  };
  
  const allPassed = Object.values(results).every(result => result);
  
  console.log('Test Results:', results);
  console.log('All tests passed:', allPassed);
  
  return { results, allPassed };
};

// Export test utilities
export const getStoreState = () => {
  return {
    patients: usePatientStore.getState().patients.length,
    medications: useMedicationStore.getState().medications.length,
    notes: useClinicalNoteStore.getState().notes.length,
    notifications: useUIStore.getState().notifications.length,
  };
};

// Reset all stores for testing
export const resetStoresForTesting = () => {
  usePatientStore.setState({ patients: [], selectedPatient: null });
  useMedicationStore.setState({ medications: [], selectedMedication: null });
  useClinicalNoteStore.setState({ notes: [], selectedNote: null });
  useUIStore.setState({ notifications: [], modals: {} });
  
  console.log('All stores reset for testing');
};