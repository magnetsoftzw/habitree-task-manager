import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/Client';
import { errorMessage, todayKey } from '../../utils/Format';
import { setPlannerDay } from './PlannerSlice';
import { onlineOnly, requireConnection } from '../../sync/Thunks';

const wrap = (fn, fallback) => async (arg, api) => {
  try {
    return await fn(arg, api);
  } catch (error) {
    return api.rejectWithValue(error.offline ? error.message : errorMessage(error, fallback));
  }
};

const live = (fn) => (arg, api) => {
  requireConnection(api.getState);
  return fn(arg, api);
};

export const fetchSchedule = createAsyncThunk('schedule/fetch', wrap(async (date) => {
  const { data } = await API.get(`/schedule/${date}`);
  return { date, segments: data.segments, isOverride: data.isOverride };
}, 'Could not load the schedule'), onlineOnly);

export const fetchTemplate = createAsyncThunk('schedule/template', wrap(async () =>
  (await API.get('/schedule/template')).data.template, 'Could not load your default schedule'), onlineOnly);

export const updateTemplateSegment = createAsyncThunk('schedule/updateSegment', wrap(live(async ({ key, ...changes }, { dispatch, getState }) => {
  const { data } = await API.patch(`/schedule/template/segments/${key}`, { ...changes, today: todayKey() });
  Object.keys(getState().schedule.byDate).forEach((date) => dispatch(fetchSchedule(date)));
  return { template: data.template, affected: data.affected || 0 };
}), 'Could not save that change'));

export const previewTemplateSegment = createAsyncThunk('schedule/previewSegment', wrap(live(async ({ key, ...changes }) =>
  (await API.patch(`/schedule/template/segments/${key}`, { ...changes, today: todayKey(), dryRun: true })).data.preview), 'Could not check that time'));

export const previewShift = createAsyncThunk('schedule/preview', wrap(live(async ({ date, segmentKey, offsetMinutes }) =>
  (await API.post(`/schedule/${date}/shift`, { segmentKey, offsetMinutes, dryRun: true })).data.preview), 'Could not preview that shift'));

export const applyShift = createAsyncThunk('schedule/shift', wrap(live(async ({ date, segmentKey, offsetMinutes }, { dispatch }) => {
  const { data } = await API.post(`/schedule/${date}/shift`, { segmentKey, offsetMinutes, confirm: true });
  dispatch(setPlannerDay({ date, planner: data.planner }));
  return { date, schedule: data.schedule, preview: data.preview };
}), 'Could not shift that work period'));

export const previewResize = createAsyncThunk('schedule/previewResize', wrap(live(async ({ date, ...body }) =>
  (await API.post(`/schedule/${date}/resize`, { ...body, dryRun: true })).data.preview), 'Could not preview that change'));

export const applyResize = createAsyncThunk('schedule/resize', wrap(live(async ({ date, ...body }, { dispatch }) => {
  const { data } = await API.post(`/schedule/${date}/resize`, { ...body, confirm: true });
  dispatch(setPlannerDay({ date, planner: data.planner }));
  return { date, schedule: data.schedule, preview: data.preview };
}), 'Could not resize that segment'));

export const resetSchedule = createAsyncThunk('schedule/reset', wrap(live(async (date) => {
  const { data } = await API.delete(`/schedule/${date}`);
  return { date, schedule: data.schedule };
}), 'Could not reset this day'));

const scheduleSlice = createSlice({
  name: 'schedule',
  initialState: { byDate: {}, template: null },
  reducers: {},
  extraReducers: (builder) => {
    const storeDay = (state, date, s) => { state.byDate[date] = { segments: s.segments, isOverride: !!s.isOverride }; };
    builder
      .addCase(fetchSchedule.fulfilled, (state, action) => storeDay(state, action.payload.date, action.payload))
      .addCase(fetchTemplate.fulfilled, (state, action) => { state.template = action.payload; })
      .addCase(updateTemplateSegment.fulfilled, (state, action) => { state.template = action.payload.template; })
      .addCase(applyShift.fulfilled, (state, action) => storeDay(state, action.payload.date, action.payload.schedule))
      .addCase(applyResize.fulfilled, (state, action) => storeDay(state, action.payload.date, action.payload.schedule))
      .addCase(resetSchedule.fulfilled, (state, action) => storeDay(state, action.payload.date, action.payload.schedule));
  },
});

export default scheduleSlice.reducer;
