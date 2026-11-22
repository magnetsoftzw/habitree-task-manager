export const toDateKey = (date = new Date()) => {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export const fromDateKey = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
};

export const shiftDateKey = (key, days) => {
    const d = fromDateKey(key);
    d.setDate(d.getDate() + days);
    return toDateKey(d);
};

export const formatDuration = (minutes = 0) => {
    const total = Math.max(0, Math.round(minutes || 0));
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
};

export const formatLongDate = (date = new Date()) =>
    new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export const formatShortDate = (date) =>
    new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export const formatDueDate = (date) =>
    new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const greeting = (date = new Date()) => {
    const h = date.getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
};

export const formatRelative = (date) => {
    if (!date) return 'Earlier';
    const d = new Date(date);
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const today = toDateKey();
    const key = toDateKey(d);
    if (key === today) return `Today, ${time}`;
    if (key === shiftDateKey(today, -1)) return `Yesterday, ${time}`;
    return formatShortDate(d);
};

export const addMinutesToTime = (time, minutes) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const hh = Math.floor((total % 1440) / 60);
    const mm = total % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export const nextHourTime = () => {
    const h = Math.min(23, new Date().getHours() + 1);
    return `${String(h).padStart(2, '0')}:00`;
};

export const DEFAULT_DAILY_GOAL = 480;

export const dailyGoalOf = (profile) => profile?.settings?.dailyGoalMinutes || DEFAULT_DAILY_GOAL;

export const formatGoal = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
};

export const tzOffset = (date = new Date()) => {
    const total = -date.getTimezoneOffset();
    const sign = total >= 0 ? '+' : '-';
    const abs = Math.abs(total);
    return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
};
