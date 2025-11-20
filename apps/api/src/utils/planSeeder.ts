import mongoose from 'mongoose';
import SubscriptionPlan, { ISubscriptionPlan } from '../models/SubscriptionPlan';
import PlanConfigService, { PlanConfig } from '../services/PlanConfigService';
import logger from './logger';

export class PlanSeeder {
    private planConfigService: PlanConfigService;

    constructor() {
        this.planConfigService = PlanConfigService.getInstance();
    }

    /**
     * Seed subscription plans from configuration
     */
    public async seedPlans(): Promise<void> {
        try {
            logger.info('Starting plan seeding process...');

            // Load configuration
            const config = await this.planConfigService.loadConfiguration();
            const planConfigs = Object.values(config.plans);

            logger.info(`Found ${planConfigs.length} plans in configuration`);

            // Process each plan
            for (const planConfig of planConfigs) {
                await this.upsertPlan(planConfig);
            }

            // Deactivate plans not in configuration
            await this.deactivateObsoletePlans(planConfigs);

            logger.info('Plan seeding completed successfully');
        } catch (error) {
            logger.error('Failed to seed plans:', error);
            throw error;
        }
    }

    /**
     * Upsert a single plan (create or update)
     */
    private async upsertPlan(planConfig: PlanConfig): Promise<void> {
        try {
            // Map configuration to model format
            const planData = this.mapConfigToPlanModel(planConfig);

            // Use findOneAndUpdate with upsert to handle create/update atomically
            // Use tier as the primary identifier for upsert
            const result = await SubscriptionPlan.findOneAndUpdate(
                { tier: planConfig.tier },
                {
                    $set: {
                        ...planData,
                        updatedAt: new Date()
                    }
                },
                {
                    upsert: true,
                    new: true,
                    runValidators: true
                }
            );

            if (result) {
                logger.info(`Upserted plan: ${planConfig.name} (${planConfig.tier})`);
            }
        } catch (error: any) {
            logger.error(`Failed to upsert plan ${planConfig.name}:`, error);
            throw error;
        }
    }

    /**
     * Create a new plan from configuration
     */
    private async createNewPlan(planConfig: PlanConfig): Promise<ISubscriptionPlan> {
        const planData = this.mapConfigToPlanModel(planConfig);
        const newPlan = new SubscriptionPlan(planData);

        // Validate before saving
        await newPlan.validate();

        return await newPlan.save();
    }

    /**
     * Update existing plan with new configuration
     */
    private async updateExistingPlan(
        existingPlan: ISubscriptionPlan,
        planConfig: PlanConfig
    ): Promise<void> {
        // Map configuration to model format
        const updatedData = this.mapConfigToPlanModel(planConfig);

        // Update fields while preserving database-specific fields
        Object.assign(existingPlan, {
            ...updatedData,
            _id: existingPlan._id,
            createdAt: existingPlan.createdAt,
            updatedAt: new Date()
        });

        // Validate before saving
        await existingPlan.validate();

        await existingPlan.save();
    }

    /**
     * Map plan configuration to database model format
     */
    private mapConfigToPlanModel(planConfig: PlanConfig): Partial<ISubscriptionPlan> {
        return {
            name: planConfig.name,
            priceNGN: planConfig.priceNGN,
            billingInterval: planConfig.billingInterval,
            tier: planConfig.tier,
            trialDuration: planConfig.trialDuration || undefined,
            popularPlan: planConfig.popularPlan,
            isContactSales: planConfig.isContactSales,
            whatsappNumber: planConfig.whatsappNumber || undefined,
            description: planConfig.description,
            isActive: planConfig.isActive,
            features: this.mapFeaturesToModel(planConfig.features, planConfig.limits)
        };
    }

    /**
     * Map features array and limits to the existing model structure
     */
    private mapFeaturesToModel(features: string[], limits: any): ISubscriptionPlan['features'] {
        return {
            // Map limits
            patientLimit: limits.patients,
            reminderSmsMonthlyLimit: limits.reminderSms,
            clinicalNotesLimit: limits.clinicalNotes,
            patientRecordsLimit: limits.patients,
            teamSize: limits.users,

            // Map boolean features
            reportsExport: features.includes('reports_export'),
            careNoteExport: features.includes('care_note_export'),
            adrModule: features.includes('adr_module'),
            multiUserSupport: features.includes('team_management'),
            apiAccess: features.includes('api_access'),
            auditLogs: features.includes('audit_logs'),
            dataBackup: features.includes('data_backup'),
            prioritySupport: features.includes('priority_support'),
            emailReminders: features.includes('email_reminders'),
            smsReminders: features.includes('sms_reminders'),
            advancedReports: features.includes('advanced_reports'),
            drugTherapyManagement: features.includes('drug_therapy_management'),
            teamManagement: features.includes('team_management'),
            dedicatedSupport: features.includes('dedicated_support'),
            integrations: features.includes('integrations'),
            customIntegrations: features.includes('custom_integrations'),

            // Advanced features
            adrReporting: features.includes('adr_reporting'),
            drugInteractionChecker: features.includes('drug_interaction_checker'),
            doseCalculator: features.includes('dose_calculator'),
            multiLocationDashboard: features.includes('multi_location_dashboard'),
            sharedPatientRecords: features.includes('shared_patient_records'),
            groupAnalytics: features.includes('group_analytics'),
            cdss: features.includes('cdss')
        };
    }

    /**
     * Deactivate plans that are no longer in configuration
     */
    private async deactivateObsoletePlans(currentPlans: PlanConfig[]): Promise<void> {
        try {
            const currentTiers = currentPlans.map(plan => plan.tier);

            // Find plans in database that are not in current configuration
            const obsoletePlans = await SubscriptionPlan.find({
                tier: { $nin: currentTiers },
                isActive: true
            });

            if (obsoletePlans.length > 0) {
                logger.info(`Found ${obsoletePlans.length} obsolete plans to deactivate`);

                // Deactivate obsolete plans instead of deleting them
                await SubscriptionPlan.updateMany(
                    { tier: { $nin: currentTiers }, isActive: true },
                    { isActive: false, updatedAt: new Date() }
                );

                logger.info(`Deactivated ${obsoletePlans.length} obsolete plans`);
            }
        } catch (error) {
            logger.error('Failed to deactivate obsolete plans:', error);
            throw error;
        }
    }

    /**
     * Validate plan configuration before seeding
     */
    public async validateConfiguration(): Promise<boolean> {
        try {
            const config = await this.planConfigService.loadConfiguration();
            const planConfigs = Object.values(config.plans);

            // Check for duplicate tier ranks
            const tierRanks = planConfigs.map(plan => plan.tierRank);
            const uniqueTierRanks = new Set(tierRanks);

            if (tierRanks.length !== uniqueTierRanks.size) {
                throw new Error('Duplicate tier ranks found in configuration');
            }

            // Check for duplicate tiers
            const tiers = planConfigs.map(plan => plan.tier);
            const uniqueTiers = new Set(tiers);

            if (tiers.length !== uniqueTiers.size) {
                throw new Error('Duplicate tiers found in configuration');
            }

            // Validate each plan can be mapped to model
            for (const planConfig of planConfigs) {
                const modelData = this.mapConfigToPlanModel(planConfig);

                // Create temporary model instance for validation
                const tempPlan = new SubscriptionPlan(modelData);
                await tempPlan.validate();
            }

            logger.info('Configuration validation passed');
            return true;
        } catch (error) {
            logger.error('Configuration validation failed:', error);
            return false;
        }
    }

    /**
     * Get seeding statistics
     */
    public async getSeedingStats(): Promise<{
        totalPlansInConfig: number;
        totalPlansInDatabase: number;
        activePlansInDatabase: number;
        lastSeededAt?: Date;
    }> {
        try {
            const config = await this.planConfigService.loadConfiguration();
            const totalPlansInConfig = Object.keys(config.plans).length;

            const totalPlansInDatabase = await SubscriptionPlan.countDocuments();
            const activePlansInDatabase = await SubscriptionPlan.countDocuments({ isActive: true });

            // Get the most recent update timestamp
            const mostRecentPlan = await SubscriptionPlan.findOne()
                .sort({ updatedAt: -1 })
                .select('updatedAt');

            return {
                totalPlansInConfig,
                totalPlansInDatabase,
                activePlansInDatabase,
                lastSeededAt: mostRecentPlan?.updatedAt
            };
        } catch (error) {
            logger.error('Failed to get seeding stats:', error);
            throw error;
        }
    }
}

export default PlanSeeder;