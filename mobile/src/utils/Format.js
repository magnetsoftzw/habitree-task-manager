const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = (n) => String(n).padStart(2, '0');

export const toDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const fromDateKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayKey = () => toDateKey(new Date());

export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const startOfWeek = (date = new Date()) => {
  const d = startOfDay(date);
  const diff = (d.getDay() + 6) % 7;
  return addDays(d, -diff);
};

export const startOfMonth = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), 1);

export const tzOffset = (date = new Date()) => {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
};

export const formatMinutes = (total = 0) => {
  const m = Math.max(0, Math.round(total));
  if (m < 60) return m === 0 ? '0h' : `${m}m`;
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
};

export const formatDuration = (m = 0) => {
  if (m < 60) return `${m}m`;
  return m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

export const formatGoal = (m = 480) => (m % 60 === 0 ? `${m / 60}h` : formatMinutes(m));

export const fullDate = (date = new Date()) => `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;

export const dayTitle = (date) => `${DAYS[date.getDay()]} ${date.getDate()}`;

export const monthTitle = (date) => `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

export const shortDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};

export const longDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
};

export const monthYear = (value) => {
  const d = new Date(value);
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
};

export const rangeLabel = (from, to) => {
  const last = addDays(to, -1);
  if (from.getMonth() === last.getMonth()) return `${from.getDate()} – ${last.getDate()} ${MONTHS[from.getMonth()]}`;
  return `${from.getDate()} ${MONTHS[from.getMonth()].slice(0, 3)} – ${last.getDate()} ${MONTHS[last.getMonth()].slice(0, 3)}`;
};

export const weekdayShort = (date) => DAYS[date.getDay()].slice(0, 3);

export const greeting = (date = new Date()) => {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

export const clock = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

export const timeToMinutes = (time = '00:00') => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const minutesToTime = (mins) => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;

export const nextHalfHour = (date = new Date()) => {
  const mins = date.getHours() * 60 + date.getMinutes();
  return minutesToTime(Math.min(23 * 60 + 30, Math.ceil((mins + 1) / 30) * 30));
};

export const isOverdue = (value, done) => {
  if (!value || done) return false;
  return startOfDay(new Date(value)) < startOfDay();
};

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

export const timer = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

export const errorMessage = (error, fallback = 'Something went wrong') =>
  error?.response?.data?.message || error?.message || fallback;
