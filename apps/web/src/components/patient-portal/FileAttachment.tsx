import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  TextSnippet as TextIcon
} from '@mui/icons-material';

interface FileAttachmentData {
  id: string;
  filename: string;
  url: string;
  type: string;
  size: number;
}

interface FileAttachmentProps {
  attachment: FileAttachmentData;
  variant?: 'message' | 'card' | 'chip';
  onRemove?: () => void;
  showPreview?: boolean;
}

const FileAttachment: React.FC<FileAttachmentProps> = ({
  attachment,
  variant = 'card',
  onRemove,
  showPreview = true
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon />;
    } else if (fileType === 'application/pdf') {
      return <PdfIcon />;
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return <DocIcon />;
    } else if (fileType.startsWith('text/')) {
      return <TextIcon />;
    } else {
      return <FileIcon />;
    }
  };

  const getFileTypeLabel = (fileType: string): string => {
    if (fileType.startsWith('image/')) {
      return 'Image';
    } else if (fileType === 'application/pdf') {
      return 'PDF';
    } else if (fileType.includes('word')) {
      return 'Word Document';
    } else if (fileType.startsWith('text/')) {
      return 'Text File';
    } else {
      return 'File';
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);

    try {
      const response = await fetch(attachment.url);
      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      setError(error.message || 'Failed to download file');
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = () => {
    if (attachment.type.startsWith('image/') || attachment.type === 'application/pdf') {
      setPreviewOpen(true);
    } else {
      // For non-previewable files, just download
      handleDownload();
    }
  };

  const canPreview = attachment.type.startsWith('image/') || attachment.type === 'application/pdf';

  // Chip variant for inline display
  if (variant === 'chip') {
    return (
      <Chip
        icon={getFileIcon(attachment.type)}
        label={attachment.filename}
        onDelete={onRemove}
        deleteIcon={<CloseIcon />}
        variant="outlined"
        size="small"
        clickable
        onClick={handlePreview}
      />
    );
  }

  // Message variant for display within messages
  if (variant === 'message') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          cursor: 'pointer',
          '&:hover': {
            bgcolor: 'action.hover'
          }
        }}
        onClick={handlePreview}
      >
        {getFileIcon(attachment.type)}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap>
            {attachment.filename}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {getFileTypeLabel(attachment.type)} • {formatFileSize(attachment.size)}
          </Typography>
        </Box>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDownload(); }}>
          {downloading ? <CircularProgress size={16} /> : <DownloadIcon />}
        </IconButton>
      </Box>
    );
  }

  // Card variant for detailed display
  return (
    <>
      <Card variant="outlined" sx={{ maxWidth: 300 }}>
        <CardContent sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Box sx={{ color: 'primary.main', mt: 0.5 }}>
              {getFileIcon(attachment.type)}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap title={attachment.filename}>
                {attachment.filename}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {getFileTypeLabel(attachment.type)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatFileSize(attachment.size)}
              </Typography>
            </Box>
            {onRemove && (
              <IconButton size="small" onClick={onRemove}>
                <CloseIcon />
              </IconButton>
            )}
          </Box>
        </CardContent>

        <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {canPreview && showPreview && (
              <Button
                size="small"
                startIcon={<ViewIcon />}
                onClick={handlePreview}
              >
                Preview
              </Button>
            )}
            <Button
              size="small"
              startIcon={downloading ? <CircularProgress size={16} /> : <DownloadIcon />}
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? 'Downloading...' : 'Download'}
            </Button>
          </Box>
        </CardActions>

        {error && (
          <Alert severity="error" sx={{ m: 1, mt: 0 }}>
            {error}
          </Alert>
        )}
      </Card>

      {/* Preview Dialog */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" noWrap>
            {attachment.filename}
          </Typography>
          <IconButton onClick={() => setPreviewOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {attachment.type.startsWith('image/') ? (
            <Box
              component="img"
              src={attachment.url}
              alt={attachment.filename}
              sx={{
                width: '100%',
                height: 'auto',
                maxHeight: '70vh',
                objectFit: 'contain'
              }}
            />
          ) : attachment.type === 'application/pdf' ? (
            <Box
              component="iframe"
              src={attachment.url}
              sx={{
                width: '100%',
                height: '70vh',
                border: 'none'
              }}
            />
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                Preview not available for this file type
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            startIcon={downloading ? <CircularProgress size={16} /> : <DownloadIcon />}
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? 'Downloading...' : 'Download'}
          </Button>
          <Button onClick={() => setPreviewOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FileAttachment;