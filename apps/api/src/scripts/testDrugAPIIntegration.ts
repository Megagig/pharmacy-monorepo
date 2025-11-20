/**
 * Drug Information Center API Integration Test
 * This script simulates the full API request/response chain
 */
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import bodyParser from 'body-parser';

// Mock drug data for testing
const mockDrugData = {
  success: true,
  data: {
    drugGroup: {
      name: 'aspirin',
      conceptGroup: [
        {
          tty: 'SCD',
          conceptProperties: [
            {
              rxcui: '123456',
              name: 'Aspirin 81mg Tablet',
              synonym: 'ASA 81mg',
              tty: 'SCD',
              language: 'ENG',
              suppress: 'N',
              umlscui: 'C123456',
            },
            {
              rxcui: '234567',
              name: 'Aspirin 325mg Tablet',
              synonym: 'ASA 325mg',
              tty: 'SCD',
              language: 'ENG',
              suppress: 'N',
              umlscui: 'C234567',
            },
          ],
        },
      ],
    },
  },
};

// Create test server
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Mock drug search endpoint
app.get('/api/drugs/search', (req, res) => {
  const { name } = req.query;
  if (!name) {
    return res
      .status(400)
      .json({ success: false, error: 'Drug name is required' });
  }

  console.log(`Received drug search request for: ${name}`);

  // Return mock data
  return res.json(mockDrugData);
});

// Start server on a different port
const PORT = 3333;
const server = app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);

  // Make client request to test API
  testAPIClient();
});

async function testAPIClient() {
  try {
    // Test with axios (like the API client)
    console.log('Testing API client with axios...');
    const axiosResponse = await axios.get(
      `http://localhost:${PORT}/api/drugs/search`,
      {
        params: { name: 'aspirin' },
      }
    );
    console.log('Axios response status:', axiosResponse.status);
    console.log('Axios data structure:', Object.keys(axiosResponse.data));
    console.log(
      'Response has drugGroup:',
      !!axiosResponse.data.data?.drugGroup
    );

    // Test with fetch (like the frontend)
    console.log('\nTesting API client with fetch...');
    const fetchResponse = await fetch(
      `http://localhost:${PORT}/api/drugs/search?name=aspirin`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    console.log('Fetch response status:', fetchResponse.status);
    const fetchData = await fetchResponse.json();
    if (fetchData && typeof fetchData === 'object') {
      console.log(
        'Fetch data structure:',
        Object.keys(fetchData as Record<string, unknown>)
      );
      console.log(
        'Response has drugGroup:',
        !!(fetchData as any).data?.drugGroup
      );
    }

    // Shut down the test server after tests complete
    server.close(() => {
      console.log('Test completed, server shut down.');
    });
  } catch (error) {
    console.error('API test error:', error);
    server.close();
  }
}
