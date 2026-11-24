import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/axiosInstance';

export const fetchTaskById = createAsyncThunk(
    'tasks/fetchById',
    async (taskId, { rejectWithValue }) => {
        try{
            const response = await API.get(`/tasks/${taskId}`);
            return response.data;
        }catch(error) {
            return rejectWithValue(error.response.data);
        }
    }
);

export const fetchInventoryTasks = createAsyncThunk(
    'tasks/fetchAll', 
    async () => {
        const response = await API.get('/tasks');
        return response.data;
    }
);

export const createNewTask = createAsyncThunk(
    'tasks/create',
    async (taskData) => {
        const response = await API.post('/tasks', taskData);
        return response.data;
    }
);

export const updateTask = createAsyncThunk(
    'tasks/update',
    async ({ id, updates }) => {
        const response = await API.put(`/tasks/${id}`, updates);
        return response.data;
    }
);

export const updateTaskAction = createAsyncThunk(
    'tasks/updateTask',
    async ({ id, updates }, { rejectWithValue }) => {
        try {
            const response = await API.put(`/tasks/${id}`, updates);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

export const updateTaskStatus = createAsyncThunk(
    'tasks/updateStatus',
    async ({ id, status }, { rejectWithValue }) => {
        try {
            const response = await API.patch(`/tasks/${id}/status`, { status });
            return response.data.task;
        } catch (error) {
            return rejectWithValue(error.response?.data || { message: 'Could not reach the server' });
        }
    }
);

export const deleteTask = createAsyncThunk(
    'tasks/delete',
    async (id) => {
        await API.delete(`/tasks/${id}`);
        return id;
    }
);

const taskSlice = createSlice({
    name: 'tasks',
    initialState: {
        inventory: {},
        currentTask: null,
        loading: false,
        detailsLoading: false,
        error: null,
    },
    reducers: {
        clearCurrentTask: (state) => {
            state.currentTask = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchTaskById.pending, (state) => {
                state.detailsLoading = true;
            })
            .addCase(fetchTaskById.fulfilled, (state, action) => {
                state.detailsLoading = false;
                state.currentTask = action.payload;
            })
            .addCase(fetchTaskById.rejected, (state, action) => {
                state.detailsLoading = false;
                state.error = action.payload?.message;
            })
            .addCase(fetchInventoryTasks.pending, (state) => {
                state.loading = true
            })
            .addCase(fetchInventoryTasks.fulfilled, (state, action) => {
                state.loading = false;
                state.inventory = action.payload;
            })
            .addCase(createNewTask.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(updateTaskAction.pending, (state, action) => {
                state.loading = true;
                const { id, updates } = action.meta.arg;
                if (state.currentTask?._id === id) {
                    // eslint-disable-next-line no-unused-vars
                    const { groupId, ...rest } = updates;
                    Object.assign(state.currentTask, rest);
                }
            })
            .addCase(updateTaskAction.rejected, (state) => {
                state.loading = false;
            })
            .addCase(updateTaskAction.fulfilled, (state, action) => {
                state.currentTask = action.payload;
                state.loading = false;
            })
            .addCase(updateTaskStatus.pending, (state, action) => {
                const { id, status } = action.meta.arg;
                Object.values(state.inventory || {}).forEach((list) => list.forEach((x) => {
                    if (x._id === id) {
                        x.previousStatus = x.status;
                        x.status = status;
                    }
                }));
            })
            .addCase(updateTaskStatus.rejected, (state, action) => {
                const { id } = action.meta.arg;
                Object.values(state.inventory || {}).forEach((list) => list.forEach((x) => {
                    if (x._id === id && x.previousStatus) x.status = x.previousStatus;
                }));
            })
            .addCase(updateTaskStatus.fulfilled, (state, action) => {
                const t = action.payload;
                if (!t?._id) return;
                Object.values(state.inventory || {}).forEach((list) => list.forEach((x) => {
                    if (x._id === t._id) Object.assign(x, { status: t.status, updatedAt: t.updatedAt });
                }));
                if (state.currentTask?._id === t._id) state.currentTask.status = t.status;
            })
            .addCase(deleteTask.fulfilled, (state, action) => {
                const deletedId = action.payload;
                Object.keys(state.inventory || {}).forEach((key) => {
                    state.inventory[key] = state.inventory[key].filter((t) => t._id !== deletedId);
                });
                if (state.currentTask?._id === deletedId) state.currentTask = null;
            });
    }
});

export const { clearCurrentTask } = taskSlice.actions;
export default taskSlice.reducer;