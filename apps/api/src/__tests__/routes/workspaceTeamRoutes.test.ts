import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { User } from '../../models/User';
import Workplace from '../../models/Workplace';
import SubscriptionPlan from '../../models/SubscriptionPlan';
import workspaceTeamRoutes from '../../routes/workspaceTeamRoutes';

describe('Workspace Team Routes', () => {
  let app: express.Application;
  let workspaceOwner: any;
  let testWorkplace: any;
  let teamMember1: any;
  let teamMember2: any;
  let ownerToken: string;
  let nonOwnerToken: string;
  let testPlan: any;

  beforeAll(async () => {
    // Create a test subscription plan
    testPlan = await SubscriptionPlan.create({
      name: 'Test Plan',
      priceNGN: 0,
      billingInterval: 'monthly',
      tier: 'free_trial',
      description: 'Test subscription plan',
      popularPlan: false,
      features: {
        patientLimit: 100,
        reminderSmsMonthlyLimit: 50,
        reportsExport: true,
        careNoteExport: true,
        adrModule: false,
        multiUserSupport: true,
        teamSize: 10,
        apiAccess: false,
        auditLogs: false,
        dataBackup: false,
        clinicalNotesLimit: 100,
        prioritySupport: false,
        emailReminders: true,
        smsReminders: false,
        advancedReports: false,
        drugTherapyManagement: false,
        teamManagement: true,
        dedicatedSupport: false,
        adrReporting: false,
        drugInteractionChecker: false,
        doseCalculator: false,
        multiLocationDashboard: false,
        sharedPatientRecords: false,
        groupAnalytics: false,
        cdss: false,
      },
      isActive: true,
    });
    
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/workspace/team', workspaceTeamRoutes);

    // Create a temporary owner ID (will be updated after creating the owner)
    const tempOwnerId = new mongoose.Types.ObjectId();
    
    // Create test workplace
    testWorkplace = await Workplace.create({
      name: 'Test Pharmacy',
      type: 'Community',
      address: 'Test Address',
      phone: '1234567890',
      email: 'test@pharmacy.com',
      licenseNumber: 'TEST123',
      ownerId: tempOwnerId,
      subscriptionStatus: 'active',
      trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      verificationStatus: 'verified',
      inviteCode: 'TEST123',
      teamMembers: [],
      documents: [],
      stats: {
        patientsCount: 0,
        usersCount: 0,
        lastUpdated: new Date(),
      },
      locations: [],
      settings: {
        maxPendingInvites: 10,
        allowSharedPatients: false,
      },
    });

    // Create workspace owner
    workspaceOwner = await User.create({
      firstName: 'Owner',
      lastName: 'User',
      email: 'owner@pharmacy.com',
      passwordHash: 'hashedpassword',
      role: 'pharmacy_outlet',
      workplaceId: testWorkplace._id,
      workplaceRole: 'Owner',
      status: 'active',
      licenseStatus: 'not_required',
      currentPlanId: testPlan._id,
      permissions: [],
      directPermissions: [],
      deniedPermissions: [],
      assignedRoles: [],
    });
    
    // Update workplace with actual owner ID
    testWorkplace.ownerId = workspaceOwner._id;
    await testWorkplace.save();

    // Create team members
    teamMember1 = await User.create({
      firstName: 'John',
      lastName: 'Pharmacist',
      email: 'john@pharmacy.com',
      passwordHash: 'hashedpassword',
      role: 'pharmacist',
      workplaceId: testWorkplace._id,
      workplaceRole: 'Pharmacist',
      status: 'active',
      licenseStatus: 'approved',
      currentPlanId: testPlan._id,
      permissions: [],
      directPermissions: [],
      deniedPermissions: [],
      assignedRoles: [],
    });

    teamMember2 = await User.create({
      firstName: 'Jane',
      lastName: 'Cashier',
      email: 'jane@pharmacy.com',
      passwordHash: 'hashedpassword',
      role: 'pharmacy_team',
      workplaceId: testWorkplace._id,
      workplaceRole: 'Cashier',
      status: 'active',
      licenseStatus: 'not_required',
      currentPlanId: testPlan._id,
      permissions: [],
      directPermissions: [],
      deniedPermissions: [],
      assignedRoles: [],
    });

    // Generate auth tokens (using the format expected by the real auth middleware)
    // Make sure JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    
    ownerToken = jwt.sign(
      {
        userId: workspaceOwner._id.toString(),
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    nonOwnerToken = jwt.sign(
      {
        userId: teamMember1._id.toString(),
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Cleanup is handled by global setup
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication and Authorization', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/workspace/team/members')
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should reject requests from non-workspace owners', async () => {
      const response = await request(app)
        .get('/api/workspace/team/members')
        .set('Authorization', `Bearer ${nonOwnerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('workspace owner');
    });

    it('should allow requests from workspace owners', async () => {
      const response = await request(app)
        .get('/api/workspace/team/members')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/workspace/team/members', () => {
    it('should return all members in the workspace', async () => {
      const response = await request(app)
        .get('/api/workspace/team/members')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.members).toBeDefined();
      expect(Array.isArray(response.body.members)).toBe(true);
      expect(response.body.members.length).toBeGreaterThanOrEqual(2);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/workspace/team/members?page=1&limit=1')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter by role', async () => {
      const response = await request(app)
        .get('/api/workspace/team/members?role=Pharmacist')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.members).toBeDefined();
      response.body.members.forEach((member: any) => {
        expect(member.workplaceRole).toBe('Pharmacist');
      });
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/workspace/team/members?status=active')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.members).toBeDefined();
      response.body.members.forEach((member: any) => {
        expect(member.status).toBe('active');
      });
    });

    it('should search by name or email', async () => {
      const response = await request(app)
        .get('/api/workspace/team/members?search=John')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.members).toBeDefined();
      expect(response.body.members.length).toBeGreaterThan(0);
    });

    it('should not expose sensitive fields', async () => {
      const response = await request(app)
        .get('/api/workspace/team/members')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.members.forEach((member: any) => {
        expect(member.passwordHash).toBeUndefined();
        expect(member.resetToken).toBeUndefined();
        expect(member.verificationToken).toBeUndefined();
      });
    });

    it('should only return members from the same workspace', async () => {
      // Create another workplace and user
      const otherWorkplace = await Workplace.create({
        name: 'Other Pharmacy',
        type: 'Community',
        address: 'Other Address',
        phone: '9876543210',
        email: 'other@pharmacy.com',
        licenseNumber: 'OTHER123',
        ownerId: new mongoose.Types.ObjectId(),
        subscriptionStatus: 'active',
        trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        verificationStatus: 'verified',
        inviteCode: 'OTHER123',
        teamMembers: [],
        documents: [],
        stats: { patientsCount: 0, usersCount: 0, lastUpdated: new Date() },
        locations: [],
        settings: { maxPendingInvites: 10, allowSharedPatients: false },
      });

      await User.create({
        firstName: 'Other',
        lastName: 'User',
        email: 'other@user.com',
        passwordHash: 'hashedpassword',
        role: 'pharmacist',
        workplaceId: otherWorkplace._id,
        workplaceRole: 'Pharmacist',
        status: 'active',
        licenseStatus: 'approved',
        currentPlanId: testPlan._id,
        permissions: [],
        directPermissions: [],
        deniedPermissions: [],
        assignedRoles: [],
      });

      const response = await request(app)
        .get('/api/workspace/team/members')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.members.forEach((member: any) => {
        expect(member._id.toString()).not.toBe(otherWorkplace._id.toString());
      });
    });
  });

  describe('PUT /api/workspace/team/members/:id', () => {
    it('should update member role successfully', async () => {
      const response = await request(app)
        .put(`/api/workspace/team/members/${teamMember1._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          workplaceRole: 'Staff',
          reason: 'Promotion',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.member).toBeDefined();
      expect(response.body.member.workplaceRole).toBe('Staff');
      expect(response.body.audit).toBeDefined();
      expect(response.body.audit.oldRole).toBe('Pharmacist');
      expect(response.body.audit.newRole).toBe('Staff');
    });

    it('should reject invalid workplace role', async () => {
      const response = await request(app)
        .put(`/api/workspace/team/members/${teamMember1._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          workplaceRole: 'InvalidRole',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject update for member not in workspace', async () => {
      const otherWorkplace = await Workplace.create({
        name: 'Another Pharmacy',
        type: 'Community',
        address: 'Another Address',
        phone: '5555555555',
        email: 'another@pharmacy.com',
        licenseNumber: 'ANOTHER123',
        ownerId: new mongoose.Types.ObjectId(),
        subscriptionStatus: 'active',
        trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        verificationStatus: 'verified',
        inviteCode: 'ANOTHER123',
        teamMembers: [],
        documents: [],
        stats: { patientsCount: 0, usersCount: 0, lastUpdated: new Date() },
        locations: [],
        settings: { maxPendingInvites: 10, allowSharedPatients: false },
      });

      const otherMember = await User.create({
        firstName: 'Other',
        lastName: 'Member',
        email: 'other@member.com',
        passwordHash: 'hashedpassword',
        role: 'pharmacist',
        workplaceId: otherWorkplace._id,
        workplaceRole: 'Pharmacist',
        status: 'active',
        licenseStatus: 'approved',
        currentPlanId: testPlan._id,
        permissions: [],
        directPermissions: [],
        deniedPermissions: [],
        assignedRoles: [],
      });

      const response = await request(app)
        .put(`/api/workspace/team/members/${otherMember._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          workplaceRole: 'Staff',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should validate member ID format', async () => {
      const response = await request(app)
        .put('/api/workspace/team/members/invalid-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          workplaceRole: 'Staff',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/workspace/team/members/:id', () => {
    it('should remove member from workspace successfully', async () => {
      const response = await request(app)
        .delete(`/api/workspace/team/members/${teamMember2._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'No longer needed',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.audit).toBeDefined();
      expect(response.body.audit.memberId).toBe(teamMember2._id.toString());

      // Verify member was removed
      const updatedMember = await User.findById(teamMember2._id);
      expect(updatedMember?.workplaceId).toBeUndefined();
      expect(updatedMember?.status).toBe('suspended');
    });

    it('should prevent removing workspace owner', async () => {
      const response = await request(app)
        .delete(`/api/workspace/team/members/${workspaceOwner._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'Test removal',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot remove workspace owner');
    });

    it('should reject removal for member not in workspace', async () => {
      const otherWorkplace = await Workplace.create({
        name: 'Yet Another Pharmacy',
        type: 'Community',
        address: 'Yet Another Address',
        phone: '4444444444',
        email: 'yetanother@pharmacy.com',
        licenseNumber: 'YETANOTHER123',
        ownerId: new mongoose.Types.ObjectId(),
        subscriptionStatus: 'active',
        trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        verificationStatus: 'verified',
        inviteCode: 'YETANOTHER123',
        teamMembers: [],
        documents: [],
        stats: { patientsCount: 0, usersCount: 0, lastUpdated: new Date() },
        locations: [],
        settings: { maxPendingInvites: 10, allowSharedPatients: false },
      });

      const otherMember = await User.create({
        firstName: 'Yet',
        lastName: 'Another',
        email: 'yet@another.com',
        passwordHash: 'hashedpassword',
        role: 'pharmacist',
        workplaceId: otherWorkplace._id,
        workplaceRole: 'Pharmacist',
        status: 'active',
        licenseStatus: 'approved',
        currentPlanId: testPlan._id,
        permissions: [],
        directPermissions: [],
        deniedPermissions: [],
        assignedRoles: [],
      });

      const response = await request(app)
        .delete(`/api/workspace/team/members/${otherMember._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'Test removal',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should validate member ID format', async () => {
      const response = await request(app)
        .delete('/api/workspace/team/members/invalid-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'Test removal',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/workspace/team/members/:id/suspend', () => {
    let activeMember: any;

    beforeEach(async () => {
      // Create a fresh active member for each test
      activeMember = await User.create({
        firstName: 'Active',
        lastName: 'Member',
        email: `active-${Date.now()}@pharmacy.com`,
        passwordHash: 'hashedpassword',
        role: 'pharmacy_team',
        workplaceId: testWorkplace._id,
        workplaceRole: 'Staff',
        status: 'active',
        licenseStatus: 'not_required',
        currentPlanId: testPlan._id,
        permissions: [],
        directPermissions: [],
        deniedPermissions: [],
        assignedRoles: [],
      });
    });

    it('should suspend member successfully', async () => {
      const response = await request(app)
        .post(`/api/workspace/team/members/${activeMember._id}/suspend`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'Policy violation',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.member).toBeDefined();
      expect(response.body.member.status).toBe('suspended');
      expect(response.body.member.suspensionReason).toBe('Policy violation');
      expect(response.body.member.suspendedAt).toBeDefined();
      expect(response.body.audit).toBeDefined();
      expect(response.body.audit.action).toBe('member_suspended');

      // Verify member was suspended in database
      const updatedMember = await User.findById(activeMember._id);
      expect(updatedMember?.status).toBe('suspended');
      expect(updatedMember?.suspensionReason).toBe('Policy violation');
      expect(updatedMember?.suspendedAt).toBeDefined();
      expect(updatedMember?.suspendedBy?.toString()).toBe(workspaceOwner._id.toString());
    });

    it('should require suspension reason', async () => {
      const response = await request(app)
        .post(`/api/workspace/team/members/${activeMember._id}/suspend`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject suspension with empty reason', async () => {
      const response = await request(app)
        .post(`/api/workspace/team/members/${activeMember._id}/suspend`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: '',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject suspension with reason exceeding max length', async () => {
      const longReason = 'a'.repeat(501);
      const response = await request(app)
        .post(`/api/workspace/team/members/${activeMember._id}/suspend`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: longReason,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should prevent suspending workspace owner', async () => {
      const response = await request(app)
        .post(`/api/workspace/team/members/${workspaceOwner._id}/suspend`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'Test suspension',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot suspend workspace owner');
    });

    it('should reject suspending already suspended member', async () => {
      // First suspension
      await request(app)
        .post(`/api/workspace/team/members/${activeMember._id}/suspend`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'First suspension',
        })
        .expect(200);

      // Second suspension attempt
      const response = await request(app)
        .post(`/api/workspace/team/members/${activeMember._id}/suspend`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'Second suspension',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already suspended');
    });

    it('should reject suspension for member not in workspace', async () => {
      const otherWorkplace = await Workplace.create({
        name: 'Suspend Test Pharmacy',
        type: 'Community',
        address: 'Suspend Test Address',
        phone: '3333333333',
        email: 'suspend@pharmacy.com',
        licenseNumber: 'SUSPEND123',
        ownerId: new mongoose.Types.ObjectId(),
        subscriptionStatus: 'active',
        trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        verificationStatus: 'verified',
        inviteCode: 'SUSPEND123',
        teamMembers: [],
        documents: [],
        stats: { patientsCount: 0, usersCount: 0, lastUpdated: new Date() },
        locations: [],
        settings: { maxPendingInvites: 10, allowSharedPatients: false },
      });

      const otherMember = await User.create({
        firstName: 'Other',
        lastName: 'Member',
        email: 'other-suspend@member.com',
        passwordHash: 'hashedpassword',
        role: 'pharmacist',
        workplaceId: otherWorkplace._id,
        workplaceRole: 'Pharmacist',
        status: 'active',
        licenseStatus: 'approved',
        currentPlanId: testPlan._id,
        permissions: [],
        directPermissions: [],
        deniedPermissions: [],
        assignedRoles: [],
      });

      const response = await request(app)
        .post(`/api/workspace/team/members/${otherMember._id}/suspend`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'Test suspension',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should validate member ID format', async () => {
      const response = await request(app)
        .post('/api/workspace/team/members/invalid-id/suspend')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'Test suspension',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/workspace/team/members/:id/activate', () => {
    let suspendedMember: any;

    beforeEach(async () => {
      // Create a suspended member for each test
      suspendedMember = await User.create({
        firstName: 'Suspended',
        lastName: 'Member',
        email: `suspended-${Date.now()}@pharmacy.com`,
        passwordHash: 'hashedpassword',
        role: 'pharmacy_team',
        workplaceId: testWorkplace._id,
        workplaceRole: 'Staff',
        status: 'suspended',
        suspensionReason: 'Test suspension',
        suspendedAt: new Date(),
        suspendedBy: workspaceOwner._id,
        licenseStatus: 'not_required',
        currentPlanId: testPlan._id,
        permissions: [],
        directPermissions: [],
        deniedPermissions: [],
        assignedRoles: [],
      });
    });

    it('should activate suspended member successfully', async () => {
      const response = await request(app)
        .post(`/api/workspace/team/members/${suspendedMember._id}/activate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.member).toBeDefined();
      expect(response.body.member.status).toBe('active');
      expect(response.body.member.reactivatedAt).toBeDefined();
      expect(response.body.audit).toBeDefined();
      expect(response.body.audit.action).toBe('member_activated');
      expect(response.body.audit.previousSuspensionReason).toBe('Test suspension');

      // Verify member was activated in database
      const updatedMember = await User.findById(suspendedMember._id);
      expect(updatedMember?.status).toBe('active');
      expect(updatedMember?.reactivatedAt).toBeDefined();
      expect(updatedMember?.reactivatedBy?.toString()).toBe(workspaceOwner._id.toString());
      expect(updatedMember?.suspensionReason).toBeUndefined();
      expect(updatedMember?.suspendedAt).toBeUndefined();
      expect(updatedMember?.suspendedBy).toBeUndefined();
    });

    it('should reject activation of non-suspended member', async () => {
      const activeMember = await User.create({
        firstName: 'Already',
        lastName: 'Active',
        email: `already-active-${Date.now()}@pharmacy.com`,
        passwordHash: 'hashedpassword',
        role: 'pharmacy_team',
        workplaceId: testWorkplace._id,
        workplaceRole: 'Staff',
        status: 'active',
        licenseStatus: 'not_required',
        currentPlanId: testPlan._id,
        permissions: [],
        directPermissions: [],
        deniedPermissions: [],
        assignedRoles: [],
      });

      const response = await request(app)
        .post(`/api/workspace/team/members/${activeMember._id}/activate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not suspended');
    });

    it('should reject activation for member not in workspace', async () => {
      const otherWorkplace = await Workplace.create({
        name: 'Activate Test Pharmacy',
        type: 'Community',
        address: 'Activate Test Address',
        phone: '6666666666',
        email: 'activate@pharmacy.com',
        licenseNumber: 'ACTIVATE123',
        ownerId: new mongoose.Types.ObjectId(),
        subscriptionStatus: 'active',
        trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        verificationStatus: 'verified',
        inviteCode: 'ACTIVATE123',
        teamMembers: [],
        documents: [],
        stats: { patientsCount: 0, usersCount: 0, lastUpdated: new Date() },
        locations: [],
        settings: { maxPendingInvites: 10, allowSharedPatients: false },
      });

      const otherMember = await User.create({
        firstName: 'Other',
        lastName: 'Suspended',
        email: 'other-activate@member.com',
        passwordHash: 'hashedpassword',
        role: 'pharmacist',
        workplaceId: otherWorkplace._id,
        workplaceRole: 'Pharmacist',
        status: 'suspended',
        suspensionReason: 'Test',
        suspendedAt: new Date(),
        licenseStatus: 'approved',
        currentPlanId: testPlan._id,
        permissions: [],
        directPermissions: [],
        deniedPermissions: [],
        assignedRoles: [],
      });

      const response = await request(app)
        .post(`/api/workspace/team/members/${otherMember._id}/activate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should validate member ID format', async () => {
      const response = await request(app)
        .post('/api/workspace/team/members/invalid-id/activate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Suspension/Activation Workflow', () => {
    it('should complete full suspension and reactivation cycle', async () => {
      // Create a test member
      const testMember = await User.create({
        firstName: 'Workflow',
        lastName: 'Test',
        email: `workflow-${Date.now()}@pharmacy.com`,
        passwordHash: 'hashedpassword',
        role: 'pharmacy_team',
        workplaceId: testWorkplace._id,
        workplaceRole: 'Staff',
        status: 'active',
        licenseStatus: 'not_required',
        currentPlanId: testPlan._id,
        permissions: [],
        directPermissions: [],
        deniedPermissions: [],
        assignedRoles: [],
      });

      // Step 1: Verify member is active
      let member = await User.findById(testMember._id);
      expect(member?.status).toBe('active');

      // Step 2: Suspend member
      const suspendResponse = await request(app)
        .post(`/api/workspace/team/members/${testMember._id}/suspend`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'Workflow test suspension',
        })
        .expect(200);

      expect(suspendResponse.body.success).toBe(true);
      expect(suspendResponse.body.member.status).toBe('suspended');

      // Step 3: Verify member is suspended
      member = await User.findById(testMember._id);
      expect(member?.status).toBe('suspended');
      expect(member?.suspensionReason).toBe('Workflow test suspension');
      expect(member?.suspendedAt).toBeDefined();

      // Step 4: Activate member
      const activateResponse = await request(app)
        .post(`/api/workspace/team/members/${testMember._id}/activate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(activateResponse.body.success).toBe(true);
      expect(activateResponse.body.member.status).toBe('active');

      // Step 5: Verify member is active again
      member = await User.findById(testMember._id);
      expect(member?.status).toBe('active');
      expect(member?.reactivatedAt).toBeDefined();
      expect(member?.suspensionReason).toBeUndefined();
      expect(member?.suspendedAt).toBeUndefined();
    });

    it('should filter suspended members correctly', async () => {
      // Create and suspend a member
      const memberToSuspend = await User.create({
        firstName: 'Filter',
        lastName: 'Test',
        email: `filter-${Date.now()}@pharmacy.com`,
        passwordHash: 'hashedpassword',
        role: 'pharmacy_team',
        workplaceId: testWorkplace._id,
        workplaceRole: 'Staff',
        status: 'active',
        licenseStatus: 'not_required',
        currentPlanId: testPlan._id,
        permissions: [],
        directPermissions: [],
        deniedPermissions: [],
        assignedRoles: [],
      });

      await request(app)
        .post(`/api/workspace/team/members/${memberToSuspend._id}/suspend`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'Filter test',
        })
        .expect(200);

      // Filter for suspended members
      const response = await request(app)
        .get('/api/workspace/team/members?status=suspended')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.members).toBeDefined();
      
      const suspendedMember = response.body.members.find(
        (m: any) => m._id === memberToSuspend._id.toString()
      );
      expect(suspendedMember).toBeDefined();
      expect(suspendedMember.status).toBe('suspended');
    });
  });

  describe('Workspace Isolation', () => {
    it('should enforce workspace isolation across all endpoints', async () => {
      // Create second workspace with owner and members
      const workspace2 = await Workplace.create({
        name: 'Second Pharmacy',
        type: 'Community',
        address: 'Second Address',
        phone: '2222222222',
        email: 'second@pharmacy.com',
        licenseNumber: 'SECOND123',
        ownerId: new mongoose.Types.ObjectId(),
        subscriptionStatus: 'active',
        trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        verificationStatus: 'verified',
        inviteCode: 'SECOND123',
        teamMembers: [],
        documents: [],
        stats: { patientsCount: 0, usersCount: 0, lastUpdated: new Date() },
        locations: [],
        settings: { maxPendingInvites: 10, allowSharedPatients: false },
      });

      const owner2 = await User.create({
        firstName: 'Second',
        lastName: 'Owner',
        email: 'owner2@pharmacy.com',
        passwordHash: 'hashedpassword',
        role: 'pharmacy_outlet',
        workplaceId: workspace2._id,
        workplaceRole: 'Owner',
        status: 'active',
        licenseStatus: 'not_required',
        currentPlanId: testPlan._id,
        permissions: [],
        directPermissions: [],
        deniedPermissions: [],
        assignedRoles: [],
      });

      const member2 = await User.create({
        firstName: 'Second',
        lastName: 'Member',
        email: 'member2@pharmacy.com',
        passwordHash: 'hashedpassword',
        role: 'pharmacist',
        workplaceId: workspace2._id,
        workplaceRole: 'Pharmacist',
        status: 'active',
        licenseStatus: 'approved',
        currentPlanId: testPlan._id,
        permissions: [],
        directPermissions: [],
        deniedPermissions: [],
        assignedRoles: [],
      });

      const owner2Token = jwt.sign(
        {
          userId: owner2._id.toString(),
        },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      // Owner 2 should not see members from workspace 1
      const response = await request(app)
        .get('/api/workspace/team/members')
        .set('Authorization', `Bearer ${owner2Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.members).toBeDefined();
      
      // Should only see members from workspace 2
      response.body.members.forEach((member: any) => {
        expect(member.email).not.toBe(teamMember1.email);
        expect(member.email).not.toBe(workspaceOwner.email);
      });
    });
  });
});
