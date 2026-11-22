import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { errorMessage } from '../../utils/Format';
import { send } from '../../sync/SyncEngine';
import { objectId } from '../../sync/ObjectId';

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

const postSession = async (api, body) => {
  const session = { ...body, clientId: `mobile-${objectId()}` };
  const sent = await send(api, { method: 'post', url: '/sessions/save', body: session, kinds: ['sessions'], label: `A ${body.durationMinutes}-minute focus session` });
  return sent.queued ? { ...session, status: 'Completed', pending: true } : sent.data.session;
};

export const saveFocusSession = createAsyncThunk('focus/save', async (_, api) => {
  const { focus } = api.getState();
  if (focus.phase !== 'focus' || !focus.sessionStartedAt) return null;
  const minutes = Math.floor(Math.min(elapsedOf(focus), phaseLengthMs('focus', focusMinutesOf(focus))) / 60000);
  if (minutes < 1) return null;
  try {
    return await postSession(api, {
      startTime: new Date(focus.sessionStartedAt).toISOString(),
      endTime: new Date().toISOString(),
      durationMinutes: minutes,
      ...refBody(focus.task),
    });
  } catch (error) {
    return api.rejectWithValue(errorMessage(error, 'Could not save the session'));
  }
});

export const logFocusTime = createAsyncThunk('focus/log', async ({ minutes, endTime, task }, api) => {
  try {
    const end = new Date(endTime);
    return await postSession(api, {
      startTime: new Date(end.getTime() - minutes * 60000).toISOString(),
      endTime: end.toISOString(),
      durationMinutes: minutes,
      ...refBody(task),
    });
  } catch (error) {
    return api.rejectWithValue(errorMessage(error, "Couldn't log that time"));
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
