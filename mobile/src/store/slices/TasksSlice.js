import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/Client';
import { errorMessage, startOfDay } from '../../utils/Format';

const wrap = (fn, fallback) => async (arg, api) => {
  try {
    return await fn(arg, api);
  } catch (error) {
    return api.rejectWithValue(errorMessage(error, fallback));
  }
};

export const fetchInventory = createAsyncThunk('tasks/fetchInventory', wrap(async () => (await API.get('/tasks')).data));
export const fetchGroups = createAsyncThunk('tasks/fetchGroups', wrap(async () => (await API.get('/groups')).data));
export const createGroup = createAsyncThunk('tasks/createGroup', wrap(async (body) => (await API.post('/groups', body)).data, 'Could not create the group'));
export const fetchTask = createAsyncThunk('tasks/fetchTask', wrap(async (id) => (await API.get(`/tasks/${id}`)).data, 'Task not found'));
export const createTask = createAsyncThunk('tasks/createTask', wrap(async (body) => (await API.post('/tasks', body)).data, 'Could not create the task'));
export const updateTask = createAsyncThunk('tasks/updateTask', wrap(async ({ id, updates }) => (await API.put(`/tasks/${id}`, updates)).data, 'Could not save the task'));
export const deleteTask = createAsyncThunk('tasks/deleteTask', wrap(async (id) => { await API.delete(`/tasks/${id}`); return id; }, 'Could not delete the task'));

export const setTaskStatus = createAsyncThunk(
  'tasks/setStatus',
  wrap(async ({ id, status }) => (await API.patch(`/tasks/${id}/status`, { status })).data.task, 'Could not update the status'),
);

export const rescheduleOverdue = createAsyncThunk('tasks/rescheduleOverdue', wrap(async (ids) => {
  const today = startOfDay().toISOString();
  await Promise.all(ids.map((id) => API.put(`/tasks/${id}`, { scheduledDate: today })));
  return { ids, today };
}, 'Could not reschedule'));

export const importPlaylist = createAsyncThunk('tasks/importPlaylist', wrap(async (playlistUrl) =>
  (await API.post('/youtube/playlist-preview', { playlistUrl })).data, 'Could not read that playlist'));

const eachTask = (state, fn) => {
  Object.values(state.inventory).forEach((list) => list.forEach(fn));
};

const replaceTask = (state, task) => {
  if (!task?._id) return;
  Object.keys(state.inventory).forEach((group) => {
    state.inventory[group] = state.inventory[group].map((t) => (t._id === task._id ? { ...t, ...task, groupId: task.groupId?._id ? task.groupId : t.groupId } : t));
  });
  if (state.current?._id === task._id) state.current = { ...state.current, ...task };
};

const tasksSlice = createSlice({
  name: 'tasks',
  initialState: { inventory: {}, groups: [], current: null, loading: false, loaded: false, error: null },
  reducers: {
    clearCurrent: (state) => { state.current = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInventory.pending, (state) => { state.loading = true; })
      .addCase(fetchInventory.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = null;
        state.inventory = action.payload;
      })
      .addCase(fetchInventory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchGroups.fulfilled, (state, action) => { state.groups = action.payload; })
      .addCase(createGroup.fulfilled, (state, action) => {
        state.groups.push(action.payload);
        state.inventory[action.payload.name] = state.inventory[action.payload.name] || [];
      })
      .addCase(fetchTask.fulfilled, (state, action) => { state.current = action.payload; })
      .addCase(updateTask.fulfilled, (state, action) => replaceTask(state, action.payload))
      .addCase(setTaskStatus.pending, (state, action) => {
        const { id, status } = action.meta.arg;
        eachTask(state, (t) => { if (t._id === id) t.status = status; });
        if (state.current?._id === id) state.current.status = status;
      })
      .addCase(setTaskStatus.fulfilled, (state, action) => replaceTask(state, action.payload))
      .addCase(setTaskStatus.rejected, (state, action) => {
        const { id, previous } = action.meta.arg;
        if (!previous) return;
        eachTask(state, (t) => { if (t._id === id) t.status = previous; });
        if (state.current?._id === id) state.current.status = previous;
      })
      .addCase(rescheduleOverdue.fulfilled, (state, action) => {
        const ids = new Set(action.payload.ids);
        eachTask(state, (t) => { if (ids.has(t._id)) t.scheduledDate = action.payload.today; });
      })
      .addCase(deleteTask.fulfilled, (state, action) => {
        Object.keys(state.inventory).forEach((group) => {
          state.inventory[group] = state.inventory[group].filter((t) => t._id !== action.payload);
        });
        if (state.current?._id === action.payload) state.current = null;
      });
  },
});

export const { clearCurrent } = tasksSlice.actions;
export default tasksSlice.reducer;
