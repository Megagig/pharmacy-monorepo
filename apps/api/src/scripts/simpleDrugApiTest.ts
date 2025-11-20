/**
 * Simple Drug API Test
 */
import axios from 'axios';

async function testDrugAPI() {
  try {
    // Test with and without auth
    console.log('Testing drug search API...');

    // Try with auth token if available
    try {
      const response = await axios.get(
        'http://localhost:5000/api/drugs/search',
        {
          params: { name: 'aspirin' },
          withCredentials: true,
        }
      );

      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));

      // Check if the response has the expected structure
      const drugGroup =
        response.data?.data?.drugGroup || response.data?.drugGroup;
      if (drugGroup) {
        console.log('✅ Received valid drug data with drug group');

        // Count results
        const conceptGroups = drugGroup.conceptGroup || [];
        let totalConcepts = 0;
        conceptGroups.forEach((group: any) => {
          const conceptCount = group.conceptProperties?.length || 0;
          totalConcepts += conceptCount;
          console.log(
            `- Group ${group.tty || 'unknown'}: ${conceptCount} concepts`
          );
        });

        console.log(`Total drug concepts found: ${totalConcepts}`);
      } else {
        console.log('❌ Invalid response format - missing drugGroup');
      }
    } catch (error: any) {
      console.error('Error calling API:', error.message);
      if (error.response) {
        console.log('Error response status:', error.response.status);
        console.log('Error data:', error.response.data);
      }
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testDrugAPI();
