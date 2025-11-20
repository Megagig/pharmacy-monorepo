import { useState, useEffect, useCallback, useRef } from 'react';
import { usePatientAuth } from './usePatientAuth';
import { apiClient } from '../services/apiClient';
import { patientApiClient } from '../services/patientApiClient';
import useSocket from './useSocket';

// Helpers to resolve patient identity reliably from token/cookies
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
};

const decodeJwt = (token: string | null): any | null => {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const getPatientIdFromEnv = (): string | null => {
  // Optional override for development/testing
  const id = (import.meta as any)?.env?.VITE_PATIENT_ID_OVERRIDE;
  return id ? String(id) : null;
};

const resolveEffectivePatientId = (contextUser: any, explicitId?: string): string | null => {
  // 1) Context-provided patientId
  const ctxId = contextUser?.patientId || contextUser?.patientUserId;
  if (ctxId) return ctxId;
  // 2) Explicit param
  if (explicitId) return explicitId;
  // 3) Token-based resolution
  const token = getCookie('patientAccessToken') || (typeof localStorage !== 'undefined' ? localStorage.getItem('patientAccessToken') : null);
  const payload = decodeJwt(token);
  const tokenId = payload?.patientUserId || payload?.patientId || payload?._id;
  if (tokenId) return tokenId;
  // 4) Dev override
  return getPatientIdFromEnv();
};

// Types for messaging used by the patient portal
interface PatientMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  attachments: Array<{
    id: string;
    filename: string;
    url: string;
    type: string;
    size: number;
  }>;
}

interface PatientConversation {
  id: string;
  pharmacistId: string;
  pharmacistName: string;
  pharmacistAvatar?: string | null;
  lastMessage: {
    content: string;
    timestamp: string;
    senderId: string;
    isRead: boolean;
  } | null;
  unreadCount: number;
  status: 'active' | 'archived';
  createdAt: string;
}

// Hook return type
interface UsePatientMessagesReturn {
  conversations: PatientConversation[] | null;
  messages: PatientMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (conversationId: string, content: string, attachments?: File[]) => Promise<void>;
  markAsRead: (conversationId: string) => void;
  refreshConversations: () => Promise<void>;
  isConnected: boolean;
  typingUsers: string[];
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
}

// API response types
interface ConversationsResponse {
  success: boolean;
  data?: {
    conversations: PatientConversation[];
  };
  message?: string;
}

// Service that talks to Communication Hub endpoints
class PatientMessagesService {
  // Attempt to resolve patient profile id
  static async resolvePatientProfileId(patientUserId: string): Promise<string | null> {
    try {
      // Try patient "me" endpoint if available
      const me = await patientApiClient.get('/patient-portal/me').catch(() => null);
      if (me?.data?.success && (me.data.data?.id || me.data.data?._id)) {
        return me.data.data.id || me.data.data._id;
      }
    } catch { }
    try {
      // Try by-user lookup
      const byUser = await patientApiClient.get(`/patients/by-user/${patientUserId}`).catch(() => null);
      if (byUser?.data?.success && (byUser.data.data?.id || byUser.data.data?._id)) {
        return byUser.data.data.id || byUser.data.data._id;
      }
    } catch { }
    return null;
  }
  private static async getPatientConversations(patientId: string) {
    const { data } = await patientApiClient.get(`/communication/patients/${patientId}/conversations`);
    return data;
  }

  private static async getConversationMessages(conversationId: string, limit: number = 50) {
    const { data } = await patientApiClient.get(
      `/communication/conversations/${conversationId}/messages?limit=${limit}&sortOrder=asc`
    );
    return data;
  }

  static async getConversations(patientId: string): Promise<{ conversations: PatientConversation[]; messages: PatientMessage[] }> {
    const convResult = await this.getPatientConversations(patientId);
    if (!convResult?.success) {
      throw new Error(convResult?.message || 'Failed to load conversations');
    }

    const conversationsRaw = convResult.data || [];

    const conversations: PatientConversation[] = conversationsRaw.map((c: any) => {
      const other = (c.participants || []).find((p: any) => p.role !== 'patient');

      const last = c.lastMessage;
      return {
        id: c._id || c.id,
        pharmacistId: other?.userId || other?._id || 'unknown',
        pharmacistName: other?.displayName || other?.name || `${other?.firstName || ''} ${other?.lastName || ''}`.trim() || 'Healthcare Provider',
        pharmacistAvatar: other?.avatarUrl || other?.avatar || null,
        lastMessage: last
          ? {
            content: typeof last.content === 'string' ? last.content : (last.content?.text || ''),
            timestamp: last.createdAt || c.updatedAt || c.createdAt,
            senderId: typeof last.senderId === 'string' ? last.senderId : last.senderId?._id || '',
            isRead: Array.isArray(last.readBy) ? last.readBy.some((r: any) => r.userId === patientId) : true,
          }
          : null,
        unreadCount: typeof c.unreadCount === 'number' ? c.unreadCount : 0,
        status: c.status === 'archived' ? 'archived' : 'active',
        createdAt: c.createdAt,
      };
    });

    const allMessages: PatientMessage[] = [];
    for (const conv of conversations) {
      try {
        const msgResult = await this.getConversationMessages(conv.id, 50);
        if (msgResult?.success) {
          const normalized: PatientMessage[] = (msgResult.data || []).map((m: any) => ({
            id: m._id || m.id,
            conversationId: m.conversationId?._id || m.conversationId || conv.id,
            senderId: typeof m.senderId === 'string' ? m.senderId : m.senderId?._id,
            senderName: m.senderId?.firstName ? `${m.senderId.firstName} ${m.senderId.lastName || ''}`.trim() : 'User',
            content: typeof m.content === 'string' ? m.content : (m.content?.text || ''),
            timestamp: m.createdAt,
            isRead: Array.isArray(m.readBy) ? m.readBy.some((r: any) => r.userId === patientId) : true,
            attachments: Array.isArray(m.attachments)
              ? m.attachments.map((f: any) => ({
                id: f._id || f.id,
                filename: f.fileName || f.name,
                url: f.url || f.downloadUrl,
                type: f.mimeType || f.type,
                size: f.size || 0,
              }))
              : [],
          }));
          allMessages.push(...normalized);
        }
      } catch {
        // ignore per-conversation fetch errors
      }
    }

    return { conversations, messages: allMessages };
  }
}

export const usePatientMessages = (patientId?: string): UsePatientMessagesReturn => {
  const { user, isAuthenticated } = usePatientAuth();
  const [conversations, setConversations] = useState<PatientConversation[] | null>(null);
  const [messages, setMessages] = useState<PatientMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const socket = useSocket();
  const typingTimeouts = useRef<{ [key: string]: number }>({});

  // Load conversations and messages
  const loadConversations = useCallback(async () => {
    const effectivePatientId = (user as any)?.patientId || patientId;
    if (!isAuthenticated || !user || !effectivePatientId) {
      setConversations(null);
      setMessages([]);
      return;
    }

    setLoading(true);

    // Resolve patient profile id if needed
    let patientProfileId = resolveEffectivePatientId(user as any, patientId);
    if (!patientProfileId) {
      setError('No patient identity found');
      setLoading(false);
      return;
    }
    // If it looks like a user id, try to resolve a profile id
    try {
      const maybeProfile = await PatientMessagesService.resolvePatientProfileId(patientProfileId);
      if (maybeProfile) patientProfileId = maybeProfile;
    } catch { }

    setError(null);

    try {
      let result;
      try {
        result = await PatientMessagesService.getConversations(patientProfileId);
      } catch (e: any) {
        // Fallback: try generic conversations by participant if patient-specific 404s
        try {
          const participantId = resolveEffectivePatientId(user as any, patientId);
          const res = await patientApiClient.get(`/communication/conversations`, { params: { participantId, role: 'patient' } });
          if (res?.data?.success) {
            const conversations = (res.data.data || []).map((c: any) => ({
              id: c._id || c.id,
              pharmacistId: (c.participants || []).find((p: any) => p.role !== 'patient')?.userId || '',
              pharmacistName: (c.participants || []).find((p: any) => p.role !== 'patient')?.displayName || 'Member',
              pharmacistAvatar: (c.participants || []).find((p: any) => p.role !== 'patient')?.avatarUrl || null,
              lastMessage: c.lastMessage ? {
                content: typeof c.lastMessage.content === 'string' ? c.lastMessage.content : (c.lastMessage.content?.text || ''),
                timestamp: c.lastMessage.createdAt || c.updatedAt || c.createdAt,
                senderId: typeof c.lastMessage.senderId === 'string' ? c.lastMessage.senderId : c.lastMessage.senderId?._id,
                isRead: true,
              } : null,
              unreadCount: typeof c.unreadCount === 'number' ? c.unreadCount : 0,
              status: (c.status === 'archived' ? 'archived' : 'active') as 'active' | 'archived',
              createdAt: c.createdAt,
            })) as PatientConversation[];
            result = { conversations, messages: [] };
          } else {
            throw new Error('No conversations found');
          }
        } catch (fallbackErr) {
          throw e;
        }
      }
      setConversations(result.conversations);
      setMessages(result.messages);
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
      setError(err.message || 'Failed to load conversations');
      setConversations(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, patientId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Initialize socket listeners and join rooms
  useEffect(() => {
    const effectivePatientId = (user as any)?.patientId || patientId;
    if (!isAuthenticated || !user || !effectivePatientId || !socket) {
      if (!effectivePatientId) setError('No patient identity found');
      setIsConnected(false);
      return;
    }

    setIsConnected(socket.connected);

    // Join rooms for loaded conversations
    (conversations || []).forEach((conv) => {
      socket.emit('conversation:join', { conversationId: conv.id });
    });

    const handleMessageReceived = (message: any) => {
      const normalized: PatientMessage = {
        id: message._id || message.id,
        conversationId: message.conversationId?._id || message.conversationId,
        senderId: typeof message.senderId === 'string' ? message.senderId : message.senderId?._id,
        senderName: message.senderId?.firstName ? `${message.senderId.firstName} ${message.senderId.lastName || ''}`.trim() : 'User',
        content: typeof message.content === 'string' ? message.content : (message.content?.text || ''),
        timestamp: message.createdAt,
        isRead: Array.isArray(message.readBy) ? message.readBy.some((r: any) => r.userId === resolveEffectivePatientId(user as any, patientId)) : true,
        attachments: Array.isArray(message.attachments)
          ? message.attachments.map((f: any) => ({
            id: f._id || f.id,
            filename: f.fileName || f.name,
            url: f.url || f.downloadUrl,
            type: f.mimeType || f.type,
            size: f.size || 0,
          }))
          : [],
      };

      setMessages((prev) => [...prev, normalized]);
      setConversations((prev) =>
        prev?.map((conv) =>
          conv.id === normalized.conversationId
            ? {
              ...conv,
              lastMessage: {
                content: normalized.content,
                timestamp: normalized.timestamp,
                senderId: normalized.senderId,
                isRead: false,
              },
              unreadCount: normalized.senderId !== resolveEffectivePatientId(user as any, patientId) ? conv.unreadCount + 1 : conv.unreadCount,
            }
            : conv
        ) || null
      );
    };

    const handleTypingStart = ({ conversationId, userId }: any) => {
      setTypingUsers((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
    };
    const handleTypingStop = ({ conversationId, userId }: any) => {
      setTypingUsers((prev) => prev.filter((id) => id !== userId));
    };

    socket.on('message:created', handleMessageReceived);
    socket.on('message_received', handleMessageReceived);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('user_typing', ({ conversationId, userId }) => handleTypingStart({ conversationId, userId }));
    socket.on('user_stopped_typing', ({ conversationId, userId }) => handleTypingStop({ conversationId, userId }));

    return () => {
      (conversations || []).forEach((conv) => {
        socket.emit('conversation:leave', { conversationId: conv.id });
      });
      socket.off('message:created', handleMessageReceived);
      socket.off('message_received', handleMessageReceived);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('user_typing');
      socket.off('user_stopped_typing');
      setIsConnected(false);
    };
    // re-join rooms when convo count changes
  }, [isAuthenticated, user, patientId, socket, conversations?.length]);

  // Send message
  const sendMessage = useCallback(
    async (conversationId: string, content: string, attachments?: File[]) => {
      const effectivePatientId = (user as any)?.patientId || patientId;
      if (!isAuthenticated || !user || !effectivePatientId) {
        throw new Error('User not authenticated');
      }

      try {
        // Ensure CSRF cookie exists for patient writes
        try {
          await patientApiClient.get('/communication/csrf-token');
        } catch (e) {
          // non-fatal; server may still accept X-CSRF-Token from existing cookie
        }

        const formData = new FormData();
        formData.append('conversationId', conversationId);
        formData.append('content', JSON.stringify({ text: content, type: 'text' }));
        if (attachments) attachments.forEach((f) => formData.append('attachments', f));

        const result = (await patientApiClient.post(`/communication/conversations/${conversationId}/messages`, formData)).data;
        if (!result?.success) throw new Error(result?.message || 'Failed to send message');

        const m = result.data;
        const newMessage: PatientMessage = {
          id: m._id || m.id,
          conversationId: m.conversationId?._id || m.conversationId || conversationId,
          senderId: typeof m.senderId === 'string' ? m.senderId : m.senderId?._id,
          senderName: m.senderId?.firstName ? `${m.senderId.firstName} ${m.senderId.lastName || ''}`.trim() : 'You',
          content: typeof m.content === 'string' ? m.content : (m.content?.text || ''),
          timestamp: m.createdAt || new Date().toISOString(),
          isRead: true,
          attachments: Array.isArray(m.attachments)
            ? m.attachments.map((f: any) => ({
              id: f._id || f.id,
              filename: f.fileName || f.name,
              url: f.url || f.downloadUrl,
              type: f.mimeType || f.type,
              size: f.size || 0,
            }))
            : [],
        };

        setMessages((prev) => [...prev, newMessage]);
        setConversations((prev) =>
          prev?.map((conv) =>
            conv.id === conversationId
              ? {
                ...conv,
                lastMessage: {
                  content: newMessage.content,
                  timestamp: newMessage.timestamp,
                  senderId: newMessage.senderId,
                  isRead: true,
                },
              }
              : conv
          ) || null
        );

        if (socket) {
          socket.emit('typing:stop', { conversationId, userId: user?.id || (user as any)?._id });
        }
      } catch (err) {
        console.error('Failed to send message:', err);
        throw err;
      }
    },
    [isAuthenticated, user, patientId, socket]
  );

  // Mark messages as read (optimistic UI, then API)
  const markAsRead = useCallback(
    (conversationId: string) => {
      const effectivePatientId = (user as any)?.patientId || patientId;
      if (!isAuthenticated || !user || !effectivePatientId) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.conversationId === conversationId && msg.senderId !== resolveEffectivePatientId(user as any, patientId) ? { ...msg, isRead: true } : msg
        )
      );

      setConversations((prev) =>
        prev?.map((conv) => (conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv)) || null
      );

      const unread = messages.filter((m) => m.conversationId === conversationId && m.senderId !== resolveEffectivePatientId(user as any, patientId) && !m.isRead);
      unread.forEach(async (m) => {
        try {
          await patientApiClient.put(`/communication/messages/${m.id}/read`, undefined, { headers: { 'X-CSRF-Token': (document?.cookie.match(/(?:^| )csrf-token=([^;]+)/)?.[1]) ? decodeURIComponent(document.cookie.match(/(?:^| )csrf-token=([^;]+)/)![1]) : undefined } });
        } catch (e) {
          console.error('Failed to mark message as read:', e);
        }
      });

      if (socket) {
        socket.emit('messages:read', { conversationId, userId: resolveEffectivePatientId(user as any, patientId) });
      }
    },
    [isAuthenticated, user, patientId, messages, socket]
  );

  const refreshConversations = useCallback(async () => {
    await loadConversations();
  }, [loadConversations]);

  // Typing indicators
  const startTyping = useCallback(
    (conversationId: string) => {
      if (!socket || !patientId) return;
      socket.emit('typing:start', { conversationId, userId: patientId });

      if (typingTimeouts.current[conversationId]) {
        clearTimeout(typingTimeouts.current[conversationId]);
      }

      typingTimeouts.current[conversationId] = setTimeout(() => {
        stopTyping(conversationId);
      }, 3000);
    },
    [patientId, socket]
  );

  const stopTyping = useCallback(
    (conversationId: string) => {
      if (!socket || !patientId) return;
      socket.emit('typing:stop', { conversationId, userId: patientId });

      if (typingTimeouts.current[conversationId]) {
        clearTimeout(typingTimeouts.current[conversationId]);
        delete typingTimeouts.current[conversationId];
      }
    },
    [patientId, socket]
  );

  return {
    conversations,
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
    refreshConversations,
    isConnected,
    typingUsers,
    startTyping,
    stopTyping,
  };
};
