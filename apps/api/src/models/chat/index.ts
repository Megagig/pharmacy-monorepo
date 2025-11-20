/**
 * Chat Models Index
 * 
 * Exports all simplified chat models for the communication module rebuild
 */

export { default as ChatConversation, IConversation, IConversationParticipant } from './Conversation';
export { default as ChatMessage, IMessage, IMessageContent, IMessageReaction, IMessageReadReceipt } from './Message';
export { default as ChatFileMetadata, IFileMetadata } from './FileMetadata';
export { PresenceModel, IPresence, ICustomStatus, initializePresenceModel, getPresenceModel } from './Presence';
export { default as MessageTemplate, IMessageTemplate } from './MessageTemplate';
export { default as ConsultationRequest, IConsultationRequest } from './ConsultationRequest';
export { default as Reminder, IReminder, IReminderConfirmation } from './Reminder';
