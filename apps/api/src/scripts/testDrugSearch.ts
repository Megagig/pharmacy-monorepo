/**
 * Test script for the Drug Information Center
 * This script tests the RxNorm search functionality directly
 */
import rxnormService from '../modules/drug-info/services/rxnormService';

async function testDrugSearch() {
  try {
    console.log('Testing RxNorm drug search service...');

    // Test with a known drug name
    const searchTerm = process.argv[2] || 'aspirin';
    console.log(`Searching for drug: ${searchTerm}`);

    const results = await rxnormService.searchDrugs(searchTerm);

    console.log('Search Results:');
    console.log(JSON.stringify(results, null, 2));

    // Extract and display concept groups
    if (results.drugGroup && results.drugGroup.conceptGroup) {
      const conceptGroups = results.drugGroup.conceptGroup;
      console.log(`Found ${conceptGroups.length} concept groups`);

      conceptGroups.forEach((group, index) => {
        if (group.conceptProperties) {
          console.log(
            `Group ${index + 1} (${group.tty}): ${
              group.conceptProperties.length
            } concepts`
          );
          group.conceptProperties.slice(0, 3).forEach((prop) => {
            console.log(`  - ${prop.name} (${prop.rxcui})`);
          });
          if (group.conceptProperties.length > 3) {
            console.log(
              `  - ... and ${group.conceptProperties.length - 3} more`
            );
          }
        }
      });
    } else {
      console.log('No concept groups found in response');
    }
  } catch (error) {
    console.error('Error testing drug search:', error);
  }
}

// Run the test
testDrugSearch();
