// Re-export the enhanced store as the main clinical note store
export {
  useEnhancedClinicalNoteStore as useClinicalNoteStore,
  useClinicalNotes,
  useSelectedNote,
  useClinicalNoteFilters,
  useClinicalNoteActions,
  useClinicalNoteSelection,
  useClinicalNoteUI,
  useClinicalNoteFileUpload,
  useClinicalNoteAnalytics,
} from './enhancedClinicalNoteStore';

// For backward compatibility, also export as default
export { default } from './enhancedClinicalNoteStore';