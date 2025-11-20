import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Chip,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  TableChart as ExcelIcon,
  TextSnippet as TextIcon,
} from '@mui/icons-material';

interface FileAttachment {
  fileId: string;
  fileName: string;
  originalName?: string;
  fileSize: number;
  mimeType: string;
  secureUrl: string;
  uploadedAt?: string;
}

interface FilePreviewProps {
  file: FileAttachment;
  showPreview?: boolean;
  showDownload?: boolean;
  showDetails?: boolean;
  compact?: boolean;
  onDownload?: (file: FileAttachment) => void;
  onPreview?: (file: FileAttachment) => void;
}

interface FilePreviewDialogProps {
  file: FileAttachment;
  open: boolean;
  onClose: () => void;
  onDownload?: (file: FileAttachment) => void;
}

const getFileIcon = (
  mimeType: string,
  size: 'small' | 'medium' | 'large' = 'medium'
) => {
  const iconProps = { fontSize: size };

  if (mimeType.startsWith('image/')) return <ImageIcon {...iconProps} />;
  if (mimeType === 'application/pdf') return <PdfIcon {...iconProps} />;
  if (mimeType.includes('document') || mimeType.includes('word'))
    return <DocIcon {...iconProps} />;
  if (mimeType.includes('sheet') || mimeType.includes('excel'))
    return <ExcelIcon {...iconProps} />;
  if (mimeType.startsWith('text/')) return <TextIcon {...iconProps} />;
  return <FileIcon {...iconProps} />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileTypeLabel = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.includes('document') || mimeType.includes('word'))
    return 'Document';
  if (mimeType.includes('sheet') || mimeType.includes('excel'))
    return 'Spreadsheet';
  if (mimeType.startsWith('text/')) return 'Text';
  return 'File';
};

const FilePreviewDialog: React.FC<FilePreviewDialogProps> = ({
  file,
  open,
  onClose,
  onDownload,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(file.secureUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.originalName || file.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      onDownload?.(file);
    } catch (err: any) {
      setError(err.message || 'Download failed');
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = () => {
    if (file.mimeType.startsWith('image/')) {
      return (
        <Box
          component="img"
          src={file.secureUrl}
          alt={file.originalName || file.fileName}
          sx={{
            maxWidth: '100%',
            maxHeight: '60vh',
            objectFit: 'contain',
          }}
          onError={() => setError('Failed to load image')}
        />
      );
    }

    if (file.mimeType === 'application/pdf') {
      return (
        <Box sx={{ height: '60vh', width: '100%' }}>
          <iframe
            src={`${file.secureUrl}#toolbar=0`}
            width="100%"
            height="100%"
            style={{ border: 'none' }}
            title={file.originalName || file.fileName}
          />
        </Box>
      );
    }

    if (file.mimeType.startsWith('text/')) {
      return (
        <Box
          sx={{
            p: 2,
            backgroundColor: 'grey.50',
            borderRadius: 1,
            maxHeight: '60vh',
            overflow: 'auto',
          }}
        >
          <Typography
            variant="body2"
            component="pre"
            sx={{ whiteSpace: 'pre-wrap' }}
          >
            {/* Text content would be loaded here */}
            Text preview not available. Please download to view the file.
          </Typography>
        </Box>
      );
    }

    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        sx={{ height: '200px', backgroundColor: 'grey.50', borderRadius: 1 }}
      >
        {getFileIcon(file.mimeType, 'large')}
        <Typography variant="h6" sx={{ mt: 2 }}>
          {getFileTypeLabel(file.mimeType)} Preview
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Preview not available for this file type
        </Typography>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            {getFileIcon(file.mimeType)}
            <Typography variant="h6" noWrap>
              {file.originalName || file.fileName}
            </Typography>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error ? (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            sx={{ height: '200px' }}
          >
            <Typography color="error" gutterBottom>
              {error}
            </Typography>
            <Button onClick={() => setError(null)}>Try Again</Button>
          </Box>
        ) : (
          renderPreview()
        )}

        <Box mt={2} display="flex" gap={1} flexWrap="wrap">
          <Chip
            label={getFileTypeLabel(file.mimeType)}
            size="small"
            variant="outlined"
          />
          <Chip
            label={formatFileSize(file.fileSize)}
            size="small"
            variant="outlined"
          />
          {file.uploadedAt && (
            <Chip
              label={`Uploaded ${new Date(
                file.uploadedAt
              ).toLocaleDateString()}`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          startIcon={
            loading ? <CircularProgress size={16} /> : <DownloadIcon />
          }
          onClick={handleDownload}
          disabled={loading}
        >
          {loading ? 'Downloading...' : 'Download'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  showPreview = true,
  showDownload = true,
  showDetails = true,
  compact = false,
  onDownload,
  onPreview,
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);

      const response = await fetch(file.secureUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.originalName || file.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      onDownload?.(file);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = () => {
    setPreviewOpen(true);
    onPreview?.(file);
  };

  if (compact) {
    return (
      <Box display="flex" alignItems="center" gap={1} sx={{ p: 1 }}>
        {getFileIcon(file.mimeType, 'small')}
        <Typography variant="body2" noWrap sx={{ flex: 1 }}>
          {file.originalName || file.fileName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatFileSize(file.fileSize)}
        </Typography>
        {showPreview && (
          <Tooltip title="Preview">
            <IconButton size="small" onClick={handlePreview}>
              <ViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {showDownload && (
          <Tooltip title="Download">
            <IconButton
              size="small"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <CircularProgress size={16} />
              ) : (
                <DownloadIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        )}

        <FilePreviewDialog
          file={file}
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          onDownload={onDownload}
        />
      </Box>
    );
  }

  return (
    <Card sx={{ maxWidth: 300 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          {getFileIcon(file.mimeType)}
          <Box flex={1} minWidth={0}>
            <Typography variant="subtitle2" noWrap>
              {file.originalName || file.fileName}
            </Typography>
            {showDetails && (
              <Typography variant="caption" color="text.secondary">
                {getFileTypeLabel(file.mimeType)} •{' '}
                {formatFileSize(file.fileSize)}
              </Typography>
            )}
          </Box>
        </Box>

        {showDetails && file.uploadedAt && (
          <Typography variant="caption" color="text.secondary">
            Uploaded {new Date(file.uploadedAt).toLocaleDateString()}
          </Typography>
        )}
      </CardContent>

      <CardActions>
        {showPreview && (
          <Button size="small" startIcon={<ViewIcon />} onClick={handlePreview}>
            Preview
          </Button>
        )}
        {showDownload && (
          <Button
            size="small"
            startIcon={
              downloading ? <CircularProgress size={16} /> : <DownloadIcon />
            }
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? 'Downloading...' : 'Download'}
          </Button>
        )}
      </CardActions>

      <FilePreviewDialog
        file={file}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onDownload={onDownload}
      />
    </Card>
  );
};

export default FilePreview;
