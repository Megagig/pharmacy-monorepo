import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

export interface PlanLimits {
    patients: number | null;
    users: number | null;
    locations: number | null;
    storage: number | null; // in MB
    apiCalls: number | null; // per month
    clinicalNotes: number | null;
    reminderSms: number | null;
}

export interface PlanConfig {
    name: string;
    code: string;
    tier: 'free_trial' | 'basic' | 'pro' | 'pharmily' | 'network' | 'enterprise';
    tierRank: number;
    priceNGN: number;
    billingInterval: 'monthly' | 'yearly';
    trialDuration?: number | null;
    popularPlan: boolean;
    isContactSales?: boolean;
    whatsappNumber?: string | null;
    description: string;
    isActive: boolean;
    isTrial: boolean;
    isCustom: boolean;
    features: string[];
    limits: PlanLimits;
}

export interface FeatureConfig {
    name: string;
    category: string;
    description: string;
}

export interface CategoryConfig {
    name: string;
    description: string;
}

export interface PlansConfiguration {
    plans: Record<string, PlanConfig>;
    features: Record<string, FeatureConfig>;
    categories: Record<string, CategoryConfig>;
}

class PlanConfigService {
    private static instance: PlanConfigService;
    private cachedConfig: PlansConfiguration | null = null;
    private lastLoadTime: number = 0;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
    private readonly CONFIG_PATH = path.join(__dirname, '../config/plans.json');

    private constructor() { }

    public static getInstance(): PlanConfigService {
        if (!PlanConfigService.instance) {
            PlanConfigService.instance = new PlanConfigService();
        }
        return PlanConfigService.instance;
    }

    /**
     * Load and validate plan configuration from JSON file
     */
    public async loadConfiguration(): Promise<PlansConfiguration> {
        const now = Date.now();

        // Return cached config if still valid
        if (this.cachedConfig && (now - this.lastLoadTime) < this.CACHE_DURATION) {
            return this.cachedConfig;
        }

        try {
            logger.info('Loading plan configuration from file');

            // Check if config file exists
            if (!fs.existsSync(this.CONFIG_PATH)) {
                throw new Error(`Plan configuration file not found at ${this.CONFIG_PATH}`);
            }

            // Read and parse JSON file
            const configData = fs.readFileSync(this.CONFIG_PATH, 'utf8');
            const parsedConfig = JSON.parse(configData) as PlansConfiguration;

            // Validate configuration structure
            this.validateConfiguration(parsedConfig);

            // Cache the configuration
            this.cachedConfig = parsedConfig;
            this.lastLoadTime = now;

            logger.info(`Successfully loaded ${Object.keys(parsedConfig.plans).length} plans and ${Object.keys(parsedConfig.features).length} features`);

            return parsedConfig;
        } catch (error) {
            logger.error('Failed to load plan configuration:', error);

            // If we have cached config, return it as fallback
            if (this.cachedConfig) {
                logger.warn('Using cached configuration as fallback');
                return this.cachedConfig;
            }

            // Return default configuration as last resort
            logger.warn('Using default configuration as fallback');
            return this.getDefaultConfiguration();
        }
    }

    /**
     * Get a specific plan configuration by code
     */
    public async getPlanByCode(code: string): Promise<PlanConfig | null> {
        const config = await this.loadConfiguration();
        return config.plans[code] || null;
    }

    /**
     * Get all active plans
     */
    public async getActivePlans(): Promise<PlanConfig[]> {
        const config = await this.loadConfiguration();
        return Object.values(config.plans).filter(plan => plan.isActive);
    }

    /**
     * Get feature configuration by code
     */
    public async getFeatureByCode(code: string): Promise<FeatureConfig | null> {
        const config = await this.loadConfiguration();
        return config.features[code] || null;
    }

    /**
     * Check if a plan has a specific feature
     */
    public async planHasFeature(planCode: string, featureCode: string): Promise<boolean> {
        const plan = await this.getPlanByCode(planCode);
        return plan ? plan.features.includes(featureCode) : false;
    }

    /**
     * Get plans by tier rank (for upgrade/downgrade logic)
     */
    public async getPlansByTierRank(): Promise<PlanConfig[]> {
        const config = await this.loadConfiguration();
        return Object.values(config.plans)
            .filter(plan => plan.isActive)
            .sort((a, b) => a.tierRank - b.tierRank);
    }

    /**
     * Force refresh the configuration cache
     */
    public async refreshCache(): Promise<void> {
        this.cachedConfig = null;
        this.lastLoadTime = 0;
        await this.loadConfiguration();
    }

    /**
     * Validate the configuration structure
     */
    private validateConfiguration(config: PlansConfiguration): void {
        if (!config.plans || typeof config.plans !== 'object') {
            throw new Error('Invalid configuration: plans object is required');
        }

        if (!config.features || typeof config.features !== 'object') {
            throw new Error('Invalid configuration: features object is required');
        }

        if (!config.categories || typeof config.categories !== 'object') {
            throw new Error('Invalid configuration: categories object is required');
        }

        // Validate each plan
        for (const [code, plan] of Object.entries(config.plans)) {
            this.validatePlan(code, plan);
        }

        // Validate each feature
        for (const [code, feature] of Object.entries(config.features)) {
            this.validateFeature(code, feature);
        }

        // Validate feature references in plans
        this.validateFeatureReferences(config);
    }

    /**
     * Validate individual plan configuration
     */
    private validatePlan(code: string, plan: PlanConfig): void {
        const requiredFields = ['name', 'code', 'tier', 'tierRank', 'priceNGN', 'billingInterval', 'description', 'features', 'limits'];

        for (const field of requiredFields) {
            if (!(field in plan)) {
                throw new Error(`Plan ${code} is missing required field: ${field}`);
            }
        }

        if (plan.code !== code) {
            throw new Error(`Plan code mismatch: expected ${code}, got ${plan.code}`);
        }

        if (!Array.isArray(plan.features)) {
            throw new Error(`Plan ${code} features must be an array`);
        }

        if (typeof plan.limits !== 'object' || plan.limits === null) {
            throw new Error(`Plan ${code} limits must be an object`);
        }

        // Validate tier values
        const validTiers = ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'];
        if (!validTiers.includes(plan.tier)) {
            throw new Error(`Plan ${code} has invalid tier: ${plan.tier}`);
        }

        // Validate billing interval
        const validIntervals = ['monthly', 'yearly'];
        if (!validIntervals.includes(plan.billingInterval)) {
            throw new Error(`Plan ${code} has invalid billing interval: ${plan.billingInterval}`);
        }
    }

    /**
     * Validate individual feature configuration
     */
    private validateFeature(code: string, feature: FeatureConfig): void {
        const requiredFields = ['name', 'category', 'description'];

        for (const field of requiredFields) {
            if (!(field in feature)) {
                throw new Error(`Feature ${code} is missing required field: ${field}`);
            }
        }
    }

    /**
     * Validate that all feature references in plans exist
     */
    private validateFeatureReferences(config: PlansConfiguration): void {
        const availableFeatures = new Set(Object.keys(config.features));

        for (const [planCode, plan] of Object.entries(config.plans)) {
            for (const featureCode of plan.features) {
                if (!availableFeatures.has(featureCode)) {
                    throw new Error(`Plan ${planCode} references unknown feature: ${featureCode}`);
                }
            }
        }
    }

    /**
     * Get default configuration as fallback
     */
    private getDefaultConfiguration(): PlansConfiguration {
        return {
            plans: {
                free_trial: {
                    name: 'Free Trial',
                    code: 'free_trial',
                    tier: 'free_trial',
                    tierRank: 0,
                    priceNGN: 0,
                    billingInterval: 'monthly',
                    trialDuration: 14,
                    popularPlan: false,
                    isContactSales: false,
                    whatsappNumber: null,
                    description: '14-day free trial with basic features',
                    isActive: true,
                    isTrial: true,
                    isCustom: false,
                    features: ['dashboard', 'patient_management', 'clinical_notes'],
                    limits: {
                        patients: 10,
                        users: 1,
                        locations: 1,
                        storage: 100,
                        apiCalls: 100,
                        clinicalNotes: 50,
                        reminderSms: 10
                    }
                }
            },
            features: {
                dashboard: {
                    name: 'Dashboard Overview',
                    category: 'core',
                    description: 'Main dashboard with key metrics'
                },
                patient_management: {
                    name: 'Patient Management',
                    category: 'clinical',
                    description: 'Basic patient record management'
                },
                clinical_notes: {
                    name: 'Clinical Notes',
                    category: 'clinical',
                    description: 'Create and manage clinical notes'
                }
            },
            categories: {
                core: {
                    name: 'Core Features',
                    description: 'Essential functionality'
                },
                clinical: {
                    name: 'Clinical Features',
                    description: 'Clinical workflow tools'
                }
            }
        };
    }
}

export default PlanConfigService;