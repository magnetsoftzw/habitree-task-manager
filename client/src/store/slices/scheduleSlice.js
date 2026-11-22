import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { toDateKey } from '../../utils/Format';
import API from '../../api/axiosInstance';

const failure = (error, fallback) => ({
    status: error.response?.status,
    message: error.response?.data?.message || fallback,
    ...error.response?.data,
});

export const fetchSchedule = createAsyncThunk('schedule/fetch', async (date, { rejectWithValue }) => {
    try {
        const { data } = await API.get(`/schedule/${date}`);
        return { ...data, date };
    } catch (error) {
        return rejectWithValue(failure(error, "Couldn't load the schedule."));
    }
});

export const fetchScheduleTemplate = createAsyncThunk('schedule/fetchTemplate', async (_, { rejectWithValue }) => {
    try {
        const { data } = await API.get('/schedule/template');
        return data.template;
    } catch (error) {
        return rejectWithValue(failure(error, "Couldn't load your daily template."));
    }
});

export const updateTemplateSegment = createAsyncThunk('schedule/updateTemplateSegment', async ({ key, changes }, { rejectWithValue }) => {
    try {
        const { data } = await API.patch(`/schedule/template/segments/${key}`, { ...changes, today: toDateKey() });
        return { template: data.template, affected: data.affected || 0 };
    } catch (error) {
        return rejectWithValue(failure(error, "Couldn't save that change."));
    }
});

export const shiftSchedule = createAsyncThunk('schedule/shift', async ({ date, segmentKey, offsetMinutes, confirm = false }, { rejectWithValue }) => {
    try {
        const { data } = await API.post(`/schedule/${date}/shift`, { segmentKey, offsetMinutes, confirm });
        return { ...data, date };
    } catch (error) {
        return rejectWithValue(failure(error, "Couldn't move that work period."));
    }
});

export const resizeSchedule = createAsyncThunk('schedule/resize', async ({ date, segmentKey, edge, offsetMinutes, confirm = false }, { rejectWithValue }) => {
    try {
        const { data } = await API.post(`/schedule/${date}/resize`, { segmentKey, edge, offsetMinutes, confirm });
        return { ...data, date };
    } catch (error) {
        return rejectWithValue(failure(error, "Couldn't resize that segment."));
    }
});

export const resetSchedule = createAsyncThunk('schedule/reset', async (date, { rejectWithValue }) => {
    try {
        const { data } = await API.delete(`/schedule/${date}`);
        return { ...data, date };
    } catch (error) {
        return rejectWithValue(failure(error, "Couldn't reset this day."));
    }
});

const store = (state, payload) => {
    const schedule = payload.schedule || payload;
    state.byDate[payload.date] = {
        segments: schedule.segments || [],
        isOverride: Boolean(schedule.isOverride),
    };
};

const scheduleSlice = createSlice({
    name: 'schedule',
    initialState: { byDate: {}, template: null, errors: {} },
    reducers: {
        invalidateSchedules(state) {
            state.byDate = {};
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSchedule.fulfilled, (state, action) => {
                store(state, action.payload);
                delete state.errors[action.payload.date];
            })
            .addCase(fetchSchedule.rejected, (state, action) => {
                state.errors[action.meta.arg] = action.payload?.message || "Couldn't load the schedule.";
            })
            .addCase(fetchScheduleTemplate.fulfilled, (state, action) => {
                state.template = action.payload;
            })
            .addCase(updateTemplateSegment.pending, (state, action) => {
                const segs = state.template?.segments || [];
                const i = segs.findIndex((s) => s.key === action.meta.arg.key);
                if (i < 0) return;
                Object.assign(segs[i], action.meta.arg.changes);
                const { start, end } = action.meta.arg.changes;
                if (start !== undefined && i > 0) segs[i - 1].end = start;
                if (end !== undefined && i < segs.length - 1) segs[i + 1].start = end;
            })
            .addCase(updateTemplateSegment.fulfilled, (state, action) => {
                state.template = action.payload.template;
                state.byDate = {};
            })
            .addCase(shiftSchedule.fulfilled, (state, action) => store(state, action.payload))
            .addCase(resizeSchedule.fulfilled, (state, action) => store(state, action.payload))
            .addCase(resetSchedule.fulfilled, (state, action) => store(state, action.payload));
    },
});

export const { invalidateSchedules } = scheduleSlice.actions;
export default scheduleSlice.reducer;
