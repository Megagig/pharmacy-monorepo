import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { clinicalNoteService } from '../services/clinicalNoteService';
import {
  ClinicalNote,
  ClinicalNoteFormData,
  ClinicalNoteFilters,
  BulkUpdateData,
} from '../types/clinicalNote';

// Query keys for React Query
export const clinicalNoteKeys = {
  all: ['clinical-notes'] as const,
  lists: () => [...clinicalNoteKeys.all, 'list'] as const,
  list: (filters: ClinicalNoteFilters) =>
    [...clinicalNoteKeys.lists(), filters] as const,
  details: () => [...clinicalNoteKeys.all, 'detail'] as const,
  detail: (id: string) => [...clinicalNoteKeys.details(), id] as const,
  patient: (patientId: string) =>
    [...clinicalNoteKeys.all, 'patient', patientId] as const,
  search: (query: string, filters: Omit<ClinicalNoteFilters, 'search'>) =>
    [...clinicalNoteKeys.all, 'search', query, filters] as const,
  statistics: (filters: { dateFrom?: string; dateTo?: string }) =>
    [...clinicalNoteKeys.all, 'statistics', filters] as const,
};

// Query hooks
export const useClinicalNotes = (filters: ClinicalNoteFilters = {}) => {

  return useQuery({
    queryKey: filters.search
      ? clinicalNoteKeys.search(
        filters.search,
        Object.fromEntries(
          Object.entries(filters).filter(([key]) => key !== 'search')
        ) as Omit<ClinicalNoteFilters, 'search'>
      )
      : clinicalNoteKeys.list(filters),
    queryFn: () => {
      if (filters.search) {
        const { search, ...otherFilters } = filters;
        return clinicalNoteService.searchNotes(search, otherFilters);
      }
      return clinicalNoteService.getNotes(filters);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

export const useClinicalNote = (id: string) => {
  return useQuery({
    queryKey: clinicalNoteKeys.detail(id),
    queryFn: () => clinicalNoteService.getNote(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    retry: 3,
  });
};

export const usePatientNotes = (
  patientId: string,
  filters: Omit<ClinicalNoteFilters, 'patientId'> = {}
) => {
  return useQuery({
    queryKey: clinicalNoteKeys.patient(patientId),
    queryFn: () => clinicalNoteService.getPatientNotes(patientId, filters),
    enabled: !!patientId,
    staleTime: 2 * 60 * 1000, // 2 minutes for patient-specific data
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (not found) or 403 (forbidden) errors
      if (error?.response?.status === 404 || error?.response?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

export const useSearchNotes = (
  query: string,
  filters: Omit<ClinicalNoteFilters, 'search'> = {}
) => {
  return useQuery({
    queryKey: clinicalNoteKeys.search(query, filters),
    queryFn: () => clinicalNoteService.searchNotes(query, filters),
    enabled: !!query && query.length >= 2, // Only search with 2+ characters
    staleTime: 1 * 60 * 1000, // 1 minute for search results
    retry: 2,
  });
};

export const useNoteStatistics = (
  filters: { dateFrom?: string; dateTo?: string } = {}
) => {
  return useQuery({
    queryKey: clinicalNoteKeys.statistics(filters),
    queryFn: () => clinicalNoteService.getNoteStatistics(filters),
    staleTime: 10 * 60 * 1000, // 10 minutes for statistics
    retry: 3,
  });
};

// Infinite query for large datasets
export const useInfiniteClinicalNotes = (filters: ClinicalNoteFilters = {}) => {
  return useInfiniteQuery({
    queryKey: [...clinicalNoteKeys.list(filters), 'infinite'],
    queryFn: ({ pageParam = 1 }) =>
      clinicalNoteService.getNotes({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.currentPage < lastPage.totalPages) {
        return lastPage.currentPage + 1;
      }
      return undefined;
    },
    staleTime: 5 * 60 * 1000,
    retry: 3,
  });
};

// Mutation hooks
export const useCreateNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ClinicalNoteFormData) =>
      clinicalNoteService.createNote(data),
    onSuccess: (response, variables) => {
      // Invalidate and refetch notes list
      queryClient.invalidateQueries({ queryKey: clinicalNoteKeys.lists() });

      // Invalidate patient-specific notes if patientId is provided
      if (variables.patient) {
        queryClient.invalidateQueries({
          queryKey: clinicalNoteKeys.patient(variables.patient),
        });
      }

      // Invalidate statistics
      queryClient.invalidateQueries({
        queryKey: clinicalNoteKeys.statistics({}),
      });

      // Add the new note to existing queries (optimistic update)
      queryClient.setQueryData(clinicalNoteKeys.detail(response.note._id), {
        note: response.note,
      });
    },
    onError: (error) => {
      console.error('Failed to create note:', error);
    },
  });
};

// Alias for form compatibility
export const useCreateClinicalNote = useCreateNote;

export const useUpdateNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<ClinicalNoteFormData>;
    }) => clinicalNoteService.updateNote(id, data),
    onSuccess: (response, variables) => {
      // Update the specific note in cache
      queryClient.setQueryData(clinicalNoteKeys.detail(variables.id), {
        note: response.note,
      });

      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: clinicalNoteKeys.lists() });

      // Invalidate patient notes if patient changed
      if (variables.data.patient) {
        queryClient.invalidateQueries({
          queryKey: clinicalNoteKeys.patient(variables.data.patient),
        });
      }
    },
    onError: (error) => {
      console.error('Failed to update note:', error);
    },
  });
};

// Alias for form compatibility
export const useUpdateClinicalNote = useUpdateNote;

export const useDeleteNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => clinicalNoteService.deleteNote(id),
    onSuccess: (_, deletedId) => {
      // Remove from all relevant queries
      queryClient.removeQueries({
        queryKey: clinicalNoteKeys.detail(deletedId),
      });
      queryClient.invalidateQueries({ queryKey: clinicalNoteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clinicalNoteKeys.all });
    },
    onError: (error) => {
      console.error('Failed to delete note:', error);
    },
  });
};

export const useBulkUpdateNotes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkUpdateData) =>
      clinicalNoteService.bulkUpdateNotes(data),
    onSuccess: () => {
      // Invalidate all note-related queries
      queryClient.invalidateQueries({ queryKey: clinicalNoteKeys.all });
    },
    onError: (error) => {
      console.error('Failed to bulk update notes:', error);
    },
  });
};

export const useBulkDeleteNotes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteIds: string[]) =>
      clinicalNoteService.bulkDeleteNotes(noteIds),
    onSuccess: (_, deletedIds) => {
      // Remove deleted notes from cache
      deletedIds.forEach((id) => {
        queryClient.removeQueries({ queryKey: clinicalNoteKeys.detail(id) });
      });

      // Invalidate all lists
      queryClient.invalidateQueries({ queryKey: clinicalNoteKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to bulk delete notes:', error);
    },
  });
};

export const useUploadAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, files }: { noteId: string; files: File[] }) =>
      clinicalNoteService.uploadAttachment(noteId, files),
    onSuccess: (response, variables) => {
      // Update the note with new attachments
      queryClient.setQueryData(clinicalNoteKeys.detail(variables.noteId), {
        note: response.note,
      });

      // Invalidate lists to show updated attachment count
      queryClient.invalidateQueries({ queryKey: clinicalNoteKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to upload attachment:', error);
    },
  });
};

export const useDeleteAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noteId,
      attachmentId,
    }: {
      noteId: string;
      attachmentId: string;
    }) => clinicalNoteService.deleteAttachment(noteId, attachmentId),
    onSuccess: (response, variables) => {
      // Update the note without the deleted attachment
      queryClient.setQueryData(clinicalNoteKeys.detail(variables.noteId), {
        note: response.note,
      });

      // Invalidate lists to show updated attachment count
      queryClient.invalidateQueries({ queryKey: clinicalNoteKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to delete attachment:', error);
    },
  });
};

// Optimistic update helpers
export const useOptimisticNoteUpdate = () => {
  const queryClient = useQueryClient();

  const optimisticUpdate = (id: string, updates: Partial<ClinicalNote>) => {
    queryClient.setQueryData(
      clinicalNoteKeys.detail(id),
      (old: { note: ClinicalNote } | undefined) => {
        if (!old) return old;
        return {
          note: { ...old.note, ...updates },
        };
      }
    );
  };

  const rollbackUpdate = (id: string, previousData: ClinicalNote) => {
    queryClient.setQueryData(clinicalNoteKeys.detail(id), {
      note: previousData,
    });
  };

  return { optimisticUpdate, rollbackUpdate };
};

// Prefetch helpers
export const usePrefetchNote = () => {
  const queryClient = useQueryClient();

  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: clinicalNoteKeys.detail(id),
      queryFn: () => clinicalNoteService.getNote(id),
      staleTime: 5 * 60 * 1000,
    });
  };
};

export const usePrefetchPatientNotes = () => {
  const queryClient = useQueryClient();

  return (patientId: string) => {
    queryClient.prefetchQuery({
      queryKey: clinicalNoteKeys.patient(patientId),
      queryFn: () => clinicalNoteService.getPatientNotes(patientId),
      staleTime: 2 * 60 * 1000,
    });
  };
};

// Background sync for offline support
export const useBackgroundSync = () => {
  const queryClient = useQueryClient();

  const syncNotes = () => {
    queryClient.invalidateQueries({ queryKey: clinicalNoteKeys.all });
  };

  return { syncNotes };
};
