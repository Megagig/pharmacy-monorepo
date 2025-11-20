import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
} from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Stack,
  useTheme,
  Skeleton,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
  Schedule as ScheduleIcon,
  AttachFile as AttachFileIcon,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import {
  ClinicalNote,
  NOTE_TYPES,
  NOTE_PRIORITIES,
} from '../types/clinicalNote';

interface VirtualizedClinicalNotesListProps {
  notes: ClinicalNote[];
  height: number;
  itemHeight?: number;
  onNoteView?: (note: ClinicalNote) => void;
  onNoteEdit?: (note: ClinicalNote) => void;
  onNoteDelete?: (note: ClinicalNote) => void;
  onNoteSelect?: (noteId: string) => void;
  selectedNotes?: string[];
  loading?: boolean;
  overscan?: number;
}

interface NoteItemProps {
  index: number;
  style: React.CSSProperties;
  note: ClinicalNote;
  onNoteView?: (note: ClinicalNote) => void;
  onNoteEdit?: (note: ClinicalNote) => void;
  onNoteDelete?: (note: ClinicalNote) => void;
  onNoteSelect?: (noteId: string) => void;
  selectedNotes?: string[];
}

// Memoized note item component for performance
const NoteItem: React.FC<NoteItemProps> = React.memo(
  ({ index, style, data }) => {
    const theme = useTheme();
    const {
      notes,
      onNoteView,
      onNoteEdit,
      onNoteDelete,
      onNoteSelect,
      selectedNotes = [],
    } = data;

    const note = notes[index];
    const isSelected = selectedNotes.includes(note._id);

    const formatDate = useCallback((dateString: string) => {
      try {
        return format(parseISO(dateString), 'MMM dd, yyyy HH:mm');
      } catch {
        return dateString;
      }
    }, []);

    const formatPatientName = useCallback(
      (patient: ClinicalNote['patient']) => {
        return `${patient.firstName} ${patient.lastName}`;
      },
      []
    );

    const formatPharmacistName = useCallback(
      (pharmacist: ClinicalNote['pharmacist']) => {
        return `${pharmacist.firstName} ${pharmacist.lastName}`;
      },
      []
    );

    const PriorityChip = React.memo(
      ({ priority }: { priority: ClinicalNote['priority'] }) => {
        const priorityInfo = NOTE_PRIORITIES.find((p) => p.value === priority);
        return (
          <Chip
            label={priorityInfo?.label || priority}
            size="small"
            sx={{
              backgroundColor: priorityInfo?.color || '#757575',
              color: 'white',
              fontWeight: 500,
              height: 20,
              fontSize: '0.75rem',
            }}
          />
        );
      }
    );

    const TypeChip = React.memo(({ type }: { type: ClinicalNote['type'] }) => {
      const typeInfo = NOTE_TYPES.find((t) => t.value === type);
      return (
        <Chip
          label={typeInfo?.label || type}
          size="small"
          variant="outlined"
          color="primary"
          sx={{ height: 20, fontSize: '0.75rem' }}
        />
      );
    });

    if (!note) {
      return (
        <div style={style}>
          <Card sx={{ m: 1, height: 'calc(100% - 16px)' }}>
            <CardContent>
              <Skeleton variant="text" width="60%" height={24} />
              <Skeleton variant="text" width="40%" height={20} />
              <Skeleton variant="text" width="80%" height={20} />
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div style={style}>
        <Card
          sx={{
            m: 1,
            height: 'calc(100% - 16px)',
            border: isSelected
              ? `2px solid ${theme.palette.primary.main}`
              : '1px solid #e0e0e0',
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              boxShadow: theme.shadows[4],
              transform: 'translateY(-1px)',
            },
          }}
          onClick={() => onNoteSelect?.(note._id)}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="subtitle1"
                  component="h3"
                  sx={{
                    fontWeight: 600,
                    mb: 0.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {note.title}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  flexWrap="wrap"
                  sx={{ mb: 1 }}
                >
                  <TypeChip type={note.type} />
                  <PriorityChip priority={note.priority} />
                  {note.isConfidential && (
                    <Chip
                      icon={<SecurityIcon sx={{ fontSize: '0.75rem' }} />}
                      label="Confidential"
                      size="small"
                      color="warning"
                      sx={{ height: 20, fontSize: '0.75rem' }}
                    />
                  )}
                </Stack>
              </Box>
              <Stack direction="row" spacing={0.5}>
                {onNoteView && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNoteView(note);
                    }}
                    sx={{ p: 0.5 }}
                  >
                    <ViewIcon fontSize="small" />
                  </IconButton>
                )}
                {onNoteEdit && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNoteEdit(note);
                    }}
                    sx={{ p: 0.5 }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
                {onNoteDelete && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNoteDelete(note);
                    }}
                    color="error"
                    sx={{ p: 0.5 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            </Box>

            {/* Patient and Pharmacist Info */}
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary" noWrap>
                Patient: <strong>{formatPatientName(note.patient)}</strong>{' '}
                (MRN: {note.patient.mrn})
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                Pharmacist: {formatPharmacistName(note.pharmacist)}
              </Typography>
            </Box>

            {/* Footer */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {formatDate(note.createdAt)}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                {note.followUpRequired && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ScheduleIcon
                      color="warning"
                      sx={{ fontSize: '0.875rem', mr: 0.25 }}
                    />
                    <Typography variant="caption" color="warning.main">
                      Follow-up
                    </Typography>
                  </Box>
                )}
                {note.attachments?.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <AttachFileIcon
                      color="action"
                      sx={{ fontSize: '0.875rem', mr: 0.25 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {note.attachments.length}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </div>
    );
  }
);

NoteItem.displayName = 'NoteItem';

const VirtualizedClinicalNotesList: React.FC<
  VirtualizedClinicalNotesListProps
> = ({
  notes,
  height,
  itemHeight = 160,
  onNoteView,
  onNoteEdit,
  onNoteDelete,
  onNoteSelect,
  selectedNotes = [],
  loading = false,
  overscan = 5,
}) => {
  const [isScrolling, setIsScrolling] = useState(false);

  // Memoize the item data to prevent unnecessary re-renders
  const itemData = useMemo(
    () => ({
      notes,
      onNoteView,
      onNoteEdit,
      onNoteDelete,
      onNoteSelect,
      selectedNotes,
    }),
    [notes, onNoteView, onNoteEdit, onNoteDelete, onNoteSelect, selectedNotes]
  );

  // Handle scroll events for performance optimization
  const handleItemsRendered = useCallback(() => {
    // This can be used for analytics or lazy loading more data
  }, []);

  const onScroll = useCallback(() => {
    if (!isScrolling) {
      setIsScrolling(true);
    }
  }, [isScrolling]);

  // Reset scrolling state after scroll ends
  useEffect(() => {
    if (isScrolling) {
      const timer = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isScrolling]);

  if (loading) {
    return (
      <Box sx={{ height }}>
        {Array.from({ length: Math.ceil(height / itemHeight) }).map(
          (_, index) => (
            <Card key={index} sx={{ m: 1, height: itemHeight - 16 }}>
              <CardContent>
                <Skeleton variant="text" width="60%" height={24} />
                <Skeleton variant="text" width="40%" height={20} />
                <Skeleton variant="text" width="80%" height={20} />
                <Box sx={{ mt: 1 }}>
                  <Skeleton
                    variant="rectangular"
                    width={60}
                    height={20}
                    sx={{ mr: 1, display: 'inline-block' }}
                  />
                  <Skeleton
                    variant="rectangular"
                    width={80}
                    height={20}
                    sx={{ display: 'inline-block' }}
                  />
                </Box>
              </CardContent>
            </Card>
          )
        )}
      </Box>
    );
  }

  if (notes.length === 0) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Typography variant="h6" color="text.secondary">
          No clinical notes found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Try adjusting your search or filters
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height, width: '100%' }}>
      <List
        height={height}
        itemCount={notes.length}
        itemSize={itemHeight}
        itemData={itemData}
        overscanCount={overscan}
        onItemsRendered={handleItemsRendered}
        onScroll={onScroll}
        style={{
          // Optimize scrolling performance
          willChange: isScrolling ? 'transform' : 'auto',
        }}
      >
        {NoteItem}
      </List>
    </Box>
  );
};

export default React.memo(VirtualizedClinicalNotesList);
