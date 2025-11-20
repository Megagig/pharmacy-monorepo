/**
 * Chat Services Index
 * 
 * Exports all chat-related services for the communication module rebuild
 */

export { ChatService, chatService } from './ChatService';
export type {
  CreateConversationDTO,
  UpdateConversationDTO,
  ConversationFilters,
  SendMessageDTO,
  MessageFilters,
} from './ChatService';

export { ChatSocketService, initializeChatSocketService, getChatSocketService } from './ChatSocketService';

export { ChatFileService, chatFileService } from './ChatFileService';
export type { UploadFileData, FileUploadResult } from './ChatFileService';

export { ChatNotificationService, chatNotificationService } from './ChatNotificationService';
export type { ChatNotificationPreferences } from './ChatNotificationService';

export { TemplateService, templateService } from './TemplateService';
export type { CreateTemplateDTO, UpdateTemplateDTO, TemplateFilters } from './TemplateService';

export { ConsultationRequestService, consultationRequestService } from './ConsultationRequestService';
export type { CreateConsultationRequestDTO, ConsultationRequestFilters } from './ConsultationRequestService';

export { ReminderService, reminderService } from './ReminderService';
export type { CreateReminderDTO, UpdateReminderDTO, ReminderFilters } from './ReminderService';

export { ReminderJobService, reminderJobService } from './ReminderJobService';

export { ChatbotService, chatbotService } from './ChatbotService';
export type { ChatbotMessage, ChatbotContext, ChatbotResponse } from './ChatbotService';

export { ChatAuditService, chatAuditService } from './ChatAuditService';
export type { AuditLogContext, AuditLogFilters } from './ChatAuditService';
