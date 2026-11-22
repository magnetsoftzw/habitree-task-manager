import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/Client';
import { errorMessage } from '../../utils/Format';
import { KANBAN_COLUMNS } from '../../utils/Status';
import { fetcher, withId, writer } from '../../sync/Thunks';
import { canReachServer, OFFLINE_MESSAGE } from '../../sync/SyncEngine';

const emptyBoard = () => Object.fromEntries(KANBAN_COLUMNS.map((c) => [c.id, []]));

export const fetchProjects = fetcher('projects/fetchAll', async () => (await API.get('/projects')).data.projects);

export const fetchProject = createAsyncThunk('projects/fetchOne', async (id, { getState, rejectWithValue }) => {
  const { projects } = getState();
  const listed = projects.items.find((p) => p._id === id);
  const cached = projects.details?.[id] || (projects.current?._id === id ? projects.current : null)
    || (listed ? { ...listed, kanban: emptyBoard() } : null);
  if (!canReachServer(getState)) return cached || rejectWithValue(OFFLINE_MESSAGE);
  try {
    return (await API.get(`/projects/${id}`)).data.project;
  } catch (error) {
    if (!error.response && cached) return cached;
    return rejectWithValue(errorMessage(error, 'Project not found'));
  }
});

export const createProject = withId(writer('projects/create', {
  request: (body) => ({ method: 'post', url: '/projects', body }),
  local: (body) => ({ ...body, owner: null, collaborators: [], progress: 0, kanban: emptyBoard(), createdAt: new Date().toISOString() }),
  fromServer: (data) => data.project,
  kinds: ['projects'],
  label: (b) => `New project "${b.name}"`,
  fallback: 'Could not create the project',
}));

export const updateProject = writer('projects/update', {
  request: ({ id, updates }) => ({ method: 'put', url: `/projects/${id}`, body: updates }),
  local: ({ id, updates }) => ({ _id: id, ...updates }),
  fromServer: (data) => data.project,
  kinds: ['projects'],
  label: 'A project edit',
  fallback: 'Could not save the project',
});

export const deleteProject = writer('projects/delete', {
  request: (id) => ({ method: 'delete', url: `/projects/${id}` }),
  local: (id) => id,
  fromServer: (_, id) => id,
  kinds: ['projects', 'tasks'],
  label: 'Deleting a project',
  fallback: 'Could not delete the project',
});

export const addCard = withId(writer('projects/addCard', {
  request: ({ projectId, columnId, title, _id }) => ({ method: 'post', url: `/projects/${projectId}/add-task`, body: { _id, columnId, title }, kinds: [`project:${projectId}`] }),
  local: ({ projectId, columnId, title, _id }) => ({ projectId, columnId, card: { _id, title, kanban: columnId, projectId, status: 'Not Started', focusMinutes: 0 } }),
  fromServer: (data, { projectId, columnId }) => ({ projectId, columnId, card: { ...data.task, focusMinutes: 0 } }),
  label: (a) => `New card "${a.title}"`,
  fallback: 'Could not add the card',
}));

export const moveCard = writer('projects/moveCard', {
  request: ({ projectId, taskId, fromColumn, toColumn }) => ({ method: 'put', url: `/projects/${projectId}/move`, body: { taskId, fromColumn, toColumn }, kinds: [`project:${projectId}`, 'tasks'] }),
  fromServer: (_, arg) => arg,
  label: 'Moving a card',
  fallback: 'Could not move the card',
});

export const renameCard = writer('projects/renameCard', {
  request: ({ taskId, title }) => ({ method: 'put', url: `/tasks/${taskId}`, body: { title } }),
  local: ({ taskId, title }) => ({ _id: taskId, title }),
  kinds: ['projects'],
  label: 'Renaming a card',
  fallback: 'Could not rename the card',
});

export const deleteCard = writer('projects/deleteCard', {
  request: ({ taskId }) => ({ method: 'delete', url: `/tasks/${taskId}` }),
  local: (arg) => arg,
  fromServer: (_, arg) => arg,
  kinds: ['projects'],
  label: 'Deleting a card',
  fallback: 'Could not delete the card',
});

const boardCount = (project) => KANBAN_COLUMNS.reduce((n, c) => n + (project.kanban?.[c.id]?.length || 0), 0);

const projectsSlice = createSlice({
  name: 'projects',
  initialState: { items: [], current: null, details: {}, loading: false, loaded: false, error: null },
  reducers: {
    removeCard: (state, action) => {
      const { taskId, columnId } = action.payload;
      if (!state.current?.kanban?.[columnId]) return;
      state.current.kanban[columnId] = state.current.kanban[columnId].filter((c) => c._id !== taskId);
      state.current.boardCardCount = boardCount(state.current);
      const item = state.items.find((p) => p._id === state.current._id);
      if (item) item.boardCardCount = state.current.boardCardCount;
    },
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
        state.error = state.loaded ? null : action.payload;
      })
      .addCase(fetchProject.pending, (state, action) => {
        if (state.current?._id !== action.meta.arg) state.current = null;
      })
      .addCase(fetchProject.fulfilled, (state, action) => {
        state.current = action.payload;
        if (!state.details) state.details = {};
        state.details[action.payload._id] = action.payload;
      })
      .addCase(createProject.pending, (state, action) => {
        state.items.unshift({ ...action.meta.arg, progress: 0, boardCardCount: 0, openTaskCount: 0, createdAt: new Date().toISOString() });
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.items = state.items.map((p) => (p._id === action.payload._id ? { ...p, ...action.payload } : p));
      })
      .addCase(createProject.rejected, (state, action) => {
        state.items = state.items.filter((p) => p._id !== action.meta.arg._id);
      })
      .addCase(updateProject.pending, (state, action) => {
        const { id, updates } = action.meta.arg;
        state.items = state.items.map((i) => (i._id === id ? { ...i, ...updates } : i));
        if (state.current?._id === id) Object.assign(state.current, updates);
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        const p = action.payload;
        state.items = state.items.map((i) => (i._id === p._id ? { ...i, name: p.name, description: p.description, color: p.color, techStack: p.techStack } : i));
        if (state.current?._id === p._id) Object.assign(state.current, { name: p.name, description: p.description, color: p.color, techStack: p.techStack });
      })
      .addCase(deleteProject.pending, (state, action) => {
        state.items = state.items.filter((p) => p._id !== action.meta.arg);
        if (state.current?._id === action.meta.arg) state.current = null;
        if (state.details) delete state.details[action.meta.arg];
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.items = state.items.filter((p) => p._id !== action.payload);
        if (state.current?._id === action.payload) state.current = null;
      })
      .addCase(addCard.pending, (state, action) => {
        const { projectId, columnId, title, _id } = action.meta.arg;
        if (state.current?._id !== projectId) return;
        state.current.kanban[columnId].push({ _id, title, kanban: columnId, projectId, status: 'Not Started', focusMinutes: 0, pending: true });
        state.current.boardCardCount = boardCount(state.current);
      })
      .addCase(addCard.rejected, (state, action) => {
        const { projectId, columnId, _id } = action.meta.arg;
        if (state.current?._id !== projectId) return;
        state.current.kanban[columnId] = state.current.kanban[columnId].filter((c) => c._id !== _id);
        state.current.boardCardCount = boardCount(state.current);
      })
      .addCase(addCard.fulfilled, (state, action) => {
        const { projectId, columnId, card } = action.payload;
        if (state.current?._id === projectId) {
          state.current.kanban[columnId] = state.current.kanban[columnId].filter((c) => c._id !== card._id);
          state.current.kanban[columnId].push(card);
          state.current.boardCardCount = boardCount(state.current);
        }
        const item = state.items.find((p) => p._id === projectId);
        if (item && state.current?._id === projectId) item.boardCardCount = state.current.boardCardCount;
      })
      .addCase(moveCard.pending, (state, action) => {
        projectsSlice.caseReducers.applyRemoteMove(state, { payload: action.meta.arg });
      })
      .addCase(moveCard.rejected, (state, action) => {
        const { taskId, fromColumn, toColumn } = action.meta.arg;
        projectsSlice.caseReducers.applyRemoteMove(state, { payload: { taskId, fromColumn: toColumn, toColumn: fromColumn } });
      })
      .addCase(renameCard.pending, (state, action) => {
        const { taskId, title } = action.meta.arg;
        const k = state.current?.kanban;
        if (!k) return;
        Object.keys(k).forEach((col) => { k[col] = k[col].map((c) => (c._id === taskId ? { ...c, title } : c)); });
      })
      .addCase(renameCard.fulfilled, (state, action) => {
        const k = state.current?.kanban;
        if (!k) return;
        Object.keys(k).forEach((col) => {
          k[col] = k[col].map((c) => (c._id === action.payload._id ? { ...c, title: action.payload.title } : c));
        });
      })
      .addCase(deleteCard.pending, (state, action) => {
        projectsSlice.caseReducers.removeCard(state, { payload: action.meta.arg });
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
