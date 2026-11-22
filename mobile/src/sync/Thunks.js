import { createAsyncThunk } from '@reduxjs/toolkit';
import { errorMessage } from '../utils/Format';
import { canReachServer, isNetworkError, OFFLINE_MESSAGE, refreshAfterFailure, send } from './SyncEngine';
import { objectId } from './ObjectId';

export const onlineOnly = { condition: (_, { getState }) => canReachServer(getState) };

export const fetcher = (type, fn, fallback) => createAsyncThunk(type, async (arg, api) => {
  try {
    return await fn(arg, api);
  } catch (error) {
    return api.rejectWithValue(isNetworkError(error) ? OFFLINE_MESSAGE : errorMessage(error, fallback));
  }
}, onlineOnly);

export const writer = (type, { request, local, fromServer = (data) => data, kinds = [], label, fallback }) => {
  const thunk = createAsyncThunk(type, async (arg, api) => {
    const req = request(arg, api.getState);
    const touched = req.kinds || kinds;
    try {
      const result = await send(api, { ...req, kinds: touched, label: typeof label === 'function' ? label(arg) : label });
      if (result.queued) return local ? local(arg, api.getState) : arg;
      return fromServer(result.data, arg, api.getState);
    } catch (error) {
      refreshAfterFailure(touched);
      return api.rejectWithValue(errorMessage(error, fallback));
    }
  });
  return thunk;
};

export const withId = (thunk, field = '_id') => Object.assign((arg = {}) => thunk({ ...arg, [field]: arg[field] || objectId() }), thunk);

export const requireConnection = (getState) => {
  if (!canReachServer(getState)) {
    throw Object.assign(new Error(getState().sync.online ? 'Still syncing your changes. Try again in a moment.' : 'This needs an internet connection.'), { offline: true });
  }
};
