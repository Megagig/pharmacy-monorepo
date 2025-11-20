import React, { useState, useRef, KeyboardEvent } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Button,
  Chip,
  Typography,
  LinearProgress,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
  InsertDriveFile as FileIcon
} from '@mui/icons-material';

interface MessageInputProps {
  onSendMessage: (content: string, attachments?: File[]) => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  maxFileSize?: number; // in MB
  allowedFileTypes?: string[];
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  disabled = false,
  loading = false,
  placeholder = 'Type your message...',
  maxFileSize = 10, // 10MB default
  allowedFileTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
}) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSendMessage = async () => {
    if (!message.trim() && attachments.length === 0) return;

    setError(null);
    try {
      await onSendMessage(message.trim(), attachments);
      setMessage('');
      setAttachments([]);
      setUploadProgress({});
    } catch (error: any) {
      setError(error.message || 'Failed to send message');
    }
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach(file => {
      // Check file type
      if (!allowedFileTypes.includes(file.type)) {
        errors.push(`${file.name}: File type not supported`);
        return;
      }

      // Check file size
      if (file.size > maxFileSize * 1024 * 1024) {
        errors.push(`${file.name}: File size exceeds ${maxFileSize}MB limit`);
        return;
      }

      // Check if file already attached
      if (attachments.some(existing => existing.name === file.name && existing.size === file.size)) {
        errors.push(`${file.name}: File already attached`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      setError(errors.join(', '));
    } else {
      setError(null);
    }

    if (validFiles.length > 0) {
      setAttachments(prev => [...prev, ...validFiles]);
      
      // Simulate upload progress for each file
      validFiles.forEach(file => {
        const fileKey = `${file.name}_${file.size}`;
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 30;
          if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
          }
          setUploadProgress(prev => ({ ...prev, [fileKey]: progress }));
        }, 200);
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (fileToRemove: File) => {
    setAttachments(prev => prev.filter(file => file !== fileToRemove));
    const fileKey = `${fileToRemove.name}_${fileToRemove.size}`;
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileKey];
      return newProgress;
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return '🖼️';
    } else if (fileType === 'application/pdf') {
      return '📄';
    } else if (fileType.includes('word')) {
      return '📝';
    } else {
      return '📎';
    }
  };

  const canSend = (message.trim().length > 0 || attachments.length > 0) && !loading && !disabled;

  return (
    <Box sx={{ p: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* File Attachments Preview */}
      {attachments.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Attachments ({attachments.length})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {attachments.map((file, index) => {
              const fileKey = `${file.name}_${file.size}`;
              const progress = uploadProgress[fileKey] || 0;
              
              return (
                <Chip
                  key={index}
                  icon={<FileIcon />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{getFileIcon(file.type)}</span>
                      <Box>
                        <Typography variant="caption" display="block">
                          {file.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(file.size)}
                        </Typography>
                      </Box>
                    </Box>
                  }
                  onDelete={() => handleRemoveAttachment(file)}
                  deleteIcon={<CloseIcon />}
                  variant="outlined"
                  sx={{
                    height: 'auto',
                    py: 1,
                    '& .MuiChip-label': {
                      display: 'block',
                      whiteSpace: 'normal'
                    }
                  }}
                />
              );
            })}
          </Box>

          {/* Upload Progress */}
          {Object.values(uploadProgress).some(progress => progress < 100) && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Uploading files...
              </Typography>
              <LinearProgress
                variant="determinate"
                value={
                  Object.values(uploadProgress).reduce((sum, progress) => sum + progress, 0) /
                  Object.values(uploadProgress).length
                }
                sx={{ mt: 0.5 }}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Message Input */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          accept={allowedFileTypes.join(',')}
          style={{ display: 'none' }}
        />

        <Tooltip title="Attach files">
          <IconButton
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || loading}
            size="small"
            sx={{ mb: 1 }}
          >
            <AttachFileIcon />
          </IconButton>
        </Tooltip>

        <TextField
          fullWidth
          multiline
          maxRows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled || loading}
          variant="outlined"
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
            }
          }}
        />

        <Button
          variant="contained"
          onClick={handleSendMessage}
          disabled={!canSend}
          startIcon={loading ? undefined : <SendIcon />}
          sx={{
            minWidth: 80,
            borderRadius: 3,
            mb: 0.5
          }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  border: 2,
                  borderColor: 'currentColor',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}
              />
              Sending
            </Box>
          ) : (
            'Send'
          )}
        </Button>
      </Box>

      {/* File Upload Guidelines */}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Supported files: Images, PDF, Word documents, Text files (max {maxFileSize}MB each)
      </Typography>

      {/* Spinning Animation */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </Box>
  );
};

export default MessageInput;