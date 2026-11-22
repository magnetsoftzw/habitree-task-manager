import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API, { TOKEN_KEY } from '../../api/Client';
import { errorMessage } from '../../utils/Format';

const authenticate = (path, fallback) => async (body, { rejectWithValue }) => {
  try {
    const { data } = await API.post(path, body);
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    const { token, success, message, user, ...flat } = data;
    return { user: user || flat, token };
  } catch (error) {
    return rejectWithValue(errorMessage(error, fallback));
  }
};

export const loginUser = createAsyncThunk('auth/login', authenticate('/auth/login', 'Login failed'));
export const registerUser = createAsyncThunk('auth/register', authenticate('/auth/register', 'Registration failed'));

export const logout = createAsyncThunk('auth/logout', async () => {
  await AsyncStorage.removeItem(TOKEN_KEY);
});

export const fetchMe = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const { data } = await API.get('/users/me');
    return data;
  } catch (error) {
    return rejectWithValue(errorMessage(error));
  }
});

export const updateProfile = createAsyncThunk('auth/updateProfile', async (updates, { rejectWithValue }) => {
  try {
    const { data } = await API.put('/users/me', updates);
    return data;
  } catch (error) {
    return rejectWithValue(errorMessage(error, 'Could not update your profile'));
  }
});

export const updateSettings = createAsyncThunk('auth/updateSettings', async (updates, { rejectWithValue }) => {
  try {
    const { data } = await API.patch('/users/settings', updates);
    return data.settings;
  } catch (error) {
    return rejectWithValue(errorMessage(error, 'Could not save that setting'));
  }
});

export const changePassword = createAsyncThunk('auth/changePassword', async (body, { rejectWithValue }) => {
  try {
    await API.put('/users/password', body);
    return true;
  } catch (error) {
    return rejectWithValue(errorMessage(error, 'Could not change your password'));
  }
});

export const deleteAccount = createAsyncThunk('auth/deleteAccount', async (password, { dispatch, rejectWithValue }) => {
  try {
    await API.delete('/users/me', { data: { password } });
    await dispatch(logout());
    return true;
  } catch (error) {
    return rejectWithValue(errorMessage(error, 'Could not delete your account'));
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, isAuthenticated: false, loading: false, error: null },
  reducers: {
    clearError: (state) => { state.error = null; },
    sessionExpired: (state) => {
      state.user = null;
      state.isAuthenticated = false;
    },
  },
  extraReducers: (builder) => {
    [loginUser, registerUser].forEach((thunk) => {
      builder
        .addCase(thunk.pending, (state) => { state.loading = true; state.error = null; })
        .addCase(thunk.fulfilled, (state, action) => {
          state.loading = false;
          state.user = action.payload.user;
          state.isAuthenticated = true;
        })
        .addCase(thunk.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
        });
    });
    builder
      .addCase(fetchMe.fulfilled, (state, action) => { state.user = { ...state.user, ...action.payload }; })
      .addCase(updateProfile.fulfilled, (state, action) => { state.user = { ...state.user, ...action.payload }; })
      .addCase(updateSettings.pending, (state, action) => {
        state.user = { ...state.user, settings: { ...state.user?.settings, ...action.meta.arg } };
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.user = { ...state.user, settings: action.payload };
      });
  },
});

export const { clearError, sessionExpired } = authSlice.actions;
export default authSlice.reducer;
