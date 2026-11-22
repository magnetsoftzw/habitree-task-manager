import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/Client';
import { errorMessage } from '../../utils/Format';

const wrap = (fn, fallback) => async (arg, api) => {
  try {
    return await fn(arg, api);
  } catch (error) {
    return api.rejectWithValue(errorMessage(error, fallback));
  }
};

export const fetchPlanner = createAsyncThunk('planner/fetch', wrap(async (date) => ({
  date,
  planner: (await API.get(`/planner/${date}`)).data,
})));

export const addToPlanner = createAsyncThunk('planner/add', wrap(async ({ date, ...entry }) => ({
  date,
  planner: (await API.post(`/planner/${date}/add`, entry)).data,
}), 'Could not add that to your plan'));

export const removeFromPlanner = createAsyncThunk('planner/remove', wrap(async ({ date, entryId }) => ({
  date,
  planner: (await API.delete(`/planner/${date}/${entryId}`)).data.planner,
}), 'Could not remove that block'));

export const updatePlannerEntry = createAsyncThunk('planner/update', wrap(async ({ date, entryId, ...updates }) => ({
  date,
  planner: (await API.patch(`/planner/${date}/${entryId}`, updates)).data.planner,
}), 'Could not update that block'));

export const rolloverPlanner = createAsyncThunk('planner/rollover', wrap(async (date) =>
  (await API.post('/planner/rollover', { date })).data));

export const fetchPlannerRange = createAsyncThunk('planner/range', wrap(async ({ from, to }) =>
  (await API.get('/planner/range', { params: { from, to } })).data.days));

const sortEntries = (entries = []) => [...entries].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

const plannerSlice = createSlice({
  name: 'planner',
  initialState: { byDate: {}, range: {}, loading: false },
  reducers: {
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
      state.byDate[date] = sortEntries(planner?.tasks);
    };
    builder
      .addCase(fetchPlanner.pending, (state) => { state.loading = true; })
      .addCase(fetchPlanner.rejected, (state) => { state.loading = false; })
      .addCase(fetchPlanner.fulfilled, store)
      .addCase(addToPlanner.fulfilled, store)
      .addCase(removeFromPlanner.fulfilled, store)
      .addCase(updatePlannerEntry.fulfilled, store)
      .addCase(fetchPlannerRange.fulfilled, (state, action) => {
        const { from, to } = action.meta.arg;
        Object.keys(state.range).forEach((d) => { if (d >= from && d <= to) delete state.range[d]; });
        action.payload.forEach((d) => { state.range[d.date] = d.entries; });
      });
  },
});

export const { markEntrySubtask, markEntryTask } = plannerSlice.actions;
export default plannerSlice.reducer;
