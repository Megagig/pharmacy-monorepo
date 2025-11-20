import rxnormService from '../services/rxnormService';
import dailymedService from '../services/dailymedService';
import openfdaService from '../services/openfdaService';
import interactionService from '../services/interactionService';

describe('Drug Information Services', () => {
  // Test RxNorm Service
  describe('RxNorm Service', () => {
    test('should search drugs by name', async () => {
      const results = await rxnormService.searchDrugs('aspirin');
      expect(results).toHaveProperty('drugGroup');
      expect(results.drugGroup).toHaveProperty('name', 'aspirin');
    }, 10000);

    test('should get RxCUI by name', async () => {
      const results = await rxnormService.getRxCuiByName('aspirin');
      expect(results).toHaveProperty('idGroup');
      expect(results.idGroup).toHaveProperty('name', 'aspirin');
    }, 10000);

    test('should get therapeutic equivalents', async () => {
      // Using a known RxCUI for testing
      const results = await rxnormService.getTherapeuticEquivalents('1191');
      expect(results).toHaveProperty('relatedGroup');
    }, 10000);
  });

  // Test DailyMed Service
  describe('DailyMed Service', () => {
    test('should search monographs by drug name', async () => {
      const results = await dailymedService.searchMonographs('aspirin');
      expect(results).toHaveProperty('metadata');
    }, 10000);

    test('should get monograph by set ID', async () => {
      // This test requires a valid set ID which we can get from the search
      const searchResults = await dailymedService.searchMonographs('aspirin');
      if (searchResults && searchResults.results && searchResults.results.length > 0) {
        const setId = searchResults.results[0].setid;
        const results = await dailymedService.getMonographById(setId);
        expect(results).toHaveProperty('SPL');
      }
    }, 15000);
  });

  // Test OpenFDA Service
  describe('OpenFDA Service', () => {
    test('should get adverse effects', async () => {
      const results = await openfdaService.getAdverseEffects('aspirin', 5);
      expect(results).toHaveProperty('results');
    }, 10000);

    test('should get drug labeling', async () => {
      const results = await openfdaService.getDrugLabeling('aspirin');
      expect(results).toHaveProperty('results');
    }, 10000);
  });

  // Test Interaction Service
  describe('Interaction Service', () => {
    test('should get interactions for single drug', async () => {
      const results = await interactionService.getInteractionsForDrug('1191');
      expect(results).toHaveProperty('interactionTypeGroup');
    }, 10000);

    test('should get interactions for multiple drugs', async () => {
      const results = await interactionService.getInteractionsForMultipleDrugs(['1191', '341248']);
      expect(results).toHaveProperty('fullInteractionTypeGroup');
    }, 10000);
  });
});