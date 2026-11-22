import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/Client';
import { errorMessage } from '../../utils/Format';
import { KANBAN_COLUMNS } from '../../utils/Status';

const wrap = (fn, fallback) => async (arg, api) => {
  try {
    return await fn(arg, api);
  } catch (error) {
    return api.rejectWithValue(errorMessage(error, fallback));
  }
};

export const fetchProjects = createAsyncThunk('projects/fetchAll', wrap(async () => (await API.get('/projects')).data.projects));
export const fetchProject = createAsyncThunk('projects/fetchOne', wrap(async (id) => (await API.get(`/projects/${id}`)).data.project, 'Project not found'));
export const createProject = createAsyncThunk('projects/create', wrap(async (body) => (await API.post('/projects', body)).data.project, 'Could not create the project'));
export const updateProject = createAsyncThunk('projects/update', wrap(async ({ id, updates }) => (await API.put(`/projects/${id}`, updates)).data.project, 'Could not save the project'));
export const deleteProject = createAsyncThunk('projects/delete', wrap(async (id) => { await API.delete(`/projects/${id}`); return id; }, 'Could not delete the project'));

export const addCard = createAsyncThunk('projects/addCard', wrap(async ({ projectId, columnId, title }) => {
  const { data } = await API.post(`/projects/${projectId}/add-task`, { columnId, title });
  return { projectId, columnId, card: { ...data.task, focusMinutes: 0 } };
}, 'Could not add the card'));

export const moveCard = createAsyncThunk('projects/moveCard', wrap(async ({ projectId, taskId, fromColumn, toColumn }) => {
  await API.put(`/projects/${projectId}/move`, { taskId, fromColumn, toColumn });
  return { projectId, taskId, fromColumn, toColumn };
}, 'Could not move the card'));

export const renameCard = createAsyncThunk('projects/renameCard', wrap(async ({ taskId, title }) =>
  (await API.put(`/tasks/${taskId}`, { title })).data, 'Could not rename the card'));

export const deleteCard = createAsyncThunk('projects/deleteCard', wrap(async ({ taskId, columnId }) => {
  await API.delete(`/tasks/${taskId}`);
  return { taskId, columnId };
}, 'Could not delete the card'));

const boardCount = (project) => KANBAN_COLUMNS.reduce((n, c) => n + (project.kanban?.[c.id]?.length || 0), 0);

const projectsSlice = createSlice({
  name: 'projects',
  initialState: { items: [], current: null, loading: false, loaded: false, error: null },
  reducers: {
    setOpenTaskCount: (state, action) => {
      const { projectId, count } = action.payload;
      const item = state.items.find((p) => p._id === projectId);
      if (item) item.openTaskCount = count;
      if (state.current?._id === projectId) state.current.openTaskCount = count;
    },
    applyRemoteMove: (state, action) => {
      const { taskId, fromColumn, toColumn } = action.payload;
      const k = state.current?.kanban;
      if (!k?.[fromColumn] || !k?.[toColumn]) return;
      const card = k[fromColumn].find((c) => c._id === taskId);
      if (!card) return;
      k[fromColumn] = k[fromColumn].filter((c) => c._id !== taskId);
      k[toColumn].push({ ...card, kanban: toColumn });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => { state.loading = true; })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = null;
        state.items = action.payload;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchProject.pending, (state, action) => {
        if (state.current?._id !== action.meta.arg) state.current = null;
      })
      .addCase(fetchProject.fulfilled, (state, action) => { state.current = action.payload; })
      .addCase(createProject.fulfilled, (state, action) => {
        state.items.unshift({ ...action.payload, boardCardCount: 0, openTaskCount: 0 });
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        const p = action.payload;
        state.items = state.items.map((i) => (i._id === p._id ? { ...i, name: p.name, description: p.description, color: p.color, techStack: p.techStack } : i));
        if (state.current?._id === p._id) Object.assign(state.current, { name: p.name, description: p.description, color: p.color, techStack: p.techStack });
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.items = state.items.filter((p) => p._id !== action.payload);
        if (state.current?._id === action.payload) state.current = null;
      })
      .addCase(addCard.fulfilled, (state, action) => {
        const { projectId, columnId, card } = action.payload;
        if (state.current?._id === projectId) {
          state.current.kanban[columnId].push(card);
          state.current.boardCardCount = boardCount(state.current);
        }
        const item = state.items.find((p) => p._id === projectId);
        if (item) item.boardCardCount = (item.boardCardCount || 0) + 1;
      })
      .addCase(moveCard.pending, (state, action) => {
        projectsSlice.caseReducers.applyRemoteMove(state, { payload: action.meta.arg });
      })
      .addCase(moveCard.rejected, (state, action) => {
        const { taskId, fromColumn, toColumn } = action.meta.arg;
        projectsSlice.caseReducers.applyRemoteMove(state, { payload: { taskId, fromColumn: toColumn, toColumn: fromColumn } });
      })
      .addCase(renameCard.fulfilled, (state, action) => {
        const k = state.current?.kanban;
        if (!k) return;
        Object.keys(k).forEach((col) => {
          k[col] = k[col].map((c) => (c._id === action.payload._id ? { ...c, title: action.payload.title } : c));
        });
      })
      .addCase(deleteCard.fulfilled, (state, action) => {
        const { taskId, columnId } = action.payload;
        if (state.current?.kanban?.[columnId]) {
          state.current.kanban[columnId] = state.current.kanban[columnId].filter((c) => c._id !== taskId);
          state.current.boardCardCount = boardCount(state.current);
          const item = state.items.find((p) => p._id === state.current._id);
          if (item) item.boardCardCount = state.current.boardCardCount;
        }
      });
  },
});

export const { setOpenTaskCount, applyRemoteMove } = projectsSlice.actions;
export default projectsSlice.reducer;
