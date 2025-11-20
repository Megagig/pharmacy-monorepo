import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Alert,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Grid,
  Tooltip,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  AttachFile as AttachFileIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  InsertDriveFile as FileIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Attachment } from '../types/clinicalNote';
import clinicalNoteService from '../services/clinicalNoteService';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  file?: File; // For local files before upload
  uploadProgress?: number;
  uploadStatus?: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface NoteFileUploadProps {
  onFilesUploaded: (files: UploadedFile[]) => void;
  onAttachmentDeleted?: (attachmentId: string) => void;
  existingAttachments?: Attachment[];
  noteId?: string; // For existing notes
  maxFiles?: number;
  acceptedTypes?: string[];
  maxFileSize?: number; // in bytes
  disabled?: boolean;
  showPreview?: boolean;
}

const NoteFileUpload: React.FC<NoteFileUploadProps> = ({
  onFilesUploaded,
  onAttachmentDeleted,
  existingAttachments = [],
  noteId,
  maxFiles = 5,
  acceptedTypes = [
    'image/*',
    'application/pdf',
    '.doc',
    '.docx',
    '.txt',
    '.csv',
  ],
  maxFileSize = 10 * 1024 * 1024, // 10MB
  disabled = false,
  showPreview = true,
}) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<
    UploadedFile | Attachment | null
  >(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon />;
    if (mimeType === 'application/pdf') return <PdfIcon />;
    if (mimeType.includes('word') || mimeType.includes('document'))
      return <DocIcon />;
    return <FileIcon />;
  };

  const isImageFile = (mimeType: string): boolean => {
    return mimeType.startsWith('image/');
  };

  const isPdfFile = (mimeType: string): boolean => {
    return mimeType === 'application/pdf';
  };

  const canPreview = (mimeType: string): boolean => {
    return (
      isImageFile(mimeType) || isPdfFile(mimeType) || mimeType === 'text/plain'
    );
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File size exceeds ${formatFileSize(maxFileSize)}`;
    }

    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    const isValidType = acceptedTypes.some((type) => {
      if (type.startsWith('.')) {
        return fileName.endsWith(type);
      }
      if (type.includes('*')) {
        const baseType = type.split('/')[0];
        return fileType.startsWith(baseType);
      }
      return fileType === type;
    });

    if (!isValidType) {
      return `File type not supported. Accepted types: ${acceptedTypes.join(
        ', '
      )}`;
    }

    return null;
  };

  const handleFileSelect = useCallback(
    async (selectedFiles: FileList) => {
      setError(null);

      const totalFiles =
        files.length + existingAttachments.length + selectedFiles.length;
      if (totalFiles > maxFiles) {
        setError(`Maximum ${maxFiles} files allowed`);
        return;
      }

      const validFiles: File[] = [];
      const errors: string[] = [];

      Array.from(selectedFiles).forEach((file) => {
        const validationError = validateFile(file);
        if (validationError) {
          errors.push(`${file.name}: ${validationError}`);
        } else {
          validFiles.push(file);
        }
      });

      if (errors.length > 0) {
        setError(errors.join(', '));
        return;
      }

      if (validFiles.length === 0) return;

      setUploading(true);
      setUploadProgress(0);

      try {
        if (noteId) {
          // Upload to existing note
          const response = await clinicalNoteService.uploadAttachment(
            noteId,
            validFiles
          );

          // Convert API response to UploadedFile format
          const uploadedFiles: UploadedFile[] = response.attachments.map(
            (att) => ({
              id: att._id,
              name: att.originalName,
              size: att.size,
              type: att.mimeType,
              url: att.url,
              uploadStatus: 'completed' as const,
            })
          );

          const newFiles = [...files, ...uploadedFiles];
          setFiles(newFiles);
          onFilesUploaded(newFiles);
          showSnackbar(`Successfully uploaded ${validFiles.length} file(s)`);
        } else {
          // For new notes, store files locally until note is created
          const localFiles: UploadedFile[] = validFiles.map((file, i) => ({
            id: `local-${Date.now()}-${i}`,
            name: file.name,
            size: file.size,
            type: file.type,
            url: URL.createObjectURL(file),
            file,
            uploadStatus: 'pending' as const,
          }));

          const newFiles = [...files, ...localFiles];
          setFiles(newFiles);
          onFilesUploaded(newFiles);
          showSnackbar(`Added ${validFiles.length} file(s) for upload`);
        }
      } catch (error: any) {
        setError(error.message || 'Failed to upload files. Please try again.');
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [
      files,
      existingAttachments,
      maxFiles,
      maxFileSize,
      acceptedTypes,
      onFilesUploaded,
      noteId,
    ]
  );

  const handleFileRemove = (fileId: string) => {
    const updatedFiles = files.filter((file) => file.id !== fileId);
    setFiles(updatedFiles);
    onFilesUploaded(updatedFiles);
  };

  const handleAttachmentDelete = async (attachmentId: string) => {
    if (!noteId) return;

    try {
      await clinicalNoteService.deleteAttachment(noteId, attachmentId);
      onAttachmentDeleted?.(attachmentId);
      showSnackbar('Attachment deleted successfully');
    } catch (error: any) {
      setError(error.message || 'Failed to delete attachment');
    }
  };

  const handleAttachmentDownload = async (attachment: Attachment) => {
    if (!noteId) return;

    try {
      const blob = await clinicalNoteService.downloadAttachment(
        noteId,
        attachment._id
      );

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSnackbar('Download started');
    } catch (error: any) {
      setError(error.message || 'Failed to download attachment');
    }
  };

  const handlePreviewFile = (file: UploadedFile | Attachment) => {
    setPreviewFile(file);
    setPreviewOpen(true);
  };

  const handleDeleteConfirm = (
    fileId: string,
    isAttachment: boolean = false
  ) => {
    setFileToDelete(fileId);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!fileToDelete) return;

    try {
      // Check if it's an existing attachment or local file
      const isExistingAttachment = existingAttachments.some(
        (att) => att._id === fileToDelete
      );

      if (isExistingAttachment) {
        await handleAttachmentDelete(fileToDelete);
      } else {
        handleFileRemove(fileToDelete);
      }
    } catch (error: unknown) {
      setError(error.message || 'Failed to delete file');
    } finally {
      setDeleteConfirmOpen(false);
      setFileToDelete(null);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled || uploading) return;

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        handleFileSelect(droppedFiles);
      }
    },
    [disabled, uploading, handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const totalFiles = files.length + existingAttachments.length;

  return (
    <Box>
      {/* Upload Area */}
      <Box
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        sx={{
          border: '2px dashed',
          borderColor: disabled ? 'grey.300' : 'primary.main',
          borderRadius: 2,
          p: 3,
          textAlign: 'center',
          backgroundColor: disabled ? 'grey.50' : 'background.paper',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: disabled ? 'grey.50' : 'action.hover',
          },
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
          style={{ display: 'none' }}
          id="file-upload-input"
          disabled={disabled || uploading}
        />

        <label
          htmlFor="file-upload-input"
          style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          <UploadIcon
            sx={{
              fontSize: 48,
              color: disabled ? 'grey.400' : 'primary.main',
              mb: 1,
            }}
          />
          <Typography variant="h6" gutterBottom>
            {uploading ? 'Uploading...' : 'Drop files here or click to browse'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Maximum {maxFiles} files, up to {formatFileSize(maxFileSize)} each
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Supported: {acceptedTypes.join(', ')}
          </Typography>
        </label>

        {uploading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={uploadProgress} />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {Math.round(uploadProgress)}% uploaded
            </Typography>
          </Box>
        )}
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Existing Attachments */}
      {existingAttachments.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Existing Attachments ({existingAttachments.length})
          </Typography>
          <Grid container spacing={2}>
            {existingAttachments.map((attachment) => (
              <Grid item xs={12} sm={6} md={4} key={attachment._id}>
                <Card variant="outlined">
                  {isImageFile(attachment.mimeType) && showPreview && (
                    <CardMedia
                      component="img"
                      height="120"
                      image={attachment.url}
                      alt={attachment.originalName}
                      sx={{ objectFit: 'cover', cursor: 'pointer' }}
                      onClick={() => handlePreviewFile(attachment)}
                    />
                  )}
                  <CardContent sx={{ pb: 1 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      {getFileIcon(attachment.mimeType)}
                      <Typography
                        variant="body2"
                        noWrap
                        title={attachment.originalName}
                      >
                        {attachment.originalName}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(attachment.size)}
                    </Typography>
                    <Chip
                      label={attachment.mimeType}
                      size="small"
                      variant="outlined"
                      sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                    />
                  </CardContent>
                  <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
                    <Box>
                      {canPreview(attachment.mimeType) && (
                        <Tooltip title="Preview">
                          <IconButton
                            size="small"
                            onClick={() => handlePreviewFile(attachment)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Download">
                        <IconButton
                          size="small"
                          onClick={() => handleAttachmentDownload(attachment)}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() =>
                          handleDeleteConfirm(attachment._id, true)
                        }
                        disabled={disabled}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* New Files */}
      {files.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            New Files ({files.length})
          </Typography>
          <Grid container spacing={2}>
            {files.map((file) => (
              <Grid item xs={12} sm={6} md={4} key={file.id}>
                <Card variant="outlined">
                  {isImageFile(file.type) && showPreview && file.url && (
                    <CardMedia
                      component="img"
                      height="120"
                      image={file.url}
                      alt={file.name}
                      sx={{ objectFit: 'cover', cursor: 'pointer' }}
                      onClick={() => handlePreviewFile(file)}
                    />
                  )}
                  <CardContent sx={{ pb: 1 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      {getFileIcon(file.type)}
                      <Typography variant="body2" noWrap title={file.name}>
                        {file.name}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(file.size)}
                    </Typography>
                    <Chip
                      label={file.type}
                      size="small"
                      variant="outlined"
                      sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                    />
                    {file.uploadStatus && (
                      <Box display="flex" alignItems="center" gap={1} mt={1}>
                        {file.uploadStatus === 'uploading' && (
                          <CircularProgress size={16} />
                        )}
                        <Chip
                          label={file.uploadStatus}
                          size="small"
                          color={
                            file.uploadStatus === 'completed'
                              ? 'success'
                              : file.uploadStatus === 'error'
                              ? 'error'
                              : 'default'
                          }
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </Box>
                    )}
                  </CardContent>
                  <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
                    <Box>
                      {canPreview(file.type) && file.url && (
                        <Tooltip title="Preview">
                          <IconButton
                            size="small"
                            onClick={() => handlePreviewFile(file)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                    <Tooltip title="Remove">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteConfirm(file.id)}
                        disabled={disabled || uploading}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Upload Button */}
      {!uploading && totalFiles < maxFiles && (
        <Button
          component="label"
          variant="outlined"
          startIcon={<UploadIcon />}
          disabled={disabled}
          sx={{ mt: 2 }}
          onClick={() => fileInputRef.current?.click()}
        >
          Add More Files
        </Button>
      )}

      {/* File Preview Dialog */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">
              {'originalName' in (previewFile || {})
                ? (previewFile as Attachment).originalName
                : (previewFile as UploadedFile)?.name}
            </Typography>
            <IconButton onClick={() => setPreviewOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {previewFile && (
            <Box textAlign="center">
              {isImageFile(
                'mimeType' in previewFile
                  ? previewFile.mimeType
                  : previewFile.type
              ) ? (
                <img
                  src={'url' in previewFile ? previewFile.url : previewFile.url}
                  alt={
                    'originalName' in previewFile
                      ? previewFile.originalName
                      : previewFile.name
                  }
                  style={{ maxWidth: '100%', maxHeight: '70vh' }}
                />
              ) : isPdfFile(
                  'mimeType' in previewFile
                    ? previewFile.mimeType
                    : previewFile.type
                ) ? (
                <iframe
                  src={'url' in previewFile ? previewFile.url : previewFile.url}
                  width="100%"
                  height="500px"
                  title="PDF Preview"
                />
              ) : (
                <Typography variant="body1" color="text.secondary">
                  Preview not available for this file type
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {'_id' in (previewFile || {}) && (
            <Button
              startIcon={<DownloadIcon />}
              onClick={() =>
                handleAttachmentDownload(previewFile as Attachment)
              }
            >
              Download
            </Button>
          )}
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this file? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default NoteFileUpload;
