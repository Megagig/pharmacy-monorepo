// Core chat interface components
export { default as ChatInterface } from './ChatInterface';
export { default as MessageThread } from './MessageThread';
export { default as MessageItem } from './MessageItem';
export { default as ParticipantList } from './ParticipantList';

// Conversation management components
export { default as ConversationList } from './ConversationList';
export { default as ConversationItem } from './ConversationItem';
export { default as NewConversationModal } from './NewConversationModal';
export { default as ConversationSettings } from './ConversationSettings';

// Utility components
export { default as ConnectionStatus } from './ConnectionStatus';
export { default as TypingIndicator } from './TypingIndicator';

// File management components
export { default as FileUpload } from './FileUpload';
export { default as FilePreview } from './FilePreview';

// Notification components
export { default as NotificationCenter } from './NotificationCenter';
export { default as NotificationItem } from './NotificationItem';
export { default as NotificationPreferences } from './NotificationPreferences';
export { default as NotificationIndicators } from './NotificationIndicators';

// Patient query management components
export { default as PatientQueryDashboard } from './PatientQueryDashboard';
export { default as QueryCard } from './QueryCard';

// Mention system components
export { default as MentionInput } from './MentionInput';
export { default as ThreadView } from './ThreadView';
export { default as ThreadIndicator } from './ThreadIndicator';
export { default as MentionDisplay } from './MentionDisplay';
export { default as MentionSearch } from './MentionSearch';

// Search components
export { default as SearchInterface } from './SearchInterface';
export { default as MessageSearch } from './MessageSearch';
export { default as ConversationSearch } from './ConversationSearch';

// Audit and compliance components
export { default as AuditLogViewer } from './AuditLogViewer';
export { default as ComplianceDashboard } from './ComplianceDashboard';
export { default as AuditTrailVisualization } from './AuditTrailVisualization';
export { default as AuditSearch } from './AuditSearch';

// Mobile and Responsive Components
export { default as ResponsiveCommunicationHub } from './ResponsiveCommunicationHub';
export { default as MobileChatInterface } from './MobileChatInterface';
export { default as MobileMessageInput } from './MobileMessageInput';
export { default as MobileFileUpload } from './MobileFileUpload';

// Performance-optimized components
export { default as VirtualizedMessageList } from './VirtualizedMessageList';
export { default as VirtualizedConversationList } from './VirtualizedConversationList';
export { default as OptimizedChatInterface } from './OptimizedChatInterface';
export { default as LazyImage } from './LazyImage';

// Dashboard integration components
export { default as CommunicationWidget } from './CommunicationWidget';
export { default as CommunicationMetrics } from './CommunicationMetrics';
export { default as CommunicationNotificationBadge } from './CommunicationNotificationBadge';

// Export types for external use
export type { default as ChatInterfaceProps } from './ChatInterface';
export type { default as MessageThreadProps } from './MessageThread';
export type { default as MessageItemProps } from './MessageItem';
export type { default as ParticipantListProps } from './ParticipantList';