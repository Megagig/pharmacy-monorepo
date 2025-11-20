import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Chip,
  Collapse,
  Typography,
  Button,
  Menu,
  MenuItem,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Send,
  AttachFile,
  CameraAlt,
  Mic,
  EmojiEmotions,
  Add,
  Close,
  PhotoLibrary,
  Description,
  LocationOn,
} from '@mui/icons-material';
import { useIsTouchDevice } from '../../hooks/useResponsive';
import MobileFileUpload from './MobileFileUpload';

interface MobileMessageInputProps {
  conversationId: string;
  onSendMessage: (
    content: string,
    attachments?: File[],
    threadId?: string,
    parentMessageId?: string,
    mentions?: string[]
  ) => Promise<void>;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  replyToMessage?: any;
  onCancelReply?: () => void;
  threadId?: string;
  parentMessageId?: string;
}

export interface MobileMessageInputRef {
  focus: () => void;
  clear: () => void;
  insertText: (text: string) => void;
}

const MobileMessageInput = forwardRef<
  MobileMessageInputRef,
  MobileMessageInputProps
>(
  (
    {
      conversationId,
      onSendMessage,
      onTypingStart,
      onTypingStop,
      disabled = false,
      placeholder = 'Type a message...',
      replyToMessage,
      onCancelReply,
      threadId,
      parentMessageId,
    },
    ref
  ) => {
    const [message, setMessage] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [attachmentMenuAnchor, setAttachmentMenuAnchor] =
      useState<null | HTMLElement>(null);
    const [mentions, setMentions] = useState<string[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    const isTouchDevice = useIsTouchDevice();

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => {
        setMessage('');
        setAttachments([]);
        setMentions([]);
      },
      insertText: (text: string) => {
        setMessage((prev) => prev + text);
        inputRef.current?.focus();
      },
    }));

    // Handle typing indicators
    useEffect(() => {
      if (message.trim()) {
        onTypingStart?.();

        // Clear existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Set new timeout to stop typing indicator
        typingTimeoutRef.current = setTimeout(() => {
          onTypingStop?.();
        }, 1000);
      } else {
        onTypingStop?.();
      }

      return () => {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      };
    }, [message, onTypingStart, onTypingStop]);

    // Handle message change
    const handleMessageChange = (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      const value = event.target.value;
      setMessage(value);

      // Detect mentions (@username)
      const mentionMatches = value.match(/@\w+/g);
      if (mentionMatches) {
        setMentions(mentionMatches.map((mention) => mention.substring(1)));
      } else {
        setMentions([]);
      }
    };

    // Handle send message
    const handleSendMessage = async () => {
      if (
        (!message.trim() && attachments.length === 0) ||
        isSending ||
        disabled
      ) {
        return;
      }

      setIsSending(true);

      try {
        await onSendMessage(
          message.trim(),
          attachments.length > 0 ? attachments : undefined,
          threadId,
          parentMessageId,
          mentions.length > 0 ? mentions : undefined
        );

        // Clear input after successful send
        setMessage('');
        setAttachments([]);
        setMentions([]);
        onCancelReply?.();
      } catch (error) {
        console.error('Failed to send message:', error);
      } finally {
        setIsSending(false);
      }
    };

    // Handle key press
    const handleKeyPress = (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
      }
    };

    // Handle file attachment
    const handleFileAttachment = (files: File[]) => {
      setAttachments((prev) => [...prev, ...files]);
      setShowAttachmentMenu(false);
    };

    // Remove attachment
    const removeAttachment = (index: number) => {
      setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    // Handle camera capture
    const handleCameraCapture = () => {
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
      setShowAttachmentMenu(false);
    };

    // Handle file selection
    const handleFileSelection = () => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
      setShowAttachmentMenu(false);
    };

    // Handle voice recording
    const handleVoiceRecording = async () => {
      if (isRecording) {
        // Stop recording
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
      } else {
        // Start recording
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;

          const chunks: Blob[] = [];
          mediaRecorder.ondataavailable = (event) => {
            chunks.push(event.data);
          };

          mediaRecorder.onstop = () => {
            const audioBlob = new Blob(chunks, { type: 'audio/wav' });
            const audioFile = new File([audioBlob], 'voice-message.wav', {
              type: 'audio/wav',
            });
            handleFileAttachment([audioFile]);

            // Stop all tracks
            stream.getTracks().forEach((track) => track.stop());
          };

          mediaRecorder.start();
          setIsRecording(true);
        } catch (error) {
          console.error('Failed to start recording:', error);
        }
      }
    };

    // Attachment menu items
    const attachmentMenuItems = [
      {
        icon: <PhotoLibrary />,
        label: 'Photo Library',
        onClick: handleFileSelection,
      },
      {
        icon: <CameraAlt />,
        label: 'Camera',
        onClick: handleCameraCapture,
      },
      {
        icon: <Description />,
        label: 'Document',
        onClick: handleFileSelection,
      },
      {
        icon: <LocationOn />,
        label: 'Location',
        onClick: () => {
          // TODO: Implement location sharing
          setShowAttachmentMenu(false);
        },
      },
    ];

    // Common emojis for healthcare
    const commonEmojis = [
      '👍',
      '👎',
      '❤️',
      '😊',
      '😢',
      '😮',
      '🤔',
      '✅',
      '❌',
      '⚠️',
      '🚨',
      '📋',
      '💊',
      '🩺',
      '📊',
      '🏥',
    ];

    return (
      <Box sx={{ p: 1 }}>
        {/* Reply indicator */}
        <Collapse in={!!replyToMessage}>
          {replyToMessage && (
            <Paper
              variant="outlined"
              sx={{
                p: 1,
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                backgroundColor: 'action.hover',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" color="primary">
                  Replying to {replyToMessage.senderName}
                </Typography>
                <Typography variant="body2" noWrap>
                  {replyToMessage.content.text}
                </Typography>
              </Box>
              <IconButton size="small" onClick={onCancelReply}>
                <Close />
              </IconButton>
            </Paper>
          )}
        </Collapse>

        {/* Attachments preview */}
        <Collapse in={attachments.length > 0}>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {attachments.map((file, index) => (
              <Chip
                key={index}
                label={file.name}
                onDelete={() => removeAttachment(index)}
                size="small"
                variant="outlined"
                sx={{ maxWidth: 200 }}
              />
            ))}
          </Box>
        </Collapse>

        {/* Emoji picker */}
        <Collapse in={showEmojiPicker}>
          <Paper
            variant="outlined"
            sx={{
              p: 1,
              mb: 1,
              display: 'flex',
              gap: 0.5,
              flexWrap: 'wrap',
              maxHeight: 120,
              overflow: 'auto',
            }}
          >
            {commonEmojis.map((emoji) => (
              <Button
                key={emoji}
                size="small"
                onClick={() => {
                  setMessage((prev) => prev + emoji);
                  setShowEmojiPicker(false);
                  inputRef.current?.focus();
                }}
                sx={{
                  minWidth: 'auto',
                  p: 0.5,
                  fontSize: '1.2rem',
                }}
              >
                {emoji}
              </Button>
            ))}
          </Paper>
        </Collapse>

        {/* Main input area */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1,
            backgroundColor: 'background.paper',
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            p: 0.5,
          }}
        >
          {/* Attachment button */}
          <IconButton
            size="small"
            onClick={(e) => {
              setAttachmentMenuAnchor(e.currentTarget);
              setShowAttachmentMenu(true);
            }}
            disabled={disabled}
          >
            <Add />
          </IconButton>

          {/* Text input */}
          <TextField
            ref={inputRef}
            fullWidth
            multiline
            maxRows={4}
            value={message}
            onChange={handleMessageChange}
            onKeyPress={handleKeyPress}
            placeholder={disabled ? 'This conversation is closed' : placeholder}
            disabled={disabled}
            variant="standard"
            InputProps={{
              disableUnderline: true,
              sx: {
                fontSize: '16px', // Prevent zoom on iOS
                lineHeight: 1.4,
              },
            }}
            sx={{
              '& .MuiInputBase-root': {
                padding: '8px 0',
              },
            }}
          />

          {/* Emoji button */}
          <IconButton
            size="small"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            disabled={disabled}
            color={showEmojiPicker ? 'primary' : 'default'}
          >
            <EmojiEmotions />
          </IconButton>

          {/* Voice/Send button */}
          {message.trim() || attachments.length > 0 ? (
            <IconButton
              size="small"
              onClick={handleSendMessage}
              disabled={disabled || isSending}
              color="primary"
              sx={{
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
                '&.Mui-disabled': {
                  backgroundColor: 'action.disabledBackground',
                },
              }}
            >
              {isSending ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <Send />
              )}
            </IconButton>
          ) : (
            <IconButton
              size="small"
              onClick={handleVoiceRecording}
              disabled={disabled}
              color={isRecording ? 'error' : 'default'}
              sx={{
                ...(isRecording && {
                  backgroundColor: 'error.main',
                  color: 'error.contrastText',
                  animation: 'pulse 1s infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                    '100%': { opacity: 1 },
                  },
                }),
              }}
            >
              <Mic />
            </IconButton>
          )}
        </Box>

        {/* Attachment menu */}
        <Menu
          anchorEl={attachmentMenuAnchor}
          open={showAttachmentMenu}
          onClose={() => setShowAttachmentMenu(false)}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          {attachmentMenuItems.map((item) => (
            <MenuItem key={item.label} onClick={item.onClick}>
              {item.icon}
              <Typography sx={{ ml: 1 }}>{item.label}</Typography>
            </MenuItem>
          ))}
        </Menu>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="*/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
              handleFileAttachment(files);
            }
            e.target.value = '';
          }}
        />

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
              handleFileAttachment(files);
            }
            e.target.value = '';
          }}
        />
      </Box>
    );
  }
);

MobileMessageInput.displayName = 'MobileMessageInput';

export default MobileMessageInput;
