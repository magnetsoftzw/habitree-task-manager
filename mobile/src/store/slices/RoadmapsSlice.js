import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/Client';
import { errorMessage } from '../../utils/Format';
import { fetcher, writer } from '../../sync/Thunks';
import { canReachServer, OFFLINE_MESSAGE } from '../../sync/SyncEngine';
import { objectId } from '../../sync/ObjectId';

export const fetchRoadmaps = fetcher('roadmaps/fetchAll', async () => (await API.get('/roadmaps')).data.roadmaps);

export const fetchRoadmap = createAsyncThunk('roadmaps/fetchOne', async (id, { getState, rejectWithValue }) => {
  const { roadmaps } = getState();
  const cached = (roadmaps.current?._id === id ? roadmaps.current : null) || roadmaps.items.find((r) => r._id === id);
  if (!canReachServer(getState)) return cached || rejectWithValue(OFFLINE_MESSAGE);
  try {
    return (await API.get(`/roadmaps/${id}`)).data.roadmap;
  } catch (error) {
    if (!error.response && cached) return cached;
    return rejectWithValue(errorMessage(error, 'Roadmap not found'));
  }
});

const createThunk = writer('roadmaps/create', {
  request: ({ _id, skillName }) => ({ method: 'post', url: '/roadmaps', body: { _id, skillName, nodes: [], edges: [] } }),
  local: ({ _id, skillName }) => ({ _id, skillName, nodes: [], edges: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
  fromServer: (data) => data.roadmap,
  kinds: ['roadmaps'],
  label: ({ skillName }) => `New roadmap "${skillName}"`,
  fallback: 'Could not create the roadmap',
});

export const createRoadmap = Object.assign((skillName) => createThunk({ _id: objectId(), skillName }), createThunk);

export const saveRoadmap = writer('roadmaps/save', {
  request: ({ id, ...updates }) => ({ method: 'put', url: `/roadmaps/${id}`, body: updates }),
  local: ({ id, ...updates }, getState) => ({ ...getState().roadmaps.items.find((r) => r._id === id), ...updates, _id: id, updatedAt: new Date().toISOString() }),
  fromServer: (data) => data.roadmap,
  kinds: ['roadmaps'],
  label: 'A roadmap edit',
  fallback: 'Could not save the roadmap',
});

export const deleteRoadmap = writer('roadmaps/delete', {
  request: (id) => ({ method: 'delete', url: `/roadmaps/${id}` }),
  local: (id) => id,
  fromServer: (_, id) => id,
  kinds: ['roadmaps'],
  label: 'Deleting a roadmap',
  fallback: 'Could not delete the roadmap',
});

const stripNode = (n) => ({ id: n.id, type: n.type || 'taskNode', position: n.position || { x: 0, y: 0 }, data: { label: n.data?.label, progress: n.data?.progress || 0, status: n.data?.status || 'Not Started' } });
export const toPayloadNodes = (nodes) => nodes.map(stripNode);
export const toPayloadEdges = (edges) => edges.map((e) => ({ id: e.id, source: e.source, target: e.target, animated: !!e.animated, label: e.label || '' }));

const roadmapsSlice = createSlice({
  name: 'roadmaps',
  initialState: { items: [], current: null, loading: false, loaded: false, saving: false, error: null },
  reducers: {
    editCurrent: (state, action) => {
      if (!state.current) return;
      Object.assign(state.current, action.payload);
    },
    updateNodeData: (state, action) => {
      const node = state.current?.nodes.find((n) => n.id === action.payload.id);
      if (node) node.data = { ...node.data, ...action.payload.data };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoadmaps.pending, (state) => { state.loading = true; })
      .addCase(fetchRoadmaps.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = null;
        state.items = action.payload;
      })
      .addCase(fetchRoadmaps.rejected, (state, action) => {
        state.loading = false;
        state.error = state.loaded ? null : action.payload;
      })
      .addCase(fetchRoadmap.pending, (state, action) => {
        if (state.current?._id !== action.meta.arg) state.current = null;
      })
      .addCase(fetchRoadmap.fulfilled, (state, action) => { state.current = action.payload; })
      .addCase(createRoadmap.pending, (state, action) => {
        const { _id, skillName } = action.meta.arg;
        state.items.unshift({ _id, skillName, nodes: [], edges: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      })
      .addCase(createRoadmap.fulfilled, (state, action) => {
        state.items = state.items.map((r) => (r._id === action.payload._id ? action.payload : r));
      })
      .addCase(createRoadmap.rejected, (state, action) => {
        state.items = state.items.filter((r) => r._id !== action.meta.arg._id);
      })
      .addCase(saveRoadmap.pending, (state) => { state.saving = true; })
      .addCase(saveRoadmap.rejected, (state) => { state.saving = false; })
      .addCase(saveRoadmap.fulfilled, (state, action) => {
        state.saving = false;
        const r = action.payload;
        state.items = state.items.map((i) => (i._id === r._id ? { ...i, skillName: r.skillName, nodes: r.nodes, edges: r.edges, updatedAt: r.updatedAt } : i));
        if (state.current?._id === r._id) state.current.skillName = r.skillName;
      })
      .addCase(deleteRoadmap.pending, (state, action) => {
        state.items = state.items.filter((r) => r._id !== action.meta.arg);
      })
      .addCase(deleteRoadmap.fulfilled, (state, action) => {
        state.items = state.items.filter((r) => r._id !== action.payload);
      });
  },
});

export const { editCurrent, updateNodeData } = roadmapsSlice.actions;
export default roadmapsSlice.reducer;
