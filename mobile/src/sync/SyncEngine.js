import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import API from '../api/Client';
import { errorMessage } from '../utils/Format';
import { opId } from './ObjectId';
import { addIssue, bumpAttempt, dequeue, enqueue, ensureDevice, setOnline, setSyncing, synced } from '../store/slices/SyncSlice';

const DIRECT_TIMEOUT = 8000;
const REPLAY_TIMEOUT = 15000;
const MAX_ATTEMPTS = 8;
const PULL_EVERY = 60000;

let store = null;
let refresher = () => {};
let flushing = null;
let retryTimer = null;
let backoff = 2000;

export const OFFLINE_MESSAGE = "You're offline. Showing what's saved on this phone.";

export const isNetworkError = (error) => !!error && !error.response && error.code !== 'ERR_CANCELED';

const headersFor = (op, deviceId) => ({
  'X-Device-Id': deviceId,
  'X-Client-Time': new Date().toISOString(),
  'X-Edited-At': op.editedAt,
  'Idempotency-Key': op.id,
});

const call = (op, deviceId, timeout) => API.request({
  method: op.method, url: op.url, data: op.body, timeout, headers: headersFor(op, deviceId),
});

export const canReachServer = (getState) => {
  const { sync } = getState();
  return sync.online && sync.outbox.length === 0;
};

export const refreshAfterFailure = (kinds) => refresher(kinds.map((k) => k.replace(/^after:/, '')));

export const send = async ({ dispatch, getState }, { method, url, body, kinds = [], label }) => {
  dispatch(ensureDevice());
  const userId = getState().auth.user?._id || getState().auth.user?.id || null;
  const op = { id: opId(), userId, method, url, body, kinds, label, editedAt: new Date().toISOString(), attempts: 0 };
  const { sync } = getState();
  if (sync.online && sync.outbox.length === 0) {
    try {
      const { data } = await call(op, sync.deviceId, DIRECT_TIMEOUT);
      refresher(kinds.filter((k) => k.startsWith('after:')).map((k) => k.slice(6)));
      return { data };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      dispatch(setOnline(false));
      dispatch(enqueue(op));
      retryLater();
      return { queued: true };
    }
  }
  dispatch(enqueue(op));
  scheduleFlush(300);
  return { queued: true };
};

const replay = async () => {
  const { dispatch, getState } = store;
  const touched = new Set();
  while (getState().sync.outbox.length) {
    const { outbox, deviceId } = getState().sync;
    const op = outbox[0];
    const me = getState().auth.user?._id || getState().auth.user?.id;
    if (op.userId && me && op.userId !== me) {
      dispatch(dequeue(op.id));
      continue;
    }
    try {
      await call(op, deviceId, REPLAY_TIMEOUT);
      op.kinds.forEach((k) => touched.add(k.replace(/^after:/, '')));
      dispatch(dequeue(op.id));
    } catch (error) {
      if (isNetworkError(error)) {
        dispatch(setOnline(false));
        return { touched, blocked: true };
      }
      const status = error.response.status;
      if (status === 401) return { touched, blocked: true };
      if (status >= 500 && (op.attempts || 0) + 1 < MAX_ATTEMPTS) {
        dispatch(bumpAttempt(op.id));
        return { touched, blocked: true };
      }
      op.kinds.forEach((k) => touched.add(k.replace(/^after:/, '')));
      dispatch(dequeue(op.id));
      if (status !== 404) {
        dispatch(addIssue({
          label: op.label || 'A change',
          kind: error.response.data?.stale ? 'stale' : 'failed',
          message: errorMessage(error, 'The server refused this change'),
        }));
      }
    }
  }
  return { touched, blocked: false };
};

const pull = async () => {
  const { dispatch, getState } = store;
  const { cursor, deviceId } = getState().sync;
  const { data } = await API.get('/sync/changes', { params: { since: cursor || undefined }, headers: { 'X-Device-Id': deviceId } });
  dispatch(synced(data.now));
  return data.full ? ['all'] : data.kinds;
};

export const syncNow = () => {
  if (!store) return Promise.resolve();
  if (flushing) return flushing;
  const { dispatch, getState } = store;
  if (!getState().auth.isAuthenticated || !getState().sync.online) return Promise.resolve();
  dispatch(ensureDevice());
  flushing = (async () => {
    dispatch(setSyncing(true));
    try {
      const { touched, blocked } = await replay();
      if (blocked) {
        if (touched.size) refresher([...touched]);
        retryLater();
        return;
      }
      backoff = 2000;
      const remote = await pull().catch((error) => {
        if (isNetworkError(error)) dispatch(setOnline(false));
        return [];
      });
      const kinds = new Set([...touched, ...remote]);
      if (kinds.size) refresher([...kinds]);
    } finally {
      dispatch(setSyncing(false));
      flushing = null;
    }
  })();
  return flushing;
};

const reachable = (net) => !!net.isConnected && net.isInternetReachable !== false;

const probe = async () => {
  if (!store) return;
  const net = await NetInfo.fetch().catch(() => null);
  if (net && reachable(net) !== store.getState().sync.online) store.dispatch(setOnline(reachable(net)));
  await syncNow();
};

function retryLater() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(probe, backoff);
  backoff = Math.min(backoff * 2, 60000);
}

function scheduleFlush(delay) {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(probe, delay);
}

export const startSync = (appStore, refreshKinds) => {
  store = appStore;
  refresher = (kinds) => { if (kinds.length) store.dispatch(refreshKinds(kinds)); };
  store.dispatch(ensureDevice());

  const unsubscribeNet = NetInfo.addEventListener((net) => {
    const online = reachable(net);
    const was = store.getState().sync.online;
    if (online !== was) store.dispatch(setOnline(online));
    if (online && !was) { backoff = 2000; syncNow(); }
  });
  const appState = AppState.addEventListener('change', (next) => { if (next === 'active') probe(); });
  const timer = setInterval(() => { if (AppState.currentState === 'active') probe(); }, PULL_EVERY);
  probe();

  return () => {
    unsubscribeNet();
    appState.remove();
    clearInterval(timer);
    clearTimeout(retryTimer);
  };
};
