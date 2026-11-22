import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/Client';
import { errorMessage, startOfDay } from '../../utils/Format';
import { fetcher, requireConnection, withId, writer } from '../../sync/Thunks';
import { canReachServer, OFFLINE_MESSAGE } from '../../sync/SyncEngine';
import { objectId } from '../../sync/ObjectId';

const findTask = (tasks, id) => {
  for (const list of Object.values(tasks.inventory)) {
    const t = list.find((x) => x._id === id);
    if (t) return t;
  }
  return tasks.current?._id === id ? tasks.current : null;
};

export const fetchInventory = fetcher('tasks/fetchInventory', async () => (await API.get('/tasks')).data);
export const fetchGroups = fetcher('tasks/fetchGroups', async () => (await API.get('/groups')).data);

export const fetchTask = createAsyncThunk('tasks/fetchTask', async (id, { getState, rejectWithValue }) => {
  const cached = findTask(getState().tasks, id);
  if (!canReachServer(getState)) return cached || rejectWithValue(OFFLINE_MESSAGE);
  try {
    return (await API.get(`/tasks/${id}`)).data;
  } catch (error) {
    if (!error.response && cached) return cached;
    return rejectWithValue(errorMessage(error, 'Task not found'));
  }
});

export const createGroup = withId(writer('tasks/createGroup', {
  request: (body) => ({ method: 'post', url: '/groups', body }),
  local: (body) => ({ ...body, createdAt: new Date().toISOString() }),
  kinds: ['groups'],
  label: (b) => `New group "${b.name}"`,
  fallback: 'Could not create the group',
}));

const localTask = (body, getState) => {
  const group = getState().tasks.groups.find((g) => g._id === body.groupId);
  const now = new Date().toISOString();
  return {
    status: 'Not Started',
    category: 'Personal',
    ...body,
    groupId: group ? { _id: group._id, name: group.name, color: group.color } : null,
    createdAt: now,
    updatedAt: now,
  };
};

const createTaskThunk = writer('tasks/createTask', {
  request: (body) => ({ method: 'post', url: '/tasks', body }),
  local: localTask,
  kinds: ['tasks'],
  label: (b) => `New task "${b.title}"`,
  fallback: 'Could not create the task',
});

export const createTask = Object.assign((body = {}) => createTaskThunk({
  ...body,
  _id: body._id || objectId(),
  subtasks: (body.subtasks || []).map((s) => ({ ...s, _id: s._id || objectId() })),
}), createTaskThunk);

export const updateTask = writer('tasks/updateTask', {
  request: ({ id, updates }) => ({ method: 'put', url: `/tasks/${id}`, body: updates }),
  local: ({ id, updates }, getState) => ({ ...findTask(getState().tasks, id), ...updates, _id: id }),
  kinds: ['tasks'],
  label: 'A task edit',
  fallback: 'Could not save the task',
});

export const deleteTask = writer('tasks/deleteTask', {
  request: (id) => ({ method: 'delete', url: `/tasks/${id}` }),
  local: (id) => id,
  fromServer: (_, id) => id,
  kinds: ['tasks', 'projects'],
  label: 'Deleting a task',
  fallback: 'Could not delete the task',
});

export const setTaskStatus = writer('tasks/setStatus', {
  request: ({ id, status }) => ({ method: 'patch', url: `/tasks/${id}/status`, body: { status } }),
  local: ({ id, status }, getState) => ({ ...findTask(getState().tasks, id), _id: id, status }),
  fromServer: (data) => data.task,
  kinds: ['tasks'],
  label: 'A task status change',
  fallback: 'Could not update the status',
});

export const rescheduleOverdue = createAsyncThunk('tasks/rescheduleOverdue', async (ids, { dispatch, rejectWithValue }) => {
  const today = startOfDay().toISOString();
  const results = await Promise.all(ids.map((id) => dispatch(updateTask({ id, updates: { scheduledDate: today } }))));
  const failed = results.find((r) => r.error);
  if (failed) return rejectWithValue(failed.payload || 'Could not reschedule');
  return { ids, today };
});

export const importPlaylist = createAsyncThunk('tasks/importPlaylist', async (playlistUrl, { getState, rejectWithValue }) => {
  try {
    requireConnection(getState);
    return (await API.post('/youtube/playlist-preview', { playlistUrl })).data;
  } catch (error) {
    return rejectWithValue(error.offline ? error.message : errorMessage(error, 'Could not read that playlist'));
  }
});

const eachTask = (state, fn) => {
  Object.values(state.inventory).forEach((list) => list.forEach(fn));
};

const groupName = (task) => task.groupId?.name || 'Uncategorized';

const replaceTask = (state, task) => {
  if (!task?._id) return;
  let found = false;
  Object.keys(state.inventory).forEach((group) => {
    state.inventory[group] = state.inventory[group].map((t) => {
      if (t._id !== task._id) return t;
      found = true;
      return { ...t, ...task, groupId: task.groupId?._id || task.groupId === null ? task.groupId : t.groupId };
    });
  });
  if (!found && !task.projectId) {
    const name = groupName(task);
    state.inventory[name] = [task, ...(state.inventory[name] || [])];
  }
  if (state.current?._id === task._id) state.current = { ...state.current, ...task };
};

const removeTask = (state, id) => {
  Object.keys(state.inventory).forEach((group) => {
    state.inventory[group] = state.inventory[group].filter((t) => t._id !== id);
  });
  if (state.current?._id === id) state.current = null;
};

const tasksSlice = createSlice({
  name: 'tasks',
  initialState: { inventory: {}, groups: [], current: null, loading: false, loaded: false, error: null },
  reducers: {
    clearCurrent: (state) => { state.current = null; },
    patchInventoryTask: (state, action) => { if (findTask(state, action.payload._id)) replaceTask(state, action.payload); },
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
        state.error = state.loaded ? null : action.payload;
      })
      .addCase(fetchGroups.fulfilled, (state, action) => { state.groups = action.payload; })
      .addCase(createGroup.pending, (state, action) => {
        const g = action.meta.arg;
        if (!state.groups.some((x) => x._id === g._id)) state.groups.push({ ...g });
        state.inventory[g.name] = state.inventory[g.name] || [];
      })
      .addCase(createGroup.fulfilled, (state, action) => {
        state.groups = state.groups.map((g) => (g._id === action.payload._id ? action.payload : g));
      })
      .addCase(createGroup.rejected, (state, action) => {
        state.groups = state.groups.filter((g) => g._id !== action.meta.arg._id);
      })
      .addCase(fetchTask.fulfilled, (state, action) => { state.current = action.payload; })
      .addCase(createTask.pending, (state, action) => {
        const group = state.groups.find((g) => g._id === action.meta.arg.groupId);
        const now = new Date().toISOString();
        replaceTask(state, {
          status: 'Not Started', category: 'Personal', ...action.meta.arg,
          groupId: group ? { _id: group._id, name: group.name, color: group.color } : null,
          createdAt: now, updatedAt: now,
        });
      })
      .addCase(createTask.fulfilled, (state, action) => replaceTask(state, action.payload))
      .addCase(createTask.rejected, (state, action) => removeTask(state, action.meta.arg._id))
      .addCase(updateTask.pending, (state, action) => {
        const { id, updates } = action.meta.arg;
        const { groupId, ...rest } = updates;
        replaceTask(state, { _id: id, ...rest, updatedAt: new Date().toISOString() });
      })
      .addCase(updateTask.fulfilled, (state, action) => replaceTask(state, action.payload))
      .addCase(setTaskStatus.pending, (state, action) => {
        const { id, status } = action.meta.arg;
        const now = new Date().toISOString();
        eachTask(state, (t) => { if (t._id === id) { t.status = status; t.updatedAt = now; } });
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
      .addCase(deleteTask.pending, (state, action) => removeTask(state, action.meta.arg))
      .addCase(deleteTask.fulfilled, (state, action) => removeTask(state, action.payload));
  },
});

export const { clearCurrent, patchInventoryTask } = tasksSlice.actions;
export default tasksSlice.reducer;
