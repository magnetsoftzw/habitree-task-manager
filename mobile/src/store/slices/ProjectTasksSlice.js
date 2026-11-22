import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/Client';
import { errorMessage } from '../../utils/Format';
import { setOpenTaskCount } from './ProjectsSlice';
import { isNetworkError, OFFLINE_MESSAGE, refreshAfterFailure, send } from '../../sync/SyncEngine';
import { onlineOnly, withId } from '../../sync/Thunks';
import { objectId } from '../../sync/ObjectId';

const base = (projectId) => `/projects/${projectId}/tasks`;
const groupBase = (projectId) => `/projects/${projectId}/task-groups`;

const findTask = (state, projectId, taskId) => state.projectTasks.byProject[projectId]?.tasks.find((t) => t._id === taskId);

const syncCount = (dispatch, getState, projectId) => {
  const tasks = getState().projectTasks.byProject[projectId]?.tasks || [];
  dispatch(setOpenTaskCount({ projectId, count: tasks.filter((t) => t.status !== 'done').length }));
};

const optimistic = (type, { local, request, fallback, label = 'A task list change' }) => createAsyncThunk(type, async (arg, { dispatch, getState, rejectWithValue }) => {
  const { projectId, taskId } = arg;
  const snapshot = taskId ? findTask(getState(), projectId, taskId) : null;
  const order = getState().projectTasks.byProject[projectId]?.tasks.map((t) => t._id);
  if (local) dispatch(projectTasksSlice.actions.patchLocal({ projectId, taskId, arg, local }));
  syncCount(dispatch, getState, projectId);
  const req = request(arg);
  try {
    const sent = await send({ dispatch, getState }, { ...req, kinds: [`projectTasks:${projectId}`], label });
    const result = sent.queued ? null : sent.data;
    if (result?.task) dispatch(projectTasksSlice.actions.upsertTask({ projectId, task: result.task }));
    if (req.removes) dispatch(projectTasksSlice.actions.removeTask({ projectId, taskId: req.removes }));
    syncCount(dispatch, getState, projectId);
    return result || { queued: true };
  } catch (error) {
    if (snapshot) dispatch(projectTasksSlice.actions.upsertTask({ projectId, task: snapshot }));
    if (order && !taskId) dispatch(projectTasksSlice.actions.applyOrder({ projectId, taskIds: order }));
    refreshAfterFailure([`projectTasks:${projectId}`]);
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
    return rejectWithValue(isNetworkError(error) ? OFFLINE_MESSAGE : errorMessage(error, 'Could not load the task list'));
  }
}, onlineOnly);

const createTaskThunk = optimistic('projectTasks/create', {
  request: ({ projectId, ...body }) => ({ method: 'post', url: base(projectId), body }),
  label: 'A new list task',
  fallback: 'Could not add the task',
});

export const createProjectTask = Object.assign((arg) => (dispatch, getState) => {
  const full = { ...arg, _id: arg._id || objectId() };
  const { projectId, ...body } = full;
  const tasks = getState().projectTasks.byProject[projectId]?.tasks || [];
  const now = new Date().toISOString();
  dispatch(projectTasksSlice.actions.upsertTask({
    projectId,
    task: {
      status: 'not_started', notes: '', dueDate: null, groupId: null, subtasks: [], ...body,
      projectId, order: tasks.reduce((m, t) => Math.max(m, t.order ?? 0), -1) + 1, createdAt: now, updatedAt: now,
    },
  }));
  return dispatch(createTaskThunk(full)).then((r) => {
    if (r.error) dispatch(projectTasksSlice.actions.removeTask({ projectId, taskId: full._id }));
    return r.error ? r : { ...r, payload: findTask(getState(), projectId, full._id) || r.payload };
  });
}, createTaskThunk);

export const updateProjectTask = optimistic('projectTasks/update', {
  local: (task, { updates }) => {
    Object.assign(task, updates);
    if (updates.status) task.completedAt = updates.status === 'done' ? new Date().toISOString() : null;
  },
  request: ({ projectId, taskId, updates }) => ({ method: 'patch', url: `${base(projectId)}/${taskId}`, body: updates }),
  label: 'A list task edit',
  fallback: 'Could not save the task',
});

export const deleteProjectTask = optimistic('projectTasks/delete', {
  request: ({ projectId, taskId }) => ({ method: 'delete', url: `${base(projectId)}/${taskId}`, removes: taskId }),
  label: 'Deleting a list task',
  fallback: 'Could not delete the task',
});

export const reorderProjectTasks = createAsyncThunk('projectTasks/reorder', async ({ projectId, taskIds }, { dispatch, getState, rejectWithValue }) => {
  const previous = getState().projectTasks.byProject[projectId]?.tasks.map((t) => t._id);
  dispatch(projectTasksSlice.actions.applyOrder({ projectId, taskIds }));
  try {
    await send({ dispatch, getState }, { method: 'put', url: `${base(projectId)}/order`, body: { taskIds }, kinds: [`projectTasks:${projectId}`], label: 'Reordering a list' });
    return taskIds;
  } catch (error) {
    if (previous) dispatch(projectTasksSlice.actions.applyOrder({ projectId, taskIds: previous }));
    return rejectWithValue(errorMessage(error, 'Could not reorder the list'));
  }
});

const groupWrite = (type, { request, apply, revert, fallback, label }) => createAsyncThunk(type, async (arg, { dispatch, getState, rejectWithValue }) => {
  const undo = revert ? revert(arg, getState) : null;
  apply(arg, dispatch);
  try {
    const sent = await send({ dispatch, getState }, { ...request(arg), kinds: [`projectTasks:${arg.projectId}`], label });
    if (!sent.queued && sent.data?.group) dispatch(projectTasksSlice.actions.upsertGroup({ projectId: arg.projectId, group: sent.data.group }));
    return sent.data?.group || arg;
  } catch (error) {
    if (undo) undo(dispatch);
    refreshAfterFailure([`projectTasks:${arg.projectId}`]);
    return rejectWithValue(errorMessage(error, fallback));
  }
});

const groupOf = (getState, projectId, groupId) => (getState().projectTasks.byProject[projectId]?.groups || []).find((g) => g._id === groupId);

export const createTaskGroup = withId(groupWrite('projectTasks/createGroup', {
  request: ({ projectId, name, _id }) => ({ method: 'post', url: groupBase(projectId), body: { _id, name } }),
  apply: ({ projectId, name, _id }, dispatch) => dispatch(projectTasksSlice.actions.upsertGroup({ projectId, group: { _id, name, projectId, createdAt: new Date().toISOString() } })),
  revert: ({ projectId, _id }) => (dispatch) => dispatch(projectTasksSlice.actions.removeGroup({ projectId, groupId: _id })),
  label: 'A new task group',
  fallback: 'Could not create the group',
}));

export const renameTaskGroup = groupWrite('projectTasks/renameGroup', {
  request: ({ projectId, groupId, name }) => ({ method: 'put', url: `${groupBase(projectId)}/${groupId}`, body: { name } }),
  apply: ({ projectId, groupId, name }, dispatch) => dispatch(projectTasksSlice.actions.renameGroupLocal({ projectId, groupId, name })),
  revert: ({ projectId, groupId }, getState) => {
    const before = groupOf(getState, projectId, groupId);
    return (dispatch) => before && dispatch(projectTasksSlice.actions.upsertGroup({ projectId, group: before }));
  },
  label: 'Renaming a task group',
  fallback: 'Could not rename the group',
});

export const deleteTaskGroup = groupWrite('projectTasks/deleteGroup', {
  request: ({ projectId, groupId }) => ({ method: 'delete', url: `${groupBase(projectId)}/${groupId}` }),
  apply: ({ projectId, groupId }, dispatch) => dispatch(projectTasksSlice.actions.removeGroup({ projectId, groupId })),
  label: 'Deleting a task group',
  fallback: 'Could not delete the group',
});

const addSubtaskThunk = optimistic('projectTasks/addSubtask', {
  local: (task, { _id, title }) => {
    const order = (task.subtasks || []).reduce((m, s) => Math.max(m, s.order ?? 0), -1) + 1;
    task.subtasks = [...(task.subtasks || []), { _id, title: title.trim(), done: false, shelved: false, order }];
  },
  request: ({ projectId, taskId, title, _id }) => ({ method: 'post', url: `${base(projectId)}/${taskId}/subtasks`, body: { _id, title } }),
  label: 'A new subtask',
  fallback: 'Could not add the subtask',
});

export const addSubtask = withId(addSubtaskThunk);

export const updateSubtask = optimistic('projectTasks/updateSubtask', {
  local: (task, { subtaskId, updates }) => {
    const sub = task.subtasks.find((s) => s._id === subtaskId);
    if (sub) Object.assign(sub, updates);
  },
  request: ({ projectId, taskId, subtaskId, updates }) => ({ method: 'patch', url: `${base(projectId)}/${taskId}/subtasks/${subtaskId}`, body: updates }),
  label: 'A subtask edit',
  fallback: 'Could not save the subtask',
});

export const deleteSubtask = optimistic('projectTasks/deleteSubtask', {
  local: (task, { subtaskId }) => { task.subtasks = task.subtasks.filter((s) => s._id !== subtaskId); },
  request: ({ projectId, taskId, subtaskId }) => ({ method: 'delete', url: `${base(projectId)}/${taskId}/subtasks/${subtaskId}` }),
  label: 'Deleting a subtask',
  fallback: 'Could not delete the subtask',
});

export const reorderSubtasks = optimistic('projectTasks/reorderSubtasks', {
  local: (task, { subtaskIds }) => {
    const byId = new Map(task.subtasks.map((s) => [s._id, s]));
    task.subtasks = subtaskIds.map((id) => byId.get(id)).filter(Boolean);
  },
  request: ({ projectId, taskId, subtaskIds }) => ({ method: 'put', url: `${base(projectId)}/${taskId}/subtasks/order`, body: { subtaskIds } }),
  label: 'Reordering subtasks',
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
    renameGroupLocal: (state, action) => {
      const { projectId, groupId, name } = action.payload;
      const g = (bucket(state, projectId).groups || []).find((x) => x._id === groupId);
      if (g) g.name = name;
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
        const b = bucket(state, action.meta.arg);
        Object.assign(b, { loading: false, error: b.loaded ? null : action.payload });
      })
      .addCase(deleteProjectTask.pending, (state, action) => {
        const { projectId, taskId } = action.meta.arg;
        const b = bucket(state, projectId);
        b.tasks = b.tasks.filter((t) => t._id !== taskId);
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
