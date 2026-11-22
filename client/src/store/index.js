import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import taskReducer from './slices/taskSlice';
import roadmapReducer from './slices/roadmapSlice';
import statsReducer from './slices/statsSlice';
import groupReducer from './slices/groupSlice';
import plannerReducer from './slices/plannerSlice';
import sessionReducer, { queueLoaded, syncSessions } from './slices/sessionSlice';
import { QUEUE_KEY, readQueue, writeQueue } from '../utils/SessionQueue';
import projectReducer from './slices/projectSlice';
import projectTasksReducer from './slices/projectTasksSlice';
import userReducer from './slices/userSlice';
import analyticsReducer from './slices/analyticsSlice';
import scheduleReducer from './slices/scheduleSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        user: userReducer,
        tasks: taskReducer,
        stats: statsReducer,
        analytics: analyticsReducer,
        roadmaps: roadmapReducer,
        groups: groupReducer,
        planner: plannerReducer,
        session: sessionReducer,
        projects: projectReducer,
        projectTasks: projectTasksReducer,
        schedule: scheduleReducer,
    },
});

let persistedQueue = store.getState().session.queue;
store.subscribe(() => {
    const { queue } = store.getState().session;
    if (queue === persistedQueue) return;
    persistedQueue = queue;
    writeQueue(queue);
});

if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
        if (e.key !== QUEUE_KEY && e.key !== null) return;
        persistedQueue = readQueue();
        store.dispatch(queueLoaded(persistedQueue));
    });
    window.addEventListener('online', () => store.dispatch(syncSessions()));
    setInterval(() => store.dispatch(syncSessions()), 60000);
}
