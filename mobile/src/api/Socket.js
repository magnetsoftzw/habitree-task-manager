import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { SOCKET_URL, TOKEN_KEY } from './Client';
import { fetchProjectTasks, upsertTask, removeTask, applyOrder, upsertGroup, removeGroup } from '../store/slices/ProjectTasksSlice';
import { applyRemoteMove, fetchProject } from '../store/slices/ProjectsSlice';

let socket = null;
const rooms = new Set();

const getSocket = async () => {
  if (socket) return socket;
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'], reconnection: true });
  socket.on('connect', () => rooms.forEach((id) => socket.emit('joinProject', id)));
  return socket;
};

export const disconnectSocket = () => {
  rooms.clear();
  socket?.disconnect();
  socket = null;
};

export function useProjectRoom(projectId) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!projectId) return undefined;
    let active = true;
    let s = null;
    const handlers = {
      'projectTask:created': ({ task }) => dispatch(upsertTask({ projectId, task })),
      'projectTask:updated': ({ task }) => dispatch(upsertTask({ projectId, task })),
      'projectTask:deleted': ({ taskId }) => dispatch(removeTask({ projectId, taskId })),
      'projectTask:reordered': ({ taskIds }) => dispatch(applyOrder({ projectId, taskIds })),
      'projectTaskGroup:created': ({ group }) => dispatch(upsertGroup({ projectId, group })),
      'projectTaskGroup:updated': ({ group }) => dispatch(upsertGroup({ projectId, group })),
      'projectTaskGroup:deleted': ({ groupId }) => dispatch(removeGroup({ projectId, groupId })),
      taskMoved: (payload) => dispatch(applyRemoteMove(payload)),
      taskDeleted: () => dispatch(fetchProject(projectId)),
    };
    const forThisProject = (fn) => (payload = {}) => {
      if (payload.projectId && payload.projectId !== projectId) return;
      fn(payload);
    };
    const wrapped = Object.fromEntries(Object.entries(handlers).map(([k, fn]) => [k, forThisProject(fn)]));
    const onReconnect = () => {
      dispatch(fetchProjectTasks(projectId));
      dispatch(fetchProject(projectId));
    };

    getSocket().then((instance) => {
      if (!active || !instance) return;
      s = instance;
      rooms.add(projectId);
      if (s.connected) s.emit('joinProject', projectId);
      Object.entries(wrapped).forEach(([event, fn]) => s.on(event, fn));
      s.io.on('reconnect', onReconnect);
    });

    return () => {
      active = false;
      rooms.delete(projectId);
      if (!s) return;
      s.emit('leaveProject', projectId);
      Object.entries(wrapped).forEach(([event, fn]) => s.off(event, fn));
      s.io.off('reconnect', onReconnect);
    };
  }, [projectId, dispatch]);
}
