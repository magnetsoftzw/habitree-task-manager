import { useSyncExternalStore } from 'react';

const KEY = 'habitree:focusMinutes';
const EVENT = 'habitree:focus-length';
const DEFAULT = 20;
const MIGRATED = 'habitree:focusMinutes:v2';

try {
    if (!localStorage.getItem(MIGRATED)) {
        if (localStorage.getItem(KEY) === '25') localStorage.setItem(KEY, String(DEFAULT));
        localStorage.setItem(MIGRATED, '1');
    }
} catch {
    /* storage unavailable */
}

const read = () => {
    const value = Number(localStorage.getItem(KEY));
    return value >= 1 && value <= 180 ? value : DEFAULT;
};

const subscribe = (callback) => {
    window.addEventListener('storage', callback);
    window.addEventListener(EVENT, callback);
    return () => {
        window.removeEventListener('storage', callback);
        window.removeEventListener(EVENT, callback);
    };
};

export const saveFocusLength = (minutes) => {
    localStorage.setItem(KEY, String(minutes));
    window.dispatchEvent(new Event(EVENT));
};

export const getFocusLength = read;

const useFocusLength = () => useSyncExternalStore(subscribe, read, () => DEFAULT);

export default useFocusLength;
