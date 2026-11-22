import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/Client';
import { errorMessage } from '../../utils/Format';

export const fetchNotifications = createAsyncThunk('notifications/fetch', async (_, { rejectWithValue }) => {
  try {
    return (await API.get('/notifications')).data.notifications || [];
  } catch (error) {
    return rejectWithValue(errorMessage(error, 'Could not load notifications'));
  }
});

export const markNotificationRead = createAsyncThunk('notifications/read', async (id, { rejectWithValue }) => {
  try {
    await API.put(`/notifications/${id}/read`);
    return id;
  } catch (error) {
    return rejectWithValue(errorMessage(error, 'Could not update the notification'));
  }
});

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: { items: [], loaded: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loaded = true;
        state.error = null;
      })
      .addCase(fetchNotifications.rejected, (state, action) => { state.error = action.payload; })
      .addCase(markNotificationRead.pending, (state, action) => {
        const n = state.items.find((x) => x._id === action.meta.arg);
        if (n) n.isRead = true;
      })
      .addCase(markNotificationRead.rejected, (state, action) => {
        const n = state.items.find((x) => x._id === action.meta.arg);
        if (n) n.isRead = false;
      });
  },
});

export default notificationsSlice.reducer;
