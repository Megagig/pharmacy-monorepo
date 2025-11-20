import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import { User } from '../../models/User';
import { WorkspaceInvite } from '../../models/WorkspaceInvite';
import { generateToken } from '../../utils/token';

describe('Workspace Team Invite Management', () => {
  let workspaceOwnerToken: string;
  let workspaceOwnerId: mongoose.Types.ObjectId;
  let workplaceId: mongoose.Types.ObjectId;
  let testInviteId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    // Create a test workspace owner
    workplaceId = new mongoose.Types.ObjectId();
    const currentPlanId = new mongoose.Types.ObjectId();
    const workspaceOwner = await User.create({
      firstName: 'Owner',
      lastName: 'Test',
      email: 'owner@test.com',
      passwordHash: 'hashedpassword',
      role: 'pharmacy_outlet',
      workplaceId,
      workplaceRole: 'Owner',
      status: 'active',
      isEmailVerified: true,
      currentPlanId,
    });

    workspaceOwnerId = workspaceOwner._id;
    workspaceOwnerToken = generateToken(workspaceOwner._id.toString(), workplaceId.toString());
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({ email: { $regex: '@test.com' } });
    await WorkspaceInvite.deleteMany({ workplaceId });
  });

  afterEach(async () => {
    // Clean up invites after each test
    await WorkspaceInvite.deleteMany({ workplaceId });
  });

  describe('POST /api/workspace/team/invites', () => {
    it('should generate a new invite link', async () => {
      const response = await request(app)
        .post('/api/workspace/team/invites')
        .set('Authorization', `Bearer ${workspaceOwnerToken}`)
        .send({
          email: 'newmember@test.com',
          workplaceRole: 'Pharmacist',
          expiresInDays: 7,
          maxUses: 1,
          requiresApproval: false,
          personalMessage: 'Welcome to our team!',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.invite).toHaveProperty('inviteToken');
      expect(response.body.invite).toHaveProperty('inviteUrl');
      expect(response.body.invite.email).toBe('newmember@test.com');
      expect(response.body.invite.workplaceRole).toBe('Pharmacist');
      expect(response.body.invite.maxUses).toBe(1);
      expect(response.body.invite.requiresApproval).toBe(false);

      testInviteId = response.body.invite._id;
    });

    it('should reject invite for existing workspace member', async () => {
      // Create an existing member
      const currentPlanId = new mongoose.Types.ObjectId();
      await User.create({
        firstName: 'Existing',
        lastName: 'Member',
        email: 'existing@test.com',
        passwordHash: 'hashedpassword',
        role: 'pharmacist',
        workplaceId,
        workplaceRole: 'Pharmacist',
        status: 'active',
        isEmailVerified: true,
        currentPlanId,
      });

      const response = await request(app)
        .post('/api/workspace/team/invites')
        .set('Authorization', `Bearer ${workspaceOwnerToken}`)
        .send({
          email: 'existing@test.com',
          workplaceRole: 'Pharmacist',
          expiresInDays: 7,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already a member');
    });

    it('should reject duplicate pending invite', async () => {
      // Create first invite
      await request(app)
        .post('/api/workspace/team/invites')
        .set('Authorization', `Bearer ${workspaceOwnerToken}`)
        .send({
          email: 'duplicate@test.com',
          workplaceRole: 'Pharmacist',
          expiresInDays: 7,
        });

      // Try to create duplicate
      const response = await request(app)
        .post('/api/workspace/team/invites')
        .set('Authorization', `Bearer ${workspaceOwnerToken}`)
        .send({
          email: 'duplicate@test.com',
          workplaceRole: 'Cashier',
          expiresInDays: 7,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/workspace/team/invites')
        .set('Authorization', `Bearer ${workspaceOwnerToken}`)
        .send({
          email: 'test@test.com',
          // Missing workplaceRole and expiresInDays
        });

      expect(response.status).toBe(400);
    });

    it('should validate expiration days range', async () => {
      const response = await request(app)
        .post('/api/workspace/team/invites')
        .set('Authorization', `Bearer ${workspaceOwnerToken}`)
        .send({
          email: 'test@test.com',
          workplaceRole: 'Pharmacist',
          expiresInDays: 35, // Exceeds max of 30
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/workspace/team/invites', () => {
    beforeEach(async () => {
      // Create test invites
      await WorkspaceInvite.create([
        {
          workplaceId,
          inviteToken: 'token1',
          email: 'invite1@test.com',
          workplaceRole: 'Pharmacist',
          status: 'pending',
          invitedBy: workspaceOwnerId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          maxUses: 1,
          usedCount: 0,
        },
        {
          workplaceId,
          inviteToken: 'token2',
          email: 'invite2@test.com',
          workplaceRole: 'Cashier',
          status: 'accepted',
          invitedBy: workspaceOwnerId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          maxUses: 1,
          usedCount: 1,
        },
      ]);
    });

    it('should get all invites for the workspace', async () => {
      const response = await request(app)
        .get('/api/workspace/team/invites')
        .set('Authorization', `Bearer ${workspaceOwnerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invites).toHaveLength(2);
      expect(response.body.pagination).toHaveProperty('total', 2);
    });

    it('should filter invites by status', async () => {
      const response = await request(app)
        .get('/api/workspace/team/invites?status=pending')
        .set('Authorization', `Bearer ${workspaceOwnerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invites).toHaveLength(1);
      expect(response.body.invites[0].status).toBe('pending');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/workspace/team/invites?page=1&limit=1')
        .set('Authorization', `Bearer ${workspaceOwnerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invites).toHaveLength(1);
      expect(response.body.pagination.totalPages).toBe(2);
    });
  });

  describe('DELETE /api/workspace/team/invites/:id', () => {
    let inviteToRevoke: any;

    beforeEach(async () => {
      inviteToRevoke = await WorkspaceInvite.create({
        workplaceId,
        inviteToken: 'revoke-token',
        email: 'revoke@test.com',
        workplaceRole: 'Pharmacist',
        status: 'pending',
        invitedBy: workspaceOwnerId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 1,
        usedCount: 0,
      });
    });

    it('should revoke a pending invite', async () => {
      const response = await request(app)
        .delete(`/api/workspace/team/invites/${inviteToRevoke._id}`)
        .set('Authorization', `Bearer ${workspaceOwnerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invite.status).toBe('revoked');

      // Verify in database
      const updatedInvite = await WorkspaceInvite.findById(inviteToRevoke._id);
      expect(updatedInvite?.status).toBe('revoked');
      expect(updatedInvite?.revokedBy).toEqual(workspaceOwnerId);
    });

    it('should not revoke already accepted invite', async () => {
      // Update invite to accepted
      inviteToRevoke.status = 'accepted';
      await inviteToRevoke.save();

      const response = await request(app)
        .delete(`/api/workspace/team/invites/${inviteToRevoke._id}`)
        .set('Authorization', `Bearer ${workspaceOwnerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot revoke');
    });

    it('should return 404 for non-existent invite', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/workspace/team/invites/${fakeId}`)
        .set('Authorization', `Bearer ${workspaceOwnerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/workspace/team/invites/pending', () => {
    beforeEach(async () => {
      // Create pending members
      const currentPlanId = new mongoose.Types.ObjectId();
      await User.create([
        {
          firstName: 'Pending',
          lastName: 'One',
          email: 'pending1@test.com',
          passwordHash: 'hashedpassword',
          role: 'pharmacist',
          workplaceId,
          workplaceRole: 'Pharmacist',
          status: 'pending',
          isEmailVerified: true,
          currentPlanId,
        },
        {
          firstName: 'Pending',
          lastName: 'Two',
          email: 'pending2@test.com',
          passwordHash: 'hashedpassword',
          role: 'pharmacist',
          workplaceId,
          workplaceRole: 'Cashier',
          status: 'pending',
          isEmailVerified: true,
          currentPlanId,
        },
      ]);
    });

    it('should get all pending member approvals', async () => {
      const response = await request(app)
        .get('/api/workspace/team/invites/pending')
        .set('Authorization', `Bearer ${workspaceOwnerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.pendingMembers).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });
  });

  describe('POST /api/workspace/team/invites/:id/approve', () => {
    let pendingMember: any;

    beforeEach(async () => {
      const currentPlanId = new mongoose.Types.ObjectId();
      pendingMember = await User.create({
        firstName: 'Approve',
        lastName: 'Me',
        email: 'approve@test.com',
        passwordHash: 'hashedpassword',
        role: 'pharmacist',
        workplaceId,
        workplaceRole: 'Pharmacist',
        status: 'pending',
        isEmailVerified: true,
        currentPlanId,
      });
    });

    it('should approve a pending member', async () => {
      const response = await request(app)
        .post(`/api/workspace/team/invites/${pendingMember._id}/approve`)
        .set('Authorization', `Bearer ${workspaceOwnerToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.member.status).toBe('active');

      // Verify in database
      const updatedMember = await User.findById(pendingMember._id);
      expect(updatedMember?.status).toBe('active');
    });

    it('should allow role override during approval', async () => {
      const response = await request(app)
        .post(`/api/workspace/team/invites/${pendingMember._id}/approve`)
        .set('Authorization', `Bearer ${workspaceOwnerToken}`)
        .send({
          workplaceRole: 'Cashier',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.member.workplaceRole).toBe('Cashier');
    });

    it('should return 404 for non-pending member', async () => {
      pendingMember.status = 'active';
      await pendingMember.save();

      const response = await request(app)
        .post(`/api/workspace/team/invites/${pendingMember._id}/approve`)
        .set('Authorization', `Bearer ${workspaceOwnerToken}`)
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/workspace/team/invites/:id/reject', () => {
    let pendingMember: any;

    beforeEach(async () => {
      const currentPlanId = new mongoose.Types.ObjectId();
      pendingMember = await User.create({
        firstName: 'Reject',
        lastName: 'Me',
        email: 'reject@test.com',
        passwordHash: 'hashedpassword',
        role: 'pharmacist',
        workplaceId,
        workplaceRole: 'Pharmacist',
        status: 'pending',
        isEmailVerified: true,
        currentPlanId,
      });
    });

    it('should reject a pending member', async () => {
      const response = await request(app)
        .post(`/api/workspace/team/invites/${pendingMember._id}/reject`)
        .set('Authorization', `Bearer ${workspaceOwnerToken}`)
        .send({
          reason: 'Not qualified',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify in database
      const updatedMember = await User.findById(pendingMember._id);
      expect(updatedMember?.status).toBe('suspended');
      expect(updatedMember?.workplaceId).toBeUndefined();
      expect(updatedMember?.suspensionReason).toContain('Not qualified');
    });

    it('should reject without reason', async () => {
      const response = await request(app)
        .post(`/api/workspace/team/invites/${pendingMember._id}/reject`)
        .set('Authorization', `Bearer ${workspaceOwnerToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Authorization', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/workspace/team/invites');

      expect(response.status).toBe(401);
    });

    it('should reject requests from non-workspace owners', async () => {
      // Create a regular user
      const currentPlanId = new mongoose.Types.ObjectId();
      const regularUser = await User.create({
        firstName: 'Regular',
        lastName: 'User',
        email: 'regular@test.com',
        passwordHash: 'hashedpassword',
        role: 'pharmacist',
        workplaceId,
        workplaceRole: 'Pharmacist',
        status: 'active',
        isEmailVerified: true,
        currentPlanId,
      });

      const regularUserToken = generateToken(regularUser._id.toString(), workplaceId.toString());

      const response = await request(app)
        .get('/api/workspace/team/invites')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
    });
  });
});
