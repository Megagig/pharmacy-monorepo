/// <reference types="jest" />
import mongoose from 'mongoose';
import { WorkspaceInvite, IWorkspaceInvite } from '../../models/WorkspaceInvite';
import { User } from '../../models/User';
import { Workplace } from '../../models/Workplace';

describe('WorkspaceInvite Model', () => {
  let testWorkplaceId: mongoose.Types.ObjectId;
  let testUserId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    // Create test workplace
    const workplace = await Workplace.create({
      name: 'Test Pharmacy',
      type: 'Community',
      licenseNumber: 'TEST123',
      email: 'test@pharmacy.com',
      ownerId: new mongoose.Types.ObjectId(),
    });
    testWorkplaceId = workplace._id;

    // Create test user
    const user = await User.create({
      email: 'inviter@test.com',
      passwordHash: 'hashedpassword',
      firstName: 'Test',
      lastName: 'User',
      role: 'pharmacy_outlet',
      workplaceId: testWorkplaceId,
      currentPlanId: new mongoose.Types.ObjectId(),
    });
    testUserId = user._id;
  });

  describe('Model Creation', () => {
    it('should create a workspace invite with required fields', async () => {
      const invite = await WorkspaceInvite.create({
        workplaceId: testWorkplaceId,
        email: 'newuser@test.com',
        workplaceRole: 'Pharmacist',
        invitedBy: testUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 1,
      });

      expect(invite).toBeDefined();
      expect(invite.workplaceId).toEqual(testWorkplaceId);
      expect(invite.email).toBe('newuser@test.com');
      expect(invite.workplaceRole).toBe('Pharmacist');
      expect(invite.status).toBe('pending');
      expect(invite.usedCount).toBe(0);
      expect(invite.requiresApproval).toBe(false);
      expect(invite.inviteToken).toBeDefined();
      expect(invite.inviteToken.length).toBe(64); // 32 bytes in hex
    });

    it('should auto-generate invite token if not provided', async () => {
      const invite = await WorkspaceInvite.create({
        workplaceId: testWorkplaceId,
        email: 'newuser@test.com',
        workplaceRole: 'Pharmacist',
        invitedBy: testUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 1,
      });

      expect(invite.inviteToken).toBeDefined();
      expect(typeof invite.inviteToken).toBe('string');
      expect(invite.inviteToken.length).toBeGreaterThan(0);
    });

    it('should set default expiration date if not provided', async () => {
      const invite = await WorkspaceInvite.create({
        workplaceId: testWorkplaceId,
        email: 'newuser@test.com',
        workplaceRole: 'Pharmacist',
        invitedBy: testUserId,
        maxUses: 1,
      });

      expect(invite.expiresAt).toBeDefined();
      expect(invite.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should normalize email to lowercase', async () => {
      const invite = await WorkspaceInvite.create({
        workplaceId: testWorkplaceId,
        email: 'NewUser@TEST.COM',
        workplaceRole: 'Pharmacist',
        invitedBy: testUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 1,
      });

      expect(invite.email).toBe('newuser@test.com');
    });
  });

  describe('Validation', () => {
    it('should require workplaceId', async () => {
      const invite = new WorkspaceInvite({
        email: 'newuser@test.com',
        workplaceRole: 'Pharmacist',
        invitedBy: testUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 1,
      });

      await expect(invite.save()).rejects.toThrow();
    });

    it('should require email', async () => {
      const invite = new WorkspaceInvite({
        workplaceId: testWorkplaceId,
        workplaceRole: 'Pharmacist',
        invitedBy: testUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 1,
      });

      await expect(invite.save()).rejects.toThrow();
    });

    it('should validate email format', async () => {
      const invite = new WorkspaceInvite({
        workplaceId: testWorkplaceId,
        email: 'invalid-email',
        workplaceRole: 'Pharmacist',
        invitedBy: testUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 1,
      });

      await expect(invite.save()).rejects.toThrow();
    });

    it('should validate workplaceRole enum', async () => {
      const invite = new WorkspaceInvite({
        workplaceId: testWorkplaceId,
        email: 'newuser@test.com',
        workplaceRole: 'InvalidRole' as any,
        invitedBy: testUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 1,
      });

      await expect(invite.save()).rejects.toThrow();
    });

    it('should validate status enum', async () => {
      const invite = new WorkspaceInvite({
        workplaceId: testWorkplaceId,
        email: 'newuser@test.com',
        workplaceRole: 'Pharmacist',
        invitedBy: testUserId,
        status: 'invalid' as any,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 1,
      });

      await expect(invite.save()).rejects.toThrow();
    });

    it('should enforce maxUses minimum value', async () => {
      const invite = new WorkspaceInvite({
        workplaceId: testWorkplaceId,
        email: 'newuser@test.com',
        workplaceRole: 'Pharmacist',
        invitedBy: testUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 0,
      });

      await expect(invite.save()).rejects.toThrow();
    });

    it('should enforce maxUses maximum value', async () => {
      const invite = new WorkspaceInvite({
        workplaceId: testWorkplaceId,
        email: 'newuser@test.com',
        workplaceRole: 'Pharmacist',
        invitedBy: testUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 101,
      });

      await expect(invite.save()).rejects.toThrow();
    });

    it('should reject expiration date in the past', async () => {
      const invite = new WorkspaceInvite({
        workplaceId: testWorkplaceId,
        email: 'newuser@test.com',
        workplaceRole: 'Pharmacist',
        invitedBy: testUserId,
        expiresAt: new Date(Date.now() - 1000),
        maxUses: 1,
      });

      await expect(invite.save()).rejects.toThrow();
    });

    it('should enforce personalMessage max length', async () => {
      const longMessage = 'a'.repeat(1001);
      const invite = new WorkspaceInvite({
        workplaceId: testWorkplaceId,
        email: 'newuser@test.com',
        workplaceRole: 'Pharmacist',
        invitedBy: testUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 1,
        personalMessage: longMessage,
      });

      await expect(invite.save()).rejects.toThrow();
    });
  });

  describe('Instance Methods', () => {
    let invite: IWorkspaceInvite;

    beforeEach(async () => {
      invite = await WorkspaceInvite.create({
        workplaceId: testWorkplaceId,
        email: 'newuser@test.com',
        workplaceRole: 'Pharmacist',
        invitedBy: testUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 1,
      });
    });

    describe('isExpired()', () => {
      it('should return false for non-expired invite', () => {
        expect(invite.isExpired()).toBe(false);
      });

      it('should return true for expired invite', async () => {
        invite.expiresAt = new Date(Date.now() - 1000);
        await invite.save();
        expect(invite.isExpired()).toBe(true);
      });

      it('should return true for invite with expired status', async () => {
        invite.status = 'expired';
        await invite.save();
        expect(invite.isExpired()).toBe(true);
      });
    });

    describe('canBeUsed()', () => {
      it('should return true for valid pending invite', () => {
        expect(invite.canBeUsed()).toBe(true);
      });

      it('should return false for expired invite', async () => {
        invite.expiresAt = new Date(Date.now() - 1000);
        await invite.save();
        expect(invite.canBeUsed()).toBe(false);
      });

      it('should return false for accepted invite', async () => {
        invite.status = 'accepted';
        await invite.save();
        expect(invite.canBeUsed()).toBe(false);
      });

      it('should return false when max uses reached', async () => {
        invite.usedCount = 1;
        await invite.save();
        expect(invite.canBeUsed()).toBe(false);
      });
    });

    describe('markAsAccepted()', () => {
      it('should mark invite as accepted', async () => {
        const acceptedBy = new mongoose.Types.ObjectId();
        invite.markAsAccepted(acceptedBy);
        await invite.save();

        expect(invite.status).toBe('accepted');
        expect(invite.acceptedAt).toBeDefined();
        expect(invite.acceptedBy).toEqual(acceptedBy);
      });
    });

    describe('markAsRejected()', () => {
      it('should mark invite as rejected with reason', async () => {
        const rejectedBy = new mongoose.Types.ObjectId();
        const reason = 'Not qualified';
        invite.markAsRejected(rejectedBy, reason);
        await invite.save();

        expect(invite.status).toBe('rejected');
        expect(invite.rejectedAt).toBeDefined();
        expect(invite.rejectedBy).toEqual(rejectedBy);
        expect(invite.rejectionReason).toBe(reason);
      });

      it('should mark invite as rejected without reason', async () => {
        const rejectedBy = new mongoose.Types.ObjectId();
        invite.markAsRejected(rejectedBy);
        await invite.save();

        expect(invite.status).toBe('rejected');
        expect(invite.rejectedAt).toBeDefined();
        expect(invite.rejectedBy).toEqual(rejectedBy);
        expect(invite.rejectionReason).toBeUndefined();
      });
    });

    describe('revoke()', () => {
      it('should revoke invite', async () => {
        const revokedBy = new mongoose.Types.ObjectId();
        invite.revoke(revokedBy);
        await invite.save();

        expect(invite.status).toBe('revoked');
        expect(invite.revokedAt).toBeDefined();
        expect(invite.revokedBy).toEqual(revokedBy);
      });
    });

    describe('incrementUsage()', () => {
      it('should increment used count', async () => {
        invite.incrementUsage();
        await invite.save();

        expect(invite.usedCount).toBe(1);
      });

      it('should mark as accepted when max uses reached', async () => {
        invite.maxUses = 2;
        await invite.save();

        invite.incrementUsage();
        expect(invite.usedCount).toBe(1);
        expect(invite.status).toBe('pending');

        invite.incrementUsage();
        expect(invite.usedCount).toBe(2);
        expect(invite.status).toBe('accepted');
      });
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create invites with future expiration dates first
      const invite1 = await WorkspaceInvite.create({
        workplaceId: testWorkplaceId,
        email: 'user1@test.com',
        workplaceRole: 'Pharmacist',
        invitedBy: testUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 1,
        status: 'pending',
      });

      // Create an invite that will be expired
      const invite2 = await WorkspaceInvite.create({
        workplaceId: testWorkplaceId,
        email: 'user2@test.com',
        workplaceRole: 'Cashier',
        invitedBy: testUserId,
        expiresAt: new Date(Date.now() + 1000), // 1 second in future
        maxUses: 1,
        status: 'pending',
      });
      // Manually update to past date after creation
      await WorkspaceInvite.updateOne(
        { _id: invite2._id },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );

      await WorkspaceInvite.create({
        workplaceId: testWorkplaceId,
        email: 'user3@test.com',
        workplaceRole: 'Technician',
        invitedBy: testUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 1,
        status: 'accepted',
      });
    });

    describe('findActiveByToken()', () => {
      it('should find active invite by token', async () => {
        const invite = await WorkspaceInvite.findOne({ status: 'pending' });
        const found = await (WorkspaceInvite as any).findActiveByToken(invite!.inviteToken);

        expect(found).toBeDefined();
        expect(found._id).toEqual(invite!._id);
      });

      it('should not find non-pending invite', async () => {
        const invite = await WorkspaceInvite.findOne({ status: 'accepted' });
        const found = await (WorkspaceInvite as any).findActiveByToken(invite!.inviteToken);

        expect(found).toBeNull();
      });
    });

    describe('countPendingForWorkspace()', () => {
      it('should count pending invites for workspace', async () => {
        const count = await (WorkspaceInvite as any).countPendingForWorkspace(testWorkplaceId);
        expect(count).toBe(2); // Two pending invites
      });
    });

    describe('expireOldInvites()', () => {
      it('should expire old invites', async () => {
        const result = await (WorkspaceInvite as any).expireOldInvites();
        expect(result.modifiedCount).toBe(1);

        const expiredInvite = await WorkspaceInvite.findOne({ email: 'user2@test.com' });
        expect(expiredInvite!.status).toBe('expired');
      });
    });
  });

  describe('Indexes', () => {
    it('should have unique index on inviteToken', async () => {
      const invite1 = await WorkspaceInvite.create({
        workplaceId: testWorkplaceId,
        email: 'user1@test.com',
        workplaceRole: 'Pharmacist',
        invitedBy: testUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 1,
      });

      const invite2 = new WorkspaceInvite({
        workplaceId: testWorkplaceId,
        email: 'user2@test.com',
        workplaceRole: 'Pharmacist',
        invitedBy: testUserId,
        inviteToken: invite1.inviteToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUses: 1,
      });

      await expect(invite2.save()).rejects.toThrow();
    });
  });
});
