import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import API from '../../api/axiosInstance';
import { setActiveDate } from '../../store/slices/plannerSlice';
import { resolveEntry } from '../../utils/Planner';
import DaySchedule from '../../components/schedule/DaySchedule';
import {
    addMinutesToTime, dailyGoalOf, formatDuration, formatGoal, fromDateKey, shiftDateKey, toDateKey, tzOffset,
} from '../../utils/Format';
import './Calendar.css';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const monthName = (d) => d.toLocaleDateString('en-GB', { month: 'long' });

const mondayOf = (key) => {
    const d = fromDateKey(key);
    return shiftDateKey(key, -((d.getDay() + 6) % 7));
};

const buildCells = (view, anchor) => {
    if (view === 'week') return Array.from({ length: 7 }, (_, i) => shiftDateKey(mondayOf(anchor), i));
    const first = fromDateKey(anchor);
    first.setDate(1);
    const start = mondayOf(toDateKey(first));
    return Array.from({ length: 42 }, (_, i) => shiftDateKey(start, i));
};

const entryStatus = (entry, dayKey, today) => {
    const r = resolveEntry(entry);
    if (!r) return 'Planned';
    if (r.state === 'done') return 'Done';
    if (r.state === 'now') return 'In progress';
    if (dayKey === today) return 'Up next';
    return dayKey < today ? 'Not done' : 'Planned';
};

const sortByTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99');

const Calendar = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const profile = useSelector((s) => s.user.profile);
    const today = toDateKey();
    const [view, setView] = useState('month');
    const [anchor, setAnchor] = useState(today);
    const [selected, setSelected] = useState(today);
    const [entriesByDay, setEntriesByDay] = useState({});
    const [focusByDay, setFocusByDay] = useState({});
    const [loading, setLoading] = useState(true);
    const goal = dailyGoalOf(profile);

    const cells = useMemo(() => buildCells(view, anchor), [view, anchor]);
    const rangeFrom = cells[0];
    const rangeTo = cells[cells.length - 1];

    const load = useCallback(async (from, to, signal) => {
        setLoading(true);
        try {
            const tz = tzOffset();
            const [plan, stats] = await Promise.all([
                API.get('/planner/range', { params: { from, to }, signal }),
                API.get('/stats/range', {
                    params: { from: `${from}T00:00:00${tz}`, to: `${shiftDateKey(to, 1)}T00:00:00${tz}`, tz },
                    signal,
                }),
            ]);
            const busy = (plan.data.days || []).map((d) => d.date);
            const details = await Promise.all(busy.map((date) => API.get(`/planner/${date}`, { signal })
                .then((r) => [date, (r.data.tasks || []).filter((t) => t.taskId)])
                .catch(() => [date, []])));
            setEntriesByDay(Object.fromEntries(details));
            setFocusByDay(Object.fromEntries((stats.data.days || []).map((d) => [d.date, d.minutes])));
        } catch (err) {
            if (err?.name !== 'CanceledError') {
                setEntriesByDay({});
                setFocusByDay({});
            }
        } finally {
            if (!signal.aborted) setLoading(false);
        }
    }, []);

    useEffect(() => {
        const ctl = new AbortController();
        load(rangeFrom, rangeTo, ctl.signal);
        return () => ctl.abort();
    }, [load, rangeFrom, rangeTo]);

    const shift = (dir) => {
        if (view === 'week') {
            const next = shiftDateKey(anchor, dir * 7);
            setAnchor(next);
            setSelected(next);
            return;
        }
        const d = fromDateKey(anchor);
        d.setDate(1);
        d.setMonth(d.getMonth() + dir);
        const key = toDateKey(d);
        setAnchor(key);
        setSelected(key.slice(0, 7) === today.slice(0, 7) ? today : key);
    };

    const goToday = () => {
        setAnchor(today);
        setSelected(today);
    };

    const pick = (key) => {
        setSelected(key);
        if (view === 'month' && key.slice(0, 7) !== anchor.slice(0, 7)) setAnchor(key);
    };

    const planDay = () => {
        dispatch(setActiveDate(selected));
        navigate('/dashboard');
    };

    const anchorDate = fromDateKey(anchor);
    const heading = view === 'week'
        ? (() => {
            const a = fromDateKey(cells[0]);
            const b = fromDateKey(cells[6]);
            return a.getMonth() === b.getMonth()
                ? `${a.getDate()}–${b.getDate()} ${monthName(b)} ${b.getFullYear()}`
                : `${a.getDate()} ${monthName(a).slice(0, 3)} – ${b.getDate()} ${monthName(b).slice(0, 3)} ${b.getFullYear()}`;
        })()
        : `${monthName(anchorDate)} ${anchorDate.getFullYear()}`;

    const selDate = fromDateKey(selected);
    const selEntries = [...(entriesByDay[selected] || [])].sort(sortByTime);
    const selFocus = focusByDay[selected] || 0;
    const selPct = Math.round((selFocus / goal) * 100);
    const selSub = selected === today ? 'Today' : selected < today ? 'Past day' : 'Upcoming';
    const chipLimit = view === 'week' ? 8 : 2;

    return (
        <div className="page">
            <div className="page-inner">
                <header className="cal-header">
                    <h1 className="cal-title" aria-live="polite">{heading}</h1>
                    <div className="cal-nav">
                        <button type="button" aria-label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={() => shift(-1)}>
                            <ChevronLeft size={16} />
                        </button>
                        <button type="button" className="cal-nav-today" onClick={goToday}>Today</button>
                        <button type="button" aria-label={view === 'week' ? 'Next week' : 'Next month'} onClick={() => shift(1)}>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                    <div role="group" aria-label="View" className="segmented">
                        <button type="button" className="segmented-option" aria-pressed={view === 'month'} onClick={() => { setView('month'); setAnchor(selected); }}>Month</button>
                        <button type="button" className="segmented-option" aria-pressed={view === 'week'} onClick={() => { setView('week'); setAnchor(selected); }}>Week</button>
                    </div>
                </header>

                <div className="cal-layout">
                    <section className="cal-grid-card" aria-label={heading} aria-busy={loading}>
                        <div className="cal-scroll">
                            <div className="cal-inner">
                                <div className="cal-weekdays" aria-hidden="true">
                                    {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
                                </div>
                                <div className={`cal-cells ${view === 'week' ? 'is-week' : ''}`}>
                                    {cells.map((key) => {
                                        const d = fromDateKey(key);
                                        const inMonth = view === 'week' || key.slice(0, 7) === anchor.slice(0, 7);
                                        const entries = [...(entriesByDay[key] || [])].sort(sortByTime);
                                        const focus = focusByDay[key] || 0;
                                        const isToday = key === today;
                                        const isSel = key === selected;
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                className={`cal-cell ${inMonth ? '' : 'is-out'} ${isSel ? 'is-selected' : ''}`}
                                                aria-pressed={isSel}
                                                aria-label={`${d.getDate()} ${monthName(d)}${isToday ? ', today' : ''}${entries.length ? `, ${entries.length} planned` : ''}${focus ? `, ${formatDuration(focus)} focused` : ''}`}
                                                onClick={() => pick(key)}
                                            >
                                                <span className={`cal-num ${isToday ? 'is-today' : ''}`}>{d.getDate()}</span>
                                                {focus > 0 && (
                                                    <span className="cal-focus">
                                                        <span className="cal-focus-bar" style={{ width: Math.max(6, Math.round(Math.min(focus, 240) / 240 * 60)) }} />
                                                        {formatDuration(focus)}
                                                    </span>
                                                )}
                                                {entries.slice(0, chipLimit).map((e) => {
                                                    const r = resolveEntry(e);
                                                    return (
                                                        <span key={e._id} className="cal-chip">
                                                            <span className="cal-chip-dot" style={{ background: r?.color }} />
                                                            {r?.title || 'Task'}
                                                        </span>
                                                    );
                                                })}
                                                {entries.length > chipLimit && <span className="cal-more">+{entries.length - chipLimit} more</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </section>

                    <aside className="cal-side">
                        <section className="card cal-day" aria-labelledby="cal-day-h">
                            <div className="cal-day-head">
                                <span className="cal-day-sub">{selSub}</span>
                                <h2 id="cal-day-h">{DAY_NAMES[selDate.getDay()]} {selDate.getDate()} {monthName(selDate)}</h2>
                            </div>
                            {selEntries.length ? (
                                <ol className="cal-events">
                                    {selEntries.map((e) => {
                                        const r = resolveEntry(e);
                                        const time = e.time ? `${e.time}–${addMinutesToTime(e.time, e.duration || 30)}` : 'Any time';
                                        return (
                                            <li key={e._id} className="cal-event">
                                                <span className="cal-event-bar" style={{ background: r?.color }} aria-hidden="true" />
                                                <div className="cal-event-text">
                                                    <span className="cal-event-title">{r?.title || 'Task'}</span>
                                                    <span className="cal-event-meta">
                                                        {time} · {entryStatus(e, selected, today)}
                                                        {e.taskType === 'projectTask' && r?.group ? ` · ${r.group}` : ''}
                                                    </span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ol>
                            ) : (
                                <div className="cal-empty">
                                    <span className="cal-empty-title">{loading ? 'Loading…' : 'Nothing scheduled'}</span>
                                    {!loading && <span className="cal-empty-help">Add tasks to this day to plan it out.</span>}
                                </div>
                            )}
                            <button type="button" className="btn btn-primary cal-plan-btn" onClick={planDay}>
                                <Plus size={16} strokeWidth={2.4} aria-hidden="true" /> Plan this day
                            </button>
                        </section>

                        <section className="card cal-sched" aria-labelledby="cal-sched-h">
                            <h2 id="cal-sched-h" className="card-title sm">Day schedule</h2>
                            <DaySchedule
                                key={selected}
                                date={selected}
                                entries={selEntries}
                                compact
                                onChanged={() => load(rangeFrom, rangeTo, new AbortController().signal)}
                            />
                        </section>

                        <section className="card cal-stat" aria-labelledby="cal-stat-h">
                            <h2 id="cal-stat-h" className="card-title sm">That day's focus</h2>
                            <dl className="cal-stat-grid">
                                <div><dt>Focus time</dt><dd className="tabular">{formatDuration(selFocus)}</dd></div>
                                <div><dt>Of {formatGoal(goal)} goal</dt><dd className="tabular">{selPct}%</dd></div>
                            </dl>
                            <div className="progress cal-stat-bar" role="img" aria-label={`${selPct} percent of daily goal`}>
                                <span style={{ width: `${Math.min(100, selPct)}%` }} />
                            </div>
                        </section>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default Calendar;
