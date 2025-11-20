import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicalNoteService } from '../services/clinicalNoteService';
import { queryKeys } from '../lib/queryClient';
import { useUIStore } from '../stores';

// Hook to fetch all clinical notes with optional filters
export const useClinicalNotes = (filters: Record<string, unknown> = {}) => {
  return useQuery({
    queryKey: queryKeys.clinicalNotes.list(filters),
    queryFn: () => clinicalNoteService.getClinicalNotes(filters),
    select: (data) => data.data || data,
  });
};

// Hook to fetch a single clinical note by ID
export const useClinicalNote = (noteId: string) => {
  return useQuery({
    queryKey: queryKeys.clinicalNotes.detail(noteId),
    queryFn: () => clinicalNoteService.getClinicalNote(noteId),
    enabled: !!noteId,
    select: (data) => data.data || data,
  });
};

// Hook to fetch clinical notes for a specific patient
export const useClinicalNotesByPatient = (patientId: string) => {
  return useQuery({
    queryKey: queryKeys.clinicalNotes.byPatient(patientId),
    queryFn: () => clinicalNoteService.getClinicalNotesByPatient(patientId),
    enabled: !!patientId,
    select: (data) => data.data || data,
  });
};

// Hook to create a new clinical note
export const useCreateClinicalNote = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: clinicalNoteService.createClinicalNote,
    onSuccess: (data: unknown) => {
      // Invalidate clinical notes lists
      queryClient.invalidateQueries({ queryKey: queryKeys.clinicalNotes.lists() });

      // If note has a patient, invalidate patient-specific notes
      if (data?.patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.clinicalNotes.byPatient(data.patientId)
        });
      }

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Note Created',
        message: `Clinical note "${data?.title || 'note'}" has been successfully created.`,
        duration: 5000,
      });
    },
    onError: (error: unknown) => {
      addNotification({
        type: 'error',
        title: 'Creation Failed',
        message: error.message || 'Failed to create clinical note. Please try again.',
        duration: 5000,
      });
    },
  });
};

// Hook to update a clinical note
export const useUpdateClinicalNote = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: ({ noteId, noteData }: { noteId: string; noteData: unknown }) =>
      clinicalNoteService.updateClinicalNote(noteId, noteData),
    onSuccess: (data: unknown, variables) => {
      // Update specific note in cache
      queryClient.setQueryData(
        queryKeys.clinicalNotes.detail(variables.noteId),
        data
      );

      // Invalidate notes lists
      queryClient.invalidateQueries({ queryKey: queryKeys.clinicalNotes.lists() });

      // If note has a patient, invalidate patient-specific notes
      if (data?.patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.clinicalNotes.byPatient(data.patientId)
        });
      }

      addNotification({
        type: 'success',
        title: 'Note Updated',
        message: 'Clinical note has been successfully updated.',
        duration: 5000,
      });
    },
    onError: (error: unknown) => {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Failed to update clinical note. Please try again.',
        duration: 5000,
      });
    },
  });
};

// Hook to toggle note privacy
export const useToggleNotePrivacy = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: (noteId: string) => clinicalNoteService.toggleNotePrivacy(noteId),
    onMutate: async (noteId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.clinicalNotes.detail(noteId) });

      // Snapshot previous value
      const previousNote = queryClient.getQueryData(queryKeys.clinicalNotes.detail(noteId));

      // Optimistically update privacy status
      queryClient.setQueryData(
        queryKeys.clinicalNotes.detail(noteId),
        (old: unknown) => old ? { ...old, isPrivate: !old.isPrivate } : old
      );

      return { previousNote };
    },
    onError: (error, noteId, context) => {
      // Rollback on error
      if (context?.previousNote) {
        queryClient.setQueryData(
          queryKeys.clinicalNotes.detail(noteId),
          context.previousNote
        );
      }

      addNotification({
        type: 'error',
        title: 'Privacy Update Failed',
        message: error.message || 'Failed to update note privacy. Please try again.',
        duration: 5000,
      });
    },
    onSuccess: (data: unknown) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.clinicalNotes.lists() });

      if (data?.patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.clinicalNotes.byPatient(data.patientId)
        });
      }

      const newStatus = data?.isPrivate ? 'private' : 'public';
      addNotification({
        type: 'success',
        title: 'Privacy Updated',
        message: `Note "${data?.title || 'note'}" is now ${newStatus}.`,
        duration: 5000,
      });
    },
  });
};

// Hook to delete a clinical note
export const useDeleteClinicalNote = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: (noteId: string) => clinicalNoteService.deleteClinicalNote(noteId),
    onSuccess: (data: unknown, noteId: string) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.clinicalNotes.detail(noteId) });

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: queryKeys.clinicalNotes.lists() });

      // Invalidate patient-specific notes if applicable
      queryClient.invalidateQueries({ queryKey: queryKeys.clinicalNotes.all });

      addNotification({
        type: 'success',
        title: 'Note Deleted',
        message: 'Clinical note has been successfully deleted.',
        duration: 5000,
      });
    },
    onError: (error: unknown) => {
      addNotification({
        type: 'error',
        title: 'Deletion Failed',
        message: error.message || 'Failed to delete clinical note. Please try again.',
        duration: 5000,
      });
    },
  });
};

// Hook to search clinical notes
export const useSearchClinicalNotes = (searchQuery: string) => {
  return useQuery({
    queryKey: [...queryKeys.clinicalNotes.all, 'search', searchQuery],
    queryFn: () => clinicalNoteService.searchClinicalNotes(searchQuery),
    enabled: !!searchQuery && searchQuery.length >= 2,
    select: (data) => data.data || data,
  });
};