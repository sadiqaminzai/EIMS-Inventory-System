import axios from 'axios';

// API base URL: use env override, otherwise default to local dev or same-host production path
const API_BASE_URL = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD
    ? `${window.location.origin}${import.meta.env.BASE_URL}backend/public/api/v1`
    : 'http://localhost:8000/api/v1');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 10000,
});

// Request Interceptor (e.g., for attaching Auth Tokens)
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    const tenantId = localStorage.getItem('tenant_id');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    if (tenantId) {
      config.headers['X-Tenant-Id'] = tenantId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor (Global Error Handling)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle standard Laravel error responses (401, 422, 500)
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('tenant_id');
      localStorage.removeItem('current_user');
      // Redirect to login if unauthorized
      const loginPath = `${import.meta.env.BASE_URL}login`;
      if (window.location.pathname !== loginPath) {
        window.location.href = loginPath;
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
