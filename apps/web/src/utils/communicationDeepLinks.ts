import { NavigateFunction } from 'react-router-dom';

export interface DeepLinkParams {
  conversationId?: string;
  messageId?: string;
  patientId?: string;
  action?: 'new' | 'reply' | 'view' | 'edit';
  tab?: 'messages' | 'notifications' | 'queries' | 'audit' | 'settings';
}

export class CommunicationDeepLinks {
  private navigate: NavigateFunction;

  constructor(navigate: NavigateFunction) {
    this.navigate = navigate;
  }

  /**
   * Navigate to a specific conversation
   */
  toConversation(conversationId: string, messageId?: string) {
    const params = new URLSearchParams();
    params.set('conversation', conversationId);

    if (messageId) {
      params.set('message', messageId);
    }

    this.navigate(`/pharmacy/communication?${params.toString()}`);
  }

  /**
   * Navigate to create a new conversation with a specific patient
   */
  toNewConversation(
    patientId?: string,
    type?: 'direct' | 'group' | 'patient_query'
  ) {
    const params = new URLSearchParams();
    params.set('action', 'new');

    if (patientId) {
      params.set('patient', patientId);
    }

    if (type) {
      params.set('type', type);
    }

    this.navigate(`/pharmacy/communication?${params.toString()}`);
  }

  /**
   * Navigate to reply to a specific message
   */
  toReplyMessage(conversationId: string, messageId: string) {
    const params = new URLSearchParams();
    params.set('conversation', conversationId);
    params.set('message', messageId);
    params.set('action', 'reply');

    this.navigate(`/pharmacy/communication?${params.toString()}`);
  }

  /**
   * Navigate to notifications tab
   */
  toNotifications(notificationId?: string) {
    const params = new URLSearchParams();
    params.set('tab', 'notifications');

    if (notificationId) {
      params.set('notification', notificationId);
    }

    this.navigate(`/pharmacy/communication?${params.toString()}`);
  }

  /**
   * Navigate to audit logs
   */
  toAuditLogs(conversationId?: string, dateRange?: { start: Date; end: Date }) {
    const params = new URLSearchParams();
    params.set('tab', 'audit');

    if (conversationId) {
      params.set('conversation', conversationId);
    }

    if (dateRange) {
      params.set('start', dateRange.start.toISOString());
      params.set('end', dateRange.end.toISOString());
    }

    this.navigate(`/pharmacy/communication?${params.toString()}`);
  }

  /**
   * Navigate to patient query dashboard
   */
  toPatientQueries(
    status?: 'open' | 'pending' | 'resolved',
    priority?: 'low' | 'normal' | 'high' | 'urgent'
  ) {
    const params = new URLSearchParams();
    params.set('tab', 'queries');

    if (status) {
      params.set('status', status);
    }

    if (priority) {
      params.set('priority', priority);
    }

    this.navigate(`/pharmacy/communication?${params.toString()}`);
  }

  /**
   * Navigate to communication settings
   */
  toSettings(section?: 'notifications' | 'privacy' | 'integrations') {
    const params = new URLSearchParams();
    params.set('tab', 'settings');

    if (section) {
      params.set('section', section);
    }

    this.navigate(`/pharmacy/communication?${params.toString()}`);
  }

  /**
   * Parse URL parameters to extract deep link information
   */
  static parseUrlParams(searchParams: URLSearchParams): DeepLinkParams {
    return {
      conversationId: searchParams.get('conversation') || undefined,
      messageId: searchParams.get('message') || undefined,
      patientId: searchParams.get('patient') || undefined,
      action:
        (searchParams.get('action') as DeepLinkParams['action']) || undefined,
      tab: (searchParams.get('tab') as DeepLinkParams['tab']) || undefined,
    };
  }

  /**
   * Generate shareable link for a conversation
   */
  static generateShareableLink(
    conversationId: string,
    messageId?: string
  ): string {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();
    params.set('conversation', conversationId);

    if (messageId) {
      params.set('message', messageId);
    }

    return `${baseUrl}/pharmacy/communication?${params.toString()}`;
  }

  /**
   * Generate notification deep link
   */
  static generateNotificationLink(data: {
    conversationId?: string;
    messageId?: string;
    patientId?: string;
    action?: string;
  }): string {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();

    if (data.conversationId) {
      params.set('conversation', data.conversationId);
    }

    if (data.messageId) {
      params.set('message', data.messageId);
    }

    if (data.patientId) {
      params.set('patient', data.patientId);
    }

    if (data.action) {
      params.set('action', data.action);
    }

    return `${baseUrl}/pharmacy/communication?${params.toString()}`;
  }

  /**
   * Validate if a deep link is accessible by the current user
   */
  static async validateAccess(
    params: DeepLinkParams,
    userPermissions: string[]
  ): Promise<boolean> {
    // Basic validation - in real implementation, this would check against backend
    if (
      params.conversationId &&
      !userPermissions.includes('communication_access')
    ) {
      return false;
    }

    if (params.tab === 'audit' && !userPermissions.includes('audit_access')) {
      return false;
    }

    if (
      params.tab === 'settings' &&
      !userPermissions.includes('communication_settings')
    ) {
      return false;
    }

    return true;
  }

  /**
   * Handle external deep links (from emails, notifications, etc.)
   */
  static handleExternalLink(url: string, navigate: NavigateFunction): boolean {
    try {
      const urlObj = new URL(url);

      // Check if it's a communication hub link
      if (urlObj.pathname === '/pharmacy/communication') {
        const params = CommunicationDeepLinks.parseUrlParams(
          urlObj.searchParams
        );
        const deepLinks = new CommunicationDeepLinks(navigate);

        if (params.conversationId) {
          deepLinks.toConversation(params.conversationId, params.messageId);
          return true;
        }

        if (params.action === 'new') {
          deepLinks.toNewConversation(params.patientId);
          return true;
        }

        if (params.tab) {
          switch (params.tab) {
            case 'notifications':
              deepLinks.toNotifications();
              break;
            case 'audit':
              deepLinks.toAuditLogs();
              break;
            case 'settings':
              deepLinks.toSettings();
              break;
            default:
              navigate('/pharmacy/communication');
          }
          return true;
        }

        // Default to communication hub
        navigate('/pharmacy/communication');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error handling external link:', error);
      return false;
    }
  }
}

/**
 * Hook for using communication deep links
 */
export const useCommunicationDeepLinks = (navigate: NavigateFunction) => {
  return new CommunicationDeepLinks(navigate);
};

/**
 * Utility functions for common deep link scenarios
 */
export const communicationLinks = {
  /**
   * Create a link to start a conversation with a patient
   */
  patientConversation: (patientId: string) =>
    `/pharmacy/communication?action=new&patient=${patientId}&type=patient_query`,

  /**
   * Create a link to view a specific conversation
   */
  conversation: (conversationId: string, messageId?: string) => {
    const params = new URLSearchParams();
    params.set('conversation', conversationId);
    if (messageId) params.set('message', messageId);
    return `/pharmacy/communication?${params.toString()}`;
  },

  /**
   * Create a link to notifications
   */
  notifications: () => '/pharmacy/communication?tab=notifications',

  /**
   * Create a link to audit logs
   */
  auditLogs: (conversationId?: string) => {
    const params = new URLSearchParams();
    params.set('tab', 'audit');
    if (conversationId) params.set('conversation', conversationId);
    return `/pharmacy/communication?${params.toString()}`;
  },

  /**
   * Create a link to patient queries dashboard
   */
  patientQueries: (status?: string, priority?: string) => {
    const params = new URLSearchParams();
    params.set('tab', 'queries');
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    return `/pharmacy/communication?${params.toString()}`;
  },
};
