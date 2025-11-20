import ClinicalInterventionService from '../../services/clinicalInterventionService';

describe('Strategy Recommendation Engine', () => {
    describe('getRecommendedStrategies', () => {
        it('should return strategies for drug therapy problem category', () => {
            const strategies = ClinicalInterventionService.getRecommendedStrategies('drug_therapy_problem');

            expect(strategies).toBeDefined();
            expect(strategies.length).toBeGreaterThan(0);
            expect(strategies[0]).toHaveProperty('type');
            expect(strategies[0]).toHaveProperty('label');
            expect(strategies[0]).toHaveProperty('description');
            expect(strategies[0]).toHaveProperty('rationale');
            expect(strategies[0]).toHaveProperty('expectedOutcome');
            expect(strategies[0]).toHaveProperty('priority');
            expect(strategies[0]).toHaveProperty('applicableCategories');
        });

        it('should return strategies for adverse drug reaction category', () => {
            const strategies = ClinicalInterventionService.getRecommendedStrategies('adverse_drug_reaction');

            expect(strategies).toBeDefined();
            expect(strategies.length).toBeGreaterThan(0);

            // Should include discontinuation as primary strategy
            const discontinuation = strategies.find(s => s.type === 'discontinuation');
            expect(discontinuation).toBeDefined();
            expect(discontinuation?.priority).toBe('primary');
        });

        it('should return strategies for medication nonadherence category', () => {
            const strategies = ClinicalInterventionService.getRecommendedStrategies('medication_nonadherence');

            expect(strategies).toBeDefined();
            expect(strategies.length).toBeGreaterThan(0);

            // Should include patient counseling as primary strategy
            const counseling = strategies.find(s => s.type === 'patient_counseling');
            expect(counseling).toBeDefined();
            expect(counseling?.priority).toBe('primary');
        });

        it('should return strategies for drug interaction category', () => {
            const strategies = ClinicalInterventionService.getRecommendedStrategies('drug_interaction');

            expect(strategies).toBeDefined();
            expect(strategies.length).toBeGreaterThan(0);

            // Should include medication review as primary strategy
            const review = strategies.find(s => s.type === 'medication_review');
            expect(review).toBeDefined();
            expect(review?.priority).toBe('primary');
        });

        it('should return strategies for dosing issue category', () => {
            const strategies = ClinicalInterventionService.getRecommendedStrategies('dosing_issue');

            expect(strategies).toBeDefined();
            expect(strategies.length).toBeGreaterThan(0);

            // Should include dose adjustment as primary strategy
            const doseAdjustment = strategies.find(s => s.type === 'dose_adjustment');
            expect(doseAdjustment).toBeDefined();
            expect(doseAdjustment?.priority).toBe('primary');
        });

        it('should return strategies for contraindication category', () => {
            const strategies = ClinicalInterventionService.getRecommendedStrategies('contraindication');

            expect(strategies).toBeDefined();
            expect(strategies.length).toBeGreaterThan(0);

            // Should include discontinuation as primary strategy
            const discontinuation = strategies.find(s => s.type === 'discontinuation');
            expect(discontinuation).toBeDefined();
            expect(discontinuation?.priority).toBe('primary');
        });

        it('should return default strategies for unknown category', () => {
            const strategies = ClinicalInterventionService.getRecommendedStrategies('unknown_category');

            expect(strategies).toBeDefined();
            expect(strategies.length).toBeGreaterThan(0);

            // Should return 'other' category strategies
            const customStrategy = strategies.find(s => s.type === 'custom');
            expect(customStrategy).toBeDefined();
        });

        it('should sort strategies by priority (primary first)', () => {
            const strategies = ClinicalInterventionService.getRecommendedStrategies('drug_therapy_problem');

            const primaryStrategies = strategies.filter(s => s.priority === 'primary');
            const secondaryStrategies = strategies.filter(s => s.priority === 'secondary');

            // Primary strategies should come first
            if (primaryStrategies.length > 0 && secondaryStrategies.length > 0) {
                const firstPrimaryIndex = strategies.findIndex(s => s.priority === 'primary');
                const firstSecondaryIndex = strategies.findIndex(s => s.priority === 'secondary');
                expect(firstPrimaryIndex).toBeLessThan(firstSecondaryIndex);
            }
        });
    });

    describe('getAllStrategies', () => {
        it('should return all unique strategies across categories', () => {
            const allStrategies = ClinicalInterventionService.getAllStrategies();

            expect(allStrategies).toBeDefined();
            expect(allStrategies.length).toBeGreaterThan(0);

            // Check for uniqueness by type
            const types = allStrategies.map(s => s.type);
            const uniqueTypes = [...new Set(types)];
            expect(types.length).toBe(uniqueTypes.length);
        });

        it('should include all expected strategy types', () => {
            const allStrategies = ClinicalInterventionService.getAllStrategies();
            const types = allStrategies.map(s => s.type);

            const expectedTypes = [
                'medication_review',
                'dose_adjustment',
                'alternative_therapy',
                'discontinuation',
                'additional_monitoring',
                'patient_counseling',
                'physician_consultation',
                'custom'
            ];

            expectedTypes.forEach(type => {
                expect(types).toContain(type);
            });
        });

        it('should sort strategies alphabetically by label', () => {
            const allStrategies = ClinicalInterventionService.getAllStrategies();

            for (let i = 1; i < allStrategies.length; i++) {
                const current = allStrategies[i];
                const previous = allStrategies[i - 1];
                if (current && previous) {
                    expect(current.label.localeCompare(previous.label)).toBeGreaterThanOrEqual(0);
                }
            }
        });
    });

    describe('getStrategiesForCategories', () => {
        it('should return strategies applicable to multiple categories', () => {
            const categories = ['drug_therapy_problem', 'adverse_drug_reaction'];
            const strategies = ClinicalInterventionService.getStrategiesForCategories(categories);

            expect(strategies).toBeDefined();
            expect(strategies.length).toBeGreaterThan(0);

            // Each strategy should be applicable to at least one of the categories
            strategies.forEach(strategy => {
                const isApplicable = categories.some(category =>
                    strategy.applicableCategories.includes(category)
                );
                expect(isApplicable).toBe(true);
            });
        });

        it('should not return duplicate strategies', () => {
            const categories = ['drug_therapy_problem', 'dosing_issue'];
            const strategies = ClinicalInterventionService.getStrategiesForCategories(categories);

            const types = strategies.map(s => s.type);
            const uniqueTypes = [...new Set(types)];
            expect(types.length).toBe(uniqueTypes.length);
        });

        it('should handle empty categories array', () => {
            const strategies = ClinicalInterventionService.getStrategiesForCategories([]);
            expect(strategies).toEqual([]);
        });
    });

    describe('validateCustomStrategy', () => {
        it('should validate correct custom strategy', () => {
            const validStrategy = {
                type: 'custom' as const,
                description: 'This is a valid custom strategy description',
                rationale: 'This is a valid rationale for the custom strategy',
                expectedOutcome: 'This is a valid expected outcome that is long enough',
                priority: 'primary' as const
            };

            const result = ClinicalInterventionService.validateCustomStrategy(validStrategy);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject strategy with wrong type', () => {
            const invalidStrategy = {
                type: 'medication_review' as const,
                description: 'This is a valid description',
                rationale: 'This is a valid rationale',
                expectedOutcome: 'This is a valid expected outcome',
                priority: 'primary' as const
            };

            const result = ClinicalInterventionService.validateCustomStrategy(invalidStrategy);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Custom strategy must have type "custom"');
        });

        it('should reject strategy with short description', () => {
            const invalidStrategy = {
                type: 'custom' as const,
                description: 'Short',
                rationale: 'This is a valid rationale',
                expectedOutcome: 'This is a valid expected outcome',
                priority: 'primary' as const
            };

            const result = ClinicalInterventionService.validateCustomStrategy(invalidStrategy);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Strategy description must be at least 10 characters');
        });

        it('should reject strategy with short rationale', () => {
            const invalidStrategy = {
                type: 'custom' as const,
                description: 'This is a valid description',
                rationale: 'Short',
                expectedOutcome: 'This is a valid expected outcome',
                priority: 'primary' as const
            };

            const result = ClinicalInterventionService.validateCustomStrategy(invalidStrategy);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Strategy rationale must be at least 10 characters');
        });

        it('should reject strategy with short expected outcome', () => {
            const invalidStrategy = {
                type: 'custom' as const,
                description: 'This is a valid description',
                rationale: 'This is a valid rationale',
                expectedOutcome: 'Short',
                priority: 'primary' as const
            };

            const result = ClinicalInterventionService.validateCustomStrategy(invalidStrategy);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Expected outcome must be at least 20 characters');
        });

        it('should reject strategy with too long fields', () => {
            const longText = 'a'.repeat(501);
            const invalidStrategy = {
                type: 'custom' as const,
                description: longText,
                rationale: longText,
                expectedOutcome: longText,
                priority: 'primary' as const
            };

            const result = ClinicalInterventionService.validateCustomStrategy(invalidStrategy);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Strategy description cannot exceed 500 characters');
            expect(result.errors).toContain('Strategy rationale cannot exceed 500 characters');
            expect(result.errors).toContain('Expected outcome cannot exceed 500 characters');
        });

        it('should handle missing fields', () => {
            const invalidStrategy = {};

            const result = ClinicalInterventionService.validateCustomStrategy(invalidStrategy);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('generateRecommendations', () => {
        it('should generate recommendations for high priority intervention', () => {
            const recommendations = ClinicalInterventionService.generateRecommendations(
                'drug_therapy_problem',
                'high',
                'Patient experiencing severe side effects'
            );

            expect(recommendations).toBeDefined();
            expect(recommendations.length).toBeGreaterThan(0);
            expect(recommendations.length).toBeLessThanOrEqual(4);

            // For high priority, should focus on primary strategies
            recommendations.forEach(rec => {
                expect(rec.priority).toBe('primary');
            });
        });

        it('should generate recommendations for low priority intervention', () => {
            const recommendations = ClinicalInterventionService.generateRecommendations(
                'drug_therapy_problem',
                'low',
                'Minor medication optimization needed'
            );

            expect(recommendations).toBeDefined();
            expect(recommendations.length).toBeGreaterThan(0);
            expect(recommendations.length).toBeLessThanOrEqual(4);
        });

        it('should consider patient factors in recommendations', () => {
            const patientFactors = {
                age: 75,
                conditions: ['diabetes', 'hypertension'],
                allergies: ['penicillin'],
                currentMedications: ['metformin', 'lisinopril', 'atorvastatin', 'aspirin', 'metoprolol', 'furosemide']
            };

            const recommendations = ClinicalInterventionService.generateRecommendations(
                'drug_therapy_problem',
                'medium',
                'Complex medication regimen needs review',
                patientFactors
            );

            expect(recommendations).toBeDefined();
            expect(recommendations.length).toBeGreaterThan(0);
        });

        it('should prioritize counseling for adherence issues', () => {
            const recommendations = ClinicalInterventionService.generateRecommendations(
                'medication_nonadherence',
                'medium',
                'Patient has poor adherence to medications'
            );

            expect(recommendations).toBeDefined();

            const counselingRec = recommendations.find(r => r.type === 'patient_counseling');
            expect(counselingRec).toBeDefined();
        });

        it('should limit recommendations to 4 items', () => {
            const recommendations = ClinicalInterventionService.generateRecommendations(
                'other',
                'low',
                'General medication issue'
            );

            expect(recommendations.length).toBeLessThanOrEqual(4);
        });
    });

    describe('getStrategyByType', () => {
        it('should return strategy for valid type', () => {
            const strategy = ClinicalInterventionService.getStrategyByType('medication_review');

            expect(strategy).toBeDefined();
            expect(strategy?.type).toBe('medication_review');
            expect(strategy?.label).toBeDefined();
            expect(strategy?.description).toBeDefined();
        });

        it('should return null for invalid type', () => {
            const strategy = ClinicalInterventionService.getStrategyByType('invalid_type');

            expect(strategy).toBeNull();
        });

        it('should return strategy for all valid types', () => {
            const validTypes = [
                'medication_review',
                'dose_adjustment',
                'alternative_therapy',
                'discontinuation',
                'additional_monitoring',
                'patient_counseling',
                'physician_consultation',
                'custom'
            ];

            validTypes.forEach(type => {
                const strategy = ClinicalInterventionService.getStrategyByType(type);
                expect(strategy).toBeDefined();
                expect(strategy?.type).toBe(type);
            });
        });
    });

    describe('Strategy Content Quality', () => {
        it('should have meaningful content for all strategies', () => {
            const allStrategies = ClinicalInterventionService.getAllStrategies();

            allStrategies.forEach(strategy => {
                expect(strategy.label.length).toBeGreaterThan(5);
                expect(strategy.description.length).toBeGreaterThan(10);
                expect(strategy.rationale.length).toBeGreaterThan(10);
                expect(strategy.expectedOutcome.length).toBeGreaterThan(10);
                expect(['primary', 'secondary']).toContain(strategy.priority);
                expect(strategy.applicableCategories.length).toBeGreaterThan(0);
            });
        });

        it('should have consistent strategy types across categories', () => {
            const allStrategies = ClinicalInterventionService.getAllStrategies();
            const strategyTypes = allStrategies.map(s => s.type);

            // Check that each type appears in at least one category's applicable categories
            strategyTypes.forEach(type => {
                const strategy = allStrategies.find(s => s.type === type);
                expect(strategy?.applicableCategories.length).toBeGreaterThan(0);
            });
        });
    });
});