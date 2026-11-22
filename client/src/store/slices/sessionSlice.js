import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import API from '../../api/axiosInstance';
import { getToken } from '../../api/Token';
import { newClientId, pendingByDay, readQueue, writeQueue } from '../../utils/SessionQueue';
import { fetchCurrentUser } from './userSlice';

const TASK_FIELDS = ['taskType', 'taskId', 'projectId'];
const RETRYABLE = new Set([401, 408, 425, 429]);

const payloadOf = (item, withTask = true) => {
    const body = {
        clientId: item.clientId,
        startTime: item.startTime,
        endTime: item.endTime,
        durationMinutes: item.durationMinutes,
        ...(item.titleSnapshot && { titleSnapshot: item.titleSnapshot }),
    };
    if (withTask) TASK_FIELDS.forEach((f) => { if (item[f]) body[f] = item[f]; });
    return body;
};

const isTransient = (error) => {
    const status = error.response?.status;
    return !status || status >= 500 || RETRYABLE.has(status);
};

const post = async (item) => {
    try {
        await API.post('/sessions/save', payloadOf(item));
        return { ok: true };
    } catch (error) {
        if (isTransient(error)) return { transient: true };
        if (!item.taskId) return { message: error.response?.data?.message || 'The server rejected this session.' };
        try {
            await API.post('/sessions/save', payloadOf(item, false));
            return { ok: true };
        } catch (retry) {
            if (isTransient(retry)) return { transient: true };
            return { message: retry.response?.data?.message || 'The server rejected this session.' };
        }
    }
};

const withLock = (work) => (globalThis.navigator?.locks
    ? navigator.locks.request('habitree-session-sync', { ifAvailable: true }, (lock) => (lock ? work() : null))
    : work());

const drain = async (userId) => {
    const items = readQueue().filter((s) => s.userId === userId && !s.failed);
    const synced = [];
    const failed = [];
    for (const item of items) {
        const result = await post(item);
        if (result.transient) break;
        if (result.ok) synced.push(item.clientId);
        else failed.push({ clientId: item.clientId, message: result.message });
    }
    if (synced.length || failed.length) {
        writeQueue(readQueue()
            .filter((s) => !synced.includes(s.clientId))
            .map((s) => {
                const f = failed.find((x) => x.clientId === s.clientId);
                return f ? { ...s, failed: f.message } : s;
            }));
    }
    return { synced, failed };
};

export const syncSessions = createAsyncThunk('session/sync', async (_, { getState }) => {
    const state = getState();
    const { synced, failed } = (await withLock(() => drain(state.user.profile._id))) || { synced: [], failed: [] };
    if (!synced.length) return { synced, failed };

    const date = state.planner.activeDate;
    const [day, weekly] = await Promise.all([
        API.get(`/stats/day${date ? `?date=${date}` : ''}`).then((r) => r.data).catch(() => null),
        API.get('/stats/weekly').then((r) => r.data.stats).catch(() => null),
    ]);
    return { synced, failed, day, weekly };
}, {
    condition: (_, { getState }) => {
        const { session, user } = getState();
        if (session.syncing || !user.profile?._id || !getToken()) return false;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
        return session.queue.some((s) => s.userId === user.profile._id && !s.failed);
    },
});

export const logSession = (data) => (dispatch, getState) => {
    const userId = getState().user.profile?._id || null;
    dispatch(sessionSlice.actions.queued({
        ...data,
        clientId: newClientId(),
        userId,
        queuedAt: new Date().toISOString(),
    }));
    dispatch(syncSessions());
};

const sessionSlice = createSlice({
    name: 'session',
    initialState: {
        queue: readQueue(),
        syncing: false,
        lastSyncedAt: null,
    },
    reducers: {
        queued: (state, action) => {
            state.queue.push(action.payload);
        },
        queueLoaded: (state, action) => {
            state.queue = action.payload;
        },
        retryFailed: (state) => {
            state.queue.forEach((s) => { delete s.failed; });
        },
        discardFailed: (state) => {
            state.queue = state.queue.filter((s) => !s.failed);
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(syncSessions.pending, (state) => {
                state.syncing = true;
            })
            .addCase(syncSessions.fulfilled, (state, action) => {
                state.syncing = false;
                const { synced, failed } = action.payload;
                if (synced.length) {
                    state.queue = state.queue.filter((s) => !synced.includes(s.clientId));
                    state.lastSyncedAt = new Date().toISOString();
                }
                failed.forEach(({ clientId, message }) => {
                    const item = state.queue.find((s) => s.clientId === clientId);
                    if (item) item.failed = message;
                });
            })
            .addCase(syncSessions.rejected, (state) => {
                state.syncing = false;
            })
            .addCase(fetchCurrentUser.fulfilled, (state, action) => {
                const userId = action.payload?._id;
                if (userId) state.queue.forEach((s) => { if (!s.userId) s.userId = userId; });
            });
    },
});

const selectQueue = (state) => state.session.queue;
const selectUserId = (state) => state.user.profile?._id;

export const selectMyQueue = createSelector([selectQueue, selectUserId], (queue, userId) => (
    queue.filter((s) => !s.userId || s.userId === userId)
));

export const selectPendingByDay = createSelector([selectMyQueue], (queue) => pendingByDay(queue.filter((s) => !s.failed)));

export const { queueLoaded, retryFailed, discardFailed } = sessionSlice.actions;
export default sessionSlice.reducer;
