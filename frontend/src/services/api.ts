import axios from 'axios';

// Create axios instance with base URL for Laravel API
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    withCredentials: true, // Important for Sanctum cookie-based auth
});

// Add a request interceptor
api.interceptors.request.use(
    (config) => {
        // You can add auth tokens here if using Bearer tokens instead of cookies
        // const token = localStorage.getItem('token');
        // if (token) {
        //     config.headers.Authorization = `Bearer ${token}`;
        // }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response?.status === 401) {
            // Handle unauthorized access (e.g., redirect to login)
            console.log('Unauthorized, redirecting to login...');
            // window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
