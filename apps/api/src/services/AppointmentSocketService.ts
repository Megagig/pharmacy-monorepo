/**
 * Appointment Socket Service
 * Handles real-time updates for appointments and follow-up tasks
 * Requirements: 1.1, 1.4, 3.1, 10.1
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import User from '../models/User';
import { IAppointment } from '../models/Appointment';
import { IFollowUpTask } from '../models/FollowUpTask';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  workplaceId?: string;
  role?: string;
}

interface SocketUserData {
  userId: string;
  workplaceId: string;
  role: string;
  email: string;
  firstName: string;
  lastName: string;
}

// Event data interfaces
interface AppointmentEventData {
  appointment: IAppointment;
  action: 'created' | 'updated' | 'status_changed' | 'rescheduled' | 'cancelled' | 'confirmed';
  actor: {
    userId: string;
    name: string;
    role: string;
  };
  timestamp: Date;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

interface FollowUpEventData {
  followUpTask: IFollowUpTask;
  action: 'created' | 'updated' | 'completed' | 'escalated' | 'converted_to_appointment' | 'assigned';
  actor: {
    userId: string;
    name: string;
    role: string;
  };
  timestamp: Date;
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

/**
 * Socket.IO service for real-time appointment and follow-up updates
 */
export class AppointmentSocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private socketUsers: Map<string, SocketUserData> = new Map(); // socketId -> userData
  private workplaceRooms: Map<string, Set<string>> = new Map(); // workplaceId -> Set of socketIds
  private pharmacistRooms: Map<string, Set<string>> = new Map(); // pharmacistId -> Set of socketIds

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupSocketHandlers();
    logger.info('Appointment Socket service initialized');
  }

  /**
   * Setup Socket.IO event handlers with authentication middleware
   */
  private setupSocketHandlers(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        let user = null;
        logger.debug('Authenticating socket for appointment service:', socket.id);

        // Try token-based auth first
        const token = socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (token) {
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
            const userId = decoded.userId || decoded.id;
            user = await User.findById(userId)
              .select('_id workplaceId role email firstName lastName');
          } catch (tokenError) {
            logger.warn('Token authentication failed for appointment socket:', tokenError.message);
          }
        }

        // Try cookie-based auth if token failed
        if (!user) {
          const cookies = socket.handshake.headers.cookie;
          if (cookies) {
            const tokenMatch = cookies.match(/token=([^;]+)/);
            if (tokenMatch) {
              try {
                const decoded = jwt.verify(tokenMatch[1], process.env.JWT_SECRET!) as any;
                const userId = decoded.userId || decoded.id;
                user = await User.findById(userId)
                  .select('_id workplaceId role email firstName lastName');
              } catch (cookieError) {
                logger.warn('Cookie authentication failed for appointment socket:', cookieError.message);
              }
            }
          }
        }

        if (!user) {
          logger.warn('Authentication failed for appointment socket:', socket.id);
          return next(new Error('Authentication failed'));
        }

        // Attach user data to socket
        socket.userId = user._id.toString();
        socket.workplaceId = user.workplaceId.toString();
        socket.role = user.role;

        logger.info('Socket authenticated for appointment service:', {
          socketId: socket.id,
          userId: socket.userId,
          workplaceId: socket.workplaceId,
          role: socket.role,
        });

        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    // Handle connections
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new socket connection
   */
  private handleConnection(socket: AuthenticatedSocket): void {
    const { userId, workplaceId, role } = socket;

    if (!userId || !workplaceId) {
      logger.error('Socket missing required auth data:', socket.id);
      socket.disconnect();
      return;
    }

    logger.info('New appointment socket connection:', {
      socketId: socket.id,
      userId,
      workplaceId,
      role,
    });

    // Store user data
    const userData: SocketUserData = {
      userId,
      workplaceId,
      role: role!,
      email: '', // Will be populated from user record if needed
      firstName: '',
      lastName: '',
    };

    this.socketUsers.set(socket.id, userData);

    // Add to user connections
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socket.id);

    // Join workplace room
    socket.join(`workplace:${workplaceId}`);
    if (!this.workplaceRooms.has(workplaceId)) {
      this.workplaceRooms.set(workplaceId, new Set());
    }
    this.workplaceRooms.get(workplaceId)!.add(socket.id);

    // Join pharmacist room if user is a pharmacist
    if (role === 'pharmacist' || role === 'pharmacy_manager') {
      socket.join(`pharmacist:${userId}`);
      if (!this.pharmacistRooms.has(userId)) {
        this.pharmacistRooms.set(userId, new Set());
      }
      this.pharmacistRooms.get(userId)!.add(socket.id);
    }

    // Setup event handlers
    this.setupEventHandlers(socket);

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  /**
   * Setup event handlers for the socket
   */
  private setupEventHandlers(socket: AuthenticatedSocket): void {
    const { userId, workplaceId } = socket;

    // Subscribe to appointment updates for specific date range
    socket.on('subscribe_calendar', (data: { startDate: string; endDate: string; pharmacistId?: string }) => {
      try {
        const { startDate, endDate, pharmacistId } = data;
        
        // Join calendar room for date range
        const calendarRoom = `calendar:${workplaceId}:${startDate}:${endDate}`;
        socket.join(calendarRoom);

        // Join pharmacist-specific calendar if specified
        if (pharmacistId) {
          const pharmacistCalendarRoom = `calendar:${pharmacistId}:${startDate}:${endDate}`;
          socket.join(pharmacistCalendarRoom);
        }

        logger.debug('Socket subscribed to calendar updates:', {
          socketId: socket.id,
          userId,
          calendarRoom,
          pharmacistId,
        });

        socket.emit('calendar_subscribed', { startDate, endDate, pharmacistId });
      } catch (error) {
        logger.error('Error subscribing to calendar:', error);
        socket.emit('error', { message: 'Failed to subscribe to calendar updates' });
      }
    });

    // Subscribe to follow-up task updates
    socket.on('subscribe_followups', (data: { assignedTo?: string; patientId?: string }) => {
      try {
        const { assignedTo, patientId } = data;

        // Join follow-up room
        const followUpRoom = `followups:${workplaceId}`;
        socket.join(followUpRoom);

        // Join assigned pharmacist room if specified
        if (assignedTo) {
          const assignedRoom = `followups:assigned:${assignedTo}`;
          socket.join(assignedRoom);
        }

        // Join patient-specific room if specified
        if (patientId) {
          const patientRoom = `followups:patient:${patientId}`;
          socket.join(patientRoom);
        }

        logger.debug('Socket subscribed to follow-up updates:', {
          socketId: socket.id,
          userId,
          followUpRoom,
          assignedTo,
          patientId,
        });

        socket.emit('followups_subscribed', { assignedTo, patientId });
      } catch (error) {
        logger.error('Error subscribing to follow-ups:', error);
        socket.emit('error', { message: 'Failed to subscribe to follow-up updates' });
      }
    });

    // Unsubscribe from calendar updates
    socket.on('unsubscribe_calendar', (data: { startDate: string; endDate: string; pharmacistId?: string }) => {
      try {
        const { startDate, endDate, pharmacistId } = data;
        
        const calendarRoom = `calendar:${workplaceId}:${startDate}:${endDate}`;
        socket.leave(calendarRoom);

        if (pharmacistId) {
          const pharmacistCalendarRoom = `calendar:${pharmacistId}:${startDate}:${endDate}`;
          socket.leave(pharmacistCalendarRoom);
        }

        logger.debug('Socket unsubscribed from calendar updates:', {
          socketId: socket.id,
          userId,
          calendarRoom,
        });

        socket.emit('calendar_unsubscribed', { startDate, endDate, pharmacistId });
      } catch (error) {
        logger.error('Error unsubscribing from calendar:', error);
      }
    });

    // Handle ping for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
  }

  /**
   * Handle socket disconnection
   */
  private handleDisconnection(socket: AuthenticatedSocket): void {
    const { userId, workplaceId } = socket;

    logger.info('Appointment socket disconnected:', {
      socketId: socket.id,
      userId,
      workplaceId,
    });

    // Remove from user connections
    if (userId && this.connectedUsers.has(userId)) {
      this.connectedUsers.get(userId)!.delete(socket.id);
      if (this.connectedUsers.get(userId)!.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }

    // Remove from workplace room
    if (workplaceId && this.workplaceRooms.has(workplaceId)) {
      this.workplaceRooms.get(workplaceId)!.delete(socket.id);
      if (this.workplaceRooms.get(workplaceId)!.size === 0) {
        this.workplaceRooms.delete(workplaceId);
      }
    }

    // Remove from pharmacist room
    if (userId && this.pharmacistRooms.has(userId)) {
      this.pharmacistRooms.get(userId)!.delete(socket.id);
      if (this.pharmacistRooms.get(userId)!.size === 0) {
        this.pharmacistRooms.delete(userId);
      }
    }

    // Remove socket user data
    this.socketUsers.delete(socket.id);
  }

  /**
   * Emit appointment created event
   */
  public emitAppointmentCreated(appointment: IAppointment, actor: { userId: string; name: string; role: string }): void {
    try {
      const eventData: AppointmentEventData = {
        appointment,
        action: 'created',
        actor,
        timestamp: new Date(),
      };

      // Emit to workplace room
      this.io.to(`workplace:${appointment.workplaceId}`).emit('appointment:created', eventData);

      // Emit to assigned pharmacist
      if (appointment.assignedTo) {
        this.io.to(`pharmacist:${appointment.assignedTo}`).emit('appointment:created', eventData);
      }

      // Emit to calendar rooms that might include this date
      const appointmentDate = new Date(appointment.scheduledDate).toISOString().split('T')[0];
      this.emitCalendarUpdate({
        date: appointmentDate,
        workplaceId: appointment.workplaceId.toString(),
        locationId: appointment.locationId,
        pharmacistId: appointment.assignedTo?.toString(),
        updateType: 'appointment_change',
      });

      logger.debug('Appointment created event emitted:', {
        appointmentId: appointment._id.toString(),
        workplaceId: appointment.workplaceId.toString(),
        assignedTo: appointment.assignedTo?.toString(),
      });
    } catch (error) {
      logger.error('Error emitting appointment created event:', error);
    }
  }

  /**
   * Emit appointment updated event
   */
  public emitAppointmentUpdated(
    appointment: IAppointment,
    actor: { userId: string; name: string; role: string },
    changes?: { field: string; oldValue: any; newValue: any }[]
  ): void {
    try {
      const eventData: AppointmentEventData = {
        appointment,
        action: 'updated',
        actor,
        timestamp: new Date(),
        changes,
      };

      // Emit to workplace room
      this.io.to(`workplace:${appointment.workplaceId}`).emit('appointment:updated', eventData);

      // Emit to assigned pharmacist
      if (appointment.assignedTo) {
        this.io.to(`pharmacist:${appointment.assignedTo}`).emit('appointment:updated', eventData);
      }

      // Emit calendar update
      const appointmentDate = new Date(appointment.scheduledDate).toISOString().split('T')[0];
      this.emitCalendarUpdate({
        date: appointmentDate,
        workplaceId: appointment.workplaceId.toString(),
        locationId: appointment.locationId,
        pharmacistId: appointment.assignedTo?.toString(),
        updateType: 'appointment_change',
      });

      logger.debug('Appointment updated event emitted:', {
        appointmentId: appointment._id.toString(),
        changes: changes?.length || 0,
      });
    } catch (error) {
      logger.error('Error emitting appointment updated event:', error);
    }
  }

  /**
   * Emit appointment status changed event
   */
  public emitAppointmentStatusChanged(
    appointment: IAppointment,
    actor: { userId: string; name: string; role: string },
    oldStatus: string
  ): void {
    try {
      const eventData: AppointmentEventData = {
        appointment,
        action: 'status_changed',
        actor,
        timestamp: new Date(),
        changes: [{
          field: 'status',
          oldValue: oldStatus,
          newValue: appointment.status,
        }],
      };

      // Emit to workplace room
      this.io.to(`workplace:${appointment.workplaceId}`).emit('appointment:status_changed', eventData);

      // Emit to assigned pharmacist
      if (appointment.assignedTo) {
        this.io.to(`pharmacist:${appointment.assignedTo}`).emit('appointment:status_changed', eventData);
      }

      // Emit to patient if they have a socket connection (future enhancement)
      // this.io.to(`patient:${appointment.patientId}`).emit('appointment:status_changed', eventData);

      logger.debug('Appointment status changed event emitted:', {
        appointmentId: appointment._id.toString(),
        oldStatus,
        newStatus: appointment.status,
      });
    } catch (error) {
      logger.error('Error emitting appointment status changed event:', error);
    }
  }

  /**
   * Emit appointment rescheduled event
   */
  public emitAppointmentRescheduled(
    appointment: IAppointment,
    actor: { userId: string; name: string; role: string },
    oldDate: Date,
    oldTime: string
  ): void {
    try {
      const eventData: AppointmentEventData = {
        appointment,
        action: 'rescheduled',
        actor,
        timestamp: new Date(),
        changes: [
          {
            field: 'scheduledDate',
            oldValue: oldDate,
            newValue: appointment.scheduledDate,
          },
          {
            field: 'scheduledTime',
            oldValue: oldTime,
            newValue: appointment.scheduledTime,
          },
        ],
      };

      // Emit to workplace room
      this.io.to(`workplace:${appointment.workplaceId}`).emit('appointment:rescheduled', eventData);

      // Emit to assigned pharmacist
      if (appointment.assignedTo) {
        this.io.to(`pharmacist:${appointment.assignedTo}`).emit('appointment:rescheduled', eventData);
      }

      // Emit calendar updates for both old and new dates
      const oldDateStr = new Date(oldDate).toISOString().split('T')[0];
      const newDateStr = new Date(appointment.scheduledDate).toISOString().split('T')[0];

      this.emitCalendarUpdate({
        date: oldDateStr,
        workplaceId: appointment.workplaceId.toString(),
        locationId: appointment.locationId,
        pharmacistId: appointment.assignedTo?.toString(),
        updateType: 'appointment_change',
      });

      if (oldDateStr !== newDateStr) {
        this.emitCalendarUpdate({
          date: newDateStr,
          workplaceId: appointment.workplaceId.toString(),
          locationId: appointment.locationId,
          pharmacistId: appointment.assignedTo?.toString(),
          updateType: 'appointment_change',
        });
      }

      logger.debug('Appointment rescheduled event emitted:', {
        appointmentId: appointment._id.toString(),
        oldDate: oldDateStr,
        newDate: newDateStr,
      });
    } catch (error) {
      logger.error('Error emitting appointment rescheduled event:', error);
    }
  }

  /**
   * Emit appointment cancelled event
   */
  public emitAppointmentCancelled(
    appointment: IAppointment,
    actor: { userId: string; name: string; role: string },
    reason: string
  ): void {
    try {
      const eventData: AppointmentEventData = {
        appointment,
        action: 'cancelled',
        actor,
        timestamp: new Date(),
        changes: [{
          field: 'status',
          oldValue: 'scheduled', // Assuming it was scheduled before cancellation
          newValue: 'cancelled',
        }],
      };

      // Emit to workplace room
      this.io.to(`workplace:${appointment.workplaceId}`).emit('appointment:cancelled', eventData);

      // Emit to assigned pharmacist
      if (appointment.assignedTo) {
        this.io.to(`pharmacist:${appointment.assignedTo}`).emit('appointment:cancelled', eventData);
      }

      // Emit calendar update
      const appointmentDate = new Date(appointment.scheduledDate).toISOString().split('T')[0];
      this.emitCalendarUpdate({
        date: appointmentDate,
        workplaceId: appointment.workplaceId.toString(),
        locationId: appointment.locationId,
        pharmacistId: appointment.assignedTo?.toString(),
        updateType: 'appointment_change',
      });

      logger.debug('Appointment cancelled event emitted:', {
        appointmentId: appointment._id.toString(),
        reason,
      });
    } catch (error) {
      logger.error('Error emitting appointment cancelled event:', error);
    }
  }

  /**
   * Emit appointment confirmed event
   */
  public emitAppointmentConfirmed(
    appointment: IAppointment,
    actor: { userId: string; name: string; role: string }
  ): void {
    try {
      const eventData: AppointmentEventData = {
        appointment,
        action: 'confirmed',
        actor,
        timestamp: new Date(),
        changes: [{
          field: 'confirmationStatus',
          oldValue: 'pending',
          newValue: 'confirmed',
        }],
      };

      // Emit to workplace room
      this.io.to(`workplace:${appointment.workplaceId}`).emit('appointment:confirmed', eventData);

      // Emit to assigned pharmacist
      if (appointment.assignedTo) {
        this.io.to(`pharmacist:${appointment.assignedTo}`).emit('appointment:confirmed', eventData);
      }

      logger.debug('Appointment confirmed event emitted:', {
        appointmentId: appointment._id.toString(),
        confirmedBy: actor.userId,
      });
    } catch (error) {
      logger.error('Error emitting appointment confirmed event:', error);
    }
  }

  /**
   * Emit follow-up task created event
   */
  public emitFollowUpCreated(
    followUpTask: IFollowUpTask,
    actor: { userId: string; name: string; role: string }
  ): void {
    try {
      const eventData: FollowUpEventData = {
        followUpTask,
        action: 'created',
        actor,
        timestamp: new Date(),
      };

      // Emit to workplace room
      this.io.to(`workplace:${followUpTask.workplaceId}`).emit('followup:created', eventData);

      // Emit to assigned pharmacist
      if (followUpTask.assignedTo) {
        this.io.to(`pharmacist:${followUpTask.assignedTo}`).emit('followup:created', eventData);
        this.io.to(`followups:assigned:${followUpTask.assignedTo}`).emit('followup:created', eventData);
      }

      // Emit to patient-specific room
      this.io.to(`followups:patient:${followUpTask.patientId}`).emit('followup:created', eventData);

      logger.debug('Follow-up task created event emitted:', {
        taskId: followUpTask._id.toString(),
        workplaceId: followUpTask.workplaceId.toString(),
        assignedTo: followUpTask.assignedTo?.toString(),
      });
    } catch (error) {
      logger.error('Error emitting follow-up created event:', error);
    }
  }

  /**
   * Emit follow-up task updated event
   */
  public emitFollowUpUpdated(
    followUpTask: IFollowUpTask,
    actor: { userId: string; name: string; role: string },
    changes?: { field: string; oldValue: any; newValue: any }[]
  ): void {
    try {
      const eventData: FollowUpEventData = {
        followUpTask,
        action: 'updated',
        actor,
        timestamp: new Date(),
        changes,
      };

      // Emit to workplace room
      this.io.to(`workplace:${followUpTask.workplaceId}`).emit('followup:updated', eventData);

      // Emit to assigned pharmacist
      if (followUpTask.assignedTo) {
        this.io.to(`pharmacist:${followUpTask.assignedTo}`).emit('followup:updated', eventData);
        this.io.to(`followups:assigned:${followUpTask.assignedTo}`).emit('followup:updated', eventData);
      }

      // Emit to patient-specific room
      this.io.to(`followups:patient:${followUpTask.patientId}`).emit('followup:updated', eventData);

      logger.debug('Follow-up task updated event emitted:', {
        taskId: followUpTask._id.toString(),
        changes: changes?.length || 0,
      });
    } catch (error) {
      logger.error('Error emitting follow-up updated event:', error);
    }
  }

  /**
   * Emit follow-up task completed event
   */
  public emitFollowUpCompleted(
    followUpTask: IFollowUpTask,
    actor: { userId: string; name: string; role: string }
  ): void {
    try {
      const eventData: FollowUpEventData = {
        followUpTask,
        action: 'completed',
        actor,
        timestamp: new Date(),
        changes: [{
          field: 'status',
          oldValue: 'pending', // Assuming it was pending before completion
          newValue: 'completed',
        }],
      };

      // Emit to workplace room
      this.io.to(`workplace:${followUpTask.workplaceId}`).emit('followup:completed', eventData);

      // Emit to assigned pharmacist
      if (followUpTask.assignedTo) {
        this.io.to(`pharmacist:${followUpTask.assignedTo}`).emit('followup:completed', eventData);
        this.io.to(`followups:assigned:${followUpTask.assignedTo}`).emit('followup:completed', eventData);
      }

      // Emit to patient-specific room
      this.io.to(`followups:patient:${followUpTask.patientId}`).emit('followup:completed', eventData);

      logger.debug('Follow-up task completed event emitted:', {
        taskId: followUpTask._id.toString(),
        completedBy: actor.userId,
      });
    } catch (error) {
      logger.error('Error emitting follow-up completed event:', error);
    }
  }

  /**
   * Emit follow-up task escalated event
   */
  public emitFollowUpEscalated(
    followUpTask: IFollowUpTask,
    actor: { userId: string; name: string; role: string },
    oldPriority: string,
    reason: string
  ): void {
    try {
      const eventData: FollowUpEventData = {
        followUpTask,
        action: 'escalated',
        actor,
        timestamp: new Date(),
        changes: [{
          field: 'priority',
          oldValue: oldPriority,
          newValue: followUpTask.priority,
        }],
      };

      // Emit to workplace room
      this.io.to(`workplace:${followUpTask.workplaceId}`).emit('followup:escalated', eventData);

      // Emit to assigned pharmacist
      if (followUpTask.assignedTo) {
        this.io.to(`pharmacist:${followUpTask.assignedTo}`).emit('followup:escalated', eventData);
        this.io.to(`followups:assigned:${followUpTask.assignedTo}`).emit('followup:escalated', eventData);
      }

      // Emit to managers for high priority escalations
      if (['urgent', 'critical'].includes(followUpTask.priority)) {
        this.io.to(`workplace:${followUpTask.workplaceId}`).emit('followup:high_priority_alert', eventData);
      }

      logger.debug('Follow-up task escalated event emitted:', {
        taskId: followUpTask._id.toString(),
        oldPriority,
        newPriority: followUpTask.priority,
        reason,
      });
    } catch (error) {
      logger.error('Error emitting follow-up escalated event:', error);
    }
  }

  /**
   * Emit follow-up converted to appointment event
   */
  public emitFollowUpConvertedToAppointment(
    followUpTask: IFollowUpTask,
    appointment: IAppointment,
    actor: { userId: string; name: string; role: string }
  ): void {
    try {
      const eventData: FollowUpEventData = {
        followUpTask,
        action: 'converted_to_appointment',
        actor,
        timestamp: new Date(),
        changes: [{
          field: 'status',
          oldValue: 'pending',
          newValue: 'converted_to_appointment',
        }],
      };

      // Emit to workplace room
      this.io.to(`workplace:${followUpTask.workplaceId}`).emit('followup:converted_to_appointment', {
        ...eventData,
        appointment,
      });

      // Emit to assigned pharmacist
      if (followUpTask.assignedTo) {
        this.io.to(`pharmacist:${followUpTask.assignedTo}`).emit('followup:converted_to_appointment', {
          ...eventData,
          appointment,
        });
      }

      // Also emit appointment created event
      this.emitAppointmentCreated(appointment, actor);

      logger.debug('Follow-up converted to appointment event emitted:', {
        taskId: followUpTask._id.toString(),
        appointmentId: appointment._id.toString(),
      });
    } catch (error) {
      logger.error('Error emitting follow-up converted to appointment event:', error);
    }
  }

  /**
   * Emit calendar update event
   */
  private emitCalendarUpdate(data: CalendarUpdateData): void {
    try {
      // Emit to all calendar rooms that might be affected
      const { date, workplaceId, locationId, pharmacistId, updateType } = data;

      // Emit to workplace calendar rooms
      this.io.to(`workplace:${workplaceId}`).emit('calendar:update', data);

      // Emit to pharmacist-specific calendar rooms
      if (pharmacistId) {
        this.io.to(`pharmacist:${pharmacistId}`).emit('calendar:update', data);
      }

      logger.debug('Calendar update event emitted:', data);
    } catch (error) {
      logger.error('Error emitting calendar update event:', error);
    }
  }

  /**
   * Get connected users count for a workplace
   */
  public getConnectedUsersCount(workplaceId: string): number {
    const workplaceRoom = this.workplaceRooms.get(workplaceId);
    return workplaceRoom ? workplaceRoom.size : 0;
  }

  /**
   * Check if a user is connected
   */
  public isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId) && this.connectedUsers.get(userId)!.size > 0;
  }

  /**
   * Get all connected users in a workplace
   */
  public getConnectedUsersInWorkplace(workplaceId: string): string[] {
    const connectedUserIds: string[] = [];
    
    for (const [userId, socketIds] of this.connectedUsers.entries()) {
      if (socketIds.size > 0) {
        // Check if any of the user's sockets are in this workplace
        for (const socketId of socketIds) {
          const userData = this.socketUsers.get(socketId);
          if (userData && userData.workplaceId === workplaceId) {
            connectedUserIds.push(userId);
            break;
          }
        }
      }
    }

    return connectedUserIds;
  }
}

// Export as default for backward compatibility
export default AppointmentSocketService;