import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/Client';
import { fetcher, writer } from '../../sync/Thunks';
import { objectId } from '../../sync/ObjectId';
import { canReachServer } from '../../sync/SyncEngine';

export const fetchPlanner = fetcher('planner/fetch', async (date) => ({
  date,
  planner: (await API.get(`/planner/${date}`)).data,
}));

const snapshotGroup = (state, { taskId, projectId, title }) => {
  const bucket = state.projectTasks.byProject[projectId];
  const project = state.projects.items.find((p) => p._id === projectId) || { _id: projectId };
  const group = bucket?.groups.find((g) => g._id === taskId);
  const tasks = (bucket?.tasks || []).filter((t) => t.groupId === taskId);
  const live = tasks.filter((t) => t.status !== 'shelved');
  const status = live.length && live.every((t) => t.status === 'done') ? 'Completed'
    : live.some((t) => t.status === 'in_progress' || t.status === 'done') ? 'On-Going' : 'Not Started';
  return {
    _id: taskId,
    isGroup: true,
    title: group && project.name ? `${group.name} - ${project.name}` : title,
    name: group?.name,
    status,
    category: 'Project',
    taskCount: tasks.length,
    doneCount: tasks.filter((t) => t.status === 'done').length,
    tasks: tasks.map((t) => ({ _id: t._id, title: t.title })),
    subtasks: [],
    groupId: project,
    projectId: project,
  };
};

const snapshotTask = (state, { taskType, taskId, projectId, subtaskId, title, parentTitle }) => {
  if (taskType === 'projectTaskGroup') return snapshotGroup(state, { taskId, projectId, title });
  if (taskType === 'projectTask') {
    const t = state.projectTasks.byProject[projectId]?.tasks.find((x) => x._id === taskId);
    if (t) return { ...t, projectId: state.projects.items.find((p) => p._id === projectId) || { _id: projectId } };
  } else {
    for (const list of Object.values(state.tasks.inventory)) {
      const t = list.find((x) => x._id === taskId);
      if (t) return t;
    }
    if (state.tasks.current?._id === taskId) return state.tasks.current;
  }
  return {
    _id: taskId,
    title: subtaskId ? parentTitle || title : title,
    status: 'Not Started',
    subtasks: subtaskId ? [{ _id: subtaskId, title, isCompleted: false }] : [],
  };
};

const addThunk = writer('planner/add', {
  request: ({ date, _id, taskType, taskId, projectId, subtaskId, time, duration, comments }) => ({
    method: 'post',
    url: `/planner/${date}/add`,
    body: { _id, taskType, taskId, projectId, subtaskId, time, duration, comments },
    kinds: [`planner:${date}`],
  }),
  local: ({ date }) => ({ date, planner: null }),
  fromServer: (data, { date }) => ({ date, planner: data }),
  label: 'Adding a block to your plan',
  fallback: 'Could not add that to your plan',
});

export const addToPlanner = Object.assign((arg) => (dispatch, getState) => {
  const full = { ...arg, _id: arg._id || objectId() };
  dispatch(plannerSlice.actions.addLocal({ ...full, task: snapshotTask(getState(), full) }));
  return dispatch(addThunk(full));
}, addThunk);

export const removeFromPlanner = writer('planner/remove', {
  request: ({ date, entryId }) => ({ method: 'delete', url: `/planner/${date}/${entryId}`, kinds: [`planner:${date}`] }),
  local: ({ date }) => ({ date, planner: null }),
  fromServer: (data, { date }) => ({ date, planner: data.planner }),
  label: 'Removing a block from your plan',
  fallback: 'Could not remove that block',
});

export const updatePlannerEntry = writer('planner/update', {
  request: ({ date, entryId, ...updates }) => ({ method: 'patch', url: `/planner/${date}/${entryId}`, body: updates, kinds: [`planner:${date}`] }),
  local: ({ date }) => ({ date, planner: null }),
  fromServer: (data, { date }) => ({ date, planner: data.planner }),
  label: 'A change to your plan',
  fallback: 'Could not update that block',
});

export const rolloverPlanner = createAsyncThunk('planner/rollover', async (date, { getState, rejectWithValue }) => {
  if (!canReachServer(getState)) return null;
  try {
    return (await API.post('/planner/rollover', { date })).data;
  } catch {
    return rejectWithValue(null);
  }
});

export const fetchPlannerRange = fetcher('planner/range', async ({ from, to }) =>
  (await API.get('/planner/range', { params: { from, to } })).data.days);

const sortEntries = (entries = []) => [...entries].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

const plannerSlice = createSlice({
  name: 'planner',
  initialState: { byDate: {}, range: {}, loading: false },
  reducers: {
    setPlannerDay: (state, action) => {
      const { date, planner } = action.payload;
      state.byDate[date] = sortEntries(planner?.tasks);
    },
    addLocal: (state, action) => {
      const { date, _id, taskType = 'task', taskId, projectId, subtaskId = null, time, duration, comments = '', task } = action.payload;
      const day = state.byDate[date] || [];
      const exists = day.some((e) => (e.taskType || 'task') === taskType && e.taskId?._id === taskId && (e.subtaskId || null) === (subtaskId || null));
      if (exists) return;
      state.byDate[date] = sortEntries([...day, { _id, taskType, taskId: task, projectId: projectId || null, subtaskId, time, duration, comments, pending: true }]);
    },
    markEntrySubtask: (state, action) => {
      const { taskId, subtaskId, done } = action.payload;
      Object.values(state.byDate).forEach((entries) => entries.forEach((e) => {
        if (e.taskId?._id !== taskId) return;
        const sub = (e.taskId.subtasks || []).find((x) => String(x._id) === String(subtaskId));
        if (sub) { sub.isCompleted = done; sub.done = done; }
      }));
    },
    markEntryTask: (state, action) => {
      const { taskId, status } = action.payload;
      Object.values(state.byDate).forEach((entries) => entries.forEach((e) => {
        if (e.taskId?._id === taskId) e.taskId.status = status;
      }));
    },
  },
  extraReducers: (builder) => {
    const store = (state, action) => {
      state.loading = false;
      const { date, planner } = action.payload;
      if (planner) state.byDate[date] = sortEntries(planner.tasks);
    };
    builder
      .addCase(fetchPlanner.pending, (state) => { state.loading = true; })
      .addCase(fetchPlanner.rejected, (state) => { state.loading = false; })
      .addCase(fetchPlanner.fulfilled, store)
      .addCase(addThunk.fulfilled, store)
      .addCase(addThunk.rejected, (state, action) => {
        const { date, _id } = action.meta.arg;
        if (state.byDate[date]) state.byDate[date] = state.byDate[date].filter((e) => e._id !== _id);
      })
      .addCase(removeFromPlanner.pending, (state, action) => {
        const { date, entryId } = action.meta.arg;
        if (state.byDate[date]) state.byDate[date] = state.byDate[date].filter((e) => e._id !== entryId);
      })
      .addCase(removeFromPlanner.fulfilled, store)
      .addCase(updatePlannerEntry.pending, (state, action) => {
        const { date, entryId, ...updates } = action.meta.arg;
        const day = state.byDate[date];
        if (!day) return;
        state.byDate[date] = sortEntries(day.map((e) => (e._id === entryId ? { ...e, ...updates } : e)));
      })
      .addCase(updatePlannerEntry.fulfilled, store)
      .addCase(fetchPlannerRange.fulfilled, (state, action) => {
        const { from, to } = action.meta.arg;
        Object.keys(state.range).forEach((d) => { if (d >= from && d <= to) delete state.range[d]; });
        action.payload.forEach((d) => { state.range[d.date] = d.entries; });
      });
  },
});

export const { markEntrySubtask, markEntryTask, setPlannerDay } = plannerSlice.actions;
export default plannerSlice.reducer;
