import Subscription from '../models/Subscription';
import PricingPlan from '../models/PricingPlan';
import Workplace from '../models/Workplace';
import { FeatureFlag } from '../models/FeatureFlag';

export class WorkspaceSubscriptionService {
  /**
   * Create a 14-day trial subscription for a new workspace
   */
  static async createTrialSubscription(workspaceId: string): Promise<any> {
    try {
      console.log(`🔧 Creating trial subscription for workspace: ${workspaceId}`);

      // Find the free trial pricing plan
      const trialPlan = await PricingPlan.findOne({
        tier: 'free_trial',
        isActive: true,
      });

      if (!trialPlan) {
        throw new Error('Free trial plan not found');
      }

      // Check if subscription already exists
      const existingSubscription = await Subscription.findOne({
        workspaceId: workspaceId,
      });

      if (existingSubscription) {
        console.log(`🔧 Subscription already exists for workspace: ${workspaceId}`);
        return existingSubscription;
      }

      // Get all features available for free trial
      const trialFeatures = await FeatureFlag.find({
        isActive: true,
        allowedTiers: { $in: ['free_trial'] },
      }).select('key');

      const featureKeys = trialFeatures.map(f => f.key);
      console.log(`🔧 Trial features found: ${featureKeys.length} features - ${JSON.stringify(featureKeys)}`);

      // Create trial subscription
      const now = new Date();
      const trialEndDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

      const subscription = new Subscription({
        workspaceId: workspaceId,
        planId: trialPlan._id,
        status: 'trial',
        tier: 'free_trial',
        startDate: now,
        endDate: trialEndDate,
        trialEndDate: trialEndDate,
        priceAtPurchase: 0,
        billingInterval: 'monthly',
        autoRenew: false,
        features: featureKeys,
        customFeatures: [],
        limits: {
          patients: null, // Unlimited during trial
          users: null,    // Unlimited during trial
          locations: null,
          storage: null,
          apiCalls: null,
        },
        usageMetrics: [],
        paymentHistory: [],
        webhookEvents: [],
        renewalAttempts: [],
      });

      await subscription.save();

      // Update workspace with subscription info
      await Workplace.findByIdAndUpdate(workspaceId, {
        currentSubscriptionId: subscription._id,
        currentPlanId: trialPlan._id,
        subscriptionStatus: 'trial',
        trialStartDate: now,
        trialEndDate: trialEndDate,
      });

      console.log(`✅ Trial subscription created for workspace: ${workspaceId}`);
      return subscription;

    } catch (error) {
      console.error('Error creating trial subscription:', error);
      throw error;
    }
  }

  /**
   * Get workspace subscription with feature access
   */
  static async getWorkspaceSubscription(workspaceId: string): Promise<any> {
    try {
      const subscription = await Subscription.findOne({
        workspaceId: workspaceId,
        status: { $in: ['active', 'trial', 'past_due'] },
      }).populate('planId');

      if (!subscription) {
        return null;
      }

      // Get available features for this subscription tier
      const availableFeatures = await FeatureFlag.find({
        isActive: true,
        allowedTiers: { $in: [subscription.tier] },
      }).select('key name description');

      return {
        ...subscription.toObject(),
        availableFeatures: availableFeatures.map(f => ({
          key: f.key,
          name: f.name,
          description: f.description,
        })),
      };

    } catch (error) {
      console.error('Error getting workspace subscription:', error);
      throw error;
    }
  }

  /**
   * Check if workspace has access to a specific feature
   */
  static async hasFeatureAccess(workspaceId: string, featureKey: string): Promise<boolean> {
    try {
      const subscription = await Subscription.findOne({
        workspaceId: workspaceId,
        status: { $in: ['active', 'trial', 'past_due'] },
      });

      if (!subscription) {
        return false;
      }

      // Check if trial has expired
      if (subscription.status === 'trial' && subscription.trialEndDate) {
        const now = new Date();
        if (now > subscription.trialEndDate) {
          return false;
        }
      }

      // Check if feature is available for this tier
      const featureFlag = await FeatureFlag.findOne({
        key: featureKey,
        isActive: true,
        allowedTiers: { $in: [subscription.tier] },
      });

      return !!featureFlag;

    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  }

  /**
   * Migrate existing users without workspaces
   */
  static async migrateUsersWithoutWorkspaces(): Promise<void> {
    try {
      console.log('🔧 Starting migration of users without workspaces...');

      const User = require('../models/User').default;
      
      // Find users without workplaces
      const usersWithoutWorkspace = await User.find({
        workplaceId: { $exists: false },
        role: { $ne: 'super_admin' }, // Don't migrate super admins
      });

      console.log(`Found ${usersWithoutWorkspace.length} users without workspaces`);

      for (const user of usersWithoutWorkspace) {
        try {
          // Create a personal workspace for the user
          const workspace = new Workplace({
            name: `${user.firstName} ${user.lastName}'s Workspace`,
            type: 'Community',
            licenseNumber: user.licenseNumber || `AUTO-${Date.now()}`,
            email: user.email,
            phone: user.phone,
            address: user.address,
            state: user.state || 'Lagos', // Default to Lagos if no state
            ownerId: user._id,
            teamMembers: [user._id],
            verificationStatus: 'unverified',
          });

          await workspace.save();

          // Create trial subscription for the workspace
          await this.createTrialSubscription(workspace._id);

          // Update user with workspace
          await User.findByIdAndUpdate(user._id, {
            workplaceId: workspace._id,
            workplaceRole: 'Owner',
          });

          console.log(`✅ Migrated user: ${user.email} to workspace: ${workspace._id}`);

        } catch (error) {
          console.error(`❌ Failed to migrate user: ${user.email}`, error);
        }
      }

      console.log('✅ Migration completed');

    } catch (error) {
      console.error('Error during migration:', error);
      throw error;
    }
  }
}

export default WorkspaceSubscriptionService;