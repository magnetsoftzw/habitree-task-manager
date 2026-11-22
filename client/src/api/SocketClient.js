import { io } from 'socket.io-client';
import { getToken } from './Token';

const apiUrl = import.meta.env.VITE_API_CALL || 'https://habitree-server.vercel.app/api';
const socketUrl = apiUrl.replace(/\/api\/?$/, '');

let socket = null;
let socketToken = null;

export const getSocket = () => {
    const token = getToken();
    if (!token) return null;
    if (socket && socketToken === token) return socket;
    socket?.disconnect();
    socketToken = token;
    socket = io(socketUrl, { auth: { token }, transports: ['websocket', 'polling'] });
    return socket;
};
