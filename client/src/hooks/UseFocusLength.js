import { useSyncExternalStore } from 'react';

const KEY = 'habitree:focusMinutes';
const EVENT = 'habitree:focus-length';
const DEFAULT = 25;

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
