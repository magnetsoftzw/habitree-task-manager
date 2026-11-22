import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/Client';
import { addDays, errorMessage, startOfDay, startOfMonth, startOfWeek, tzOffset } from '../../utils/Format';

export const rangeBounds = (range, now = new Date()) => {
  if (range === 'Today') return { from: startOfDay(now), to: addDays(startOfDay(now), 1) };
  if (range === 'Month') {
    const from = startOfMonth(now);
    return { from, to: new Date(from.getFullYear(), from.getMonth() + 1, 1) };
  }
  const from = startOfWeek(now);
  return { from, to: addDays(from, 7) };
};

const getRange = async (from, to) => (await API.get('/stats/range', {
  params: { from: from.toISOString(), to: to.toISOString(), tz: tzOffset(from) },
})).data;

export const fetchRangeStats = createAsyncThunk('stats/range', async (key, { rejectWithValue }) => {
  try {
    if (key === 'Today' || key === 'Week' || key === 'Month') {
      const { from, to } = rangeBounds(key);
      return { key, data: await getRange(from, to) };
    }
    const [y, m] = key.split('-').map(Number);
    return { key, data: await getRange(new Date(y, m - 1, 1), new Date(y, m, 1)) };
  } catch (error) {
    return rejectWithValue(errorMessage(error, 'Could not load your stats'));
  }
});

export const fetchTaskVolume = createAsyncThunk('stats/volume', async () => (await API.get('/stats/tasks')).data);
export const fetchActivity = createAsyncThunk('stats/activity', async () => (await API.get('/stats/activity')).data.activity);

const statsSlice = createSlice({
  name: 'stats',
  initialState: { ranges: {}, volume: null, activity: [], loading: {}, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRangeStats.pending, (state, action) => { state.loading[action.meta.arg] = true; })
      .addCase(fetchRangeStats.fulfilled, (state, action) => {
        state.loading[action.payload.key] = false;
        state.ranges[action.payload.key] = action.payload.data;
        state.error = null;
      })
      .addCase(fetchRangeStats.rejected, (state, action) => {
        state.loading[action.meta.arg] = false;
        state.error = action.payload;
      })
      .addCase(fetchTaskVolume.fulfilled, (state, action) => { state.volume = action.payload; })
      .addCase(fetchActivity.fulfilled, (state, action) => { state.activity = action.payload; });
  },
});

export default statsSlice.reducer;
