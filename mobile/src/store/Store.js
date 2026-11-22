import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { createMigrate, persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import auth, { logout, sessionExpired } from './slices/AuthSlice';
import prefs from './slices/PrefsSlice';
import tasks from './slices/TasksSlice';
import planner from './slices/PlannerSlice';
import focus, { FOCUS_MINUTES } from './slices/FocusSlice';
import projects from './slices/ProjectsSlice';
import projectTasks from './slices/ProjectTasksSlice';
import roadmaps from './slices/RoadmapsSlice';
import stats from './slices/StatsSlice';
import notifications from './slices/NotificationsSlice';
import schedule from './slices/ScheduleSlice';
import sync from './slices/SyncSlice';
import { DeviceStorage } from '../storage/DeviceStorage';
import { setUnauthorizedHandler } from '../api/Client';

const local = (key, reducer, blacklist = [], throttle = 800) => persistReducer({ key: `data_${key}`, storage: DeviceStorage, blacklist, throttle }, reducer);

const DATA = {
  tasks: local('tasks', tasks, ['loading', 'error']),
  planner: local('planner', planner, ['loading']),
  projects: local('projects', projects, ['loading', 'error']),
  projectTasks: local('projectTasks', projectTasks),
  roadmaps: local('roadmaps', roadmaps, ['loading', 'saving', 'error']),
  stats: local('stats', stats, ['loading', 'error']),
  notifications: local('notifications', notifications, ['error']),
  schedule: local('schedule', schedule),
  sync: local('sync', sync, ['syncing', 'online'], 0),
};

const appReducer = combineReducers({ auth, prefs, focus, ...DATA });

const rootReducer = (state, action) => {
  if (action.type === logout.fulfilled.type || action.type === sessionExpired.type) {
    const keepOutbox = action.type === sessionExpired.type;
    const sync = { ...state?.sync, outbox: keepOutbox ? state?.sync?.outbox || [] : [], cursor: null, issues: [] };
    const fresh = appReducer({ prefs: state?.prefs, sync }, action);
    Object.keys(DATA).forEach((key) => {
      if (state?.[key]?._persist) fresh[key] = { ...fresh[key], _persist: state[key]._persist };
    });
    return fresh;
  }
  return appReducer(state, action);
};

const persisted = persistReducer(
  {
    key: 'habitree',
    storage: AsyncStorage,
    whitelist: ['auth', 'prefs', 'focus'],
    version: 2,
    migrate: createMigrate({
      1: (state) => (state?.focus?.minutes === 25 && state.focus.status === 'idle'
        ? { ...state, focus: { ...state.focus, minutes: FOCUS_MINUTES } }
        : state),
      2: (state) => state,
    }),
  },
  rootReducer,
);

export const store = configureStore({
  reducer: persisted,
  middleware: (getDefault) => getDefault({
    serializableCheck: {
      ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER, 'projectTasks/patchLocal', 'sync/enqueue'],
    },
  }),
});

export const persistor = persistStore(store);

setUnauthorizedHandler(() => store.dispatch(sessionExpired()));
