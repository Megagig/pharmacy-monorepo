import SubscriptionPlan from '../../models/SubscriptionPlan';
import PlanSeeder from '../../utils/planSeeder';

describe('PlanSeeder', () => {
    let seeder: PlanSeeder;

    beforeEach(async () => {
        // Clear database before each test
        await SubscriptionPlan.deleteMany({});
        seeder = new PlanSeeder();
    });

    describe('validateConfiguration', () => {
        it('should validate configuration successfully', async () => {
            const isValid = await seeder.validateConfiguration();
            expect(isValid).toBe(true);
        });
    });

    describe('seedPlans', () => {
        it('should seed plans from configuration', async () => {
            // Verify no plans exist initially
            const initialCount = await SubscriptionPlan.countDocuments();
            expect(initialCount).toBe(0);

            // Seed plans
            await seeder.seedPlans();

            // Verify plans were created
            const finalCount = await SubscriptionPlan.countDocuments();
            expect(finalCount).toBeGreaterThan(0);

            // Verify specific plans exist
            const freeTrial = await SubscriptionPlan.findOne({ tier: 'free_trial' });
            expect(freeTrial).toBeTruthy();
            expect(freeTrial?.name).toBe('Free Trial');
            expect(freeTrial?.isActive).toBe(true);
        });

        it('should update existing plans when seeding again', async () => {
            // First seeding
            await seeder.seedPlans();
            const initialCount = await SubscriptionPlan.countDocuments();

            // Second seeding should not create duplicates
            await seeder.seedPlans();
            const finalCount = await SubscriptionPlan.countDocuments();

            expect(finalCount).toBe(initialCount);
        });
    });

    describe('getSeedingStats', () => {
        it('should return correct statistics', async () => {
            // Get stats before seeding
            const statsBefore = await seeder.getSeedingStats();
            expect(statsBefore.totalPlansInDatabase).toBe(0);
            expect(statsBefore.activePlansInDatabase).toBe(0);
            expect(statsBefore.totalPlansInConfig).toBeGreaterThan(0);

            // Seed plans
            await seeder.seedPlans();

            // Get stats after seeding
            const statsAfter = await seeder.getSeedingStats();
            expect(statsAfter.totalPlansInDatabase).toBeGreaterThan(0);
            expect(statsAfter.activePlansInDatabase).toBeGreaterThan(0);
            expect(statsAfter.totalPlansInConfig).toBe(statsAfter.activePlansInDatabase);
        });
    });
});