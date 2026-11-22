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
import { setUnauthorizedHandler } from '../api/Client';

const appReducer = combineReducers({ auth, prefs, tasks, planner, focus, projects, projectTasks, roadmaps, stats, notifications });

const rootReducer = (state, action) => {
  if (action.type === logout.fulfilled.type || action.type === sessionExpired.type) {
    return appReducer({ prefs: state?.prefs }, action);
  }
  return appReducer(state, action);
};

const persisted = persistReducer(
  {
    key: 'habitree',
    storage: AsyncStorage,
    whitelist: ['auth', 'prefs', 'focus'],
    version: 1,
    migrate: createMigrate({
      1: (state) => (state?.focus?.minutes === 25 && state.focus.status === 'idle'
        ? { ...state, focus: { ...state.focus, minutes: FOCUS_MINUTES } }
        : state),
    }),
  },
  rootReducer,
);

export const store = configureStore({
  reducer: persisted,
  middleware: (getDefault) => getDefault({
    serializableCheck: {
      ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER, 'projectTasks/patchLocal'],
    },
  }),
});

export const persistor = persistStore(store);

setUnauthorizedHandler(() => store.dispatch(sessionExpired()));
