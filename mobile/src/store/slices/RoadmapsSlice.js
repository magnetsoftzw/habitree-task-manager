import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/Client';
import { errorMessage } from '../../utils/Format';

const wrap = (fn, fallback) => async (arg, api) => {
  try {
    return await fn(arg, api);
  } catch (error) {
    return api.rejectWithValue(errorMessage(error, fallback));
  }
};

export const fetchRoadmaps = createAsyncThunk('roadmaps/fetchAll', wrap(async () => (await API.get('/roadmaps')).data.roadmaps));
export const fetchRoadmap = createAsyncThunk('roadmaps/fetchOne', wrap(async (id) => (await API.get(`/roadmaps/${id}`)).data.roadmap, 'Roadmap not found'));

export const createRoadmap = createAsyncThunk('roadmaps/create', wrap(async (skillName) =>
  (await API.post('/roadmaps', { skillName, nodes: [], edges: [] })).data.roadmap, 'Could not create the roadmap'));

export const saveRoadmap = createAsyncThunk('roadmaps/save', wrap(async ({ id, ...updates }) =>
  (await API.put(`/roadmaps/${id}`, updates)).data.roadmap, 'Could not save the roadmap'));

export const deleteRoadmap = createAsyncThunk('roadmaps/delete', wrap(async (id) => {
  await API.delete(`/roadmaps/${id}`);
  return id;
}, 'Could not delete the roadmap'));

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
        state.error = action.payload;
      })
      .addCase(fetchRoadmap.pending, (state, action) => {
        if (state.current?._id !== action.meta.arg) state.current = null;
      })
      .addCase(fetchRoadmap.fulfilled, (state, action) => { state.current = action.payload; })
      .addCase(createRoadmap.fulfilled, (state, action) => { state.items.unshift(action.payload); })
      .addCase(saveRoadmap.pending, (state) => { state.saving = true; })
      .addCase(saveRoadmap.rejected, (state) => { state.saving = false; })
      .addCase(saveRoadmap.fulfilled, (state, action) => {
        state.saving = false;
        const r = action.payload;
        state.items = state.items.map((i) => (i._id === r._id ? { ...i, skillName: r.skillName, nodes: r.nodes, edges: r.edges, updatedAt: r.updatedAt } : i));
        if (state.current?._id === r._id) state.current.skillName = r.skillName;
      })
      .addCase(deleteRoadmap.fulfilled, (state, action) => {
        state.items = state.items.filter((r) => r._id !== action.payload);
      });
  },
});

export const { editCurrent, updateNodeData } = roadmapsSlice.actions;
export default roadmapsSlice.reducer;
