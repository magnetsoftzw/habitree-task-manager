import { createSlice } from '@reduxjs/toolkit';
import { objectId } from '../../sync/ObjectId';

const MAX_ISSUES = 20;

const syncSlice = createSlice({
  name: 'sync',
  initialState: { deviceId: null, outbox: [], cursor: null, online: true, syncing: false, lastSyncAt: null, issues: [] },
  reducers: {
    ensureDevice: (state) => { if (!state.deviceId) state.deviceId = `m-${objectId()}`; },
    enqueue: (state, action) => { state.outbox.push(action.payload); },
    dequeue: (state, action) => { state.outbox = state.outbox.filter((op) => op.id !== action.payload); },
    bumpAttempt: (state, action) => {
      const op = state.outbox.find((o) => o.id === action.payload);
      if (op) op.attempts = (op.attempts || 0) + 1;
    },
    setOnline: (state, action) => { state.online = action.payload; },
    setSyncing: (state, action) => { state.syncing = action.payload; },
    synced: (state, action) => { state.cursor = action.payload; state.lastSyncAt = new Date().toISOString(); },
    addIssue: (state, action) => {
      state.issues = [{ id: objectId(), at: new Date().toISOString(), ...action.payload }, ...state.issues].slice(0, MAX_ISSUES);
    },
    clearIssues: (state) => { state.issues = []; },
  },
});

export const { ensureDevice, enqueue, dequeue, bumpAttempt, setOnline, setSyncing, synced, addIssue, clearIssues } = syncSlice.actions;
export default syncSlice.reducer;
