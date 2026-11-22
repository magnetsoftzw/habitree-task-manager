import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/axiosInstance';

export const fetchSingleProject = createAsyncThunk(
    'projects/fetchSingle',
    async (projectId, { rejectWithValue }) => {
        try {
            const response = await API.get(`/projects/${projectId}`);
            return response.data.project;
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

export const fetchProjects = createAsyncThunk(
    'projects/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await API.get('/projects');
            return response.data.projects;
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

export const createProject = createAsyncThunk(
    'projects/create',
    async (projectData, { rejectWithValue }) => {
        try {
            const response = await API.post('/projects', projectData);
            return response.data.project; 
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

export const updateProject = createAsyncThunk(
    'projects/update',
    async ({ projectId, updates }, { rejectWithValue }) => {
        try {
            const { data } = await API.put(`/projects/${projectId}`, updates);
            return data.project || data;
        } catch (error) {
            return rejectWithValue(error.response?.data);
        }
    }
);

export const deleteProject = createAsyncThunk(
    'projects/delete',
    async (projectId, { rejectWithValue }) => {
        try {
            await API.delete(`/projects/${projectId}`);
            return projectId;
        } catch (error) {
            return rejectWithValue(error.response?.data);
        }
    }
);

export const addTaskToColumn = createAsyncThunk(
    'projects/addTask',
    async ({ projectId, columnId }, { rejectWithValue }) => {
        try {
            const response = await API.post(`/projects/${projectId}/add-task`, {
                columnId: columnId,
                title: "New Task" 
            });

            return { 
                newTask: response.data.task, 
                columnId: columnId 
            };
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

// Accepts an array of title strings and creates one task per title in sequence.
// Each fulfilled action updates the Redux column immediately so the UI fills
// in real time rather than waiting for all requests to finish.
export const addTasksFromCSV = createAsyncThunk(
    'projects/addTasksFromCSV',
    async ({ projectId, columnId, titles }, { dispatch, rejectWithValue }) => {
        try {
            const results = [];
            for (const title of titles) {
                const response = await API.post(`/projects/${projectId}/add-task`, {
                    columnId,
                    title,
                });
                results.push({ newTask: response.data.task, columnId });
                // Push each task into the column immediately as it arrives
                dispatch({
                    type: 'projects/addTask/fulfilled',
                    payload: { newTask: response.data.task, columnId },
                });
            }
            return results;
        } catch (error) {
            return rejectWithValue(error.response?.data);
        }
    }
);

export const updateTask = createAsyncThunk(
    'projects/updateTask',
    async ({ taskId, updates }, { rejectWithValue }) => {
        try {
            const response = await API.put(`/tasks/${taskId}`, updates);
            // Check your backend: Is it response.data.task or just response.data?
            return response.data.task || response.data; 
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

export const deleteTask = createAsyncThunk(
    'projects/deleteTask',
    async ({ taskId, columnId }, { rejectWithValue }) => {
        try {
            await API.delete(`/tasks/${taskId}`);
            return { taskId, columnId };
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

// Deletes every task in a column sequentially, then clears the column in state.
export const deleteAllFromColumn = createAsyncThunk(
    'projects/deleteAllFromColumn',
    async ({ columnId, taskIds }, { rejectWithValue }) => {
        try {
            for (const taskId of taskIds) {
                await API.delete(`/tasks/${taskId}`);
            }
            return { columnId };
        } catch (error) {
            return rejectWithValue(error.response?.data);
        }
    }
);

// Move a selection of tasks from their current columns to a target column.
export const moveSelectedTasks = createAsyncThunk(
    'projects/moveSelectedTasks',
    async ({ projectId, tasks, toColumn }, { rejectWithValue }) => {
        // tasks: [{ taskId, fromColumn }]
        try {
            for (const { taskId, fromColumn } of tasks) {
                if (fromColumn === toColumn) continue;
                await API.put(`/projects/${projectId}/move`, { taskId, fromColumn, toColumn });
            }
            return { tasks, toColumn };
        } catch (error) {
            return rejectWithValue(error.response?.data);
        }
    }
);

// Delete a selection of tasks (each may be in a different column).
export const deleteSelectedTasks = createAsyncThunk(
    'projects/deleteSelectedTasks',
    async ({ taskIds }, { rejectWithValue }) => {
        try {
            for (const taskId of taskIds) {
                await API.delete(`/tasks/${taskId}`);
            }
            return { taskIds };
        } catch (error) {
            return rejectWithValue(error.response?.data);
        }
    }
);

export const moveTaskBetweenColumns = createAsyncThunk(
    'projects/moveTask',
    async ({ projectId, taskId, fromColumn, toColumn }, { rejectWithValue }) => {
        try {
            const response = await API.put(`/projects/${projectId}/move`, {
                taskId,
                fromColumn,
                toColumn
            });

            return { taskId, fromColumn, toColumn, project: response.data.project };
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

const projectSlice = createSlice({
    name: 'projects',
    initialState: {
        items: [],
        currentProject: null,
        loading: false,
        error: null,
        createLoading: false, 
        moveLoading: false,
        bulkMoveLoading: false,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchSingleProject.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchSingleProject.fulfilled, (state, action) => {
                state.loading = false;
                state.currentProject = action.payload;
            })
            .addCase(fetchSingleProject.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.message;
            })
            .addCase(fetchProjects.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchProjects.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchProjects.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.message;
            })

            .addCase(updateProject.fulfilled, (state, action) => {
                const p = action.payload;
                if (!p?._id) return;
                const i = state.items.findIndex((x) => x._id === p._id);
                if (i !== -1) state.items[i] = { ...state.items[i], name: p.name, description: p.description, techStack: p.techStack, color: p.color };
                if (state.currentProject?._id === p._id) {
                    Object.assign(state.currentProject, { name: p.name, description: p.description, techStack: p.techStack, color: p.color });
                }
            })
            .addCase(deleteProject.fulfilled, (state, action) => {
                state.items = state.items.filter((p) => p._id !== action.payload);
                if (state.currentProject?._id === action.payload) state.currentProject = null;
            })
            .addCase(createProject.pending, (state) => {
                state.createLoading = true;
            })
            .addCase(createProject.fulfilled, (state, action) => {
                state.createLoading = false;
                state.items.unshift(action.payload);
            })
            .addCase(createProject.rejected, (state, action) => {
                state.createLoading = false;
                state.error = action.payload?.message;
            })
            .addCase(addTaskToColumn.fulfilled, (state, action) => {
                const { newTask, columnId } = action.payload;
                
                // Ensure currentProject is loaded before pushing
                if (state.currentProject && state.currentProject.kanban[columnId]) {
                    state.currentProject.kanban[columnId].push(newTask);
                }
            })
            .addCase(addTaskToColumn.rejected, (state, action) => {
                state.error = action.payload?.message || "Failed to add task";
            })
            .addCase(updateTask.fulfilled, (state, action) => {
                const updatedTask = action.payload;
                
                // If the server failed to send the task back, stop here
                if (!updatedTask) {
                    console.error("Update successful, but no task data returned from server.");
                    return;
                }

                const columnId = updatedTask.kanban; 

                // Check if the project, the kanban object, and the specific column exist
                if (state.currentProject?.kanban?.[columnId]) {
                    const index = state.currentProject.kanban[columnId].findIndex(t => t._id === updatedTask._id);
                    if (index !== -1) {
                        const existing = state.currentProject.kanban[columnId][index];
                        state.currentProject.kanban[columnId][index] = {
                            ...existing,
                            ...updatedTask,
                            userId: existing.userId,
                            focusMinutes: existing.focusMinutes,
                        };
                    }
                }
            })
            .addCase(deleteTask.fulfilled, (state, action) => {
                const { taskId, columnId } = action.payload;
                if (state.currentProject) {
                    state.currentProject.kanban[columnId] = state.currentProject.kanban[columnId].filter(
                        t => t._id !== taskId
                    );
                }
            })
            .addCase(deleteAllFromColumn.fulfilled, (state, action) => {
                const { columnId } = action.payload;
                if (state.currentProject?.kanban?.[columnId]) {
                    state.currentProject.kanban[columnId] = [];
                }
            })
            .addCase(moveSelectedTasks.pending, (state) => {
                state.bulkMoveLoading = true;
            })
            .addCase(moveSelectedTasks.fulfilled, (state, action) => {
                state.bulkMoveLoading = false;
                const { tasks, toColumn } = action.payload;
                if (!state.currentProject) return;
                for (const { taskId, fromColumn } of tasks) {
                    if (fromColumn === toColumn) continue;
                    const col = state.currentProject.kanban[fromColumn];
                    const taskObj = col?.find(t => t._id === taskId);
                    if (taskObj) {
                        state.currentProject.kanban[fromColumn] =
                            col.filter(t => t._id !== taskId);
                        state.currentProject.kanban[toColumn].push({
                            ...taskObj,
                            kanban: toColumn,
                        });
                    }
                }
            })
            .addCase(deleteSelectedTasks.fulfilled, (state, action) => {                const { taskIds } = action.payload;
                if (!state.currentProject) return;
                const idSet = new Set(taskIds);
                for (const col of Object.keys(state.currentProject.kanban)) {
                    state.currentProject.kanban[col] =
                        state.currentProject.kanban[col].filter(t => !idSet.has(t._id));
                }
            })
            .addCase(moveTaskBetweenColumns.pending, (state, action) => {
                const { taskId, fromColumn, toColumn } = action.meta.arg;
                const board = state.currentProject?.kanban;
                const card = board?.[fromColumn]?.find((t) => t._id === taskId);
                if (!card || !board[toColumn]) return;
                board[fromColumn] = board[fromColumn].filter((t) => t._id !== taskId);
                board[toColumn].push({ ...card, kanban: toColumn });
            })
            .addCase(moveTaskBetweenColumns.rejected, (state, action) => {
                const { taskId, fromColumn, toColumn } = action.meta.arg;
                const board = state.currentProject?.kanban;
                const card = board?.[toColumn]?.find((t) => t._id === taskId);
                if (card && board[fromColumn]) {
                    board[toColumn] = board[toColumn].filter((t) => t._id !== taskId);
                    board[fromColumn].push({ ...card, kanban: fromColumn });
                }
                state.error = action.payload?.message;
            })
            .addCase(moveSelectedTasks.rejected, (state) => {
                state.bulkMoveLoading = false;
            });
    }
});

export default projectSlice.reducer;