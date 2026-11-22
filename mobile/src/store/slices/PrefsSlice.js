import { createSlice } from '@reduxjs/toolkit';

const prefsSlice = createSlice({
  name: 'prefs',
  initialState: { themeMode: 'system', projectViews: {} },
  reducers: {
    setThemeMode: (state, action) => { state.themeMode = action.payload; },
    setProjectView: (state, action) => {
      state.projectViews[action.payload.projectId] = action.payload.view;
    },
  },
});

export const { setThemeMode, setProjectView } = prefsSlice.actions;
export default prefsSlice.reducer;
