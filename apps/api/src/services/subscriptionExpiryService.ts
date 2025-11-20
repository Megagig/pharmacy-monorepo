import Subscription from '../models/Subscription';
import Workplace from '../models/Workplace';
import User from '../models/User';
import { emailService } from '../utils/emailService';
import logger from '../utils/logger';

export class SubscriptionExpiryService {
    /**
     * Check and handle expired trials
     */
    async checkExpiredTrials(): Promise<void> {
        try {
            const now = new Date();

            // Find all trial subscriptions that have expired
            const expiredTrials = await Subscription.find({
                status: 'trial',
                trialEndDate: { $lt: now },
            }).populate('workspaceId');

            logger.info(`Found ${expiredTrials.length} expired trials to process`);

            for (const subscription of expiredTrials) {
                try {
                    await this.expireTrialSubscription(subscription);
                    logger.info(`Expired trial subscription ${subscription._id} for workspace ${subscription.workspaceId}`);
                } catch (error) {
                    logger.error(`Error expiring trial subscription ${subscription._id}:`, error);
                }
            }

            // Send trial expiry warnings (3 days before expiry)
            await this.sendTrialExpiryWarnings();

        } catch (error) {
            logger.error('Error checking expired trials:', error);
        }
    }

    /**
     * Check and handle expired subscriptions
     */
    async checkExpiredSubscriptions(): Promise<void> {
        try {
            const now = new Date();

            // Find active subscriptions that have expired
            const expiredSubscriptions = await Subscription.find({
                status: 'active',
                endDate: { $lt: now },
            }).populate('workspaceId');

            logger.info(`Found ${expiredSubscriptions.length} expired subscriptions to process`);

            for (const subscription of expiredSubscriptions) {
                try {
                    await this.handleExpiredSubscription(subscription);
                    logger.info(`Handled expired subscription ${subscription._id} for workspace ${subscription.workspaceId}`);
                } catch (error) {
                    logger.error(`Error handling expired subscription ${subscription._id}:`, error);
                }
            }

            // Handle grace period expiry
            await this.checkGracePeriodExpiry();

            // Send subscription expiry warnings
            await this.sendSubscriptionExpiryWarnings();

        } catch (error) {
            logger.error('Error checking expired subscriptions:', error);
        }
    }

    /**
     * Check and handle grace period expiry
     */
    async checkGracePeriodExpiry(): Promise<void> {
        try {
            const now = new Date();

            // Find past_due subscriptions where grace period has expired
            const expiredGracePeriods = await Subscription.find({
                status: 'past_due',
                gracePeriodEnd: { $lt: now },
            }).populate('workspaceId');

            logger.info(`Found ${expiredGracePeriods.length} expired grace periods to process`);

            for (const subscription of expiredGracePeriods) {
                try {
                    await this.expireSubscriptionAfterGracePeriod(subscription);
                    logger.info(`Expired subscription ${subscription._id} after grace period for workspace ${subscription.workspaceId}`);
                } catch (error) {
                    logger.error(`Error expiring subscription after grace period ${subscription._id}:`, error);
                }
            }
        } catch (error) {
            logger.error('Error checking grace period expiry:', error);
        }
    }

    /**
     * Process scheduled downgrades
     */
    async processScheduledDowngrades(): Promise<void> {
        try {
            const now = new Date();

            // Find subscriptions with scheduled downgrades that are due
            const subscriptionsToDowngrade = await Subscription.find({
                status: 'active',
                'scheduledDowngrade.effectiveDate': { $lte: now },
            }).populate('scheduledDowngrade.planId').populate('workspaceId');

            logger.info(`Found ${subscriptionsToDowngrade.length} scheduled downgrades to process`);

            for (const subscription of subscriptionsToDowngrade) {
                try {
                    await this.applyScheduledDowngrade(subscription);
                    logger.info(`Applied scheduled downgrade for subscription ${subscription._id}`);
                } catch (error) {
                    logger.error(`Error applying scheduled downgrade for subscription ${subscription._id}:`, error);
                }
            }
        } catch (error) {
            logger.error('Error processing scheduled downgrades:', error);
        }
    }

    /**
     * Send trial expiry warnings (3 days before expiry)
     */
    private async sendTrialExpiryWarnings(): Promise<void> {
        try {
            const threeDaysFromNow = new Date();
            threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

            const trialsSoonToExpire = await Subscription.find({
                status: 'trial',
                trialEndDate: {
                    $gte: new Date(),
                    $lte: threeDaysFromNow,
                },
            }).populate('workspaceId');

            for (const subscription of trialsSoonToExpire) {
                try {
                    const workspace = subscription.workspaceId as any;
                    const owner = await User.findById(workspace.ownerId);

                    if (owner) {
                        const daysRemaining = Math.ceil(
                            (subscription.trialEndDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                        );

                        await emailService.sendTrialExpiryWarning(owner.email, {
                            firstName: owner.firstName,
                            workspaceName: workspace.name,
                            trialStartDate: subscription.startDate,
                            trialEndDate: subscription.trialEndDate!,
                            daysLeft: daysRemaining,
                        });

                        logger.info(`Sent trial expiry warning to ${owner.email} for workspace ${workspace.name}`);
                    }
                } catch (error) {
                    logger.error(`Error sending trial expiry warning for subscription ${subscription._id}:`, error);
                }
            }
        } catch (error) {
            logger.error('Error sending trial expiry warnings:', error);
        }
    }

    /**
     * Send subscription expiry warnings (7 days before expiry)
     */
    private async sendSubscriptionExpiryWarnings(): Promise<void> {
        try {
            const sevenDaysFromNow = new Date();
            sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

            const subscriptionsSoonToExpire = await Subscription.find({
                status: 'active',
                endDate: {
                    $gte: new Date(),
                    $lte: sevenDaysFromNow,
                },
            }).populate('workspaceId');

            for (const subscription of subscriptionsSoonToExpire) {
                try {
                    const workspace = subscription.workspaceId as any;
                    const owner = await User.findById(workspace.ownerId);

                    if (owner) {
                        const daysRemaining = Math.ceil(
                            (subscription.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                        );

                        await emailService.sendSubscriptionExpiryWarning(owner.email, {
                            firstName: owner.firstName,
                            workspaceName: workspace.name,
                            daysRemaining,
                            endDate: subscription.endDate,
                        });

                        logger.info(`Sent subscription expiry warning to ${owner.email} for workspace ${workspace.name}`);
                    }
                } catch (error) {
                    logger.error(`Error sending subscription expiry warning for subscription ${subscription._id}:`, error);
                }
            }
        } catch (error) {
            logger.error('Error sending subscription expiry warnings:', error);
        }
    }

    /**
     * Expire trial subscription
     */
    private async expireTrialSubscription(subscription: any): Promise<void> {
        const workspace = subscription.workspaceId;

        // Update subscription status
        subscription.status = 'expired';
        await subscription.save();

        // Update workspace status
        workspace.subscriptionStatus = 'expired';
        await workspace.save();

        // Send expiry notification
        const owner = await User.findById(workspace.ownerId);
        if (owner) {
            await emailService.sendTrialExpired(owner.email, {
                firstName: owner.firstName,
                workspaceName: workspace.name,
                trialEndDate: subscription.trialEndDate,
            });
        }
    }

    /**
     * Handle expired subscription (set to past_due with grace period)
     */
    private async handleExpiredSubscription(subscription: any): Promise<void> {
        const workspace = subscription.workspaceId;

        // Set grace period (7 days)
        const gracePeriodEnd = new Date();
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

        // Update subscription status
        subscription.status = 'past_due';
        subscription.gracePeriodEnd = gracePeriodEnd;
        await subscription.save();

        // Update workspace status
        workspace.subscriptionStatus = 'past_due';
        await workspace.save();

        // Send past due notification
        const owner = await User.findById(workspace.ownerId);
        if (owner) {
            await emailService.sendSubscriptionPastDue(owner.email, {
                firstName: owner.firstName,
                workspaceName: workspace.name,
                gracePeriodEnd,
            });
        }
    }

    /**
     * Expire subscription after grace period
     */
    private async expireSubscriptionAfterGracePeriod(subscription: any): Promise<void> {
        const workspace = subscription.workspaceId;

        // Update subscription status
        subscription.status = 'expired';
        await subscription.save();

        // Update workspace status
        workspace.subscriptionStatus = 'expired';
        await workspace.save();

        // Send expiry notification
        const owner = await User.findById(workspace.ownerId);
        if (owner) {
            await emailService.sendSubscriptionExpired(owner.email, {
                firstName: owner.firstName,
                workspaceName: workspace.name,
            });
        }
    }

    /**
     * Apply scheduled downgrade
     */
    private async applyScheduledDowngrade(subscription: any): Promise<void> {
        const workspace = subscription.workspaceId;
        const newPlan = subscription.scheduledDowngrade.planId;

        // Update subscription with new plan
        subscription.planId = newPlan._id;
        subscription.tier = newPlan.tier;
        subscription.priceAtPurchase = newPlan.priceNGN;
        subscription.features = Object.keys(newPlan.features).filter(
            key => (newPlan.features as any)[key] === true
        );
        subscription.limits = {
            patients: newPlan.features.patientLimit,
            users: newPlan.features.teamSize,
            locations: newPlan.features.multiLocationDashboard ? null : 1,
            storage: null,
            apiCalls: newPlan.features.apiAccess ? null : 0,
        };

        // Clear scheduled downgrade
        subscription.scheduledDowngrade = undefined;

        await subscription.save();

        // Update workspace
        workspace.currentPlanId = newPlan._id;
        await workspace.save();

        // Send downgrade confirmation
        const owner = await User.findById(workspace.ownerId);
        if (owner) {
            await emailService.sendSubscriptionDowngradeApplied(owner.email, {
                firstName: owner.firstName,
                workspaceName: workspace.name,
                newPlanName: newPlan.name,
                effectiveDate: new Date(),
            });
        }
    }

    /**
     * Run all expiry checks
     */
    async runExpiryChecks(): Promise<void> {
        logger.info('Starting subscription expiry checks...');

        await this.checkExpiredTrials();
        await this.checkExpiredSubscriptions();
        await this.processScheduledDowngrades();

        logger.info('Completed subscription expiry checks');
    }
}

export const subscriptionExpiryService = new SubscriptionExpiryService();