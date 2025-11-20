import axios from 'axios';

// Function to check server health
export const checkServerHealth = async (): Promise<{ status: string }> => {
  try {
    const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'https://PharmaPilot-nttq.onrender.com/api'}/health`);

    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

// Function to debug authentication on the server
export const debugToken = async (): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'https://PharmaPilot-nttq.onrender.com/api'}/health/feature-flags/debug-token`,
      {
        withCredentials: true, // Include httpOnly cookies
      }
    );

    return response.data;
  } catch (error) {
    console.error('Auth debug failed:', error);
    throw error;
  }
};
