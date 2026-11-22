import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/Client';
import { errorMessage } from '../../utils/Format';
import { setOpenTaskCount } from './ProjectsSlice';

const base = (projectId) => `/projects/${projectId}/tasks`;
const groupBase = (projectId) => `/projects/${projectId}/task-groups`;

const findTask = (state, projectId, taskId) => state.projectTasks.byProject[projectId]?.tasks.find((t) => t._id === taskId);

const syncCount = (dispatch, getState, projectId) => {
  const tasks = getState().projectTasks.byProject[projectId]?.tasks || [];
  dispatch(setOpenTaskCount({ projectId, count: tasks.filter((t) => t.status !== 'done').length }));
};

const optimistic = (type, { local, request, fallback }) => createAsyncThunk(type, async (arg, { dispatch, getState, rejectWithValue }) => {
  const { projectId, taskId } = arg;
  const snapshot = taskId ? findTask(getState(), projectId, taskId) : null;
  const order = getState().projectTasks.byProject[projectId]?.tasks.map((t) => t._id);
  if (local) dispatch(projectTasksSlice.actions.patchLocal({ projectId, taskId, arg, local }));
  try {
    const result = await request(arg);
    if (result?.task) dispatch(projectTasksSlice.actions.upsertTask({ projectId, task: result.task }));
    if (result?.removed) dispatch(projectTasksSlice.actions.removeTask({ projectId, taskId: result.removed }));
    syncCount(dispatch, getState, projectId);
    return result;
  } catch (error) {
    if (snapshot) dispatch(projectTasksSlice.actions.upsertTask({ projectId, task: snapshot }));
    if (order && !taskId) dispatch(projectTasksSlice.actions.applyOrder({ projectId, taskIds: order }));
    syncCount(dispatch, getState, projectId);
    return rejectWithValue(errorMessage(error, fallback));
  }
});

export const fetchProjectTasks = createAsyncThunk('projectTasks/fetch', async (projectId, { dispatch, getState, rejectWithValue }) => {
  try {
    const [{ data }, groups] = await Promise.all([
      API.get(base(projectId)),
      API.get(groupBase(projectId)).then((r) => r.data.groups || []).catch(() => null),
    ]);
    setTimeout(() => syncCount(dispatch, getState, projectId), 0);
    return { projectId, tasks: data.tasks, groups };
  } catch (error) {
    return rejectWithValue(errorMessage(error, 'Could not load the task list'));
  }
});

export const createProjectTask = createAsyncThunk('projectTasks/create', async ({ projectId, ...body }, { dispatch, getState, rejectWithValue }) => {
  try {
    const { data } = await API.post(base(projectId), body);
    dispatch(projectTasksSlice.actions.upsertTask({ projectId, task: data.task }));
    syncCount(dispatch, getState, projectId);
    return data.task;
  } catch (error) {
    return rejectWithValue(errorMessage(error, 'Could not add the task'));
  }
});

export const updateProjectTask = optimistic('projectTasks/update', {
  local: (task, { updates }) => {
    Object.assign(task, updates);
    if (updates.status) task.completedAt = updates.status === 'done' ? new Date().toISOString() : null;
  },
  request: async ({ projectId, taskId, updates }) => (await API.patch(`${base(projectId)}/${taskId}`, updates)).data,
  fallback: 'Could not save the task',
});

export const deleteProjectTask = optimistic('projectTasks/delete', {
  request: async ({ projectId, taskId }) => {
    await API.delete(`${base(projectId)}/${taskId}`);
    return { removed: taskId };
  },
  fallback: 'Could not delete the task',
});

export const reorderProjectTasks = createAsyncThunk('projectTasks/reorder', async ({ projectId, taskIds }, { dispatch, getState, rejectWithValue }) => {
  const previous = getState().projectTasks.byProject[projectId]?.tasks.map((t) => t._id);
  dispatch(projectTasksSlice.actions.applyOrder({ projectId, taskIds }));
  try {
    await API.put(`${base(projectId)}/order`, { taskIds });
    return taskIds;
  } catch (error) {
    if (previous) dispatch(projectTasksSlice.actions.applyOrder({ projectId, taskIds: previous }));
    return rejectWithValue(errorMessage(error, 'Could not reorder the list'));
  }
});

export const createTaskGroup = createAsyncThunk('projectTasks/createGroup', async ({ projectId, name }, { dispatch, rejectWithValue }) => {
  try {
    const { data } = await API.post(groupBase(projectId), { name });
    dispatch(projectTasksSlice.actions.upsertGroup({ projectId, group: data.group }));
    return data.group;
  } catch (error) {
    return rejectWithValue(errorMessage(error, 'Could not create the group'));
  }
});

export const renameTaskGroup = createAsyncThunk('projectTasks/renameGroup', async ({ projectId, groupId, name }, { dispatch, rejectWithValue }) => {
  try {
    const { data } = await API.put(`${groupBase(projectId)}/${groupId}`, { name });
    dispatch(projectTasksSlice.actions.upsertGroup({ projectId, group: data.group }));
    return data.group;
  } catch (error) {
    return rejectWithValue(errorMessage(error, 'Could not rename the group'));
  }
});

export const deleteTaskGroup = createAsyncThunk('projectTasks/deleteGroup', async ({ projectId, groupId }, { dispatch, rejectWithValue }) => {
  try {
    await API.delete(`${groupBase(projectId)}/${groupId}`);
    dispatch(projectTasksSlice.actions.removeGroup({ projectId, groupId }));
    return groupId;
  } catch (error) {
    return rejectWithValue(errorMessage(error, 'Could not delete the group'));
  }
});

export const addSubtask = optimistic('projectTasks/addSubtask', {
  request: async ({ projectId, taskId, title }) => (await API.post(`${base(projectId)}/${taskId}/subtasks`, { title })).data,
  fallback: 'Could not add the subtask',
});

export const updateSubtask = optimistic('projectTasks/updateSubtask', {
  local: (task, { subtaskId, updates }) => {
    const sub = task.subtasks.find((s) => s._id === subtaskId);
    if (sub) Object.assign(sub, updates);
  },
  request: async ({ projectId, taskId, subtaskId, updates }) =>
    (await API.patch(`${base(projectId)}/${taskId}/subtasks/${subtaskId}`, updates)).data,
  fallback: 'Could not save the subtask',
});

export const deleteSubtask = optimistic('projectTasks/deleteSubtask', {
  local: (task, { subtaskId }) => { task.subtasks = task.subtasks.filter((s) => s._id !== subtaskId); },
  request: async ({ projectId, taskId, subtaskId }) =>
    (await API.delete(`${base(projectId)}/${taskId}/subtasks/${subtaskId}`)).data,
  fallback: 'Could not delete the subtask',
});

export const reorderSubtasks = optimistic('projectTasks/reorderSubtasks', {
  local: (task, { subtaskIds }) => {
    const byId = new Map(task.subtasks.map((s) => [s._id, s]));
    task.subtasks = subtaskIds.map((id) => byId.get(id)).filter(Boolean);
  },
  request: async ({ projectId, taskId, subtaskIds }) =>
    (await API.put(`${base(projectId)}/${taskId}/subtasks/order`, { subtaskIds })).data,
  fallback: 'Could not reorder the subtasks',
});

const bucket = (state, projectId) => {
  if (!state.byProject[projectId]) state.byProject[projectId] = { tasks: [], groups: [], groupsSupported: true, loading: false, loaded: false, error: null };
  return state.byProject[projectId];
};

const projectTasksSlice = createSlice({
  name: 'projectTasks',
  initialState: { byProject: {} },
  reducers: {
    upsertTask: (state, action) => {
      const { projectId, task } = action.payload;
      const b = bucket(state, projectId);
      const i = b.tasks.findIndex((t) => t._id === task._id);
      if (i >= 0) b.tasks[i] = task;
      else b.tasks.push(task);
      b.tasks.sort((a, z) => a.order - z.order);
    },
    removeTask: (state, action) => {
      const b = bucket(state, action.payload.projectId);
      b.tasks = b.tasks.filter((t) => t._id !== action.payload.taskId);
    },
    applyOrder: (state, action) => {
      const { projectId, taskIds } = action.payload;
      const b = bucket(state, projectId);
      const rank = new Map(taskIds.map((id, i) => [id, i]));
      b.tasks.forEach((t) => { if (rank.has(t._id)) t.order = rank.get(t._id); });
      b.tasks.sort((a, z) => a.order - z.order);
    },
    upsertGroup: (state, action) => {
      const { projectId, group } = action.payload;
      const b = bucket(state, projectId);
      b.groups = [...(b.groups || []).filter((g) => g._id !== group._id), group]
        .sort((a, z) => new Date(a.createdAt) - new Date(z.createdAt));
    },
    removeGroup: (state, action) => {
      const { projectId, groupId } = action.payload;
      const b = bucket(state, projectId);
      b.groups = (b.groups || []).filter((g) => g._id !== groupId);
      b.tasks.forEach((t) => { if (t.groupId === groupId) t.groupId = null; });
    },
    patchLocal: (state, action) => {
      const { projectId, taskId, arg, local } = action.payload;
      const task = bucket(state, projectId).tasks.find((t) => t._id === taskId);
      if (task) local(task, arg);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjectTasks.pending, (state, action) => { bucket(state, action.meta.arg).loading = true; })
      .addCase(fetchProjectTasks.fulfilled, (state, action) => {
        const b = bucket(state, action.payload.projectId);
        const { tasks, groups } = action.payload;
        Object.assign(b, { tasks, groups: groups || [], groupsSupported: groups !== null, loading: false, loaded: true, error: null });
      })
      .addCase(fetchProjectTasks.rejected, (state, action) => {
        Object.assign(bucket(state, action.meta.arg), { loading: false, error: action.payload });
      })
      .addCase(deleteProjectTask.fulfilled, (state, action) => {
        const { projectId, taskId } = action.meta.arg;
        const b = bucket(state, projectId);
        b.tasks = b.tasks.filter((t) => t._id !== taskId);
      });
  },
});

export const { upsertTask, removeTask, applyOrder, upsertGroup, removeGroup } = projectTasksSlice.actions;
export default projectTasksSlice.reducer;
