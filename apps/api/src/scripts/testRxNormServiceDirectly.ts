import rxnormService from '../modules/drug-info/services/rxnormService';

async function testDirectlyWithRxNormService() {
  try {
    console.log('Testing RxNorm service directly for "aspirin"');
    const results = await rxnormService.searchDrugs('aspirin');

    if (results && results.drugGroup && results.drugGroup.conceptGroup) {
      console.log(
        `Found ${results.drugGroup.conceptGroup.length} concept groups`
      );

      results.drugGroup.conceptGroup.forEach((group: any, index: number) => {
        console.log(
          `Group ${index + 1} (${group.tty}): ${
            group.conceptProperties?.length || 0
          } concepts`
        );

        if (group.conceptProperties && group.conceptProperties.length > 0) {
          // Display first 3 drugs as example
          group.conceptProperties.slice(0, 3).forEach((drug: any) => {
            console.log(`  - ${drug.name} (${drug.rxcui})`);
          });

          if (group.conceptProperties.length > 3) {
            console.log(
              `  - ... and ${group.conceptProperties.length - 3} more`
            );
          }
        }
      });
    } else {
      console.log('No results or invalid structure received');
      console.log('Raw results:', JSON.stringify(results, null, 2));
    }
  } catch (error) {
    console.error('Error calling RxNorm service directly:', error);
  }
}

// Run the test
testDirectlyWithRxNormService();
