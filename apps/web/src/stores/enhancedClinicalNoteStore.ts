import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
    ClinicalNote,
    ClinicalNoteFormData,
    ClinicalNoteFilters,
    FileUploadState,
    clinicalNoteUtils
} from '../types/clinicalNote';
import { clinicalNoteService } from '../services/clinicalNoteService';

// Helper functions
const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Enhanced store interface
interface EnhancedClinicalNoteStore {
    // Core state
    notes: ClinicalNote[];
    selectedNote: ClinicalNote | null;
    selectedNotes: string[];
    filters: ClinicalNoteFilters;
    searchQuery: string;

    // Loading states
    loading: {
        fetchNotes: boolean;
        createNote: boolean;
        updateNote: boolean;
        deleteNote: boolean;
        bulkOperations: boolean;
        uploadAttachment: boolean;
    };

    // Error states
    errors: {
        fetchNotes: string | null;
        createNote: string | null;
        updateNote: string | null;
        deleteNote: string | null;
        bulkOperations: string | null;
        uploadAttachment: string | null;
    };

    // Pagination
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };

    // File upload state
    fileUpload: FileUploadState;

    // UI state
    ui: {
        isCreateModalOpen: boolean;
        isEditModalOpen: boolean;
        isDeleteConfirmOpen: boolean;
        isBulkDeleteConfirmOpen: boolean;
        viewMode: 'list' | 'grid' | 'table';
        sidebarCollapsed: boolean;
    };

    // Enhanced CRUD operations
    fetchNotes: (filters?: ClinicalNoteFilters) => Promise<void>;
    fetchNotesByPatient: (patientId: string, filters?: Omit<ClinicalNoteFilters, 'patientId'>) => Promise<void>;
    searchNotes: (query: string, filters?: Omit<ClinicalNoteFilters, 'search'>) => Promise<void>;
    createNote: (noteData: ClinicalNoteFormData) => Promise<ClinicalNote | null>;
    updateNote: (id: string, noteData: Partial<ClinicalNoteFormData>) => Promise<ClinicalNote | null>;
    deleteNote: (id: string) => Promise<boolean>;
    getNoteById: (id: string) => Promise<ClinicalNote | null>;

    // Bulk operations
    bulkUpdateNotes: (noteIds: string[], updates: Partial<ClinicalNoteFormData>) => Promise<boolean>;
    bulkDeleteNotes: (noteIds: string[]) => Promise<boolean>;
    bulkToggleConfidential: (noteIds: string[], isConfidential: boolean) => Promise<boolean>;
    bulkAddTags: (noteIds: string[], tags: string[]) => Promise<boolean>;

    // File attachment operations
    uploadAttachment: (noteId: string, files: File[]) => Promise<boolean>;
    deleteAttachment: (noteId: string, attachmentId: string) => Promise<boolean>;
    downloadAttachment: (noteId: string, attachmentId: string) => Promise<void>;

    // Selection management
    selectNote: (note: ClinicalNote | null) => void;
    toggleNoteSelection: (noteId: string) => void;
    selectAllNotes: () => void;
    clearSelection: () => void;
    isNoteSelected: (noteId: string) => boolean;

    // Filter and search management
    setFilters: (filters: Partial<ClinicalNoteFilters>) => void;
    clearFilters: () => void;
    setSearchQuery: (query: string) => void;
    applyFilters: () => Promise<void>;

    // Pagination management
    setPage: (page: number) => void;
    setLimit: (limit: number) => void;
    nextPage: () => void;
    previousPage: () => void;

    // UI state management
    setCreateModalOpen: (open: boolean) => void;
    setEditModalOpen: (open: boolean) => void;
    setDeleteConfirmOpen: (open: boolean) => void;
    setBulkDeleteConfirmOpen: (open: boolean) => void;
    setViewMode: (mode: 'list' | 'grid' | 'table') => void;
    toggleSidebar: () => void;

    // File upload management
    addFileToUpload: (file: File) => void;
    removeFileFromUpload: (fileIndex: number) => void;
    clearUploadFiles: () => void;
    updateFileProgress: (fileIndex: number, progress: number) => void;
    setFileError: (fileIndex: number, error: string) => void;

    // Optimistic updates
    optimisticCreateNote: (noteData: ClinicalNoteFormData) => string;
    optimisticUpdateNote: (id: string, updates: Partial<ClinicalNote>) => void;
    optimisticDeleteNote: (id: string) => void;
    rollbackOptimisticUpdate: (tempId: string) => void;

    // State management helpers
    setLoading: (key: keyof EnhancedClinicalNoteStore['loading'], loading: boolean) => void;
    setError: (key: keyof EnhancedClinicalNoteStore['errors'], error: string | null) => void;
    clearErrors: () => void;
    clearAllLoading: () => void;

    // Analytics and utilities
    getNotesByType: (type: ClinicalNote['type']) => ClinicalNote[];
    getNotesByPriority: (priority: ClinicalNote['priority']) => ClinicalNote[];
    getConfidentialNotes: () => ClinicalNote[];
    getNotesWithFollowUp: () => ClinicalNote[];
    getNotesWithAttachments: () => ClinicalNote[];
    getAllTags: () => string[];
    getPatientNoteSummary: (patientId: string) => {
        consultation: number;
        medicationReview: number;
        followUp: number;
        adverseEvent: number;
        other: number;
        total: number;
        confidential: number;
        withFollowUp: number;
        withAttachments: number;
    };
}

// Create the enhanced store
export const useEnhancedClinicalNoteStore = create<EnhancedClinicalNoteStore>()(
    subscribeWithSelector(
        persist(
            immer((set, get) => ({
                // Initial state
                notes: [],
                selectedNote: null,
                selectedNotes: [],
                filters: {
                    page: 1,
                    limit: 10,
                    sortBy: 'createdAt',
                    sortOrder: 'desc',
                },
                searchQuery: '',
                loading: {
                    fetchNotes: false,
                    createNote: false,
                    updateNote: false,
                    deleteNote: false,
                    bulkOperations: false,
                    uploadAttachment: false,
                },
                errors: {
                    fetchNotes: null,
                    createNote: null,
                    updateNote: null,
                    deleteNote: null,
                    bulkOperations: null,
                    uploadAttachment: null,
                },
                pagination: {
                    page: 1,
                    limit: 10,
                    total: 0,
                    totalPages: 0,
                },
                fileUpload: {
                    files: [],
                    isUploading: false,
                    totalProgress: 0,
                },
                ui: {
                    isCreateModalOpen: false,
                    isEditModalOpen: false,
                    isDeleteConfirmOpen: false,
                    isBulkDeleteConfirmOpen: false,
                    viewMode: 'table',
                    sidebarCollapsed: false,
                },

                // Enhanced CRUD operations
                fetchNotes: async (filters) => {
                    set((state) => {
                        state.loading.fetchNotes = true;
                        state.errors.fetchNotes = null;
                    });

                    try {
                        const currentFilters = filters || get().filters;
                        const response = await clinicalNoteService.getNotes(currentFilters);

                        set((state) => {
                            state.notes = response.notes;
                            state.pagination = {
                                page: response.currentPage,
                                limit: currentFilters.limit || 10,
                                total: response.total,
                                totalPages: response.totalPages,
                            };
                            if (filters) {
                                state.filters = { ...state.filters, ...filters };
                            }
                        });
                    } catch (error: any) {
                        set((state) => {
                            state.errors.fetchNotes = error.message || 'Failed to fetch clinical notes';
                        });
                    } finally {
                        set((state) => {
                            state.loading.fetchNotes = false;
                        });
                    }
                },

                fetchNotesByPatient: async (patientId, filters = {}) => {
                    set((state) => {
                        state.loading.fetchNotes = true;
                        state.errors.fetchNotes = null;
                    });

                    try {
                        const response = await clinicalNoteService.getPatientNotes(patientId, filters);

                        set((state) => {
                            state.notes = response.notes;
                            state.pagination = {
                                page: response.currentPage,
                                limit: filters.limit || 10,
                                total: response.total,
                                totalPages: response.totalPages,
                            };
                            state.filters = { ...state.filters, patientId, ...filters };
                        });
                    } catch (error: any) {
                        set((state) => {
                            state.errors.fetchNotes = error.message || 'Failed to fetch patient notes';
                        });
                    } finally {
                        set((state) => {
                            state.loading.fetchNotes = false;
                        });
                    }
                },

                searchNotes: async (query, filters = {}) => {
                    set((state) => {
                        state.loading.fetchNotes = true;
                        state.errors.fetchNotes = null;
                        state.searchQuery = query;
                    });

                    try {
                        const response = await clinicalNoteService.searchNotes(query, filters);

                        set((state) => {
                            state.notes = response.notes;
                            state.pagination = {
                                page: response.currentPage,
                                limit: filters.limit || 10,
                                total: response.total,
                                totalPages: response.totalPages,
                            };
                        });
                    } catch (error: any) {
                        set((state) => {
                            state.errors.fetchNotes = error.message || 'Failed to search notes';
                        });
                    } finally {
                        set((state) => {
                            state.loading.fetchNotes = false;
                        });
                    }
                },

                createNote: async (noteData) => {
                    // Optimistic update
                    const tempId = get().optimisticCreateNote(noteData);

                    set((state) => {
                        state.loading.createNote = true;
                        state.errors.createNote = null;
                    });

                    try {
                        const response = await clinicalNoteService.createNote(noteData);

                        set((state) => {
                            // Replace optimistic note with real note
                            const tempNoteIndex = state.notes.findIndex(n => n._id === tempId);
                            if (tempNoteIndex !== -1) {
                                state.notes[tempNoteIndex] = response.note;
                            }
                            state.pagination.total += 1;
                        });

                        return response.note;
                    } catch (error: any) {
                        // Rollback optimistic update
                        get().rollbackOptimisticUpdate(tempId);

                        set((state) => {
                            state.errors.createNote = error.message || 'Failed to create note';
                        });
                        return null;
                    } finally {
                        set((state) => {
                            state.loading.createNote = false;
                        });
                    }
                },

                updateNote: async (id, noteData) => {
                    // Store original note for rollback
                    const originalNote = get().notes.find(n => n._id === id);
                    if (!originalNote) return null;

                    // Optimistic update
                    get().optimisticUpdateNote(id, noteData as Partial<ClinicalNote>);

                    set((state) => {
                        state.loading.updateNote = true;
                        state.errors.updateNote = null;
                    });

                    try {
                        const response = await clinicalNoteService.updateNote(id, noteData);

                        set((state) => {
                            const noteIndex = state.notes.findIndex(n => n._id === id);
                            if (noteIndex !== -1) {
                                state.notes[noteIndex] = response.note;
                            }
                            if (state.selectedNote?._id === id) {
                                state.selectedNote = response.note;
                            }
                        });

                        return response.note;
                    } catch (error: any) {
                        // Rollback optimistic update
                        set((state) => {
                            const noteIndex = state.notes.findIndex(n => n._id === id);
                            if (noteIndex !== -1) {
                                state.notes[noteIndex] = originalNote;
                            }
                            if (state.selectedNote?._id === id) {
                                state.selectedNote = originalNote;
                            }
                            state.errors.updateNote = error.message || 'Failed to update note';
                        });
                        return null;
                    } finally {
                        set((state) => {
                            state.loading.updateNote = false;
                        });
                    }
                },

                deleteNote: async (id) => {
                    // Store original note for rollback
                    const originalNote = get().notes.find(n => n._id === id);
                    if (!originalNote) return false;

                    // Optimistic update
                    get().optimisticDeleteNote(id);

                    set((state) => {
                        state.loading.deleteNote = true;
                        state.errors.deleteNote = null;
                    });

                    try {
                        await clinicalNoteService.deleteNote(id);

                        set((state) => {
                            state.pagination.total = Math.max(0, state.pagination.total - 1);
                            if (state.selectedNote?._id === id) {
                                state.selectedNote = null;
                            }
                            state.selectedNotes = state.selectedNotes.filter(noteId => noteId !== id);
                        });

                        return true;
                    } catch (error: any) {
                        // Rollback optimistic update
                        set((state) => {
                            state.notes.push(originalNote);
                            state.errors.deleteNote = error.message || 'Failed to delete note';
                        });
                        return false;
                    } finally {
                        set((state) => {
                            state.loading.deleteNote = false;
                        });
                    }
                },

                getNoteById: async (id) => {
                    try {
                        const response = await clinicalNoteService.getNote(id);
                        return response.note;
                    } catch (error: any) {
                        console.error('Failed to fetch note:', error);
                        return null;
                    }
                },

                // Bulk operations
                bulkUpdateNotes: async (noteIds, updates) => {
                    set((state) => {
                        state.loading.bulkOperations = true;
                        state.errors.bulkOperations = null;
                    });

                    try {
                        await clinicalNoteService.bulkUpdateNotes({ noteIds, updates });

                        // Refresh notes to get updated data
                        await get().fetchNotes();
                        return true;
                    } catch (error: any) {
                        set((state) => {
                            state.errors.bulkOperations = error.message || 'Failed to bulk update notes';
                        });
                        return false;
                    } finally {
                        set((state) => {
                            state.loading.bulkOperations = false;
                        });
                    }
                },

                bulkDeleteNotes: async (noteIds) => {
                    set((state) => {
                        state.loading.bulkOperations = true;
                        state.errors.bulkOperations = null;
                    });

                    try {
                        await clinicalNoteService.bulkDeleteNotes(noteIds);

                        set((state) => {
                            state.notes = state.notes.filter(note => !noteIds.includes(note._id));
                            state.selectedNotes = [];
                            state.pagination.total = Math.max(0, state.pagination.total - noteIds.length);
                        });

                        return true;
                    } catch (error: any) {
                        set((state) => {
                            state.errors.bulkOperations = error.message || 'Failed to bulk delete notes';
                        });
                        return false;
                    } finally {
                        set((state) => {
                            state.loading.bulkOperations = false;
                        });
                    }
                },

                bulkToggleConfidential: async (noteIds, isConfidential) => {
                    return get().bulkUpdateNotes(noteIds, { isConfidential });
                },

                bulkAddTags: async (noteIds, tags) => {
                    // Get existing tags for each note and merge with new tags
                    const notes = get().notes.filter(note => noteIds.includes(note._id));
                    const promises = notes.map(note => {
                        const existingTags = note.tags || [];
                        const mergedTags = [...new Set([...existingTags, ...tags])];
                        return get().updateNote(note._id, { tags: mergedTags });
                    });

                    try {
                        await Promise.all(promises);
                        return true;
                    } catch (error) {
                        return false;
                    }
                },

                // File attachment operations
                uploadAttachment: async (noteId, files) => {
                    set((state) => {
                        state.loading.uploadAttachment = true;
                        state.errors.uploadAttachment = null;
                        state.fileUpload.isUploading = true;
                    });

                    try {
                        const response = await clinicalNoteService.uploadAttachment(noteId, files);

                        set((state) => {
                            const noteIndex = state.notes.findIndex(n => n._id === noteId);
                            if (noteIndex !== -1) {
                                state.notes[noteIndex] = response.note;
                            }
                            if (state.selectedNote?._id === noteId) {
                                state.selectedNote = response.note;
                            }
                            state.fileUpload.files = [];
                        });

                        return true;
                    } catch (error: any) {
                        set((state) => {
                            state.errors.uploadAttachment = error.message || 'Failed to upload attachment';
                        });
                        return false;
                    } finally {
                        set((state) => {
                            state.loading.uploadAttachment = false;
                            state.fileUpload.isUploading = false;
                        });
                    }
                },

                deleteAttachment: async (noteId, attachmentId) => {
                    try {
                        const response = await clinicalNoteService.deleteAttachment(noteId, attachmentId);

                        set((state) => {
                            const noteIndex = state.notes.findIndex(n => n._id === noteId);
                            if (noteIndex !== -1) {
                                state.notes[noteIndex] = response.note;
                            }
                            if (state.selectedNote?._id === noteId) {
                                state.selectedNote = response.note;
                            }
                        });

                        return true;
                    } catch (error: any) {
                        console.error('Failed to delete attachment:', error);
                        return false;
                    }
                },

                downloadAttachment: async (noteId, attachmentId) => {
                    try {
                        const blob = await clinicalNoteService.downloadAttachment(noteId, attachmentId);

                        // Create download link
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = 'attachment'; // You might want to get the actual filename
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                    } catch (error: any) {
                        console.error('Failed to download attachment:', error);
                    }
                },

                // Selection management
                selectNote: (note) => {
                    set((state) => {
                        state.selectedNote = note;
                    });
                },

                toggleNoteSelection: (noteId) => {
                    set((state) => {
                        const index = state.selectedNotes.indexOf(noteId);
                        if (index > -1) {
                            state.selectedNotes.splice(index, 1);
                        } else {
                            state.selectedNotes.push(noteId);
                        }
                    });
                },

                selectAllNotes: () => {
                    set((state) => {
                        state.selectedNotes = state.notes.map(note => note._id);
                    });
                },

                clearSelection: () => {
                    set((state) => {
                        state.selectedNotes = [];
                    });
                },

                isNoteSelected: (noteId) => {
                    return get().selectedNotes.includes(noteId);
                },

                // Filter and search management
                setFilters: (filters) => {
                    set((state) => {
                        state.filters = { ...state.filters, ...filters };
                    });
                },

                clearFilters: () => {
                    set((state) => {
                        state.filters = {
                            page: 1,
                            limit: 10,
                            sortBy: 'createdAt',
                            sortOrder: 'desc',
                        };
                        state.searchQuery = '';
                    });
                },

                setSearchQuery: (query) => {
                    set((state) => {
                        state.searchQuery = query;
                    });
                },

                applyFilters: async () => {
                    const { filters, searchQuery } = get();
                    if (searchQuery) {
                        await get().searchNotes(searchQuery, filters);
                    } else {
                        await get().fetchNotes(filters);
                    }
                },

                // Pagination management
                setPage: (page) => {
                    set((state) => {
                        state.filters.page = page;
                    });
                    get().applyFilters();
                },

                setLimit: (limit) => {
                    set((state) => {
                        state.filters.limit = limit;
                        state.filters.page = 1; // Reset to first page
                    });
                    get().applyFilters();
                },

                nextPage: () => {
                    const { pagination } = get();
                    if (pagination.page < pagination.totalPages) {
                        get().setPage(pagination.page + 1);
                    }
                },

                previousPage: () => {
                    const { pagination } = get();
                    if (pagination.page > 1) {
                        get().setPage(pagination.page - 1);
                    }
                },

                // UI state management
                setCreateModalOpen: (open) => {
                    set((state) => {
                        state.ui.isCreateModalOpen = open;
                    });
                },

                setEditModalOpen: (open) => {
                    set((state) => {
                        state.ui.isEditModalOpen = open;
                    });
                },

                setDeleteConfirmOpen: (open) => {
                    set((state) => {
                        state.ui.isDeleteConfirmOpen = open;
                    });
                },

                setBulkDeleteConfirmOpen: (open) => {
                    set((state) => {
                        state.ui.isBulkDeleteConfirmOpen = open;
                    });
                },

                setViewMode: (mode) => {
                    set((state) => {
                        state.ui.viewMode = mode;
                    });
                },

                toggleSidebar: () => {
                    set((state) => {
                        state.ui.sidebarCollapsed = !state.ui.sidebarCollapsed;
                    });
                },

                // File upload management
                addFileToUpload: (file) => {
                    set((state) => {
                        state.fileUpload.files.push({
                            file,
                            progress: 0,
                            status: 'pending',
                        });
                    });
                },

                removeFileFromUpload: (fileIndex) => {
                    set((state) => {
                        state.fileUpload.files.splice(fileIndex, 1);
                    });
                },

                clearUploadFiles: () => {
                    set((state) => {
                        state.fileUpload.files = [];
                        state.fileUpload.totalProgress = 0;
                    });
                },

                updateFileProgress: (fileIndex, progress) => {
                    set((state) => {
                        if (state.fileUpload.files[fileIndex]) {
                            state.fileUpload.files[fileIndex].progress = progress;
                            state.fileUpload.files[fileIndex].status = progress === 100 ? 'completed' : 'uploading';
                        }
                    });
                },

                setFileError: (fileIndex, error) => {
                    set((state) => {
                        if (state.fileUpload.files[fileIndex]) {
                            state.fileUpload.files[fileIndex].error = error;
                            state.fileUpload.files[fileIndex].status = 'error';
                        }
                    });
                },

                // Optimistic updates
                optimisticCreateNote: (noteData) => {
                    const tempId = generateTempId();
                    const tempNote: ClinicalNote = {
                        _id: tempId,
                        patient: { _id: noteData.patient, firstName: '', lastName: '', mrn: '' },
                        pharmacist: { _id: '', firstName: '', lastName: '', role: '' },
                        workplaceId: '',
                        type: noteData.type,
                        title: noteData.title,
                        content: noteData.content,
                        medications: noteData.medications || [],
                        laborResults: noteData.laborResults || [],
                        recommendations: noteData.recommendations || [],
                        followUpRequired: noteData.followUpRequired || false,
                        followUpDate: noteData.followUpDate,
                        attachments: [],
                        priority: noteData.priority || 'medium',
                        isConfidential: noteData.isConfidential || false,
                        tags: noteData.tags || [],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        createdBy: '',
                        lastModifiedBy: '',
                    };

                    set((state) => {
                        state.notes.unshift(tempNote);
                    });

                    return tempId;
                },

                optimisticUpdateNote: (id, updates) => {
                    set((state) => {
                        const noteIndex = state.notes.findIndex(n => n._id === id);
                        if (noteIndex !== -1) {
                            state.notes[noteIndex] = { ...state.notes[noteIndex], ...updates };
                        }
                        if (state.selectedNote?._id === id) {
                            state.selectedNote = { ...state.selectedNote, ...updates };
                        }
                    });
                },

                optimisticDeleteNote: (id) => {
                    set((state) => {
                        state.notes = state.notes.filter(n => n._id !== id);
                    });
                },

                rollbackOptimisticUpdate: (tempId) => {
                    set((state) => {
                        state.notes = state.notes.filter(n => n._id !== tempId);
                    });
                },

                // State management helpers
                setLoading: (key, loading) => {
                    set((state) => {
                        state.loading[key] = loading;
                    });
                },

                setError: (key, error) => {
                    set((state) => {
                        state.errors[key] = error;
                    });
                },

                clearErrors: () => {
                    set((state) => {
                        Object.keys(state.errors).forEach(key => {
                            state.errors[key as keyof typeof state.errors] = null;
                        });
                    });
                },

                clearAllLoading: () => {
                    set((state) => {
                        Object.keys(state.loading).forEach(key => {
                            state.loading[key as keyof typeof state.loading] = false;
                        });
                    });
                },

                // Analytics and utilities
                getNotesByType: (type) => {
                    return get().notes.filter(note => note.type === type);
                },

                getNotesByPriority: (priority) => {
                    return get().notes.filter(note => note.priority === priority);
                },

                getConfidentialNotes: () => {
                    return get().notes.filter(note => note.isConfidential);
                },

                getNotesWithFollowUp: () => {
                    return get().notes.filter(note => note.followUpRequired);
                },

                getNotesWithAttachments: () => {
                    return get().notes.filter(note => note.attachments && note.attachments.length > 0);
                },

                getAllTags: () => {
                    const allTags = get().notes.flatMap(note => note.tags || []);
                    return [...new Set(allTags)];
                },

                getPatientNoteSummary: (patientId) => {
                    const patientNotes = get().notes.filter(note => note.patient._id === patientId);

                    return {
                        consultation: patientNotes.filter(n => n.type === 'consultation').length,
                        medicationReview: patientNotes.filter(n => n.type === 'medication_review').length,
                        followUp: patientNotes.filter(n => n.type === 'follow_up').length,
                        adverseEvent: patientNotes.filter(n => n.type === 'adverse_event').length,
                        other: patientNotes.filter(n => n.type === 'other').length,
                        total: patientNotes.length,
                        confidential: patientNotes.filter(n => n.isConfidential).length,
                        withFollowUp: patientNotes.filter(n => n.followUpRequired).length,
                        withAttachments: patientNotes.filter(n => n.attachments && n.attachments.length > 0).length,
                    };
                },
            })),
            {
                name: 'enhanced-clinical-note-store',
                partialize: (state) => ({
                    filters: state.filters,
                    ui: {
                        viewMode: state.ui.viewMode,
                        sidebarCollapsed: state.ui.sidebarCollapsed,
                    },
                }),
            }
        )
    )
);

// Utility hooks for easier access to specific states
export const useClinicalNotes = () =>
    useEnhancedClinicalNoteStore((state) => ({
        notes: state.notes,
        loading: state.loading.fetchNotes,
        error: state.errors.fetchNotes,
        pagination: state.pagination,
        fetchNotes: state.fetchNotes,
        fetchNotesByPatient: state.fetchNotesByPatient,
        searchNotes: state.searchNotes,
    }));

export const useSelectedNote = () =>
    useEnhancedClinicalNoteStore((state) => ({
        selectedNote: state.selectedNote,
        selectNote: state.selectNote,
        getNoteById: state.getNoteById,
    }));

export const useClinicalNoteFilters = () =>
    useEnhancedClinicalNoteStore((state) => ({
        filters: state.filters,
        searchQuery: state.searchQuery,
        setFilters: state.setFilters,
        clearFilters: state.clearFilters,
        setSearchQuery: state.setSearchQuery,
        applyFilters: state.applyFilters,
    }));

export const useClinicalNoteActions = () =>
    useEnhancedClinicalNoteStore((state) => ({
        createNote: state.createNote,
        updateNote: state.updateNote,
        deleteNote: state.deleteNote,
        bulkUpdateNotes: state.bulkUpdateNotes,
        bulkDeleteNotes: state.bulkDeleteNotes,
        bulkToggleConfidential: state.bulkToggleConfidential,
        bulkAddTags: state.bulkAddTags,
        loading: {
            create: state.loading.createNote,
            update: state.loading.updateNote,
            delete: state.loading.deleteNote,
            bulk: state.loading.bulkOperations,
        },
        errors: {
            create: state.errors.createNote,
            update: state.errors.updateNote,
            delete: state.errors.deleteNote,
            bulk: state.errors.bulkOperations,
        },
        clearErrors: state.clearErrors,
    }));

export const useClinicalNoteSelection = () =>
    useEnhancedClinicalNoteStore((state) => ({
        selectedNotes: state.selectedNotes,
        toggleNoteSelection: state.toggleNoteSelection,
        selectAllNotes: state.selectAllNotes,
        clearSelection: state.clearSelection,
        isNoteSelected: state.isNoteSelected,
    }));

export const useClinicalNoteUI = () =>
    useEnhancedClinicalNoteStore((state) => ({
        ui: state.ui,
        setCreateModalOpen: state.setCreateModalOpen,
        setEditModalOpen: state.setEditModalOpen,
        setDeleteConfirmOpen: state.setDeleteConfirmOpen,
        setBulkDeleteConfirmOpen: state.setBulkDeleteConfirmOpen,
        setViewMode: state.setViewMode,
        toggleSidebar: state.toggleSidebar,
    }));

export const useClinicalNoteFileUpload = () =>
    useEnhancedClinicalNoteStore((state) => ({
        fileUpload: state.fileUpload,
        uploadAttachment: state.uploadAttachment,
        deleteAttachment: state.deleteAttachment,
        downloadAttachment: state.downloadAttachment,
        addFileToUpload: state.addFileToUpload,
        removeFileFromUpload: state.removeFileFromUpload,
        clearUploadFiles: state.clearUploadFiles,
        updateFileProgress: state.updateFileProgress,
        setFileError: state.setFileError,
        loading: state.loading.uploadAttachment,
        error: state.errors.uploadAttachment,
    }));

export const useClinicalNoteAnalytics = () =>
    useEnhancedClinicalNoteStore((state) => ({
        getNotesByType: state.getNotesByType,
        getNotesByPriority: state.getNotesByPriority,
        getConfidentialNotes: state.getConfidentialNotes,
        getNotesWithFollowUp: state.getNotesWithFollowUp,
        getNotesWithAttachments: state.getNotesWithAttachments,
        getAllTags: state.getAllTags,
        getPatientNoteSummary: state.getPatientNoteSummary,
    }));

// Export the main store as default
export default useEnhancedClinicalNoteStore;