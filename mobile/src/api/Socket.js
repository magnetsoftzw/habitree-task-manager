import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { SOCKET_URL, TOKEN_KEY } from './Client';
import { fetchProjectTasks, upsertTask, removeTask, applyOrder, upsertGroup, removeGroup } from '../store/slices/ProjectTasksSlice';
import { applyRemoteMove, fetchProject } from '../store/slices/ProjectsSlice';
import { fetchSchedule, fetchTemplate } from '../store/slices/ScheduleSlice';
import { fetchPlanner } from '../store/slices/PlannerSlice';
import { fetchInventory } from '../store/slices/TasksSlice';
import { syncNow } from '../sync/SyncEngine';

let socket = null;
const rooms = new Set();
let userRoom = null;

const getSocket = async () => {
  if (socket) return socket;
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'], reconnection: true });
  socket.on('connect', () => {
    rooms.forEach((id) => socket.emit('joinProject', id));
    if (userRoom) socket.emit('joinUserRoom', userRoom);
    syncNow();
  });
  return socket;
};

export const disconnectSocket = () => {
  rooms.clear();
  userRoom = null;
  socket?.disconnect();
  socket = null;
};

const refreshSchedule = ({ date, template } = {}) => (dispatch, getState) => {
  const { schedule, planner } = getState();
  if (template) {
    dispatch(fetchTemplate());
    Object.keys(schedule.byDate).forEach((d) => dispatch(fetchSchedule(d)));
  }
  if (date) {
    if (schedule.byDate[date]) dispatch(fetchSchedule(date));
    if (planner.byDate[date]) dispatch(fetchPlanner(date));
    dispatch(fetchInventory());
  }
};

export function useUserRoom(userId) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    let s = null;
    const onSchedule = (payload) => dispatch(refreshSchedule(payload));
    getSocket().then((instance) => {
      if (!active || !instance) return;
      s = instance;
      userRoom = String(userId);
      if (s.connected) s.emit('joinUserRoom', userRoom);
      s.on('scheduleUpdated', onSchedule);
    });
    return () => {
      active = false;
      if (userRoom === String(userId)) userRoom = null;
      s?.off('scheduleUpdated', onSchedule);
    };
  }, [userId, dispatch]);
}

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
