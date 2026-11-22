export const DAY = 1440;
export const HALF = 720;
export const SNAP = 15;

export const toMinutes = (hhmm) => {
    if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

export const toHHMM = (minutes) => {
    const m = ((Math.round(minutes) % DAY) + DAY) % DAY;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export const clockLabel = (minutes) => {
    const m = ((Math.round(minutes) % DAY) + DAY) % DAY;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    const suffix = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return mm ? `${h12}:${String(mm).padStart(2, '0')} ${suffix}` : `${h12}:00 ${suffix}`;
};

export const rangeLabel = (start, end) => `${clockLabel(start)}–${clockLabel(end)}${end > DAY ? ' (next day)' : ''}`;

export const durationLabel = (minutes) => {
    const m = Math.max(0, Math.round(minutes));
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (!h) return `${r} min`;
    return r ? `${h} h ${r} min` : `${h} h`;
};

export const workPeriods = (segments = []) => segments.filter((s) => s.kind === 'work');

export const entryInterval = (entry) => {
    const start = toMinutes(entry.time);
    if (start === null) return null;
    return { start, end: start + (Number(entry.duration) || 30) };
};

export const periodOfEntry = (segments, entry) => {
    const iv = entryInterval(entry);
    if (!iv) return null;
    return workPeriods(segments).find((p) => iv.start >= p.start && iv.end <= p.end) || null;
};

export const entriesInPeriod = (period, entries = []) => entries
    .filter((e) => {
        const iv = entryInterval(e);
        return iv && iv.start >= period.start && iv.end <= period.end;
    })
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));

export const conflictFor = (segments, time, duration) => {
    const start = toMinutes(time);
    if (start === null || !segments?.length) return null;
    const end = start + (Number(duration) || 30);
    if (workPeriods(segments).some((p) => start >= p.start && end <= p.end)) return null;
    const clash = segments.find((s) => s.kind === 'personal' && start < s.end && end > s.start)
        || (start < (segments[0]?.start ?? 0) ? { label: segments.find((s) => s.key === 'rest')?.label || 'Rest', start: 0, end: segments[0].start } : null);
    if (clash) return `Overlaps ${clash.label} (${rangeLabel(clash.start, clash.end)}).`;
    return 'Must fit inside a single work period.';
};

export const nextFreeSlot = (segments, entries = [], duration = 30, from = 0) => {
    const busy = entries.map(entryInterval).filter(Boolean);
    for (const p of workPeriods(segments)) {
        let t = Math.max(p.start, Math.ceil(from / SNAP) * SNAP);
        while (t + duration <= p.end) {
            const end = t + duration;
            const hit = busy.find((b) => t < b.end && end > b.start);
            if (!hit) return toHHMM(t);
            t = Math.ceil(hit.end / SNAP) * SNAP;
        }
    }
    return null;
};

export const clipToHalf = (segments, half) => {
    const from = half * HALF;
    const to = from + HALF;
    const rest = segments.find((s) => s.key === 'rest');
    const leadEnd = rest ? rest.end - DAY : segments[0]?.start || 0;
    const lead = leadEnd > 0
        ? [{ key: 'rest-prev', kind: 'personal', label: rest?.label || 'Rest', start: 0, end: leadEnd, carried: true }]
        : [];
    return [...lead, ...segments]
        .map((s) => ({ ...s, from: Math.max(s.start, from), to: Math.min(s.end, to) }))
        .filter((s) => s.to > s.from);
};
