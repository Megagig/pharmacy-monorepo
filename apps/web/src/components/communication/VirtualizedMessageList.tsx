import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { Box, CircularProgress, Typography } from '@mui/material';
import MessageItem from './MessageItem';
import { Message } from '../../stores/types';
import { useResponsive } from '../../hooks/useResponsive';

interface VirtualizedMessageListProps {
  messages: Message[];
  height: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  onReply?: (message: Message) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onCreateThread?: (messageId: string) => void;
  onViewThread?: (threadId: string) => void;
  conversationId?: string;
  currentUserId?: string;
  itemSize?: number;
  overscan?: number;
}

interface MessageItemData {
  messages: Message[];
  onReply?: (message: Message) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onCreateThread?: (messageId: string) => void;
  onViewThread?: (threadId: string) => void;
  conversationId?: string;
  currentUserId?: string;
  isMobile: boolean;
}

// Memoized message item component for virtualization
const VirtualizedMessageItem = React.memo<
  ListChildComponentProps<MessageItemData>
>(({ index, style, data }) => {
  const message = data.messages[index];
  const isOwn = message.senderId === data.currentUserId;

  // Determine if we should show avatar (first message or different sender)
  const showAvatar =
    index === 0 || data.messages[index - 1]?.senderId !== message.senderId;

  return (
    <div style={style}>
      <MessageItem
        message={message}
        showAvatar={showAvatar}
        showTimestamp={true}
        isOwn={isOwn}
        onReply={data.onReply}
        onEdit={data.onEdit}
        onDelete={data.onDelete}
        onReaction={data.onReaction}
        onCreateThread={data.onCreateThread}
        onViewThread={data.onViewThread}
        conversationId={data.conversationId}
        mobile={data.isMobile}
        touchOptimized={data.isMobile}
      />
    </div>
  );
});

VirtualizedMessageItem.displayName = 'VirtualizedMessageItem';

const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
  messages,
  height,
  onLoadMore,
  hasMore = false,
  loading = false,
  onReply,
  onEdit,
  onDelete,
  onReaction,
  onCreateThread,
  onViewThread,
  conversationId,
  currentUserId,
  itemSize = 120, // Default estimated item height
  overscan = 5,
}) => {
  const { isMobile } = useResponsive();
  const listRef = useRef<List>(null);
  const loadingRef = useRef(false);

  // Memoize item data to prevent unnecessary re-renders
  const itemData = useMemo<MessageItemData>(
    () => ({
      messages,
      onReply,
      onEdit,
      onDelete,
      onReaction,
      onCreateThread,
      onViewThread,
      conversationId,
      currentUserId,
      isMobile,
    }),
    [
      messages,
      onReply,
      onEdit,
      onDelete,
      onReaction,
      onCreateThread,
      onViewThread,
      conversationId,
      currentUserId,
      isMobile,
    ]
  );

  // Handle scroll to load more messages
  const handleScroll = useCallback(
    ({ scrollOffset, scrollUpdateWasRequested }: unknown) => {
      if (
        scrollUpdateWasRequested ||
        loadingRef.current ||
        !hasMore ||
        !onLoadMore
      ) {
        return;
      }

      // Load more when scrolled to top (for chat history)
      if (scrollOffset <= 100) {
        loadingRef.current = true;
        onLoadMore();

        // Reset loading flag after a delay
        setTimeout(() => {
          loadingRef.current = false;
        }, 1000);
      }
    },
    [hasMore, onLoadMore]
  );

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
    }
  }, [messages.length]);

  // Dynamic item size calculation based on message content
  const getItemSize = useCallback(
    (index: number) => {
      const message = messages[index];
      if (!message) return itemSize;

      let estimatedHeight = 60; // Base height

      // Add height for text content
      if (message.content.text) {
        const textLines = Math.ceil(message.content.text.length / 50);
        estimatedHeight += textLines * 20;
      }

      // Add height for attachments
      if (message.content.attachments?.length) {
        estimatedHeight += message.content.attachments.length * 60;
      }

      // Add height for reactions
      if (message.reactions.length > 0) {
        estimatedHeight += 40;
      }

      // Add height for thread indicator
      if (message.threadId === message._id) {
        estimatedHeight += 30;
      }

      // Mobile adjustments
      if (isMobile) {
        estimatedHeight *= 1.2; // Increase for touch targets
      }

      return Math.max(estimatedHeight, itemSize);
    },
    [messages, itemSize, isMobile]
  );

  if (messages.length === 0 && !loading) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
        }}
      >
        <Typography variant="body2">No messages yet</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height, position: 'relative' }}>
      {/* Loading indicator at top */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1,
            display: 'flex',
            justifyContent: 'center',
            p: 1,
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <CircularProgress size={20} />
          <Typography variant="caption" sx={{ ml: 1 }}>
            Loading messages...
          </Typography>
        </Box>
      )}

      {/* Virtualized list */}
      <List
        ref={listRef}
        height={height}
        itemCount={messages.length}
        itemSize={itemSize}
        itemData={itemData}
        overscanCount={overscan}
        onScroll={handleScroll}
        style={{
          paddingTop: loading ? 40 : 0,
        }}
      >
        {VirtualizedMessageItem}
      </List>
    </Box>
  );
};

export default VirtualizedMessageList;
