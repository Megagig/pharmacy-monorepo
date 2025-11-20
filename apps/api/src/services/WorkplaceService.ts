import Workplace, { IWorkplace } from '../models/Workplace';
import User from '../models/User';
import mongoose from 'mongoose';

export interface CreateWorkplaceData {
  name: string;
  type:
  | 'Community'
  | 'Hospital'
  | 'Academia'
  | 'Industry'
  | 'Regulatory Body'
  | 'Other';
  licenseNumber: string;
  email: string;
  address?: string;
  state?: string;
  lga?: string;
  ownerId: mongoose.Types.ObjectId;
}

export interface JoinWorkplaceData {
  userId: mongoose.Types.ObjectId;
  inviteCode?: string;
  workplaceId?: mongoose.Types.ObjectId;
  workplaceRole?:
  | 'Staff'
  | 'Pharmacist'
  | 'Cashier'
  | 'Technician'
  | 'Assistant';
}

export class WorkplaceService {
  /**
   * Create a new workplace
   */
  async createWorkplace(data: CreateWorkplaceData): Promise<IWorkplace> {
    const workplace = new Workplace({
      ...data,
      verificationStatus: 'verified', // Auto-verify for patient portal access
      patientPortalEnabled: true, // Enable patient portal by default
      patientPortalSettings: {
        allowSelfRegistration: true,
        requireEmailVerification: true,
        requireAdminApproval: true,
        operatingHours: 'Monday-Friday: 8:00 AM - 5:00 PM',
        services: ['Prescription Refills', 'Medication Consultation', 'Health Screening'],
      },
      teamMembers: [data.ownerId], // Owner is automatically added to team
    });

    const savedWorkplace = await workplace.save();

    // Update the owner's workplace info
    await User.findByIdAndUpdate(data.ownerId, {
      workplaceId: savedWorkplace._id,
      workplaceRole: 'Owner',
    });

    return savedWorkplace;
  }

  /**
   * Join an existing workplace using invite code or workplace ID
   */
  async joinWorkplace(data: JoinWorkplaceData, session?: mongoose.ClientSession): Promise<IWorkplace> {
    let workplace: IWorkplace | null = null;

    if (data.inviteCode) {
      workplace = await Workplace.findOne({ inviteCode: data.inviteCode });
      if (!workplace) {
        throw new Error('Invalid invite code');
      }
    } else if (data.workplaceId) {
      workplace = await Workplace.findById(data.workplaceId);
      if (!workplace) {
        throw new Error('Workplace not found');
      }
    } else {
      throw new Error('Either invite code or workplace ID is required');
    }

    // Check if user is already a member
    const isAlreadyMember = workplace.teamMembers.some(
      (memberId) => memberId.toString() === data.userId.toString()
    );

    if (!isAlreadyMember) {
      // Add user to workplace team
      workplace.teamMembers.push(data.userId);
      await workplace.save({ session });
    }

    // Update user's workplace info
    await User.findByIdAndUpdate(data.userId, {
      workplaceId: workplace._id,
      workplaceRole: data.workplaceRole || 'Staff',
    }, { session });

    return workplace;
  }

  /**
   * Find workplace by invite code
   */
  async findByInviteCode(inviteCode: string): Promise<IWorkplace | null> {
    return await Workplace.findOne({ inviteCode }).populate(
      'ownerId',
      'firstName lastName email'
    );
  }

  /**
   * Generate a new invite code for a workplace
   */
  async regenerateInviteCode(
    workplaceId: mongoose.Types.ObjectId
  ): Promise<string> {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let newCode = '';
    let isUnique = false;

    // Keep trying until we get a unique code
    while (!isUnique) {
      newCode = '';
      for (let i = 0; i < 6; i++) {
        newCode += characters.charAt(
          Math.floor(Math.random() * characters.length)
        );
      }

      const existing = await Workplace.findOne({ inviteCode: newCode });
      if (!existing) {
        isUnique = true;
      }
    }

    await Workplace.findByIdAndUpdate(workplaceId, { inviteCode: newCode });
    return newCode;
  }

  /**
   * Get workplace with team members
   */
  async getWorkplaceWithTeam(
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IWorkplace | null> {
    return await Workplace.findById(workplaceId)
      .populate('ownerId', 'firstName lastName email')
      .populate('teamMembers', 'firstName lastName email role workplaceRole');
  }

  /**
   * Remove user from workplace
   */
  async removeFromWorkplace(
    workplaceId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<void> {
    await Workplace.findByIdAndUpdate(workplaceId, {
      $pull: { teamMembers: userId },
    });

    await User.findByIdAndUpdate(userId, {
      $unset: { workplaceId: 1, workplaceRole: 1 },
    });
  }

  /**
   * Check if user can access workplace features
   */
  async canAccessWorkplaceFeatures(
    userId: mongoose.Types.ObjectId
  ): Promise<boolean> {
    const user = await User.findById(userId);
    return !!(user?.workplaceId || user?.currentPlanId);
  }
}

export default new WorkplaceService();
