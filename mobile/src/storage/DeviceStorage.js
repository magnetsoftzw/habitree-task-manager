import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FS from 'expo-file-system/legacy';

const LOCATION_KEY = 'habitree_storage_location';
const INTERNAL_DIR = `${FS.documentDirectory}habitree-data/`;
const SAF = FS.StorageAccessFramework;

export const externalSupported = Platform.OS === 'android' && !!SAF;

const fileName = (key) => `${String(key).replace(/[^a-z0-9_-]/gi, '_')}.json`;
const baseName = (uri) => decodeURIComponent(uri).split('/').pop();

const internalBackend = () => ({
  type: 'internal',
  async init() {
    const info = await FS.getInfoAsync(INTERNAL_DIR);
    if (!info.exists) await FS.makeDirectoryAsync(INTERNAL_DIR, { intermediates: true });
  },
  async read(key) {
    const uri = INTERNAL_DIR + fileName(key);
    const info = await FS.getInfoAsync(uri);
    return info.exists ? FS.readAsStringAsync(uri) : null;
  },
  write: (key, value) => FS.writeAsStringAsync(INTERNAL_DIR + fileName(key), value),
  remove: (key) => FS.deleteAsync(INTERNAL_DIR + fileName(key), { idempotent: true }),
});

const externalBackend = (rootUri) => {
  let index = null;
  const load = async () => {
    if (!index) index = new Map((await SAF.readDirectoryAsync(rootUri)).map((u) => [baseName(u), u]));
    return index;
  };
  return {
    type: 'external',
    uri: rootUri,
    init: load,
    async read(key) {
      const uri = (await load()).get(fileName(key));
      return uri ? FS.readAsStringAsync(uri) : null;
    },
    async write(key, value) {
      const files = await load();
      let uri = files.get(fileName(key));
      if (!uri) {
        uri = await SAF.createFileAsync(rootUri, fileName(key).replace(/\.json$/, ''), 'application/json');
        files.set(baseName(uri), uri);
        files.set(fileName(key), uri);
      }
      await FS.writeAsStringAsync(uri, value);
    },
    async remove(key) {
      const files = await load();
      const uri = files.get(fileName(key));
      if (!uri) return;
      await FS.deleteAsync(uri, { idempotent: true });
      files.delete(fileName(key));
    },
  };
};

let backend = null;
let location = { type: 'internal' };
let problem = null;
const keys = new Set();
const pending = new Map();
const running = new Map();
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn(getStorageInfo()));

const open = async (loc) => {
  const next = loc?.type === 'external' && loc.uri && externalSupported ? externalBackend(loc.uri) : internalBackend();
  await next.init();
  return next;
};

const ready = (async () => {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(LOCATION_KEY)) || 'null');
    if (saved) location = saved;
  } catch {
    location = { type: 'internal' };
  }
  try {
    backend = await open(location);
  } catch (error) {
    problem = location.type === 'external'
      ? "The SD card folder isn't available, so data is being kept on the phone for now."
      : 'Phone storage could not be opened.';
    backend = internalBackend();
    await backend.init().catch(() => {});
  }
})();

const drain = async (key) => {
  while (pending.has(key)) {
    const value = pending.get(key);
    pending.delete(key);
    try {
      await backend.write(key, value);
    } catch (error) {
      if (backend.type === 'external') {
        problem = "The SD card folder couldn't be written, so data is being kept on the phone for now.";
        backend = internalBackend();
        await backend.init().catch(() => {});
        await backend.write(key, value).catch(() => {});
        notify();
      }
    }
  }
  running.delete(key);
};

export const DeviceStorage = {
  async getItem(key) {
    await ready;
    keys.add(key);
    if (pending.has(key)) return pending.get(key);
    try {
      return await backend.read(key);
    } catch {
      return null;
    }
  },
  async setItem(key, value) {
    await ready;
    keys.add(key);
    pending.set(key, value);
    if (!running.has(key)) running.set(key, drain(key));
    return running.get(key);
  },
  async removeItem(key) {
    await ready;
    pending.delete(key);
    await running.get(key);
    await backend.remove(key).catch(() => {});
  },
};

export const flushStorage = async () => {
  await ready;
  await Promise.all([...running.values()]);
};

export const getStorageInfo = () => ({ location, active: backend?.type || location.type, problem });

export const onStorageChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const moveTo = async (nextLocation) => {
  await flushStorage();
  const target = await open(nextLocation);
  const previous = backend;
  const copied = [];
  for (const key of keys) {
    const value = await previous.read(key).catch(() => null);
    if (value == null) continue;
    await target.write(key, value);
    copied.push(key);
  }
  backend = target;
  location = nextLocation;
  problem = null;
  await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(nextLocation));
  for (const key of copied) await previous.remove(key).catch(() => {});
  notify();
};

export const chooseExternalFolder = async () => {
  if (!externalSupported) throw new Error('SD card storage is only available on Android');
  const result = await SAF.requestDirectoryPermissionsAsync();
  if (!result.granted) return false;
  const tree = decodeURIComponent(result.directoryUri).split('/tree/').pop() || '';
  const [volume, folder = ''] = tree.split(':');
  const label = `${volume === 'primary' ? 'Shared phone storage' : 'SD card'}${folder ? ` › ${folder.replace(/\//g, ' › ')}` : ''}`;
  await moveTo({ type: 'external', uri: result.directoryUri, label });
  return true;
};

export const switchToInternalStorage = () => moveTo({ type: 'internal' });

export const clearStoredData = async () => {
  await flushStorage();
  for (const key of keys) await backend.remove(key).catch(() => {});
};
