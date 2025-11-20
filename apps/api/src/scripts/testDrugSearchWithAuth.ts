import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://localhost:5000';
const DRUG_NAME = 'aspirin';

async function testDrugSearch() {
  try {
    // First attempt to login and get authentication
    const loginResponse = await axios.post(
      `${API_URL}/api/users/login`,
      {
        email: process.env.TEST_USER_EMAIL || 'admin@example.com',
        password: process.env.TEST_USER_PASSWORD || 'password123',
      },
      {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Login response status:', loginResponse.status);

    // Get cookies from the login response
    const cookies = loginResponse.headers['set-cookie'];
    console.log('Cookies received:', cookies);

    // Now make the drug search request with the cookies
    const searchResponse = await axios.get(`${API_URL}/api/drugs/search`, {
      params: { name: DRUG_NAME },
      withCredentials: true,
      headers: {
        Cookie: cookies,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Drug search results for "${DRUG_NAME}":`);

    const data = searchResponse.data;

    if (data.success) {
      const drugGroups = data.data?.drugGroup?.conceptGroup || [];

      console.log(`Found ${drugGroups.length} concept groups`);

      drugGroups.forEach((group: any, i: number) => {
        const concepts = group.conceptProperties || [];
        console.log(
          `Group ${i + 1} (${group.tty}): ${concepts.length} concepts`
        );

        // Show first 3 concepts as a sample
        concepts.slice(0, 3).forEach((concept: any) => {
          console.log(`  - ${concept.name} (${concept.rxcui})`);
        });

        if (concepts.length > 3) {
          console.log(`  - ... and ${concepts.length - 3} more`);
        }
      });
    } else {
      console.log('API returned error:', data.error);
    }
  } catch (error) {
    console.error('Error making API request:');
    if (axios.isAxiosError(error)) {
      console.error('Status:', error.response?.status);
      console.error('Response data:', error.response?.data);
    } else {
      console.error(error);
    }
  }
}

testDrugSearch();
