import axios from 'axios';

/**
 * Public API Client - No authentication required
 * Used for public routes like workspace search, blog posts, etc.
 */
export const publicApiClient = axios.create({
    baseURL: import.meta.env.MODE === 'development'
        ? 'http://localhost:5000/api'
        : '/api',
    timeout: 30000, // 30 seconds
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: false, // DO NOT include cookies
});

// No authentication interceptors - this is for public routes only
// Just handle basic response errors
publicApiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        // Just pass through the error without any auth handling
        return Promise.reject(error);
    }
);

export default publicApiClient;
