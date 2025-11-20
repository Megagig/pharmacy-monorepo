/**
 * Tests for AppointmentSocketService
 * Requirements: 1.1, 1.4, 3.1, 10.1
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import AppointmentSocketService from '../../services/AppointmentSocketService';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import * as bcrypt from 'bcryptjs';

describe('AppointmentSocketService', () => {
  let mongoServer: MongoMemoryServer;
  let httpServer: any;
  let io: SocketIOServer;
  let appointmentSocketService: AppointmentSocketService;
  let mockSocket: any;
  let testUser: any;
  let testWorkplace: any;

  beforeEach(async () => {
    // Setup MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create a mock plan first
    const mockPlan = new mongoose.Types.ObjectId();

    // Create test owner first
    const testOwner = await User.create({
      firstName: 'Test',
      lastName: 'Owner',
      email: 'owner@pharmacy.com',
      passwordHash: await bcrypt.hash('password123', 10),
      role: 'owner',
      currentPlanId: mockPlan,
      assignedRoles: [],
      directPermissions: [],
      deniedPermissions: [],
      permissions: [],
      features: [],
      licenseStatus: 'not_required',
      isActive: true,
      emailVerified: true,
      status: 'active',
    });

    // Create test workplace
    testWorkplace = await Workplace.create({
      name: 'Test Pharmacy',
      type: 'Community',
      address: 'Test Address',
      phone: '1234567890',
      email: 'test@pharmacy.com',
      ownerId: testOwner._id,
      verificationStatus: 'verified',
      documents: [],
      inviteCode: 'TEST123',
      teamMembers: [],
      subscriptionTier: 'premium',
      isActive: true,
    });

    // Create test user
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'Pharmacist',
      email: 'test@pharmacist.com',
      passwordHash: await bcrypt.hash('password123', 10),
      role: 'pharmacist',
      workplaceId: testWorkplace._id,
      currentPlanId: mockPlan,
      assignedRoles: [],
      directPermissions: [],
      deniedPermissions: [],
      permissions: [],
      features: [],
      licenseStatus: 'not_required',
      isActive: true,
      emailVerified: true,
      status: 'active',
    });

    // Setup HTTP server and Socket.IO
    httpServer = createServer();
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    // Initialize AppointmentSocketService
    appointmentSocketService = new AppointmentSocketService(io);

    // Create mock socket
    mockSocket = {
      id: 'test-socket-id',
      userId: testUser._id.toString(),
      workplaceId: testWorkplace._id.toString(),
      role: testUser.role,
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      disconnect: jest.fn(),
    };
  });

  afterEach(async () => {
    if (httpServer) {
      httpServer.close();
    }
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('Socket Service Initialization', () => {
    it('should initialize AppointmentSocketService successfully', () => {
      expect(appointmentSocketService).toBeDefined();
      expect(appointmentSocketService.getConnectedUsersCount).toBeDefined();
      expect(appointmentSocketService.isUserConnected).toBeDefined();
    });

    it('should track connected users count', () => {
      const count = appointmentSocketService.getConnectedUsersCount(testWorkplace._id.toString());
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should check if user is connected', () => {
      const isConnected = appointmentSocketService.isUserConnected(testUser._id.toString());
      expect(typeof isConnected).toBe('boolean');
    });
  });

  describe('Event Emission', () => {
    it('should emit appointment created event', () => {
      const mockAppointment = {
        _id: new mongoose.Types.ObjectId(),
        workplaceId: testWorkplace._id,
        patientId: new mongoose.Types.ObjectId(),
        assignedTo: testUser._id,
        type: 'mtm_session',
        title: 'Test Appointment',
        scheduledDate: new Date('2025-10-25'),
        scheduledTime: '10:00',
        duration: 30,
        status: 'scheduled',
      };

      const actor = {
        userId: testUser._id.toString(),
        name: `${testUser.firstName} ${testUser.lastName}`,
        role: testUser.role,
      };

      // Mock the io.to method
      const mockTo = jest.fn().mockReturnValue({
        emit: jest.fn(),
      });
      (io as any).to = mockTo;

      appointmentSocketService.emitAppointmentCreated(mockAppointment as any, actor);

      expect(mockTo).toHaveBeenCalledWith(`workplace:${testWorkplace._id}`);
      expect(mockTo).toHaveBeenCalledWith(`pharmacist:${testUser._id}`);
    });

    it('should emit appointment status changed event', () => {
      const mockAppointment = {
        _id: new mongoose.Types.ObjectId(),
        workplaceId: testWorkplace._id,
        patientId: new mongoose.Types.ObjectId(),
        assignedTo: testUser._id,
        type: 'mtm_session',
        title: 'Test Appointment',
        scheduledDate: new Date('2025-10-25'),
        scheduledTime: '10:00',
        duration: 30,
        status: 'confirmed',
      };

      const actor = {
        userId: testUser._id.toString(),
        name: `${testUser.firstName} ${testUser.lastName}`,
        role: testUser.role,
      };

      // Mock the io.to method
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({
        emit: mockEmit,
      });
      (io as any).to = mockTo;

      appointmentSocketService.emitAppointmentStatusChanged(mockAppointment as any, actor, 'scheduled');

      expect(mockTo).toHaveBeenCalledWith(`workplace:${testWorkplace._id}`);
      expect(mockEmit).toHaveBeenCalledWith('appointment:status_changed', expect.objectContaining({
        appointment: mockAppointment,
        action: 'status_changed',
        actor,
        changes: expect.arrayContaining([
          expect.objectContaining({
            field: 'status',
            oldValue: 'scheduled',
            newValue: 'confirmed',
          }),
        ]),
      }));
    });

    it('should emit follow-up created event', () => {
      const mockFollowUpTask = {
        _id: new mongoose.Types.ObjectId(),
        workplaceId: testWorkplace._id,
        patientId: new mongoose.Types.ObjectId(),
        assignedTo: testUser._id,
        type: 'medication_start_followup',
        title: 'Test Follow-up',
        description: 'Test follow-up task',
        priority: 'high',
        dueDate: new Date('2025-10-30'),
        status: 'pending',
      };

      const actor = {
        userId: testUser._id.toString(),
        name: `${testUser.firstName} ${testUser.lastName}`,
        role: testUser.role,
      };

      // Mock the io.to method
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({
        emit: mockEmit,
      });
      (io as any).to = mockTo;

      appointmentSocketService.emitFollowUpCreated(mockFollowUpTask as any, actor);

      expect(mockTo).toHaveBeenCalledWith(`workplace:${testWorkplace._id}`);
      expect(mockEmit).toHaveBeenCalledWith('followup:created', expect.objectContaining({
        followUpTask: mockFollowUpTask,
        action: 'created',
        actor,
      }));
    });

    it('should emit follow-up escalated event', () => {
      const mockFollowUpTask = {
        _id: new mongoose.Types.ObjectId(),
        workplaceId: testWorkplace._id,
        patientId: new mongoose.Types.ObjectId(),
        assignedTo: testUser._id,
        type: 'medication_start_followup',
        title: 'Test Follow-up',
        description: 'Test follow-up task',
        priority: 'urgent',
        dueDate: new Date('2025-10-30'),
        status: 'pending',
      };

      const actor = {
        userId: testUser._id.toString(),
        name: `${testUser.firstName} ${testUser.lastName}`,
        role: testUser.role,
      };

      // Mock the io.to method
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({
        emit: mockEmit,
      });
      (io as any).to = mockTo;

      appointmentSocketService.emitFollowUpEscalated(
        mockFollowUpTask as any,
        actor,
        'high',
        'Patient condition worsening'
      );

      expect(mockTo).toHaveBeenCalledWith(`workplace:${testWorkplace._id}`);
      expect(mockEmit).toHaveBeenCalledWith('followup:escalated', expect.objectContaining({
        followUpTask: mockFollowUpTask,
        action: 'escalated',
        actor,
        changes: expect.arrayContaining([
          expect.objectContaining({
            field: 'priority',
            oldValue: 'high',
            newValue: 'urgent',
          }),
        ]),
      }));
    });
  });

  describe('Utility Methods', () => {
    it('should get connected users in workplace', () => {
      const connectedUsers = appointmentSocketService.getConnectedUsersInWorkplace(
        testWorkplace._id.toString()
      );
      expect(Array.isArray(connectedUsers)).toBe(true);
    });
  });
});