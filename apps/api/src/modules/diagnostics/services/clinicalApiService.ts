import { ApiClient } from '../../../utils/apiClient';
import logger from '../../../utils/logger';
import rxnormService, { RxNormDrug } from '../../../services/rxnormService';
import drugInteractionService, { DrugInteractionCheck } from '../../../services/drugInteractionService';

export interface DrugInfo {
    rxcui: string;
    name: string;
    brandNames: string[];
    genericNames: string[];
    strength?: string;
    dosageForm?: string;
    route?: string;
    manufacturer?: string;
    ndcs: string[];
    therapeuticClass?: string;
    pharmacologicalClass?: string;
    indication?: string;
    contraindications: string[];
    warnings: string[];
    adverseEffects: string[];
    dosing?: {
        adult?: string;
        pediatric?: string;
        renal?: string;
        hepatic?: string;
    };
}

export interface InteractionResult {
    drugPair: {
        drug1: string;
        drug2: string;
        rxcui1?: string;
        rxcui2?: string;
    };
    severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
    description: string;
    mechanism?: string;
    clinicalEffects: string[];
    management: string;
    source: string;
    references?: string[];
}

export interface AllergyAlert {
    allergen: string;
    medication: string;
    rxcui?: string;
    alertType: 'allergy' | 'cross_sensitivity' | 'intolerance';
    severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
    description: string;
    recommendations: string[];
}

export interface ContraindicationAlert {
    medication: string;
    rxcui?: string;
    condition: string;
    severity: 'relative' | 'absolute';
    description: string;
    alternatives?: string[];
}

export interface ClinicalApiResponse<T> {
    data: T;
    cached: boolean;
    timestamp: Date;
    source: string;
}

interface CacheEntry<T> {
    data: T;
    timestamp: Date;
    expiresAt: Date;
}

export class ClinicalApiService {
    private rxnormClient: ApiClient;
    private openfdaClient: ApiClient;
    private cache: Map<string, CacheEntry<any>>;
    private readonly cacheTimeout: number = 24 * 60 * 60 * 1000; // 24 hours
    private readonly maxCacheSize: number = 1000;

    constructor() {
        this.rxnormClient = new ApiClient({
            baseURL: 'https://rxnav.nlm.nih.gov/REST',
            timeout: 15000,
            retryAttempts: 3,
            retryDelay: 1000,
        });

        this.openfdaClient = new ApiClient({
            baseURL: 'https://api.fda.gov/drug',
            timeout: 15000,
            retryAttempts: 3,
            retryDelay: 1000,
        });

        this.cache = new Map();

        // Clean cache periodically
        setInterval(() => this.cleanExpiredCache(), 60 * 60 * 1000); // Every hour
    }

    /**
     * Get comprehensive drug information
     */
    async getDrugInfo(drugName: string): Promise<ClinicalApiResponse<DrugInfo>> {
        const cacheKey = `drug_info_${drugName.toLowerCase()}`;
        const cached = this.getFromCache<DrugInfo>(cacheKey);

        if (cached) {
            return {
                data: cached,
                cached: true,
                timestamp: new Date(),
                source: 'cache',
            };
        }

        try {
            // Get RxCUI first
            const rxcuis = await rxnormService.getRxCui(drugName);
            if (rxcuis.length === 0) {
                throw new Error(`No RxCUI found for drug: ${drugName}`);
            }

            const primaryRxcui = rxcuis[0]!;

            // Get basic drug information from RxNorm
            const [drugDetails, relatedDrugs] = await Promise.all([
                rxnormService.getDrugDetails(primaryRxcui),
                rxnormService.getRelatedDrugs(primaryRxcui),
            ]);

            // Get FDA drug information
            const fdaInfo = await this.getFDADrugInfo(drugName);

            // Compile comprehensive drug information
            const drugInfo: DrugInfo = {
                rxcui: primaryRxcui,
                name: drugName,
                brandNames: this.extractBrandNames(relatedDrugs),
                genericNames: this.extractGenericNames(relatedDrugs),
                strength: drugDetails.properties?.strength,
                dosageForm: drugDetails.properties?.dosage_form,
                route: drugDetails.properties?.route,
                manufacturer: fdaInfo?.manufacturer,
                ndcs: drugDetails.ndcs || [],
                therapeuticClass: fdaInfo?.therapeuticClass,
                pharmacologicalClass: fdaInfo?.pharmacologicalClass,
                indication: fdaInfo?.indication,
                contraindications: fdaInfo?.contraindications || [],
                warnings: fdaInfo?.warnings || [],
                adverseEffects: fdaInfo?.adverseEffects || [],
                dosing: fdaInfo?.dosing,
            };

            this.setCache(cacheKey, drugInfo);

            logger.info(`Retrieved comprehensive drug info for: ${drugName}`, {
                rxcui: primaryRxcui,
                brandNames: drugInfo.brandNames.length,
                contraindications: drugInfo.contraindications.length,
            });

            return {
                data: drugInfo,
                cached: false,
                timestamp: new Date(),
                source: 'api',
            };
        } catch (error) {
            logger.error(`Failed to get drug info for ${drugName}:`, error);
            throw new Error(`Failed to retrieve drug information: ${error}`);
        }
    }

    /**
     * Check drug interactions with severity classification
     */
    async checkDrugInteractions(
        medications: string[]
    ): Promise<ClinicalApiResponse<InteractionResult[]>> {
        if (medications.length < 2) {
            return {
                data: [],
                cached: false,
                timestamp: new Date(),
                source: 'api',
            };
        }

        const cacheKey = `interactions_${medications.sort().join('_').toLowerCase()}`;
        const cached = this.getFromCache<InteractionResult[]>(cacheKey);

        if (cached) {
            return {
                data: cached,
                cached: true,
                timestamp: new Date(),
                source: 'cache',
            };
        }

        try {
            // Get RxCUIs for all medications
            const rxcuiPromises = medications.map(med => rxnormService.getRxCui(med));
            const rxcuiResults = await Promise.all(rxcuiPromises);

            const validRxcuis: string[] = [];
            const medicationMap: Map<string, string> = new Map();

            rxcuiResults.forEach((rxcuis, index) => {
                if (rxcuis.length > 0) {
                    const rxcui = rxcuis[0];
                    if (rxcui) {
                        validRxcuis.push(rxcui);
                        medicationMap.set(rxcui, medications[index]!);
                    }
                }
            });

            if (validRxcuis.length < 2) {
                logger.warn('Insufficient valid RxCUIs for interaction check', {
                    medications,
                    validRxcuis: validRxcuis.length,
                });
                return {
                    data: [],
                    cached: false,
                    timestamp: new Date(),
                    source: 'api',
                };
            }

            // Check interactions
            const interactionData = await drugInteractionService.checkMultiDrugInteractions(validRxcuis);
            const formattedResults = drugInteractionService.formatInteractionResults(interactionData);

            // Enhance with additional clinical information
            const enhancedResults: InteractionResult[] = [];

            for (const result of formattedResults) {
                for (const interaction of result.interactions) {
                    const enhancedInteraction: InteractionResult = {
                        drugPair: {
                            drug1: result.drugName,
                            drug2: interaction.interactingDrug,
                            rxcui1: result.rxcui,
                            rxcui2: interaction.interactingRxcui,
                        },
                        severity: interaction.severity || 'minor',
                        description: interaction.description,
                        mechanism: await this.getInteractionMechanism(
                            result.rxcui || '',
                            interaction.interactingRxcui || ''
                        ),
                        clinicalEffects: this.extractClinicalEffects(interaction.description),
                        management: interaction.management ||
                            drugInteractionService.getManagementRecommendations(
                                interaction.severity || 'minor',
                                interaction.description
                            ),
                        source: interaction.source,
                        references: [], // Could be enhanced with literature references
                    };

                    enhancedResults.push(enhancedInteraction);
                }
            }

            this.setCache(cacheKey, enhancedResults);

            logger.info(`Drug interaction check completed`, {
                medications: medications.length,
                interactions: enhancedResults.length,
                severities: this.countBySeverity(enhancedResults),
            });

            return {
                data: enhancedResults,
                cached: false,
                timestamp: new Date(),
                source: 'api',
            };
        } catch (error) {
            logger.error('Drug interaction check failed:', error);
            throw new Error(`Failed to check drug interactions: ${error}`);
        }
    }

    /**
     * Check for drug allergies and cross-sensitivities
     */
    async checkDrugAllergies(
        medications: string[],
        knownAllergies: string[]
    ): Promise<ClinicalApiResponse<AllergyAlert[]>> {
        const cacheKey = `allergies_${medications.sort().join('_')}_${knownAllergies.sort().join('_')}`.toLowerCase();
        const cached = this.getFromCache<AllergyAlert[]>(cacheKey);

        if (cached) {
            return {
                data: cached,
                cached: true,
                timestamp: new Date(),
                source: 'cache',
            };
        }

        try {
            const alerts: AllergyAlert[] = [];

            for (const medication of medications) {
                for (const allergy of knownAllergies) {
                    const alert = await this.checkSingleDrugAllergy(medication, allergy);
                    if (alert) {
                        alerts.push(alert);
                    }
                }
            }

            this.setCache(cacheKey, alerts);

            logger.info(`Allergy check completed`, {
                medications: medications.length,
                allergies: knownAllergies.length,
                alerts: alerts.length,
            });

            return {
                data: alerts,
                cached: false,
                timestamp: new Date(),
                source: 'api',
            };
        } catch (error) {
            logger.error('Drug allergy check failed:', error);
            throw new Error(`Failed to check drug allergies: ${error}`);
        }
    }

    /**
     * Check for contraindications based on patient conditions
     */
    async checkContraindications(
        medications: string[],
        conditions: string[]
    ): Promise<ClinicalApiResponse<ContraindicationAlert[]>> {
        const cacheKey = `contraindications_${medications.sort().join('_')}_${conditions.sort().join('_')}`.toLowerCase();
        const cached = this.getFromCache<ContraindicationAlert[]>(cacheKey);

        if (cached) {
            return {
                data: cached,
                cached: true,
                timestamp: new Date(),
                source: 'cache',
            };
        }

        try {
            const alerts: ContraindicationAlert[] = [];

            for (const medication of medications) {
                const drugInfo = await this.getDrugInfo(medication);

                for (const condition of conditions) {
                    const alert = this.checkSingleContraindication(drugInfo.data, condition);
                    if (alert) {
                        alerts.push(alert);
                    }
                }
            }

            this.setCache(cacheKey, alerts);

            logger.info(`Contraindication check completed`, {
                medications: medications.length,
                conditions: conditions.length,
                alerts: alerts.length,
            });

            return {
                data: alerts,
                cached: false,
                timestamp: new Date(),
                source: 'api',
            };
        } catch (error) {
            logger.error('Contraindication check failed:', error);
            throw new Error(`Failed to check contraindications: ${error}`);
        }
    }

    /**
     * Search for drugs by name
     */
    async searchDrugs(drugName: string, limit: number = 20): Promise<ClinicalApiResponse<RxNormDrug[]>> {
        const cacheKey = `drug_search_${drugName.toLowerCase()}_${limit}`;
        const cached = this.getFromCache<RxNormDrug[]>(cacheKey);

        if (cached) {
            return {
                data: cached,
                cached: true,
                timestamp: new Date(),
                source: 'cache',
            };
        }

        try {
            const results = await rxnormService.searchDrugs(drugName, limit);
            this.setCache(cacheKey, results);

            return {
                data: results,
                cached: false,
                timestamp: new Date(),
                source: 'api',
            };
        } catch (error) {
            logger.error(`Failed to search for drug ${drugName}:`, error);
            throw new Error(`Failed to search for drug: ${error}`);
        }
    }

    /**
     * Get FDA drug information
     */
    private async getFDADrugInfo(drugName: string): Promise<any> {
        try {
            // Search FDA drug database
            const response = await this.openfdaClient.get('/label.json', {
                params: {
                    search: `openfda.brand_name:"${drugName}" OR openfda.generic_name:"${drugName}"`,
                    limit: 1,
                },
            });

            const results = response.data?.results;
            if (!results || results.length === 0) {
                return null;
            }

            const drugLabel = results[0];

            return {
                manufacturer: drugLabel.openfda?.manufacturer_name?.[0],
                therapeuticClass: drugLabel.openfda?.pharm_class_epc?.[0],
                pharmacologicalClass: drugLabel.openfda?.pharm_class_moa?.[0],
                indication: drugLabel.indications_and_usage?.[0],
                contraindications: drugLabel.contraindications || [],
                warnings: drugLabel.warnings || [],
                adverseEffects: drugLabel.adverse_reactions || [],
                dosing: {
                    adult: drugLabel.dosage_and_administration?.[0],
                    pediatric: drugLabel.pediatric_use?.[0],
                    renal: drugLabel.use_in_specific_populations?.[0],
                    hepatic: drugLabel.use_in_specific_populations?.[1],
                },
            };
        } catch (error) {
            logger.warn(`FDA drug info not found for ${drugName}:`, error);
            return null;
        }
    }

    /**
     * Extract brand names from related drugs
     */
    private extractBrandNames(relatedDrugs: RxNormDrug[]): string[] {
        return relatedDrugs
            .filter(drug => drug.tty === 'BN' || drug.tty === 'SBD')
            .map(drug => drug.name)
            .filter((name, index, array) => array.indexOf(name) === index);
    }

    /**
     * Extract generic names from related drugs
     */
    private extractGenericNames(relatedDrugs: RxNormDrug[]): string[] {
        return relatedDrugs
            .filter(drug => drug.tty === 'IN' || drug.tty === 'SCD')
            .map(drug => drug.name)
            .filter((name, index, array) => array.indexOf(name) === index);
    }

    /**
     * Get interaction mechanism (simplified implementation)
     */
    private async getInteractionMechanism(rxcui1: string, rxcui2: string): Promise<string | undefined> {
        // This would typically involve more sophisticated drug interaction databases
        // For now, return undefined - could be enhanced with DrugBank or other APIs
        return undefined;
    }

    /**
     * Extract clinical effects from interaction description
     */
    private extractClinicalEffects(description: string): string[] {
        const effects: string[] = [];
        const lowerDesc = description.toLowerCase();

        // Common clinical effects patterns
        const effectPatterns = [
            { pattern: /increased.*risk/g, effect: 'Increased risk' },
            { pattern: /decreased.*effectiveness/g, effect: 'Decreased effectiveness' },
            { pattern: /elevated.*levels/g, effect: 'Elevated drug levels' },
            { pattern: /reduced.*clearance/g, effect: 'Reduced clearance' },
            { pattern: /prolonged.*effect/g, effect: 'Prolonged effect' },
            { pattern: /enhanced.*toxicity/g, effect: 'Enhanced toxicity' },
        ];

        effectPatterns.forEach(({ pattern, effect }) => {
            if (pattern.test(lowerDesc)) {
                effects.push(effect);
            }
        });

        return effects.length > 0 ? effects : ['Monitor for interaction effects'];
    }

    /**
     * Check single drug allergy
     */
    private async checkSingleDrugAllergy(medication: string, allergy: string): Promise<AllergyAlert | null> {
        // Simplified allergy checking - in production, this would use comprehensive allergy databases
        const commonCrossSensitivities: Record<string, string[]> = {
            'penicillin': ['amoxicillin', 'ampicillin', 'cephalexin'],
            'sulfa': ['sulfamethoxazole', 'trimethoprim-sulfamethoxazole'],
            'aspirin': ['ibuprofen', 'naproxen', 'diclofenac'],
        };

        const lowerMedication = medication.toLowerCase();
        const lowerAllergy = allergy.toLowerCase();

        // Direct match
        if (lowerMedication.includes(lowerAllergy)) {
            return {
                allergen: allergy,
                medication: medication,
                alertType: 'allergy',
                severity: 'severe',
                description: `Direct allergy match: Patient is allergic to ${allergy}`,
                recommendations: ['Do not administer', 'Consider alternative medication'],
            };
        }

        // Cross-sensitivity check
        for (const [allergen, crossReactive] of Object.entries(commonCrossSensitivities)) {
            if (lowerAllergy.includes(allergen)) {
                for (const crossDrug of crossReactive) {
                    if (lowerMedication.includes(crossDrug)) {
                        return {
                            allergen: allergy,
                            medication: medication,
                            alertType: 'cross_sensitivity',
                            severity: 'moderate',
                            description: `Potential cross-sensitivity: ${medication} may cross-react with ${allergy}`,
                            recommendations: ['Use with caution', 'Monitor closely', 'Consider alternative if possible'],
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * Check single contraindication
     */
    private checkSingleContraindication(drugInfo: DrugInfo, condition: string): ContraindicationAlert | null {
        const lowerCondition = condition.toLowerCase();

        // Check contraindications
        for (const contraindication of drugInfo.contraindications) {
            if (contraindication.toLowerCase().includes(lowerCondition)) {
                return {
                    medication: drugInfo.name,
                    rxcui: drugInfo.rxcui,
                    condition: condition,
                    severity: 'absolute',
                    description: contraindication,
                    alternatives: [], // Could be enhanced with alternative suggestions
                };
            }
        }

        // Check warnings for relative contraindications
        for (const warning of drugInfo.warnings) {
            if (warning.toLowerCase().includes(lowerCondition)) {
                return {
                    medication: drugInfo.name,
                    rxcui: drugInfo.rxcui,
                    condition: condition,
                    severity: 'relative',
                    description: warning,
                    alternatives: [],
                };
            }
        }

        return null;
    }

    /**
     * Count interactions by severity
     */
    private countBySeverity(interactions: InteractionResult[]): Record<string, number> {
        return interactions.reduce((counts, interaction) => {
            counts[interaction.severity] = (counts[interaction.severity] || 0) + 1;
            return counts;
        }, {} as Record<string, number>);
    }

    /**
     * Cache management methods
     */
    private getFromCache<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt.getTime()) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    private setCache<T>(key: string, data: T): void {
        // Implement LRU eviction if cache is full
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }

        const entry: CacheEntry<T> = {
            data,
            timestamp: new Date(),
            expiresAt: new Date(Date.now() + this.cacheTimeout),
        };

        this.cache.set(key, entry);
    }

    private cleanExpiredCache(): void {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt.getTime()) {
                this.cache.delete(key);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.info(`Cleaned ${cleanedCount} expired cache entries`);
        }
    }

    /**
     * Clear all cache
     */
    clearCache(): void {
        this.cache.clear();
        logger.info('Clinical API cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
        hitRate?: number;
    } {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            // Hit rate would need to be tracked separately
        };
    }
}

export default new ClinicalApiService();