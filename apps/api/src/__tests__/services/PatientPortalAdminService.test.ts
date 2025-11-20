import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import PatientUser from '../../models/PatientUser';
import FollowUpTask from '../../models/FollowUpTask';
import PatientPortalSettings from '../../models/PatientPortalSettings';
import User from '../../models/User';
import { PatientPortalAdminService } from '../../services/PatientPortalAdminService';
import { notificationService } from '../../services/notificationService';

// Mock notification service
jest.mock('../../services/notificationService', () => ({
  notificationService: {
    createNotification: jest.fn().mockResolvedValue({}),
  },
}));

describe('PatientPortalAdminService', () => {
  let mongoServer: MongoMemoryServer;
  let adminService: PatientPortalAdminService;
  let workplaceId: mongoose.Types.ObjectId;
  let adminUserId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;
  let patientUserId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await PatientUser.deleteMany({});
    await FollowUpTask.deleteMany({});
    await PatientPortalSettings.deleteMany({});
    await User.deleteMany({});

    // Initialize service
    adminService = new PatientPortalAdminService();

    // Create test IDs
    workplaceId = new mongoose.Types.ObjectId();
    adminUserId = new mongoose.Types.ObjectId();
    pharmacistId = new mongoose.Types.ObjectId();
    patientUserId = new mongoose.Types.ObjectId();

    // Create test pharmacist
    await User.create({
      _id: pharmacistId,
      workplaceId,
      firstName: 'John',
      lastName: 'Pharmacist',
      email: 'pharmacist@test.com',
      role: 'pharmacist',
      passwordHash: 'hashedpassword',
      createdBy: adminUserId,
    });

    // Clear notification service mock
    jest.clearAllMocks();
  });

  describe('getPatientPortalUsers', () => {
    beforeEach(async () => {
      // Create test patient users
      await PatientUser.create([
        {
          _id: patientUserId,
          workplaceId,
          email: 'patient1@test.com',
          firstName: 'John',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'active',
          createdBy: adminUserId,
        },
        {
          workplaceId,
          email: 'patient2@test.com',
          firstName: 'Jane',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'pending',
          createdBy: adminUserId,
        },
        {
          workplaceId,
          email: 'patient3@test.com',
          firstName: 'Bob',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'suspended',
          createdBy: adminUserId,
        },
      ]);
    });

    it('should get all patient users with default pagination', async () => {
      const result = await adminService.getPatientPortalUsers(workplaceId);

      expect(result.users).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter users by status', async () => {
      const result = await adminService.getPatientPortalUsers(
        workplaceId,
        { status: 'active' }
      );

      expect(result.users).toHaveLength(1);
      expect(result.users[0].status).toBe('active');
      expect(result.total).toBe(1);
    });

    it('should search users by name', async () => {
      const result = await adminService.getPatientPortalUsers(
        workplaceId,
        { search: 'Jane' }
      );

      expect(result.users).toHaveLength(1);
      expect(result.users[0].firstName).toBe('Jane');
    });

    it('should search users by email', async () => {
      const result = await adminService.getPatientPortalUsers(
        workplaceId,
        { search: 'patient2@test.com' }
      );

      expect(result.users).toHaveLength(1);
      expect(result.users[0].email).toBe('patient2@test.com');
    });

    it('should apply pagination correctly', async () => {
      const result = await adminService.getPatientPortalUsers(
        workplaceId,
        {},
        { page: 1, limit: 2 }
      );

      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(2);
    });

    it('should filter by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const result = await adminService.getPatientPortalUsers(
        workplaceId,
        { dateFrom: yesterday, dateTo: tomorrow }
      );

      expect(result.users).toHaveLength(3);
    });
  });

  describe('approvePatientUser', () => {
    let pendingPatientId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const pendingPatient = await PatientUser.create({
        workplaceId,
        email: 'pending@test.com',
        firstName: 'Pending',
        lastName: 'Patient',
        passwordHash: 'hashedpassword',
        status: 'pending',
        createdBy: adminUserId,
      });
      pendingPatientId = pendingPatient._id;
    });

    it('should approve a pending patient user', async () => {
      const result = await adminService.approvePatientUser(
        workplaceId,
        pendingPatientId,
        adminUserId
      );

      expect(result.status).toBe('active');
      expect(result.updatedBy).toEqual(adminUserId);
      expect(notificationService.createNotification).toHaveBeenCalledWith({
        userId: pendingPatientId,
        type: 'account_approved',
        title: 'Account Approved',
        content: 'Your patient portal account has been approved. You can now access all features.',
        workplaceId,
        createdBy: adminUserId,
      });
    });

    it('should throw error if patient user not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      await expect(
        adminService.approvePatientUser(workplaceId, nonExistentId, adminUserId)
      ).rejects.toThrow('Patient user not found');
    });

    it('should throw error if user is not pending', async () => {
      const activePatient = await PatientUser.create({
        workplaceId,
        email: 'active@test.com',
        firstName: 'Active',
        lastName: 'Patient',
        passwordHash: 'hashedpassword',
        status: 'active',
        createdBy: adminUserId,
      });

      await expect(
        adminService.approvePatientUser(workplaceId, activePatient._id, adminUserId)
      ).rejects.toThrow('Cannot approve user with status: active');
    });
  });

  describe('suspendPatientUser', () => {
    let activePatientId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const activePatient = await PatientUser.create({
        workplaceId,
        email: 'active@test.com',
        firstName: 'Active',
        lastName: 'Patient',
        passwordHash: 'hashedpassword',
        status: 'active',
        createdBy: adminUserId,
      });
      activePatientId = activePatient._id;
    });

    it('should suspend an active patient user', async () => {
      const reason = 'Violation of terms';
      const result = await adminService.suspendPatientUser(
        workplaceId,
        activePatientId,
        reason,
        adminUserId
      );

      expect(result.status).toBe('suspended');
      expect(result.updatedBy).toEqual(adminUserId);
      expect(notificationService.createNotification).toHaveBeenCalledWith({
        userId: activePatientId,
        type: 'account_suspended',
        title: 'Account Suspended',
        content: `Your patient portal account has been suspended. Reason: ${reason}`,
        workplaceId,
        createdBy: adminUserId,
      });
    });

    it('should throw error if user is already suspended', async () => {
      const suspendedPatient = await PatientUser.create({
        workplaceId,
        email: 'suspended@test.com',
        firstName: 'Suspended',
        lastName: 'Patient',
        passwordHash: 'hashedpassword',
        status: 'suspended',
        createdBy: adminUserId,
      });

      await expect(
        adminService.suspendPatientUser(
          workplaceId,
          suspendedPatient._id,
          'Test reason',
          adminUserId
        )
      ).rejects.toThrow('User is already suspended');
    });
  });

  describe('reactivatePatientUser', () => {
    let suspendedPatientId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const suspendedPatient = await PatientUser.create({
        workplaceId,
        email: 'suspended@test.com',
        firstName: 'Suspended',
        lastName: 'Patient',
        passwordHash: 'hashedpassword',
        status: 'suspended',
        createdBy: adminUserId,
      });
      suspendedPatientId = suspendedPatient._id;
    });

    it('should reactivate a suspended patient user', async () => {
      const result = await adminService.reactivatePatientUser(
        workplaceId,
        suspendedPatientId,
        adminUserId
      );

      expect(result.status).toBe('active');
      expect(result.updatedBy).toEqual(adminUserId);
      expect(notificationService.createNotification).toHaveBeenCalledWith({
        userId: suspendedPatientId,
        type: 'account_reactivated',
        title: 'Account Reactivated',
        content: 'Your patient portal account has been reactivated. You can now access all features.',
        workplaceId,
        createdBy: adminUserId,
      });
    });

    it('should throw error if user is not suspended', async () => {
      const activePatient = await PatientUser.create({
        workplaceId,
        email: 'active@test.com',
        firstName: 'Active',
        lastName: 'Patient',
        passwordHash: 'hashedpassword',
        status: 'active',
        createdBy: adminUserId,
      });

      await expect(
        adminService.reactivatePatientUser(workplaceId, activePatient._id, adminUserId)
      ).rejects.toThrow('Cannot reactivate user with status: active');
    });
  });

  describe('getRefillRequests', () => {
    let medicationId: mongoose.Types.ObjectId;
    let patientId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      medicationId = new mongoose.Types.ObjectId();
      patientId = new mongoose.Types.ObjectId();

      // Create test refill requests
      await FollowUpTask.create([
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'medication_refill_request',
          title: 'Refill Request: Test Med 1',
          description: 'Patient requested refill',
          objectives: ['Process refill'],
          priority: 'medium',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'pending',
          trigger: {
            type: 'manual',
            sourceId: medicationId,
            sourceType: 'Medication',
            triggerDate: new Date(),
          },
          metadata: {
            refillRequest: {
              medicationId,
              medicationName: 'Test Med 1',
              currentRefillsRemaining: 3,
              requestedQuantity: 30,
              urgency: 'routine',
              requestedBy: patientUserId,
              requestedAt: new Date(),
            },
          },
          createdBy: patientUserId,
        },
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'medication_refill_request',
          title: 'Refill Request: Test Med 2',
          description: 'Urgent refill needed',
          objectives: ['Process urgent refill'],
          priority: 'high',
          dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
          status: 'pending',
          trigger: {
            type: 'manual',
            sourceId: medicationId,
            sourceType: 'Medication',
            triggerDate: new Date(),
          },
          metadata: {
            refillRequest: {
              medicationId,
              medicationName: 'Test Med 2',
              currentRefillsRemaining: 1,
              requestedQuantity: 30,
              urgency: 'urgent',
              requestedBy: patientUserId,
              requestedAt: new Date(),
            },
          },
          createdBy: patientUserId,
        },
      ]);
    });

    it('should get all refill requests with default pagination', async () => {
      const result = await adminService.getRefillRequests(workplaceId);

      expect(result.requests).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter requests by status', async () => {
      const result = await adminService.getRefillRequests(
        workplaceId,
        { status: 'pending' }
      );

      expect(result.requests).toHaveLength(2);
      expect(result.requests.every(r => r.status === 'pending')).toBe(true);
    });

    it('should filter requests by urgency', async () => {
      const result = await adminService.getRefillRequests(
        workplaceId,
        { urgency: 'urgent' }
      );

      expect(result.requests).toHaveLength(1);
      expect(result.requests[0].metadata?.refillRequest?.urgency).toBe('urgent');
    });

    it('should apply pagination correctly', async () => {
      const result = await adminService.getRefillRequests(
        workplaceId,
        {},
        { page: 1, limit: 1 }
      );

      expect(result.requests).toHaveLength(1);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(2);
    });
  });

  describe('approveRefillRequest', () => {
    let refillRequestId: mongoose.Types.ObjectId;
    let medicationId: mongoose.Types.ObjectId;
    let patientId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      medicationId = new mongoose.Types.ObjectId();
      patientId = new mongoose.Types.ObjectId();

      const refillRequest = await FollowUpTask.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'medication_refill_request',
        title: 'Refill Request: Test Med',
        description: 'Patient requested refill',
        objectives: ['Process refill'],
        priority: 'medium',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'pending',
        trigger: {
          type: 'manual',
          sourceId: medicationId,
          sourceType: 'Medication',
          triggerDate: new Date(),
        },
        metadata: {
          refillRequest: {
            medicationId,
            medicationName: 'Test Med',
            currentRefillsRemaining: 3,
            requestedQuantity: 30,
            urgency: 'routine',
            requestedBy: patientUserId,
            requestedAt: new Date(),
          },
        },
        createdBy: patientUserId,
      });
      refillRequestId = refillRequest._id;
    });

    it('should approve a refill request', async () => {
      const approvedQuantity = 30;
      const pharmacistNotes = 'Approved as requested';

      const result = await adminService.approveRefillRequest(
        workplaceId,
        refillRequestId,
        pharmacistId,
        approvedQuantity,
        pharmacistNotes
      );

      expect(result.status).toBe('completed');
      expect(result.completedBy).toEqual(pharmacistId);
      expect(result.metadata?.refillRequest?.approvedQuantity).toBe(approvedQuantity);
      expect(result.metadata?.refillRequest?.pharmacistNotes).toBe(pharmacistNotes);
      expect(result.outcome?.status).toBe('successful');
    });

    it('should throw error if approved quantity is invalid', async () => {
      await expect(
        adminService.approveRefillRequest(
          workplaceId,
          refillRequestId,
          pharmacistId,
          0
        )
      ).rejects.toThrow('Approved quantity must be greater than 0');

      await expect(
        adminService.approveRefillRequest(
          workplaceId,
          refillRequestId,
          pharmacistId,
          50 // More than requested
        )
      ).rejects.toThrow('Approved quantity cannot exceed requested quantity');
    });

    it('should throw error if request not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      await expect(
        adminService.approveRefillRequest(
          workplaceId,
          nonExistentId,
          pharmacistId,
          30
        )
      ).rejects.toThrow('Refill request not found');
    });
  });

  describe('denyRefillRequest', () => {
    let refillRequestId: mongoose.Types.ObjectId;
    let medicationId: mongoose.Types.ObjectId;
    let patientId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      medicationId = new mongoose.Types.ObjectId();
      patientId = new mongoose.Types.ObjectId();

      const refillRequest = await FollowUpTask.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'medication_refill_request',
        title: 'Refill Request: Test Med',
        description: 'Patient requested refill',
        objectives: ['Process refill'],
        priority: 'medium',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'pending',
        trigger: {
          type: 'manual',
          sourceId: medicationId,
          sourceType: 'Medication',
          triggerDate: new Date(),
        },
        metadata: {
          refillRequest: {
            medicationId,
            medicationName: 'Test Med',
            currentRefillsRemaining: 3,
            requestedQuantity: 30,
            urgency: 'routine',
            requestedBy: patientUserId,
            requestedAt: new Date(),
          },
        },
        createdBy: patientUserId,
      });
      refillRequestId = refillRequest._id;
    });

    it('should deny a refill request', async () => {
      const denialReason = 'No refills remaining';

      const result = await adminService.denyRefillRequest(
        workplaceId,
        refillRequestId,
        pharmacistId,
        denialReason
      );

      expect(result.status).toBe('completed');
      expect(result.completedBy).toEqual(pharmacistId);
      expect(result.metadata?.refillRequest?.denialReason).toBe(denialReason);
      expect(result.outcome?.status).toBe('unsuccessful');
    });

    it('should throw error if denial reason is empty', async () => {
      await expect(
        adminService.denyRefillRequest(
          workplaceId,
          refillRequestId,
          pharmacistId,
          ''
        )
      ).rejects.toThrow('Denial reason is required');
    });
  });

  describe('getPortalAnalytics', () => {
    beforeEach(async () => {
      // Create test data for analytics
      await PatientUser.create([
        {
          workplaceId,
          email: 'active1@test.com',
          firstName: 'Active1',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'active',
          createdBy: adminUserId,
        },
        {
          workplaceId,
          email: 'active2@test.com',
          firstName: 'Active2',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'active',
          createdBy: adminUserId,
        },
        {
          workplaceId,
          email: 'pending@test.com',
          firstName: 'Pending',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'pending',
          createdBy: adminUserId,
        },
        {
          workplaceId,
          email: 'suspended@test.com',
          firstName: 'Suspended',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'suspended',
          createdBy: adminUserId,
        },
      ]);

      // Create refill requests
      const medicationId = new mongoose.Types.ObjectId();
      const patientId = new mongoose.Types.ObjectId();

      await FollowUpTask.create([
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'medication_refill_request',
          title: 'Refill Request 1',
          description: 'Test refill',
          objectives: ['Process refill'],
          priority: 'medium',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'pending',
          trigger: {
            type: 'manual',
            sourceId: medicationId,
            sourceType: 'Medication',
            triggerDate: new Date(),
          },
          metadata: {
            refillRequest: {
              medicationId,
              medicationName: 'Test Med',
              currentRefillsRemaining: 3,
              requestedQuantity: 30,
              urgency: 'routine',
              requestedBy: patientUserId,
              requestedAt: new Date(),
            },
          },
          createdBy: patientUserId,
        },
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'medication_refill_request',
          title: 'Refill Request 2',
          description: 'Test refill completed',
          objectives: ['Process refill'],
          priority: 'medium',
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          status: 'completed',
          completedAt: new Date(),
          outcome: {
            status: 'successful',
            notes: 'Approved',
            nextActions: [],
            appointmentCreated: false,
          },
          trigger: {
            type: 'manual',
            sourceId: medicationId,
            sourceType: 'Medication',
            triggerDate: new Date(),
          },
          metadata: {
            refillRequest: {
              medicationId,
              medicationName: 'Test Med',
              currentRefillsRemaining: 3,
              requestedQuantity: 30,
              urgency: 'routine',
              requestedBy: patientUserId,
              requestedAt: new Date(),
            },
          },
          createdBy: patientUserId,
        },
      ]);
    });

    it('should get portal analytics', async () => {
      const result = await adminService.getPortalAnalytics(workplaceId);

      expect(result.userMetrics.totalUsers).toBe(4);
      expect(result.userMetrics.activeUsers).toBe(2);
      expect(result.userMetrics.pendingUsers).toBe(1);
      expect(result.userMetrics.suspendedUsers).toBe(1);

      expect(result.operationalMetrics.totalRefillRequests).toBe(2);
      expect(result.operationalMetrics.pendingRefillRequests).toBe(1);
      expect(result.operationalMetrics.approvedRefillRequests).toBe(1);

      expect(result.engagementMetrics.totalLogins).toBeGreaterThan(0);
      expect(result.engagementMetrics.mostUsedFeatures).toHaveLength(4);
    });
  });

  describe('getPortalSettings', () => {
    it('should get existing portal settings', async () => {
      // Create settings
      const settings = await PatientPortalSettings.create({
        workplaceId,
        isEnabled: true,
        requireApproval: false,
        createdBy: adminUserId,
      });

      const result = await adminService.getPortalSettings(workplaceId);

      expect(result._id).toEqual(settings._id);
      expect(result.isEnabled).toBe(true);
      expect(result.requireApproval).toBe(false);
    });

    it('should create default settings if none exist', async () => {
      const result = await adminService.getPortalSettings(workplaceId);

      expect(result.workplaceId).toEqual(workplaceId);
      expect(result.isEnabled).toBe(true);
      expect(result.requireApproval).toBe(true);
    });
  });

  describe('updatePortalSettings', () => {
    it('should update existing portal settings', async () => {
      // Create initial settings
      await PatientPortalSettings.create({
        workplaceId,
        isEnabled: true,
        requireApproval: true,
        createdBy: adminUserId,
      });

      const updates = {
        requireApproval: false,
        allowedFeatures: {
          messaging: true,
          appointments: false,
          medications: true,
          vitals: true,
          labResults: true,
          billing: false,
          educationalResources: true,
          healthRecords: true,
        },
      };

      const result = await adminService.updatePortalSettings(
        workplaceId,
        updates,
        adminUserId
      );

      expect(result.requireApproval).toBe(false);
      expect(result.allowedFeatures.appointments).toBe(false);
      expect(result.updatedBy).toEqual(adminUserId);
    });

    it('should create new settings if none exist', async () => {
      const updates = {
        isEnabled: false,
        requireApproval: false,
      };

      const result = await adminService.updatePortalSettings(
        workplaceId,
        updates,
        adminUserId
      );

      expect(result.workplaceId).toEqual(workplaceId);
      expect(result.isEnabled).toBe(false);
      expect(result.requireApproval).toBe(false);
    });
  });

  describe('resetPortalSettings', () => {
    it('should reset portal settings to defaults', async () => {
      // Create custom settings
      await PatientPortalSettings.create({
        workplaceId,
        isEnabled: false,
        requireApproval: false,
        allowedFeatures: {
          messaging: false,
          appointments: false,
          medications: false,
          vitals: false,
          labResults: false,
          billing: false,
          educationalResources: false,
          healthRecords: false,
        },
        createdBy: adminUserId,
      });

      const result = await adminService.resetPortalSettings(workplaceId, adminUserId);

      expect(result.isEnabled).toBe(true);
      expect(result.requireApproval).toBe(true);
      expect(result.allowedFeatures.messaging).toBe(true);
      expect(result.allowedFeatures.appointments).toBe(true);
      expect(result.updatedBy).toEqual(adminUserId);
    });
  });
});