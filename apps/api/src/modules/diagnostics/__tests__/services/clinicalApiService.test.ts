import { ClinicalApiService, DrugInfo, InteractionResult, AllergyAlert, ContraindicationAlert } from '../../services/clinicalApiService';
import rxnormService from '../../../../services/rxnormService';
import drugInteractionService from '../../../../services/drugInteractionService';
import { ApiClient } from '../../../../utils/apiClient';
import logger from '../../../../utils/logger';

// Mock dependencies
jest.mock('../../../../services/rxnormService');
jest.mock('../../../../services/drugInteractionService');
jest.mock('../../../../utils/apiClient');
jest.mock('../../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const mockedRxnormService = rxnormService as jest.Mocked<typeof rxnormService>;
const mockedDrugInteractionService = drugInteractionService as jest.Mocked<typeof drugInteractionService>;
const mockedApiClient = ApiClient as jest.MockedClass<typeof ApiClient>;

describe('ClinicalApiService', () => {
    let service: ClinicalApiService;
    let mockRxnormClient: jest.Mocked<ApiClient>;
    let mockOpenfdaClient: jest.Mocked<ApiClient>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock ApiClient instances
        mockRxnormClient = {
            get: jest.fn(),
            post: jest.fn(),
        } as any;

        mockOpenfdaClient = {
            get: jest.fn(),
            post: jest.fn(),
        } as any;

        mockedApiClient.mockImplementation((config) => {
            if (config.baseURL?.includes('rxnav')) {
                return mockRxnormClient;
            }
            return mockOpenfdaClient;
        });

        service = new ClinicalApiService();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getDrugInfo', () => {
        const mockRxNormDrugs = [
            { rxcui: '123', name: 'Aspirin', tty: 'IN', synonym: 'acetylsalicylic acid' },
            { rxcui: '456', name: 'Bayer Aspirin', tty: 'BN', synonym: 'brand name' },
            { rxcui: '789', name: 'Aspirin 325mg', tty: 'SCD', synonym: 'clinical drug' },
        ];

        const mockDrugDetails = {
            properties: {
                strength: '325mg',
                dosage_form: 'tablet',
                route: 'oral',
            },
            ndcs: ['12345-678-90', '98765-432-10'],
        };

        const mockFDAResponse = {
            data: {
                results: [{
                    openfda: {
                        manufacturer_name: ['Bayer Healthcare'],
                        pharm_class_epc: ['Nonsteroidal Anti-inflammatory Drug'],
                        pharm_class_moa: ['Cyclooxygenase Inhibitors'],
                    },
                    indications_and_usage: ['Pain relief, fever reduction'],
                    contraindications: ['Active bleeding', 'Severe renal impairment'],
                    warnings: ['GI bleeding risk', 'Renal toxicity'],
                    adverse_reactions: ['Nausea', 'Headache', 'Dizziness'],
                    dosage_and_administration: ['325-650mg every 4-6 hours'],
                    pediatric_use: ['Not recommended under 12 years'],
                    use_in_specific_populations: ['Reduce dose in renal impairment', 'Avoid in severe hepatic impairment'],
                }],
            },
        };

        beforeEach(() => {
            mockedRxnormService.getRxCui.mockResolvedValue(['123']);
            mockedRxnormService.getDrugDetails.mockResolvedValue(mockDrugDetails);
            mockedRxnormService.getRelatedDrugs.mockResolvedValue(mockRxNormDrugs);
            mockOpenfdaClient.get.mockResolvedValue(mockFDAResponse);
        });

        it('should retrieve comprehensive drug information', async () => {
            const result = await service.getDrugInfo('aspirin');

            expect(result.data).toMatchObject({
                rxcui: '123',
                name: 'aspirin',
                brandNames: ['Bayer Aspirin'],
                genericNames: ['Aspirin', 'Aspirin 325mg'],
                strength: '325mg',
                dosageForm: 'tablet',
                route: 'oral',
                manufacturer: 'Bayer Healthcare',
                ndcs: ['12345-678-90', '98765-432-10'],
                therapeuticClass: 'Nonsteroidal Anti-inflammatory Drug',
                contraindications: ['Active bleeding', 'Severe renal impairment'],
                warnings: ['GI bleeding risk', 'Renal toxicity'],
            });

            expect(result.cached).toBe(false);
            expect(result.source).toBe('api');
            expect(mockedRxnormService.getRxCui).toHaveBeenCalledWith('aspirin');
            expect(mockOpenfdaClient.get).toHaveBeenCalledWith('/label.json', {
                params: {
                    search: 'openfda.brand_name:"aspirin" OR openfda.generic_name:"aspirin"',
                    limit: 1,
                },
            });
        });

        it('should return cached data on subsequent requests', async () => {
            // First request
            await service.getDrugInfo('aspirin');

            // Second request should return cached data
            const result = await service.getDrugInfo('aspirin');

            expect(result.cached).toBe(true);
            expect(result.source).toBe('cache');
            expect(mockedRxnormService.getRxCui).toHaveBeenCalledTimes(1); // Only called once
        });

        it('should handle drug not found in RxNorm', async () => {
            mockedRxnormService.getRxCui.mockResolvedValue([]);

            await expect(service.getDrugInfo('nonexistent-drug')).rejects.toThrow(
                'No RxCUI found for drug: nonexistent-drug'
            );
        });

        it('should handle FDA API errors gracefully', async () => {
            mockOpenfdaClient.get.mockRejectedValue(new Error('FDA API error'));

            const result = await service.getDrugInfo('aspirin');

            expect(result.data.manufacturer).toBeUndefined();
            expect(result.data.therapeuticClass).toBeUndefined();
            expect(logger.warn).toHaveBeenCalledWith(
                'FDA drug info not found for aspirin:',
                expect.any(Error)
            );
        });

        it('should handle RxNorm service errors', async () => {
            mockedRxnormService.getRxCui.mockRejectedValue(new Error('RxNorm error'));

            await expect(service.getDrugInfo('aspirin')).rejects.toThrow(
                'Failed to retrieve drug information: Error: RxNorm error'
            );
        });
    });

    describe('checkDrugInteractions', () => {
        const mockInteractionData = {
            interactions: [{
                interactionPairs: [{
                    interactionConcept: [
                        {
                            minConceptItem: { rxcui: '123', name: 'Aspirin', tty: 'IN' },
                            sourceConceptItem: { id: 'source1', name: 'DrugBank', url: 'http://drugbank.ca' },
                        },
                        {
                            minConceptItem: { rxcui: '456', name: 'Warfarin', tty: 'IN' },
                            sourceConceptItem: { id: 'source1', name: 'DrugBank', url: 'http://drugbank.ca' },
                        },
                    ],
                    severity: 'major',
                    description: 'Increased risk of bleeding when aspirin is combined with warfarin',
                }],
            }],
        };

        const mockFormattedResults = [{
            drugName: 'Aspirin',
            rxcui: '123',
            interactions: [{
                interactingDrug: 'Warfarin',
                interactingRxcui: '456',
                severity: 'major' as const,
                description: 'Increased risk of bleeding when aspirin is combined with warfarin',
                source: 'DrugBank',
                management: 'Monitor closely. Consider dose adjustment or alternative therapy.',
            }],
        }];

        beforeEach(() => {
            mockedRxnormService.getRxCui
                .mockResolvedValueOnce(['123']) // aspirin
                .mockResolvedValueOnce(['456']); // warfarin

            mockedDrugInteractionService.checkMultiDrugInteractions.mockResolvedValue(mockInteractionData);
            mockedDrugInteractionService.formatInteractionResults.mockReturnValue(mockFormattedResults);
            mockedDrugInteractionService.getManagementRecommendations.mockReturnValue(
                'Monitor closely. Consider dose adjustment or alternative therapy.'
            );
        });

        it('should check drug interactions successfully', async () => {
            const result = await service.checkDrugInteractions(['aspirin', 'warfarin']);

            expect(result.data).toHaveLength(1);
            expect(result.data[0]).toMatchObject({
                drugPair: {
                    drug1: 'Aspirin',
                    drug2: 'Warfarin',
                    rxcui1: '123',
                    rxcui2: '456',
                },
                severity: 'major',
                description: 'Increased risk of bleeding when aspirin is combined with warfarin',
                management: 'Monitor closely. Consider dose adjustment or alternative therapy.',
                source: 'DrugBank',
            });

            expect(result.cached).toBe(false);
            expect(mockedDrugInteractionService.checkMultiDrugInteractions).toHaveBeenCalledWith(['123', '456']);
        });

        it('should return empty array for single medication', async () => {
            const result = await service.checkDrugInteractions(['aspirin']);

            expect(result.data).toEqual([]);
            expect(result.cached).toBe(false);
        });

        it('should handle medications without valid RxCUIs', async () => {
            mockedRxnormService.getRxCui
                .mockResolvedValueOnce([]) // no rxcui for first drug
                .mockResolvedValueOnce(['456']); // valid rxcui for second drug

            const result = await service.checkDrugInteractions(['unknown-drug', 'warfarin']);

            expect(result.data).toEqual([]);
            expect(logger.warn).toHaveBeenCalledWith(
                'Insufficient valid RxCUIs for interaction check',
                expect.objectContaining({
                    medications: ['unknown-drug', 'warfarin'],
                    validRxcuis: 1,
                })
            );
        });

        it('should cache interaction results', async () => {
            // First request
            await service.checkDrugInteractions(['aspirin', 'warfarin']);

            // Second request should return cached data
            const result = await service.checkDrugInteractions(['aspirin', 'warfarin']);

            expect(result.cached).toBe(true);
            expect(result.source).toBe('cache');
            expect(mockedDrugInteractionService.checkMultiDrugInteractions).toHaveBeenCalledTimes(1);
        });

        it('should handle drug interaction service errors', async () => {
            mockedDrugInteractionService.checkMultiDrugInteractions.mockRejectedValue(
                new Error('Interaction service error')
            );

            await expect(service.checkDrugInteractions(['aspirin', 'warfarin'])).rejects.toThrow(
                'Failed to check drug interactions: Error: Interaction service error'
            );
        });
    });

    describe('checkDrugAllergies', () => {
        it('should detect direct allergy matches', async () => {
            const result = await service.checkDrugAllergies(['penicillin'], ['penicillin']);

            expect(result.data).toHaveLength(1);
            expect(result.data[0]).toMatchObject({
                allergen: 'penicillin',
                medication: 'penicillin',
                alertType: 'allergy',
                severity: 'severe',
                description: 'Direct allergy match: Patient is allergic to penicillin',
                recommendations: ['Do not administer', 'Consider alternative medication'],
            });
        });

        it('should detect cross-sensitivities', async () => {
            const result = await service.checkDrugAllergies(['amoxicillin'], ['penicillin']);

            expect(result.data).toHaveLength(1);
            expect(result.data[0]).toMatchObject({
                allergen: 'penicillin',
                medication: 'amoxicillin',
                alertType: 'cross_sensitivity',
                severity: 'moderate',
                description: 'Potential cross-sensitivity: amoxicillin may cross-react with penicillin',
                recommendations: ['Use with caution', 'Monitor closely', 'Consider alternative if possible'],
            });
        });

        it('should return empty array when no allergies detected', async () => {
            const result = await service.checkDrugAllergies(['aspirin'], ['penicillin']);

            expect(result.data).toEqual([]);
        });

        it('should cache allergy check results', async () => {
            // First request
            await service.checkDrugAllergies(['penicillin'], ['penicillin']);

            // Second request should return cached data
            const result = await service.checkDrugAllergies(['penicillin'], ['penicillin']);

            expect(result.cached).toBe(true);
            expect(result.source).toBe('cache');
        });
    });

    describe('checkContraindications', () => {
        const mockDrugInfo = {
            data: {
                rxcui: '123',
                name: 'aspirin',
                brandNames: [],
                genericNames: [],
                ndcs: [],
                contraindications: ['Active bleeding', 'Severe renal impairment'],
                warnings: ['Use caution in patients with asthma'],
                adverseEffects: [],
            } as DrugInfo,
            cached: false,
            timestamp: new Date(),
            source: 'api' as const,
        };

        beforeEach(() => {
            // Mock getDrugInfo method
            jest.spyOn(service, 'getDrugInfo').mockResolvedValue(mockDrugInfo);
        });

        it('should detect absolute contraindications', async () => {
            const result = await service.checkContraindications(['aspirin'], ['active bleeding']);

            expect(result.data).toHaveLength(1);
            expect(result.data[0]).toMatchObject({
                medication: 'aspirin',
                rxcui: '123',
                condition: 'active bleeding',
                severity: 'absolute',
                description: 'Active bleeding',
            });
        });

        it('should detect relative contraindications from warnings', async () => {
            const result = await service.checkContraindications(['aspirin'], ['asthma']);

            expect(result.data).toHaveLength(1);
            expect(result.data[0]).toMatchObject({
                medication: 'aspirin',
                condition: 'asthma',
                severity: 'relative',
                description: 'Use caution in patients with asthma',
            });
        });

        it('should return empty array when no contraindications found', async () => {
            const result = await service.checkContraindications(['aspirin'], ['diabetes']);

            expect(result.data).toEqual([]);
        });

        it('should cache contraindication results', async () => {
            // First request
            await service.checkContraindications(['aspirin'], ['active bleeding']);

            // Second request should return cached data
            const result = await service.checkContraindications(['aspirin'], ['active bleeding']);

            expect(result.cached).toBe(true);
            expect(result.source).toBe('cache');
        });
    });

    describe('cache management', () => {
        it('should clear cache when requested', () => {
            service.clearCache();
            expect(logger.info).toHaveBeenCalledWith('Clinical API cache cleared');
        });

        it('should return cache statistics', () => {
            const stats = service.getCacheStats();

            expect(stats).toHaveProperty('size');
            expect(stats).toHaveProperty('maxSize');
            expect(typeof stats.size).toBe('number');
            expect(typeof stats.maxSize).toBe('number');
        });

        it('should handle cache expiration', async () => {
            // Mock short cache timeout for testing
            const originalTimeout = (service as any).cacheTimeout;
            (service as any).cacheTimeout = 1; // 1ms timeout

            mockedRxnormService.getRxCui.mockResolvedValue(['123']);
            mockedRxnormService.getDrugDetails.mockResolvedValue({
                properties: {},
                ndcs: [],
            });
            mockedRxnormService.getRelatedDrugs.mockResolvedValue([]);
            mockOpenfdaClient.get.mockResolvedValue({ data: { results: [] } });

            // First request
            await service.getDrugInfo('test-drug');

            // Wait for cache to expire
            await new Promise(resolve => setTimeout(resolve, 10));

            // Second request should not be cached
            const result = await service.getDrugInfo('test-drug');

            expect(result.cached).toBe(false);
            expect(mockedRxnormService.getRxCui).toHaveBeenCalledTimes(2);

            // Restore original timeout
            (service as any).cacheTimeout = originalTimeout;
        });
    });

    describe('error handling', () => {
        it('should handle network errors gracefully', async () => {
            mockedRxnormService.getRxCui.mockRejectedValue(new Error('Network error'));

            await expect(service.getDrugInfo('aspirin')).rejects.toThrow(
                'Failed to retrieve drug information: Error: Network error'
            );

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to get drug info for aspirin:',
                expect.any(Error)
            );
        });

        it('should handle malformed API responses', async () => {
            mockedRxnormService.getRxCui.mockResolvedValue(['123']);
            mockedRxnormService.getDrugDetails.mockResolvedValue(null as any);
            mockedRxnormService.getRelatedDrugs.mockResolvedValue([]);

            await expect(service.getDrugInfo('aspirin')).rejects.toThrow();
        });
    });

    describe('clinical effects extraction', () => {
        it('should extract clinical effects from interaction descriptions', async () => {
            const mockInteractionData = {
                interactions: [{
                    interactionPairs: [{
                        interactionConcept: [
                            {
                                minConceptItem: { rxcui: '123', name: 'Drug A', tty: 'IN' },
                                sourceConceptItem: { id: 'source1', name: 'DrugBank' },
                            },
                            {
                                minConceptItem: { rxcui: '456', name: 'Drug B', tty: 'IN' },
                                sourceConceptItem: { id: 'source1', name: 'DrugBank' },
                            },
                        ],
                        description: 'Increased risk of bleeding and elevated drug levels',
                    }],
                }],
            };

            mockedRxnormService.getRxCui
                .mockResolvedValueOnce(['123'])
                .mockResolvedValueOnce(['456']);

            mockedDrugInteractionService.checkMultiDrugInteractions.mockResolvedValue(mockInteractionData);
            mockedDrugInteractionService.formatInteractionResults.mockReturnValue([{
                drugName: 'Drug A',
                rxcui: '123',
                interactions: [{
                    interactingDrug: 'Drug B',
                    interactingRxcui: '456',
                    severity: 'major' as const,
                    description: 'Increased risk of bleeding and elevated drug levels',
                    source: 'DrugBank',
                }],
            }]);

            const result = await service.checkDrugInteractions(['Drug A', 'Drug B']);

            expect(result.data[0].clinicalEffects).toContain('Increased risk');
            expect(result.data[0].clinicalEffects).toContain('Elevated drug levels');
        });
    });
});