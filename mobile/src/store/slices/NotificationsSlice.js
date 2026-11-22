import { createSlice } from '@reduxjs/toolkit';
import API from '../../api/Client';
import { fetcher, writer } from '../../sync/Thunks';

export const fetchNotifications = fetcher('notifications/fetch', async () =>
  (await API.get('/notifications')).data.notifications || [], 'Could not load notifications');

export const markNotificationRead = writer('notifications/read', {
  request: (id) => ({ method: 'put', url: `/notifications/${id}/read` }),
  local: (id) => id,
  fromServer: (_, id) => id,
  label: 'Marking a notification read',
  fallback: 'Could not update the notification',
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
      .addCase(fetchNotifications.rejected, (state, action) => { state.error = state.loaded ? null : action.payload; })
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
