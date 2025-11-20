import axios from 'axios';

// Dedicated API client for Patient Portal using explicit Bearer token
// to avoid ambiguity when workspace cookies are also present.

const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
};

export const buildPatientAuthHeader = (): string | undefined => {
  const token = getCookie('patientAccessToken') || (typeof localStorage !== 'undefined' ? localStorage.getItem('patientAccessToken') : null);
  if (token) return `Bearer ${token}`;
  return undefined;
};


export const patientApiClient = axios.create({
  baseURL: '/api',
  withCredentials: false, // do not send workspace cookies
  timeout: 300000,
});

patientApiClient.interceptors.request.use((config) => {
  const auth = buildPatientAuthHeader();
  if (auth) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = auth;
    (config.headers as any)['X-Auth-Context'] = 'patient';
  }
  return config;
});

export default patientApiClient;
