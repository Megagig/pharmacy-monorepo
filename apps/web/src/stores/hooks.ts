import { useCallback, useMemo } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useSidebarControls } from './sidebarHooks';

// Direct imports from store files - using explicit file paths to avoid circular dependencies
import { usePatientStore } from './patientStore';
import { useMedicationStore } from './medicationStore';
import { useClinicalNoteStore } from './clinicalNoteStore';
import { useAppLoading, useLoadingStore } from './loadingStore';

// Sidebar hooks are now using the dedicated sidebar store
export const useSidebarOpen = () => {
  const { sidebarOpen } = useSidebarControls();
  return sidebarOpen;
};
export const useSidebarToggle = () => {
  const { toggleSidebar } = useSidebarControls();
  return toggleSidebar;
};
export const useSidebarSetter = () => {
  const { setSidebarOpen } = useSidebarControls();
  return setSidebarOpen;
};

// Use the combined hook for simplicity
export const useSidebar = useSidebarControls;

// Enhanced patient hooks with additional functionality
export const usePatientManagement = () => {
  const patients = usePatientStore((state) => state.patients);
  const loading = usePatientStore((state) => state.loading);
  const errors = usePatientStore((state) => state.errors);
  const fetchPatients = usePatientStore((state) => state.fetchPatients);
  const createPatient = usePatientStore((state) => state.createPatient);
  const updatePatient = usePatientStore((state) => state.updatePatient);
  const deletePatient = usePatientStore((state) => state.deletePatient);
  const selectPatient = usePatientStore((state) => state.selectPatient);
  const selectedPatient = usePatientStore((state) => state.selectedPatient);
  const { addNotification } = useNotifications();

  const handleCreatePatient = useCallback(
    async (patientData: Record<string, unknown>) => {
      const result = await createPatient(patientData);
      if (result) {
        addNotification({
          type: 'success',
          title: 'Patient Created',
          message: `Patient ${result.firstName} ${result.lastName} has been successfully created.`,
          duration: 5000,
        });
        return result;
      } else {
        addNotification({
          type: 'error',
          title: 'Creation Failed',
          message: 'Failed to create patient. Please try again.',
          duration: 5000,
        });
        return null;
      }
    },
    [createPatient, addNotification]
  );

  const handleUpdatePatient = useCallback(
    async (id: string, patientData: Record<string, unknown>) => {
      const result = await updatePatient(id, patientData);
      if (result) {
        addNotification({
          type: 'success',
          title: 'Patient Updated',
          message: `Patient information has been successfully updated.`,
          duration: 5000,
        });
        return result;
      } else {
        addNotification({
          type: 'error',
          title: 'Update Failed',
          message: 'Failed to update patient. Please try again.',
          duration: 5000,
        });
        return null;
      }
    },
    [updatePatient, addNotification]
  );

  const handleDeletePatient = useCallback(
    async (id: string, patientName: string) => {
      const result = await deletePatient(id);
      if (result) {
        addNotification({
          type: 'success',
          title: 'Patient Deleted',
          message: `Patient ${patientName} has been successfully deleted.`,
          duration: 5000,
        });
        return true;
      } else {
        addNotification({
          type: 'error',
          title: 'Deletion Failed',
          message: 'Failed to delete patient. Please try again.',
          duration: 5000,
        });
        return false;
      }
    },
    [deletePatient, addNotification]
  );

  return {
    patients,
    loading,
    errors,
    selectedPatient,
    fetchPatients,
    selectPatient,
    createPatient: handleCreatePatient,
    updatePatient: handleUpdatePatient,
    deletePatient: handleDeletePatient,
  };
};

// Enhanced medication hooks with additional functionality
export const useMedicationManagement = () => {
  const medications = useMedicationStore((state) => state.medications);
  const loading = useMedicationStore((state) => state.loading);
  const errors = useMedicationStore((state) => state.errors);
  const fetchMedications = useMedicationStore(
    (state) => state.fetchMedications
  );
  const createMedication = useMedicationStore(
    (state) => state.createMedication
  );
  const updateMedication = useMedicationStore(
    (state) => state.updateMedication
  );
  const deleteMedication = useMedicationStore(
    (state) => state.deleteMedication
  );
  const updateMedicationStatus = useMedicationStore(
    (state) => state.updateMedicationStatus
  );
  const selectedMedication = useMedicationStore(
    (state) => state.selectedMedication
  );
  const selectMedication = useMedicationStore(
    (state) => state.selectMedication
  );
  const { addNotification } = useNotifications();

  const handleCreateMedication = useCallback(
    async (medicationData: Record<string, unknown>) => {
      const result = await createMedication(medicationData);
      if (result) {
        addNotification({
          type: 'success',
          title: 'Medication Added',
          message: `Medication ${result.name} has been successfully added.`,
          duration: 5000,
        });
        return result;
      } else {
        addNotification({
          type: 'error',
          title: 'Addition Failed',
          message: 'Failed to add medication. Please try again.',
          duration: 5000,
        });
        return null;
      }
    },
    [createMedication, addNotification]
  );

  const handleUpdateMedicationStatus = useCallback(
    async (id: string, status: string, medicationName: string) => {
      const result = await updateMedicationStatus(
        id,
        status as 'active' | 'inactive' | 'discontinued'
      );
      if (result) {
        addNotification({
          type: 'success',
          title: 'Status Updated',
          message: `${medicationName} status changed to ${status}.`,
          duration: 5000,
        });
        return true;
      } else {
        addNotification({
          type: 'error',
          title: 'Update Failed',
          message: 'Failed to update medication status. Please try again.',
          duration: 5000,
        });
        return false;
      }
    },
    [updateMedicationStatus, addNotification]
  );

  return {
    medications,
    loading,
    errors,
    selectedMedication,
    activeMedicationsCount: (medications || []).filter(
      (m) => m?.status === 'active'
    ).length,
    fetchMedications,
    selectMedication,
    createMedication: handleCreateMedication,
    updateMedication,
    deleteMedication,
    updateMedicationStatus: handleUpdateMedicationStatus,
  };
};

// Enhanced clinical notes hooks with additional functionality
export const useClinicalNoteManagement = () => {
  const notes = useClinicalNoteStore((state) => state.notes);
  const loading = useClinicalNoteStore((state) => state.loading);
  const errors = useClinicalNoteStore((state) => state.errors);
  const fetchNotes = useClinicalNoteStore((state) => state.fetchNotes);
  const createNote = useClinicalNoteStore((state) => state.createNote);
  const updateNote = useClinicalNoteStore((state) => state.updateNote);
  const deleteNote = useClinicalNoteStore((state) => state.deleteNote);
  const selectedNote = useClinicalNoteStore((state) => state.selectedNote);
  const selectNote = useClinicalNoteStore((state) => state.selectNote);
  const toggleNotePrivacy = useClinicalNoteStore(
    (state) => state.toggleNotePrivacy
  );
  const { addNotification } = useNotifications();

  const handleCreateNote = useCallback(
    async (noteData: Record<string, unknown>) => {
      const result = await createNote(noteData);
      if (result) {
        addNotification({
          type: 'success',
          title: 'Note Created',
          message: `Clinical note "${result.title}" has been successfully created.`,
          duration: 5000,
        });
        return result;
      } else {
        addNotification({
          type: 'error',
          title: 'Creation Failed',
          message: 'Failed to create clinical note. Please try again.',
          duration: 5000,
        });
        return null;
      }
    },
    [createNote, addNotification]
  );

  const handleTogglePrivacy = useCallback(
    async (id: string, noteTitle: string) => {
      const result = await toggleNotePrivacy(id);
      if (result) {
        const note = notes.find((n) => n._id === id);
        const newStatus = note?.isPrivate ? 'public' : 'private';
        addNotification({
          type: 'success',
          title: 'Privacy Updated',
          message: `Note "${noteTitle}" is now ${newStatus}.`,
          duration: 5000,
        });
        return true;
      } else {
        addNotification({
          type: 'error',
          title: 'Update Failed',
          message: 'Failed to update note privacy. Please try again.',
          duration: 5000,
        });
        return false;
      }
    },
    [toggleNotePrivacy, addNotification, notes]
  );

  // Memoize available tags to prevent re-renders
  const availableTags = useMemo(() => {
    const allTags = notes.flatMap((note) => note.tags || []);
    return [...new Set(allTags)]; // Remove duplicates
  }, [notes]);

  return {
    notes,
    loading,
    errors,
    selectedNote,
    availableTags,
    fetchNotes,
    selectNote,
    createNote: handleCreateNote,
    updateNote,
    deleteNote,
    toggleNotePrivacy: handleTogglePrivacy,
  };
};

// Hook for dashboard data aggregation
export const useDashboardData = () => {
  const patients = usePatientStore((state) => state.patients);
  const medications = useMedicationStore((state) => state.medications);
  const notes = useClinicalNoteStore((state) => state.notes);

  // Memoize computed values to prevent infinite re-renders
  const dashboardStats = useMemo(() => {
    // Safety checks for undefined/null data
    const safePatients = patients || [];
    const safeMedications = medications || [];
    const safeNotes = notes || [];

    // Early return with default values if stores are not initialized
    if (
      !Array.isArray(safePatients) ||
      !Array.isArray(safeMedications) ||
      !Array.isArray(safeNotes)
    ) {
      return {
        totalPatients: 0,
        activeMedications: 0,
        totalNotes: 0,
        recentNotes: [],
        recentPatients: [],
        medicationsByStatus: { active: 0, completed: 0, discontinued: 0 },
        notesByType: { consultation: 0, followUp: 0, emergency: 0, general: 0 },
      };
    }

    const activeMedications = safeMedications.filter(
      (m) => m?.status === 'active'
    ).length;

    return {
      totalPatients: safePatients.length,
      activeMedications,
      totalNotes: safeNotes.length,
      recentNotes: safeNotes.slice(0, 5),
      recentPatients: safePatients.slice(0, 5),
      medicationsByStatus: {
        active: safeMedications.filter((m) => m?.status === 'active').length,
        completed: safeMedications.filter((m) => m?.status === 'completed')
          .length,
        discontinued: safeMedications.filter(
          (m) => m?.status === 'discontinued'
        ).length,
      },
      notesByType: {
        consultation: safeNotes.filter((n) => n?.type === 'consultation')
          .length,
        followUp: safeNotes.filter((n) => n?.type === 'follow-up').length,
        emergency: safeNotes.filter((n) => n?.type === 'emergency').length,
        general: safeNotes.filter((n) => n?.type === 'general').length,
      },
    };
  }, [patients, medications, notes]); // Only recompute when actual data changes

  return dashboardStats;
};

// Hook for search functionality across all stores
export const useGlobalSearch = () => {
  const searchPatients = usePatientStore((state) => state.searchPatients);
  const searchMedications = useMedicationStore(
    (state) => state.searchMedications
  );
  const searchNotes = useClinicalNoteStore((state) => state.searchNotes);

  const performGlobalSearch = useCallback(
    (searchTerm: string) => {
      searchPatients(searchTerm);
      searchMedications(searchTerm);
      searchNotes(searchTerm);
    },
    [searchPatients, searchMedications, searchNotes]
  );

  return {
    performGlobalSearch,
  };
};

// Hook for error handling across all stores
export const useErrorManagement = () => {
  const patientErrors = usePatientStore((state) => state.errors);
  const medicationErrors = useMedicationStore((state) => state.errors);
  const noteErrors = useClinicalNoteStore((state) => state.errors);
  const clearPatientErrors = usePatientStore((state) => state.clearErrors);
  const clearMedicationErrors = useMedicationStore(
    (state) => state.clearErrors
  );
  const clearNoteErrors = useClinicalNoteStore((state) => state.clearErrors);
  const { addNotification } = useNotifications();

  const allErrors = {
    ...patientErrors,
    ...medicationErrors,
    ...noteErrors,
  };

  const hasErrors = Object.values(allErrors).some((error) => error !== null);

  const clearAllErrors = useCallback(() => {
    clearPatientErrors();
    clearMedicationErrors();
    clearNoteErrors();
  }, [clearPatientErrors, clearMedicationErrors, clearNoteErrors]);

  const displayError = useCallback(
    (title: string, message: string) => {
      addNotification({
        type: 'error',
        title,
        message,
        duration: 8000,
      });
    },
    [addNotification]
  );

  return {
    allErrors,
    hasErrors,
    clearAllErrors,
    displayError,
  };
};

// Hook for loading states across all stores
export const useLoadingStates = () => {
  const patientLoading = usePatientStore((state) => state.loading);
  const medicationLoading = useMedicationStore((state) => state.loading);
  const noteLoading = useClinicalNoteStore((state) => state.loading);
  const { loading: uiLoading } = useAppLoading();

  const isLoading = (area?: string) => {
    if (area) {
      return (
        patientLoading[area] ||
        medicationLoading[area] ||
        noteLoading[area] ||
        false
      );
    }

    return (
      Object.values(patientLoading).some(Boolean) ||
      Object.values(medicationLoading).some(Boolean) ||
      Object.values(noteLoading).some(Boolean) ||
      uiLoading
    );
  };

  return {
    isLoading,
    patientLoading,
    medicationLoading,
    noteLoading,
    uiLoading,
  };
};

// Hook for data synchronization
export const useDataSync = () => {
  const syncAllData = useCallback(async () => {
    const patientStore = usePatientStore.getState();
    const medicationStore = useMedicationStore.getState();
    const clinicalNoteStore = useClinicalNoteStore.getState();
    const loadingStore = useLoadingStore.getState();

    loadingStore.setLoading(true);
    try {
      await Promise.all([
        patientStore.fetchPatients(),
        medicationStore.fetchMedications(),
        clinicalNoteStore.fetchNotes(),
      ]);
    } catch (error) {
      console.error('Data synchronization failed:', error);
    } finally {
      loadingStore.setLoading(false);
    }
  }, []); // Safe to use empty dependency array since we're getting fresh state

  return {
    syncAllData,
  };
};
