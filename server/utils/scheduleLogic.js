const DAY_START = 240;
const DAY_END = 1680;
const MIDNIGHT = 1440;
const MIN_PERSONAL = 5;

const DEFAULT_SEGMENTS = [
    { key: 'wake', kind: 'personal', label: 'WAKE', color: null, start: 240, end: 360 },
    { key: 'wp1', kind: 'work', label: 'Work period 1', color: '#0F7A5C', start: 360, end: 420 },
    { key: 'breakfast', kind: 'personal', label: 'Breakfast', color: null, start: 420, end: 480 },
    { key: 'wp2', kind: 'work', label: 'Work period 2', color: '#2563EB', start: 480, end: 600 },
    { key: 'brunch', kind: 'personal', label: 'Brunch', color: null, start: 600, end: 660 },
    { key: 'wp3', kind: 'work', label: 'Work period 3', color: '#B45309', start: 660, end: 780 },
    { key: 'lunch', kind: 'personal', label: 'Lunch', color: null, start: 780, end: 840 },
    { key: 'wp4', kind: 'work', label: 'Work period 4', color: '#7C3AED', start: 840, end: 960 },
    { key: 'break', kind: 'personal', label: 'Break', color: null, start: 960, end: 1020 },
    { key: 'wp5', kind: 'work', label: 'Work period 5', color: '#DB2777', start: 1020, end: 1140 },
    { key: 'rest', kind: 'personal', label: 'Rest', color: null, start: 1140, end: 1680 },
];

const toMinutes = (time) => {
    const [h, m] = String(time).split(':').map(Number);
    return h * 60 + m;
};

const toTime = (minutes) => {
    const m = ((minutes % MIDNIGHT) + MIDNIGHT) % MIDNIGHT;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const clock = (minutes) => {
    const m = ((minutes % MIDNIGHT) + MIDNIGHT) % MIDNIGHT;
    const h = Math.floor(m / 60);
    const suffix = h < 12 ? 'AM' : 'PM';
    const hour = h % 12 || 12;
    return { text: m % 60 ? `${hour}:${String(m % 60).padStart(2, '0')}` : `${hour}:00`, suffix };
};

const formatRange = (start, end) => {
    const a = clock(start);
    const b = clock(end);
    return a.suffix === b.suffix ? `${a.text}–${b.text} ${b.suffix}` : `${a.text} ${a.suffix}–${b.text} ${b.suffix}`;
};

const plain = (s) => ({ key: s.key, kind: s.kind, label: s.label, color: s.color ?? null, start: s.start, end: s.end });

const effectiveSegments = (template, override) => {
    const base = (template?.segments?.length ? template.segments : DEFAULT_SEGMENTS).map(plain);
    if (!override?.segments?.length) return base;
    const byKey = new Map(base.map((s) => [s.key, s]));
    return override.segments
        .filter((o) => byKey.has(o.key))
        .map((o) => ({ ...byKey.get(o.key), start: o.start, end: o.end }))
        .sort((a, b) => a.start - b.start);
};

const entryInterval = (entry) => {
    const start = toMinutes(entry.time || '08:00');
    return { start, end: start + (Number(entry.duration) || 30) };
};

const containingWork = (segments, start, end) =>
    segments.find((s) => s.kind === 'work' && start >= s.start && end <= s.end) || null;

const overlaps = (segments, start, end) => {
    const shifted = segments.flatMap((s) => (s.end > MIDNIGHT ? [s, { ...s, start: s.start - MIDNIGHT, end: s.end - MIDNIGHT }] : [s]));
    return shifted.find((s) => s.kind === 'personal' && start < s.end && end > s.start) || null;
};

const intervalError = (segments, start, end) => {
    if (containingWork(segments, start, end)) return null;
    const hit = overlaps(segments, start, end);
    if (hit) {
        const original = segments.find((s) => s.key === hit.key) || hit;
        return `That time overlaps ${original.label} (${formatRange(original.start, original.end)}). Pick a time inside a work period.`;
    }
    return 'That time crosses into another work period. Shorten it or pick a time inside a single work period.';
};

const shiftError = (message) => ({ error: message });

const computeShift = (segments, entries, segmentKey, offset) => {
    if (!Number.isInteger(offset) || offset === 0 || offset % 5 !== 0 || Math.abs(offset) > 720) {
        return shiftError('offsetMinutes must be a non-zero multiple of 5, up to 720');
    }
    const segs = segments.map(plain).sort((a, b) => a.start - b.start);
    const i = segs.findIndex((s) => s.key === segmentKey);
    if (i === -1) return shiftError('That segment is not part of this day');
    if (segs[i].kind !== 'work') return shiftError('Only work periods can be shifted');

    const restIndex = segs.findIndex((s) => s.key === 'rest');
    const lastWork = segs.reduce((acc, s, idx) => (s.kind === 'work' ? idx : acc), -1);
    const isFinal = i === lastWork;
    const prev = segs[i - 1];
    const dayEnd = restIndex === -1 ? MIDNIGHT : segs[restIndex].start;

    if (offset < 0) {
        const floor = prev ? prev.start + (prev.kind === 'personal' ? MIN_PERSONAL : prev.end - prev.start) : DAY_START;
        if (segs[i].start + offset < floor) return shiftError(`It can move at most ${segs[i].start - floor} minutes earlier`);
    }
    if (isFinal && offset > 0 && segs[i].end + offset > MIDNIGHT) {
        return shiftError(`It can move at most ${MIDNIGHT - segs[i].end} minutes later, because work periods end by midnight`);
    }
    if (!isFinal && offset > 0 && segs[i].start + offset >= dayEnd) {
        return shiftError('There is no room left in the day to move it that far');
    }

    const moving = new Set(segs.slice(i).filter((s) => s.key !== 'rest').map((s) => s.key));
    const next = segs.map((s) => (moving.has(s.key) ? { ...s, start: s.start + offset, end: s.end + offset } : { ...s }));
    if (prev) next[i - 1].end = next[i].start;

    let restLostMinutes = 0;
    let workLostMinutes = 0;
    let result;
    if (offset < 0 || isFinal) {
        if (restIndex !== -1) {
            const lastMoved = next[restIndex - 1];
            restLostMinutes = Math.max(0, lastMoved.end - segs[restIndex].start);
            next[restIndex].start = lastMoved.end;
        }
        result = next;
    } else {
        result = [];
        next.forEach((s, idx) => {
            if (s.key === 'rest') return result.push(s);
            if (s.start >= dayEnd) {
                if (s.kind === 'work') workLostMinutes += segs[idx].end - segs[idx].start;
                return undefined;
            }
            if (s.end > dayEnd) {
                if (s.kind === 'work') workLostMinutes += s.end - dayEnd;
                return result.push({ ...s, end: dayEnd });
            }
            return result.push(s);
        });
    }

    const moved = [];
    const removed = [];
    entries.forEach((entry) => {
        const { start, end } = entryInterval(entry);
        const home = containingWork(segs, start, end);
        if (!home || !moving.has(home.key)) return;
        const ns = start + offset;
        const ne = end + offset;
        if (containingWork(result, ns, ne)) moved.push({ entry, time: toTime(ns) });
        else removed.push(entry);
    });

    return {
        segments: result,
        restLostMinutes,
        workLostMinutes,
        rest: result.find((s) => s.key === 'rest') || null,
        moved,
        removed,
        requiresConfirmation: restLostMinutes > 0 || workLostMinutes > 0 || removed.length > 0,
    };
};

const MIN_SEGMENT = 5;
const length = (s) => s.end - s.start;

const computeResize = (segments, entries, segmentKey, edge, offset) => {
    if (edge !== 'start' && edge !== 'end') return { error: "edge must be 'start' or 'end'", field: 'edge' };
    if (!Number.isInteger(offset) || offset === 0 || offset % 5 !== 0 || Math.abs(offset) > 720) {
        return shiftError('offsetMinutes must be a non-zero multiple of 5, up to 720');
    }
    const segs = segments.map(plain).sort((a, b) => a.start - b.start);
    const i = segs.findIndex((s) => s.key === segmentKey);
    if (i === -1) return { error: 'That segment is not part of this day', field: 'segmentKey' };
    const restIndex = segs.findIndex((s) => s.key === 'rest');
    if (restIndex === -1) return shiftError('This day has no Rest segment');
    const cur = segs[i];
    if (edge === 'start' && i === 0) return { error: `The start of ${cur.label} is fixed at 4:00 AM, where the day begins`, field: 'edge' };
    if (edge === 'end' && i === segs.length - 1) return { error: `The end of ${cur.label} is fixed at 4:00 AM, where the day begins`, field: 'edge' };

    const lastWork = segs.reduce((acc, s, idx) => (s.kind === 'work' ? idx : acc), -1);
    const dayEnd = segs[restIndex].start;
    const next = segs.map((s) => ({ ...s }));
    const moving = new Set();
    let shrinking = null;
    let restLostMinutes = 0;
    let workLostMinutes = 0;
    let result = next;

    if (edge === 'end' && offset > 0) {
        next[i].end += offset;
        for (let k = i + 1; k < restIndex; k += 1) {
            next[k].start += offset;
            next[k].end += offset;
            moving.add(next[k].key);
        }
        if (i + 1 === restIndex || i + 1 === lastWork) {
            const latestWorkEnd = Math.max(...segs.slice(i, restIndex).filter((s) => s.kind === 'work').map((s) => s.end), -Infinity);
            const room = Math.min(MIDNIGHT - latestWorkEnd, length(segs[restIndex]) - MIN_SEGMENT);
            if (offset > room) return shiftError(`It can grow by at most ${Math.max(0, room)} minutes, because work periods end by midnight`);
            next[restIndex].start = next[restIndex - 1].end;
            restLostMinutes = offset;
        } else {
            if (next[i].end > dayEnd) return shiftError(`It can grow by at most ${dayEnd - cur.end} minutes before Rest begins`);
            result = [];
            next.forEach((s, idx) => {
                if (!moving.has(s.key)) return result.push(s);
                if (s.start >= dayEnd) {
                    if (s.kind === 'work') workLostMinutes += length(segs[idx]);
                    return undefined;
                }
                if (s.end > dayEnd) {
                    if (s.kind === 'work') workLostMinutes += s.end - dayEnd;
                    return result.push({ ...s, end: dayEnd });
                }
                return result.push(s);
            });
        }
    } else if (edge === 'end') {
        if (length(cur) + offset < MIN_SEGMENT) return shiftError(`It can shrink by at most ${length(cur) - MIN_SEGMENT} minutes`);
        next[i].end += offset;
        next[i + 1].start += offset;
        shrinking = cur.key;
    } else if (offset < 0) {
        const prev = segs[i - 1];
        if (length(prev) + offset < MIN_SEGMENT) {
            return shiftError(`It can grow by at most ${length(prev) - MIN_SEGMENT} minutes, because ${prev.label} needs at least 5 minutes`);
        }
        next[i].start += offset;
        next[i - 1].end += offset;
        shrinking = prev.key;
    } else {
        const prev = segs[i - 1];
        if (length(cur) - offset < MIN_SEGMENT) return shiftError(`It can shrink by at most ${length(cur) - MIN_SEGMENT} minutes`);
        if (prev.kind === 'work' && prev.end + offset > MIDNIGHT) {
            return shiftError(`It can shrink by at most ${MIDNIGHT - prev.end} minutes, because work periods end by midnight`);
        }
        next[i].start += offset;
        next[i - 1].end += offset;
        shrinking = cur.key;
        if (i === restIndex) restLostMinutes = offset;
    }

    const moved = [];
    const removed = [];
    entries.forEach((entry) => {
        const { start, end } = entryInterval(entry);
        const home = containingWork(segs, start, end);
        if (!home) return;
        if (moving.has(home.key)) {
            const ns = start + offset;
            if (containingWork(result, ns, end + offset)) moved.push({ entry, time: toTime(ns) });
            else removed.push(entry);
        } else if (home.key === shrinking && !containingWork(result, start, end)) {
            removed.push(entry);
        }
    });

    return {
        segments: result.sort((a, b) => a.start - b.start),
        restLostMinutes,
        workLostMinutes,
        rest: result.find((s) => s.key === 'rest') || null,
        moved,
        removed,
        requiresConfirmation: restLostMinutes > 0 || workLostMinutes > 0 || removed.length > 0,
    };
};

module.exports = {
    DAY_START, DAY_END, MIDNIGHT, DEFAULT_SEGMENTS,
    toMinutes, toTime, formatRange, effectiveSegments, entryInterval, containingWork, intervalError, computeShift, computeResize,
};
