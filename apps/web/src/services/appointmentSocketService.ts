/**
 * Appointment Socket Service
 * Handles real-time updates for appointments and follow-up tasks
 * Requirements: 1.1, 1.4, 3.1, 10.1
 */

import { io, Socket } from 'socket.io-client';

// Event data interfaces matching backend
interface AppointmentEventData {
  appointment: any; // Will be typed properly when appointment types are available
  action: 'created' | 'updated' | 'status_changed' | 'rescheduled' | 'cancelled' | 'confirmed';
  actor: {
    userId: string;
    name: string;
    role: string;
  };
  timestamp: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

interface FollowUpEventData {
  followUpTask: any; // Will be typed properly when follow-up types are available
  action: 'created' | 'updated' | 'completed' | 'escalated' | 'converted_to_appointment' | 'assigned';
  actor: {
    userId: string;
    name: string;
    role: string;
  };
  timestamp: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

interface CalendarUpdateData {
  date: string; // YYYY-MM-DD format
  workplaceId: string;
  locationId?: string;
  pharmacistId?: string;
  updateType: 'appointment_change' | 'availability_change' | 'schedule_change';
}

// Socket event types for type safety
interface ServerToClientEvents {
  // Appointment events
  'appointment:created': (data: AppointmentEventData) => void;
  'appointment:updated': (data: AppointmentEventData) => void;
  'appointment:status_changed': (data: AppointmentEventData) => void;
  'appointment:rescheduled': (data: AppointmentEventData) => void;
  'appointment:cancelled': (data: AppointmentEventData) => void;
  'appointment:confirmed': (data: AppointmentEventData) => void;

  // Follow-up events
  'followup:created': (data: FollowUpEventData) => void;
  'followup:updated': (data: FollowUpEventData) => void;
  'followup:completed': (data: FollowUpEventData) => void;
  'followup:escalated': (data: FollowUpEventData) => void;
  'followup:converted_to_appointment': (data: FollowUpEventData & { appointment: any }) => void;

  // Calendar events
  'calendar:update': (data: CalendarUpdateData) => void;

  // Subscription confirmations
  'calendar_subscribed': (data: { startDate: string; endDate: string; pharmacistId?: string }) => void;
  'calendar_unsubscribed': (data: { startDate: string; endDate: string; pharmacistId?: string }) => void;
  'followups_subscribed': (data: { assignedTo?: string; patientId?: string }) => void;

  // Connection events
  'connect': () => void;
  'disconnect': (reason: string) => void;
  'reconnect': (attemptNumber: number) => void;
  'reconnect_error': (error: Error) => void;
  'connect_error': (error: Error) => void;
  'pong': (data: { timestamp: string }) => void;
  'error': (data: { message: string }) => void;
}

interface ClientToServerEvents {
  // Calendar subscriptions
  'subscribe_calendar': (data: { startDate: string; endDate: string; pharmacistId?: string }) => void;
  'unsubscribe_calendar': (data: { startDate: string; endDate: string; pharmacistId?: string }) => void;

  // Follow-up subscriptions
  'subscribe_followups': (data: { assignedTo?: string; patientId?: string }) => void;

  // Health check
  'ping': () => void;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

export interface AppointmentSocketConfig {
  url?: string;
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  timeout?: number;
}

export interface AppointmentEventHandlers {
  // Appointment event handlers
  onAppointmentCreated?: (data: AppointmentEventData) => void;
  onAppointmentUpdated?: (data: AppointmentEventData) => void;
  onAppointmentStatusChanged?: (data: AppointmentEventData) => void;
  onAppointmentRescheduled?: (data: AppointmentEventData) => void;
  onAppointmentCancelled?: (data: AppointmentEventData) => void;
  onAppointmentConfirmed?: (data: AppointmentEventData) => void;

  // Follow-up event handlers
  onFollowUpCreated?: (data: FollowUpEventData) => void;
  onFollowUpUpdated?: (data: FollowUpEventData) => void;
  onFollowUpCompleted?: (data: FollowUpEventData) => void;
  onFollowUpEscalated?: (data: FollowUpEventData) => void;
  onFollowUpConvertedToAppointment?: (data: FollowUpEventData & { appointment: any }) => void;

  // Calendar event handlers
  onCalendarUpdate?: (data: CalendarUpdateData) => void;

  // Connection event handlers
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onError?: (error: string) => void;
}

class AppointmentSocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private eventHandlers: AppointmentEventHandlers = {};
  private subscriptions: {
    calendar: Map<string, { startDate: string; endDate: string; pharmacistId?: string }>;
    followups: Map<string, { assignedTo?: string; patientId?: string }>;
  } = {
    calendar: new Map(),
    followups: new Map(),
  };
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isManualDisconnect = false;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(private config: AppointmentSocketConfig = {}) {
    this.maxReconnectAttempts = config.reconnectionAttempts || 5;
    this.reconnectDelay = config.reconnectionDelay || 1000;
  }

  /**
   * Initialize socket connection with cookie-based authentication
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Use environment variable or fallback to same-origin with port 5000
        const envUrl = import.meta.env.VITE_SOCKET_URL;
        const socketUrl = this.config.url || envUrl || `${window.location.origin.replace(/:\\d+$/, ':5000')}`;

        this.socket = io(socketUrl, {
          withCredentials: true, // Include httpOnly cookies for authentication
          autoConnect: this.config.autoConnect !== false,
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
          timeout: this.config.timeout || 20000,
          transports: ['websocket', 'polling'],
        });

        this.setupEventListeners();
        this.isManualDisconnect = false;

        // Handle initial connection
        this.socket.on('connect', () => {
          this.setConnectionStatus('connected');
          this.reconnectAttempts = 0;
          this.resubscribeAll();
          this.startPingInterval();
          resolve();
        });

        // Handle connection errors
        this.socket.on('connect_error', (error) => {
          this.setConnectionStatus('error');
          this.eventHandlers.onError?.(error.message);
          reject(error);
        });

        // Start connection if autoConnect is enabled
        if (this.config.autoConnect !== false) {
          this.setConnectionStatus('connecting');
          this.socket.connect();
        }
      } catch (error) {
        this.setConnectionStatus('error');
        reject(error);
      }
    });
  }

  /**
   * Disconnect socket connection
   */
  disconnect(): void {
    this.isManualDisconnect = true;
    this.subscriptions.calendar.clear();
    this.subscriptions.followups.clear();
    this.stopPingInterval();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.setConnectionStatus('disconnected');
  }

  /**
   * Set up all socket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.setConnectionStatus('connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      this.setConnectionStatus('disconnected');
      this.stopPingInterval();

      // Don't attempt reconnection if it was manual
      if (!this.isManualDisconnect && reason === 'io server disconnect') {
        this.attemptReconnection();
      }
    });

    this.socket.on('reconnect', () => {
      this.setConnectionStatus('connected');
      this.reconnectAttempts = 0;
      this.resubscribeAll();
      this.startPingInterval();
    });

    this.socket.on('reconnect_error', (error) => {
      this.setConnectionStatus('error');
      this.eventHandlers.onError?.(error.message);
    });

    // Appointment events
    this.socket.on('appointment:created', (data) => {
      this.eventHandlers.onAppointmentCreated?.(data);
    });

    this.socket.on('appointment:updated', (data) => {
      this.eventHandlers.onAppointmentUpdated?.(data);
    });

    this.socket.on('appointment:status_changed', (data) => {
      this.eventHandlers.onAppointmentStatusChanged?.(data);
    });

    this.socket.on('appointment:rescheduled', (data) => {
      this.eventHandlers.onAppointmentRescheduled?.(data);
    });

    this.socket.on('appointment:cancelled', (data) => {
      this.eventHandlers.onAppointmentCancelled?.(data);
    });

    this.socket.on('appointment:confirmed', (data) => {
      this.eventHandlers.onAppointmentConfirmed?.(data);
    });

    // Follow-up events
    this.socket.on('followup:created', (data) => {
      this.eventHandlers.onFollowUpCreated?.(data);
    });

    this.socket.on('followup:updated', (data) => {
      this.eventHandlers.onFollowUpUpdated?.(data);
    });

    this.socket.on('followup:completed', (data) => {
      this.eventHandlers.onFollowUpCompleted?.(data);
    });

    this.socket.on('followup:escalated', (data) => {
      this.eventHandlers.onFollowUpEscalated?.(data);
    });

    this.socket.on('followup:converted_to_appointment', (data) => {
      this.eventHandlers.onFollowUpConvertedToAppointment?.(data);
    });

    // Calendar events
    this.socket.on('calendar:update', (data) => {
      this.eventHandlers.onCalendarUpdate?.(data);
    });

    // Subscription confirmations
    this.socket.on('calendar_subscribed', (data) => {

    });

    this.socket.on('calendar_unsubscribed', (data) => {

    });

    this.socket.on('followups_subscribed', (data) => {

    });

    // Health check
    this.socket.on('pong', (data) => {
      console.debug('Pong received:', data);
    });

    // Error events
    this.socket.on('error', (data) => {
      this.eventHandlers.onError?.(data.message);
    });
  }

  /**
   * Set event handlers for socket events
   */
  setEventHandlers(handlers: AppointmentEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Subscribe to calendar updates for a date range
   */
  subscribeToCalendar(startDate: string, endDate: string, pharmacistId?: string): void {
    const subscriptionKey = `${startDate}-${endDate}-${pharmacistId || 'all'}`;
    
    if (!this.socket || !this.isConnected()) {
      // Store subscription for later when connected
      this.subscriptions.calendar.set(subscriptionKey, { startDate, endDate, pharmacistId });
      return;
    }

    this.socket.emit('subscribe_calendar', { startDate, endDate, pharmacistId });
    this.subscriptions.calendar.set(subscriptionKey, { startDate, endDate, pharmacistId });
  }

  /**
   * Unsubscribe from calendar updates
   */
  unsubscribeFromCalendar(startDate: string, endDate: string, pharmacistId?: string): void {
    const subscriptionKey = `${startDate}-${endDate}-${pharmacistId || 'all'}`;
    
    if (this.socket && this.isConnected()) {
      this.socket.emit('unsubscribe_calendar', { startDate, endDate, pharmacistId });
    }

    this.subscriptions.calendar.delete(subscriptionKey);
  }

  /**
   * Subscribe to follow-up task updates
   */
  subscribeToFollowUps(assignedTo?: string, patientId?: string): void {
    const subscriptionKey = `${assignedTo || 'all'}-${patientId || 'all'}`;
    
    if (!this.socket || !this.isConnected()) {
      // Store subscription for later when connected
      this.subscriptions.followups.set(subscriptionKey, { assignedTo, patientId });
      return;
    }

    this.socket.emit('subscribe_followups', { assignedTo, patientId });
    this.subscriptions.followups.set(subscriptionKey, { assignedTo, patientId });
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected === true;
  }

  /**
   * Get socket instance (for advanced usage)
   */
  getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
    return this.socket;
  }

  /**
   * Private helper methods
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.eventHandlers.onConnectionStatusChange?.(status);
    }
  }

  private attemptReconnection(): void {
    if (this.isManualDisconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    this.setConnectionStatus('reconnecting');

    setTimeout(() => {
      if (this.socket && !this.socket.connected) {
        this.socket.connect();
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  private resubscribeAll(): void {
    // Resubscribe to all calendar subscriptions
    this.subscriptions.calendar.forEach((subscription, key) => {
      if (this.socket && this.isConnected()) {
        this.socket.emit('subscribe_calendar', subscription);
      }
    });

    // Resubscribe to all follow-up subscriptions
    this.subscriptions.followups.forEach((subscription, key) => {
      if (this.socket && this.isConnected()) {
        this.socket.emit('subscribe_followups', subscription);
      }
    });
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.socket && this.isConnected()) {
        this.socket.emit('ping');
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Utility methods for debugging and monitoring
   */
  getConnectionInfo(): {
    status: ConnectionStatus;
    reconnectAttempts: number;
    subscriptions: {
      calendar: string[];
      followups: string[];
    };
    socketId?: string;
  } {
    return {
      status: this.connectionStatus,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: {
        calendar: Array.from(this.subscriptions.calendar.keys()),
        followups: Array.from(this.subscriptions.followups.keys()),
      },
      socketId: this.socket?.id,
    };
  }

  /**
   * Force reconnection (useful for testing or manual recovery)
   */
  forceReconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.connect();
    }
  }
}

// Create singleton instance
export const appointmentSocketService = new AppointmentSocketService();

// Export types
export type {
  AppointmentEventData,
  FollowUpEventData,
  CalendarUpdateData,
  AppointmentEventHandlers,
  AppointmentSocketConfig,
};