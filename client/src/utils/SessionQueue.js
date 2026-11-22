export const QUEUE_KEY = 'habitree:sessionQueue';

export const readQueue = () => {
    try {
        const value = JSON.parse(localStorage.getItem(QUEUE_KEY));
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
};

export const writeQueue = (queue) => {
    try {
        if (queue.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        else localStorage.removeItem(QUEUE_KEY);
    } catch {
        // Storage blocked or full: the queue still lives in memory for this tab.
    }
};

export const newClientId = () => `web-${globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`}`;

export const sessionDay = (session) => String(session.startTime).slice(0, 10);

export const pendingByDay = (queue) => queue.reduce((acc, s) => {
    const day = sessionDay(s);
    acc[day] = acc[day] || { minutes: 0, count: 0 };
    acc[day].minutes += s.durationMinutes || 0;
    acc[day].count += 1;
    return acc;
}, {});
