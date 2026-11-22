import axios from 'axios';
import { clearToken, getToken } from './Token';

const API = axios.create({
    baseURL: import.meta.env.VITE_API_CALL || 'https://habitree-server.vercel.app/api',
    headers: {
        'Content-Type': 'application/json'
    },
});

//REQUEST INTERCEPTOR: Attach Token
API.interceptors.request.use(
    (config) => {
        const token = getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

//RESPONSE INTERCEPTOR: Handle Global Error
API.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const isAuthCall = /\/auth\//.test(error.config?.url || '');
        if (status === 401 && !isAuthCall) {
            clearToken();
            if (window.location.pathname !== '/login') window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default API;