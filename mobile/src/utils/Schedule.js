import { minutesToTime, timeToMinutes } from './Format';

export const HALF = 720;
export const DAY = 1440;
export const HALVES = [
  { value: 0, label: '12 AM–12 PM', start: 0 },
  { value: 1, label: '12 PM–12 AM', start: HALF },
];

const clockParts = (minutes) => {
  const m = ((minutes % DAY) + DAY) % DAY;
  const h = Math.floor(m / 60);
  return { text: `${h % 12 || 12}${m % 60 ? `:${String(m % 60).padStart(2, '0')}` : ':00'}`, suffix: h < 12 ? 'AM' : 'PM' };
};

export const clock12 = (minutes) => {
  const p = clockParts(minutes);
  return `${p.text} ${p.suffix}`;
};

export const formatRange = (start, end) => {
  const a = clockParts(start);
  const b = clockParts(end);
  return a.suffix === b.suffix ? `${a.text}–${b.text} ${b.suffix}` : `${a.text} ${a.suffix}–${b.text} ${b.suffix}`;
};

export const formatLength = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
};

export const entryRange = (entry) => {
  const start = timeToMinutes(entry.time || '08:00');
  return { start, end: start + (entry.duration || 30) };
};

export const workPeriodFor = (segments = [], start, end) =>
  segments.find((s) => s.kind === 'work' && start >= s.start && end <= s.end) || null;

export const entriesIn = (segment, entries = []) => (segment?.kind === 'work'
  ? entries.filter((e) => {
    const { start, end } = entryRange(e);
    return start >= segment.start && end <= segment.end;
  })
  : []);

export const outsideEntries = (segments = [], entries = []) => entries.filter((e) => {
  const { start, end } = entryRange(e);
  return !workPeriodFor(segments, start, end);
});

export const piecesForHalf = (segments = [], half) => {
  const from = half * HALF;
  const to = from + HALF;
  const pieces = [];
  segments.forEach((s) => {
    const spans = s.end > DAY ? [[s.start, DAY], [0, s.end - DAY]] : [[s.start, s.end]];
    spans.forEach(([a, b]) => {
      const start = Math.max(a, from);
      const end = Math.min(b, to);
      if (end > start) pieces.push({ segment: s, start, end });
    });
  });
  return pieces.sort((x, y) => x.start - y.start);
};

export const freeSlot = (segments = [], entries = [], duration = 30, { after = 0, within } = {}) => {
  const periods = segments.filter((s) => s.kind === 'work' && (!within || s.key === within));
  const taken = entries.map(entryRange);
  for (const p of periods) {
    let t = Math.max(p.start, Math.ceil(after / 5) * 5);
    while (t + duration <= p.end) {
      const clash = taken.find((r) => t < r.end && t + duration > r.start);
      if (!clash) return minutesToTime(t);
      t = Math.ceil(clash.end / 5) * 5;
    }
  }
  return null;
};

export const placement = (segments = [], start, end) => {
  const home = workPeriodFor(segments, start, end);
  if (home) return { ok: true, segment: home };
  const hit = segments.find((s) => s.kind === 'personal' && ((start < s.end && end > s.start) || (start + DAY < s.end && end + DAY > s.start)));
  return { ok: false, segment: hit || null };
};

export const halfFor = (minutes) => (minutes >= HALF && minutes < DAY ? 1 : 0);
