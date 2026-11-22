import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://habitree-server.vercel.app/api').replace(/\/$/, '');
export const SOCKET_URL = API_URL.replace(/\/api$/, '');
export const TOKEN_KEY = 'habitree_token';

const API = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (handler) => { onUnauthorized = handler; };

API.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isAuthRoute = error.config?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && !isAuthRoute) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

export default API;
