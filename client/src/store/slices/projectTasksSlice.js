import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import API from '../../api/axiosInstance';

const base = (projectId) => `/projects/${projectId}/tasks`;
const fail = (error) => error.response?.data || { message: 'Request failed' };

export const fetchProjectTasks = createAsyncThunk('projectTasks/fetch', async (projectId, { rejectWithValue }) => {
    try {
        const { data } = await API.get(base(projectId));
        return { projectId, tasks: data.tasks || [] };
    } catch (error) {
        return rejectWithValue(fail(error));
    }
});

export const createProjectTask = createAsyncThunk('projectTasks/create', async ({ projectId, ...body }, { rejectWithValue }) => {
    try {
        const { data } = await API.post(base(projectId), body);
        return { projectId, task: data.task };
    } catch (error) {
        return rejectWithValue(fail(error));
    }
});

export const updateProjectTask = createAsyncThunk('projectTasks/update', async ({ projectId, taskId, changes }, { rejectWithValue }) => {
    try {
        const { data } = await API.patch(`${base(projectId)}/${taskId}`, changes);
        return { projectId, task: data.task };
    } catch (error) {
        return rejectWithValue(fail(error));
    }
});

export const deleteProjectTask = createAsyncThunk('projectTasks/delete', async ({ projectId, taskId }, { rejectWithValue }) => {
    try {
        await API.delete(`${base(projectId)}/${taskId}`);
        return { projectId, taskId };
    } catch (error) {
        return rejectWithValue(fail(error));
    }
});

export const reorderProjectTasks = createAsyncThunk('projectTasks/reorder', async ({ projectId, taskIds }, { rejectWithValue }) => {
    try {
        await API.put(`${base(projectId)}/order`, { taskIds });
        return { projectId, taskIds };
    } catch (error) {
        return rejectWithValue(fail(error));
    }
});

export const createSubtask = createAsyncThunk('projectTasks/createSubtask', async ({ projectId, taskId, title }, { rejectWithValue }) => {
    try {
        const { data } = await API.post(`${base(projectId)}/${taskId}/subtasks`, { title });
        return { projectId, task: data.task };
    } catch (error) {
        return rejectWithValue(fail(error));
    }
});

export const updateSubtask = createAsyncThunk('projectTasks/updateSubtask', async ({ projectId, taskId, subtaskId, changes }, { rejectWithValue }) => {
    try {
        const { data } = await API.patch(`${base(projectId)}/${taskId}/subtasks/${subtaskId}`, changes);
        return { projectId, task: data.task };
    } catch (error) {
        return rejectWithValue(fail(error));
    }
});

export const deleteSubtask = createAsyncThunk('projectTasks/deleteSubtask', async ({ projectId, taskId, subtaskId }, { rejectWithValue }) => {
    try {
        const { data } = await API.delete(`${base(projectId)}/${taskId}/subtasks/${subtaskId}`);
        return { projectId, task: data.task };
    } catch (error) {
        return rejectWithValue(fail(error));
    }
});

export const reorderSubtasks = createAsyncThunk('projectTasks/reorderSubtasks', async ({ projectId, taskId, subtaskIds }, { rejectWithValue }) => {
    try {
        const { data } = await API.put(`${base(projectId)}/${taskId}/subtasks/order`, { subtaskIds });
        return { projectId, task: data.task };
    } catch (error) {
        return rejectWithValue(fail(error));
    }
});

const groupBase = (projectId) => `/projects/${projectId}/task-groups`;

export const fetchTaskGroups = createAsyncThunk('projectTasks/fetchGroups', async (projectId, { rejectWithValue }) => {
    try {
        const { data } = await API.get(groupBase(projectId));
        return { projectId, groups: data.groups || [] };
    } catch (error) {
        return rejectWithValue(fail(error));
    }
});

export const createTaskGroup = createAsyncThunk('projectTasks/createGroup', async ({ projectId, name }, { rejectWithValue }) => {
    try {
        const { data } = await API.post(groupBase(projectId), { name });
        return { projectId, group: data.group };
    } catch (error) {
        return rejectWithValue(fail(error));
    }
});

export const renameTaskGroup = createAsyncThunk('projectTasks/renameGroup', async ({ projectId, groupId, name }, { rejectWithValue }) => {
    try {
        const { data } = await API.put(`${groupBase(projectId)}/${groupId}`, { name });
        return { projectId, group: data.group };
    } catch (error) {
        return rejectWithValue(fail(error));
    }
});

export const deleteTaskGroup = createAsyncThunk('projectTasks/deleteGroup', async ({ projectId, groupId }, { rejectWithValue }) => {
    try {
        await API.delete(`${groupBase(projectId)}/${groupId}`);
        return { projectId, groupId };
    } catch (error) {
        return rejectWithValue(fail(error));
    }
});

const entryFor = (state, projectId) => {
    if (!state.byProject[projectId]) {
        state.byProject[projectId] = { tasks: [], groups: [], loading: false, loaded: false, error: null };
    }
    if (!state.byProject[projectId].groups) state.byProject[projectId].groups = [];
    return state.byProject[projectId];
};

const byCreated = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);

const upsertGroup = (state, projectId, group) => {
    if (!group) return;
    const entry = entryFor(state, projectId);
    const i = entry.groups.findIndex((g) => g._id === group._id);
    if (i === -1) entry.groups.push(group);
    else entry.groups[i] = group;
    entry.groups.sort(byCreated);
};

const dropGroup = (state, projectId, groupId) => {
    const entry = entryFor(state, projectId);
    entry.groups = entry.groups.filter((g) => g._id !== groupId);
    entry.tasks.forEach((t) => {
        if (t.groupId === groupId) t.groupId = null;
    });
};

const upsert = (state, projectId, task) => {
    if (!task) return;
    const entry = entryFor(state, projectId);
    const i = entry.tasks.findIndex((t) => t._id === task._id);
    if (i === -1) entry.tasks.push(task);
    else entry.tasks[i] = task;
};

const findTask = (state, projectId, taskId) => state.byProject[projectId]?.tasks.find((t) => t._id === taskId);

const applyOrder = (entry, taskIds) => {
    const pos = new Map(taskIds.map((id, i) => [String(id), i]));
    entry.tasks.sort((a, b) => (pos.get(a._id) ?? 1e9) - (pos.get(b._id) ?? 1e9));
};

const projectTasksSlice = createSlice({
    name: 'projectTasks',
    initialState: { byProject: {} },
    reducers: {
        projectTaskEvent(state, action) {
            const { type, projectId, task, taskId, taskIds } = action.payload;
            const entry = entryFor(state, projectId);
            if (type === 'created' || type === 'updated') upsert(state, projectId, task);
            else if (type === 'deleted') entry.tasks = entry.tasks.filter((t) => t._id !== taskId);
            else if (type === 'reordered') applyOrder(entry, taskIds);
        },
        projectTaskGroupEvent(state, action) {
            const { type, projectId, group, groupId } = action.payload;
            if (type === 'deleted') dropGroup(state, projectId, groupId);
            else upsertGroup(state, projectId, group);
        },
        hideTaskLocally(state, action) {
            const { projectId, taskId } = action.payload;
            const t = findTask(state, projectId, taskId);
            if (t) t._pendingDelete = true;
        },
        restoreTaskLocally(state, action) {
            const { projectId, taskId } = action.payload;
            const t = findTask(state, projectId, taskId);
            if (t) delete t._pendingDelete;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchProjectTasks.pending, (state, action) => {
                const entry = entryFor(state, action.meta.arg);
                entry.loading = true;
                entry.error = null;
            })
            .addCase(fetchProjectTasks.fulfilled, (state, action) => {
                const entry = entryFor(state, action.payload.projectId);
                entry.tasks = action.payload.tasks;
                entry.loading = false;
                entry.loaded = true;
            })
            .addCase(fetchProjectTasks.rejected, (state, action) => {
                const entry = entryFor(state, action.meta.arg);
                entry.loading = false;
                entry.error = action.payload?.message || 'Could not load tasks';
            })
            .addCase(fetchTaskGroups.fulfilled, (state, action) => {
                entryFor(state, action.payload.projectId).groups = [...action.payload.groups].sort(byCreated);
            })
            .addCase(createTaskGroup.fulfilled, (state, action) => upsertGroup(state, action.payload.projectId, action.payload.group))
            .addCase(renameTaskGroup.pending, (state, action) => {
                const { projectId, groupId, name } = action.meta.arg;
                const g = entryFor(state, projectId).groups.find((x) => x._id === groupId);
                if (g) g.name = name;
            })
            .addCase(renameTaskGroup.fulfilled, (state, action) => upsertGroup(state, action.payload.projectId, action.payload.group))
            .addCase(deleteTaskGroup.fulfilled, (state, action) => dropGroup(state, action.payload.projectId, action.payload.groupId))
            .addCase(updateProjectTask.pending, (state, action) => {
                const { projectId, taskId, changes } = action.meta.arg;
                const t = findTask(state, projectId, taskId);
                if (t) Object.assign(t, changes);
            })
            .addCase(deleteProjectTask.fulfilled, (state, action) => {
                const entry = entryFor(state, action.payload.projectId);
                entry.tasks = entry.tasks.filter((t) => t._id !== action.payload.taskId);
            })
            .addCase(reorderProjectTasks.pending, (state, action) => {
                applyOrder(entryFor(state, action.meta.arg.projectId), action.meta.arg.taskIds);
            })
            .addCase(updateSubtask.pending, (state, action) => {
                const { projectId, taskId, subtaskId, changes } = action.meta.arg;
                const sub = findTask(state, projectId, taskId)?.subtasks?.find((s) => s._id === subtaskId);
                if (sub) Object.assign(sub, changes);
            })
            .addCase(deleteSubtask.pending, (state, action) => {
                const { projectId, taskId, subtaskId } = action.meta.arg;
                const t = findTask(state, projectId, taskId);
                if (t) t.subtasks = t.subtasks.filter((s) => s._id !== subtaskId);
            })
            .addCase(reorderSubtasks.pending, (state, action) => {
                const { projectId, taskId, subtaskIds } = action.meta.arg;
                const t = findTask(state, projectId, taskId);
                if (!t) return;
                const pos = new Map(subtaskIds.map((id, i) => [id, i]));
                t.subtasks.sort((a, b) => (pos.get(a._id) ?? 1e9) - (pos.get(b._id) ?? 1e9));
            })
            .addMatcher(
                (action) => action.type.startsWith('projectTasks/') && action.type.endsWith('/fulfilled') && action.payload?.task,
                (state, action) => upsert(state, action.payload.projectId, action.payload.task),
            );
    },
});

export const { projectTaskEvent, projectTaskGroupEvent, hideTaskLocally, restoreTaskLocally } = projectTasksSlice.actions;

export const selectProjectTasks = (state, projectId) => state.projectTasks.byProject[projectId];

export default projectTasksSlice.reducer;
