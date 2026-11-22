import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/axiosInstance';
import { clearToken, getToken, setToken } from '../../api/Token';

export const loginUser = createAsyncThunk(
    'auth/login',
    async ({ remember = true, ...credentials }, { rejectWithValue }) => {
        try {
            const response = await API.post('/auth/login', credentials);
            setToken(response.data.token, remember);
            return response.data.user;

        } catch (err) {
            return rejectWithValue(err.response?.data?.message || "Login failed");
        }
    }
);

export const registerUser = createAsyncThunk(
    'auth/register',
    async (userData, { rejectWithValue }) => {
        try {
            const response = await API.post('/auth/register', userData);
            setToken(response.data.token);
            return response.data.user;
        }catch(err) {
            return rejectWithValue(err.response?.data?.message ||"Registration failed");
        }
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        user: null,
        isAuthenticated: !!getToken(),
        loading: false,
        error: null,
    },
    reducers: {
        logout: (state) => {
            clearToken();
            state.user = null;
            state.isAuthenticated = false;
            state.error = null;
        },
        clearAuthError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(loginUser.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload;
                state.isAuthenticated = true;
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(registerUser.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(registerUser.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload;
                state.isAuthenticated = true;
            })
            .addCase(registerUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
    }
});

export const { logout, clearAuthError } = authSlice.actions;
export default authSlice.reducer;