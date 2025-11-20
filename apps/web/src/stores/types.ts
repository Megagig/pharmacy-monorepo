// Common types and interfaces for Zustand stores

// Communication Types
export interface Conversation {
  _id: string;
  title?: string;
  type: 'direct' | 'group' | 'patient_query';
  participants: {
    userId: string;
    role: 'pharmacist' | 'doctor' | 'patient';
    joinedAt: string;
    leftAt?: string;
    permissions: string[];
  }[];
  patientId?: string; // Link to patient record
  caseId?: string; // Clinical case identifier
  status: 'active' | 'archived' | 'resolved';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  tags: string[];
  lastMessageAt: string;
  createdBy: string;
  workplaceId: string;
  metadata: {
    isEncrypted: boolean;
    encryptionKeyId?: string;
    clinicalContext?: {
      diagnosis?: string;
      medications?: string[];
      conditions?: string[];
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string | {
    _id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  content: {
    text?: string; // Encrypted
    type: 'text' | 'file' | 'image' | 'clinical_note' | 'system';
    attachments?: {
      fileId: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      secureUrl: string;
    }[];
  };
  threadId?: string; // For threaded conversations
  parentMessageId?: string; // For replies
  mentions: string[]; // @mentioned users
  reactions: {
    userId: string;
    emoji: string;
    createdAt: string;
  }[];
  status: 'sent' | 'delivered' | 'read' | 'failed';
  priority: 'normal' | 'urgent';
  readBy: {
    userId: string;
    readAt: string;
  }[];
  editHistory: {
    content: string;
    editedAt: string;
    editedBy: string;
  }[];
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationNotification {
  _id: string;
  userId: string;
  type:
  | 'new_message'
  | 'mention'
  | 'therapy_update'
  | 'clinical_alert'
  | 'conversation_invite';
  title: string;
  content: string;
  data: {
    conversationId?: string;
    messageId?: string;
    senderId?: string;
    patientId?: string;
    actionUrl?: string;
  };
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'unread' | 'read' | 'dismissed';
  deliveryChannels: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
  };
  scheduledFor?: string;
  sentAt?: string;
  readAt?: string;
  workplaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationFilters {
  search?: string;
  type?: 'direct' | 'group' | 'patient_query';
  status?: 'active' | 'archived' | 'resolved';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  patientId?: string;
  sortBy?: 'lastMessageAt' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface MessageFilters {
  search?: string;
  type?: 'text' | 'file' | 'image' | 'clinical_note' | 'system';
  senderId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface SendMessageData {
  conversationId: string;
  content: {
    text?: string;
    type: 'text' | 'file' | 'image' | 'clinical_note' | 'system';
    attachments?: File[];
  };
  threadId?: string;
  parentMessageId?: string;
  mentions?: string[];
  priority?: 'normal' | 'urgent';
  currentUser?: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export interface CreateConversationData {
  title?: string;
  type: 'direct' | 'group' | 'patient_query';
  participants: Array<{ userId: string; role: string }> | string[]; // Array of participant objects with role or user IDs
  patientId?: string;
  caseId?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  tags?: string[];
}

// Patient Types
export interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  dateOfBirth: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  medicalHistory?: string;
  allergies?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PatientFormData {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  dateOfBirth: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  medicalHistory?: string;
  allergies?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

// Medication Types
export interface Medication {
  _id: string;
  patientId: string;
  name: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  prescribedDate: string;
  duration?: string;
  status: 'active' | 'completed' | 'discontinued';
  sideEffects?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MedicationFormData {
  patientId: string;
  name: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  prescribedDate: string;
  duration?: string;
  status: 'active' | 'completed' | 'discontinued';
  sideEffects?: string[];
}

// Clinical Notes Types
export interface ClinicalNote {
  _id: string;
  patientId: string;
  title: string;
  content: string;
  type: 'consultation' | 'follow-up' | 'emergency' | 'general';
  tags?: string[];
  attachments?: string[];
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalNoteFormData {
  patientId: string;
  title: string;
  content: string;
  type: 'consultation' | 'follow-up' | 'emergency' | 'general';
  tags?: string[];
  attachments?: string[];
  isPrivate: boolean;
}

// Theme Types
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

// UI State Types
export interface UIState {
  loading: boolean;
  notifications: Notification[];
  modals: {
    [key: string]: boolean;
  };
  sidebarOpen: boolean;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  duration?: number; // Auto-dismiss time in ms
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Filter and Search Types
export interface PatientFilters {
  search?: string;
  sortBy?: 'firstName' | 'lastName' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface MedicationFilters {
  patientId?: string;
  status?: 'active' | 'completed' | 'discontinued';
  search?: string;
  sortBy?: 'name' | 'prescribedDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ClinicalNoteFilters {
  patientId?: string;
  type?: 'consultation' | 'follow-up' | 'emergency' | 'general';
  search?: string;
  tags?: string[];
  sortBy?: 'title' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Store State Types
export interface LoadingState {
  [key: string]: boolean;
}

export interface ErrorState {
  [key: string]: string | null;
}
