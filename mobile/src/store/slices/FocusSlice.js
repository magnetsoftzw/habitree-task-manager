import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/Client';

export const FOCUS_MINUTES = 20;
export const FOCUS_PRESETS = [20, 30, 40, 50, 60];
export const BREAK_MINUTES = 5;

export const MIN_FOCUS = 1;
export const MAX_FOCUS = 180;

const initialState = {
  task: null,
  minutes: FOCUS_MINUTES,
  phase: 'focus',
  status: 'idle',
  runStartedAt: null,
  elapsedMs: 0,
  sessionStartedAt: null,
};

export const elapsedOf = (focus, now = Date.now()) =>
  focus.elapsedMs + (focus.status === 'running' && focus.runStartedAt ? now - focus.runStartedAt : 0);

export const focusMinutesOf = (focus) => focus?.minutes || FOCUS_MINUTES;

export const phaseLengthMs = (phase, minutes = FOCUS_MINUTES) => (phase === 'break' ? BREAK_MINUTES : minutes) * 60000;

const refBody = (ref) => (ref ? {
  taskType: ref.taskType,
  taskId: ref.taskId,
  projectId: ref.projectId,
} : {});

export const saveFocusSession = createAsyncThunk('focus/save', async (_, { getState, rejectWithValue }) => {
  const { focus } = getState();
  if (focus.phase !== 'focus' || !focus.sessionStartedAt) return null;
  const minutes = Math.floor(Math.min(elapsedOf(focus), phaseLengthMs('focus', focusMinutesOf(focus))) / 60000);
  if (minutes < 1) return null;
  try {
    const { data } = await API.post('/sessions/save', {
      startTime: new Date(focus.sessionStartedAt).toISOString(),
      endTime: new Date().toISOString(),
      durationMinutes: minutes,
      ...refBody(focus.task),
    });
    return data.session;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Could not save the session');
  }
});

export const logFocusTime = createAsyncThunk('focus/log', async ({ minutes, endTime, task }, { rejectWithValue }) => {
  try {
    const end = new Date(endTime);
    const { data } = await API.post('/sessions/save', {
      startTime: new Date(end.getTime() - minutes * 60000).toISOString(),
      endTime: end.toISOString(),
      durationMinutes: minutes,
      ...refBody(task),
    });
    return data.session;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || "Couldn't log that time");
  }
});

const focusSlice = createSlice({
  name: 'focus',
  initialState,
  reducers: {
    selectFocusTask: (state, action) => {
      state.task = action.payload;
    },
    setFocusMinutes: (state, action) => {
      if (state.status !== 'idle' && state.phase === 'focus') return;
      state.minutes = Math.max(MIN_FOCUS, Math.min(MAX_FOCUS, Math.round(action.payload) || FOCUS_MINUTES));
    },
    startFocus: (state, action) => {
      if (action.payload !== undefined) state.task = action.payload;
      state.phase = 'focus';
      state.status = 'running';
      state.elapsedMs = 0;
      state.runStartedAt = Date.now();
      state.sessionStartedAt = Date.now();
    },
    pauseFocus: (state) => {
      if (state.status !== 'running') return;
      state.elapsedMs = elapsedOf(state);
      state.runStartedAt = null;
      state.status = 'paused';
    },
    resumeFocus: (state) => {
      if (state.status !== 'paused') return;
      state.runStartedAt = Date.now();
      state.status = 'running';
    },
    startBreak: (state) => {
      state.phase = 'break';
      state.status = 'running';
      state.elapsedMs = 0;
      state.runStartedAt = Date.now();
      state.sessionStartedAt = null;
    },
    resetFocus: (state) => ({ ...initialState, task: state.task, minutes: focusMinutesOf(state) }),
    clearFocus: () => initialState,
  },
});

export const { selectFocusTask, setFocusMinutes, startFocus, pauseFocus, resumeFocus, startBreak, resetFocus, clearFocus } = focusSlice.actions;
export default focusSlice.reducer;
