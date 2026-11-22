import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/axiosInstance';
import { syncSessions } from './sessionSlice';

// Accepts an optional date string (YYYY-MM-DD). Defaults to today on the backend.
export const fetchTodayStats = createAsyncThunk(
    'stats/today',
    async (date) => {
        const params = date ? `?date=${date}` : '';
        const response = await API.get(`/stats/day${params}`);
        return response.data;
    }
);

const applyDay = (state, day) => {
    state.efficiencyScore = day.efficiencyScore || 0;
    state.totalProductivityMinutes = day.totalMinutes || day.totalProductivityMinutes || 0;
    state.sessionsCount = day.sessionsCount || 0;
    state.activeDate = day.date || null;
};

const statsSlice = createSlice({
    name: 'stats',
    initialState: {
        efficiencyScore: 0,
        totalProductivityMinutes: 0,
        sessionsCount: 0,
        activeDate: null,
        loading: false,
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchTodayStats.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchTodayStats.fulfilled, (state, action) => {
                state.loading = false;
                applyDay(state, action.payload);
            })
            .addCase(syncSessions.fulfilled, (state, action) => {
                if (action.payload.day) applyDay(state, action.payload.day);
            })
            .addCase(fetchTodayStats.rejected, (state) => {
                state.loading = false;
            });
    },
});

export default statsSlice.reducer;