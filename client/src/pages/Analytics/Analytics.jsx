import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import API from '../../api/axiosInstance';
import PageHeader from '../../components/ui/PageHeader';
import { fetchInventoryTasks } from '../../store/slices/taskSlice';
import {
    dailyGoalOf, formatDuration, formatGoal, fromDateKey, shiftDateKey, toDateKey, tzOffset,
} from '../../utils/Format';
import './Analytics.css';

const RANGES = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
];

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const mondayOf = (key) => shiftDateKey(key, -((fromDateKey(key).getDay() + 6) % 7));

const rangeDays = (range, today) => {
    if (range === 'month') {
        const d = fromDateKey(today);
        const first = toDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
        const count = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        return Array.from({ length: count }, (_, i) => shiftDateKey(first, i));
    }
    const start = mondayOf(today);
    return Array.from({ length: 7 }, (_, i) => shiftDateKey(start, i));
};

const dayLabel = (key) => {
    const d = fromDateKey(key);
    return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
};

const STATUS_GROUPS = [
    { label: 'Done', match: ['Completed'], color: 'var(--accent)' },
    { label: 'In progress', match: ['On-Going'], color: '#D99A2B' },
    { label: 'Not started', match: ['Not Started'], color: 'var(--text-faint)' },
    { label: 'On hold or shelved', match: ['On-Hold', 'Shelved'], color: '#7C6FCF' },
];

const Analytics = () => {
    const dispatch = useDispatch();
    const profile = useSelector((s) => s.user.profile);
    const inventory = useSelector((s) => s.tasks.inventory);
    const goal = dailyGoalOf(profile);
    const today = toDateKey();
    const [range, setRange] = useState('week');
    const [stats, setStats] = useState(null);
    const [failed, setFailed] = useState(false);

    const days = useMemo(() => rangeDays(range, today), [range, today]);
    const chartDays = range === 'today' ? rangeDays('week', today) : days;
    const queryFrom = chartDays[0] < days[0] ? chartDays[0] : days[0];
    const queryTo = days[days.length - 1] > chartDays[chartDays.length - 1] ? days[days.length - 1] : chartDays[chartDays.length - 1];

    useEffect(() => {
        dispatch(fetchInventoryTasks());
    }, [dispatch]);

    useEffect(() => {
        const ctl = new AbortController();
        const tz = tzOffset();
        API.get('/stats/range', {
            params: { from: `${queryFrom}T00:00:00${tz}`, to: `${shiftDateKey(queryTo, 1)}T00:00:00${tz}`, tz },
            signal: ctl.signal,
        })
            .then((r) => {
                setStats(r.data);
                setFailed(false);
            })
            .catch((err) => {
                if (err?.name !== 'CanceledError') setFailed(true);
            });
        return () => ctl.abort();
    }, [queryFrom, queryTo]);

    const byDay = useMemo(() => new Map((stats?.days || []).map((d) => [d.date, d])), [stats]);
    const minutesOn = (key) => byDay.get(key)?.minutes || 0;
    const sessionsOn = (key) => byDay.get(key)?.sessions || 0;

    const kpiDays = range === 'today' ? [today] : days;
    const elapsed = kpiDays.filter((k) => k <= today);
    const totalMinutes = kpiDays.reduce((sum, k) => sum + minutesOn(k), 0);
    const totalSessions = kpiDays.reduce((sum, k) => sum + sessionsOn(k), 0);
    const best = kpiDays.reduce((top, k) => (minutesOn(k) > (top ? minutesOn(top) : 0) ? k : top), null);

    const allTasks = useMemo(() => Object.values(inventory || {}).flat(), [inventory]);
    const doneAll = allTasks.filter((t) => t.status === 'Completed').length;
    const statuses = STATUS_GROUPS.map((g) => ({ ...g, n: allTasks.filter((t) => g.match.includes(t.status)).length }));

    const todayMinutes = minutesOn(today);
    const goalPct = Math.round((todayMinutes / goal) * 100);
    const ring = 2 * Math.PI * 70;

    const chartMax = Math.max(goal, ...chartDays.map(minutesOn));
    const scaleMax = Math.ceil(chartMax / 120) * 120;
    const ticks = Array.from({ length: 5 }, (_, i) => Math.round((scaleMax * (4 - i)) / 4));
    const hasChartData = chartDays.some((k) => minutesOn(k) > 0);
    const dense = chartDays.length > 7;

    const rangeWord = range === 'today' ? 'today' : range === 'week' ? 'this week' : 'this month';
    const subtitle = range === 'today'
        ? fromDateKey(today).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
        : range === 'week'
            ? `${fromDateKey(days[0]).getDate()} – ${dayLabel(days[6]).split(' ').slice(1).join(' ')} ${fromDateKey(days[6]).getFullYear()}`
            : fromDateKey(today).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    const summaryRows = range === 'month'
        ? Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => {
            const chunk = days.slice(i * 7, i * 7 + 7);
            const future = chunk[0] > today;
            const mins = chunk.reduce((s, k) => s + minutesOn(k), 0);
            return {
                key: chunk[0],
                label: `${fromDateKey(chunk[0]).getDate()}–${dayLabel(chunk[chunk.length - 1]).split(' ').slice(1).join(' ')}`,
                sessions: future ? '—' : chunk.reduce((s, k) => s + sessionsOn(k), 0),
                focus: future ? '—' : formatDuration(mins),
                goal: future ? '' : `${Math.round((mins / (goal * chunk.length)) * 100)}%`,
            };
        })
        : rangeDays('week', today).map((k) => ({
            key: k,
            label: dayLabel(k),
            sessions: k > today ? '—' : sessionsOn(k),
            focus: k > today ? '—' : formatDuration(minutesOn(k)),
            goal: k > today ? '' : `${Math.round((minutesOn(k) / goal) * 100)}%`,
            current: k === today,
        }));
    const summaryDays = range === 'month' ? days : rangeDays('week', today);
    const summaryTotalMinutes = summaryDays.reduce((s, k) => s + minutesOn(k), 0);
    const summaryTotalSessions = summaryDays.reduce((s, k) => s + sessionsOn(k), 0);

    const projects = (stats?.byProject || []).filter((p) => p.kind !== 'none');
    const projectMax = Math.max(1, ...projects.map((p) => p.minutes));

    return (
        <div className="page">
            <div className="page-inner">
                <PageHeader
                    alignEnd
                    title="Analytics"
                    subtitle={subtitle}
                    actions={(
                        <div role="group" aria-label="Time range" className="segmented">
                            {RANGES.map((r) => (
                                <button key={r.value} type="button" className="segmented-option" aria-pressed={range === r.value} onClick={() => setRange(r.value)}>
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    )}
                />

                {failed && <p className="an-error" role="alert">Couldn't load your stats. They'll appear once the connection is back.</p>}

                <section aria-label="Key numbers" className="stat-grid">
                    <div className="an-kpi">
                        <span className="an-kpi-label">Focus time</span>
                        <span className="an-kpi-value tabular">{formatDuration(totalMinutes)}</span>
                        <span className="an-kpi-note">{totalSessions} {totalSessions === 1 ? 'session' : 'sessions'} {rangeWord}</span>
                    </div>
                    <div className="an-kpi">
                        <span className="an-kpi-label">Daily average</span>
                        <span className="an-kpi-value tabular">{formatDuration(Math.round(totalMinutes / Math.max(1, elapsed.length)))}</span>
                        <span className="an-kpi-note">Across {elapsed.length} {elapsed.length === 1 ? 'day' : 'days'} so far</span>
                    </div>
                    <div className="an-kpi">
                        <span className="an-kpi-label">Tasks completed</span>
                        <span className="an-kpi-value tabular">{doneAll} / {allTasks.length}</span>
                        <span className="an-kpi-note">
                            {stats ? `${stats.tasksCompleted} done ${rangeWord}, list tasks included` : `${allTasks.length ? Math.round((doneAll / allTasks.length) * 100) : 0}% completion, all time`}
                        </span>
                    </div>
                    <div className="an-kpi">
                        <span className="an-kpi-label">Best day</span>
                        <span className="an-kpi-value">{best ? SHORT_DAYS[fromDateKey(best).getDay()] : '—'}</span>
                        <span className="an-kpi-note">{best ? `${formatDuration(minutesOn(best))} focused` : 'No sessions yet'}</span>
                    </div>
                </section>

                <div className="an-row">
                    <section className="card an-chart-card" aria-labelledby="an-ft-h">
                        <div className="an-card-head">
                            <h2 id="an-ft-h" className="card-title">Focus time per day</h2>
                            <span className="an-card-note">Dashed line = {formatGoal(goal)} goal</span>
                        </div>
                        {hasChartData ? (
                            <div className="an-chart">
                                <div className="an-axis" aria-hidden="true">
                                    {ticks.map((t) => <span key={t}>{t ? `${Math.round(t / 60)}h` : '0'}</span>)}
                                </div>
                                <div className="an-plot-wrap">
                                    <div
                                        className={`an-plot ${dense ? 'is-dense' : ''}`}
                                        role="img"
                                        aria-label={`Bar chart of focus time per day, ${formatDuration(chartDays.reduce((s, k) => s + minutesOn(k), 0))} total`}
                                    >
                                        <span className="an-goal-line" style={{ bottom: `${(goal / scaleMax) * 100}%` }} />
                                        {chartDays.map((k) => {
                                            const m = minutesOn(k);
                                            return (
                                                <div key={k} className="an-bar-col" title={`${dayLabel(k)}: ${formatDuration(m)}, ${sessionsOn(k)} sessions`}>
                                                    {!dense && m > 0 && <span className="an-bar-val tabular">{formatDuration(m)}</span>}
                                                    <div className={`an-bar ${k === today ? 'is-today' : ''}`} style={{ height: `${(m / scaleMax) * 100}%` }} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className={`an-labels ${dense ? 'is-dense' : ''}`} aria-hidden="true">
                                        {chartDays.map((k, i) => (
                                            <span key={k} className={k === today ? 'is-today' : ''}>
                                                {dense ? ((i % 3 === 0 || k === today) ? fromDateKey(k).getDate() : '') : SHORT_DAYS[fromDateKey(k).getDay()]}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="an-empty">
                                <span className="an-empty-title">No focus time logged yet</span>
                                <span className="an-empty-help">Start a session from the dashboard and your days will fill in here.</span>
                                <Link to="/dashboard" className="btn btn-primary">Start a session</Link>
                            </div>
                        )}
                    </section>

                    <section className="card an-goal-card" aria-labelledby="an-goal-h">
                        <h2 id="an-goal-h" className="card-title">Today vs goal</h2>
                        <div className="an-ring">
                            <svg width="168" height="168" viewBox="0 0 168 168" role="img" aria-label={`${goalPct} percent of the ${formatGoal(goal)} goal`}>
                                <circle cx="84" cy="84" r="70" fill="none" className="an-ring-track" strokeWidth="14" />
                                <circle
                                    cx="84" cy="84" r="70" fill="none" className="an-ring-fill" strokeWidth="14" strokeLinecap="round"
                                    strokeDasharray={ring} strokeDashoffset={ring * (1 - Math.min(100, goalPct) / 100)} transform="rotate(-90 84 84)"
                                />
                                <text x="84" y="86" textAnchor="middle" className="an-ring-pct">{goalPct}%</text>
                                <text x="84" y="108" textAnchor="middle" className="an-ring-sub">of {formatGoal(goal)} goal</text>
                            </svg>
                        </div>
                        <dl className="an-goal-list">
                            <div><dt><span className="an-swatch is-accent" />Focused</dt><dd className="tabular">{formatDuration(todayMinutes)}</dd></div>
                            <div><dt><span className="an-swatch is-soft" />Remaining</dt><dd className="tabular">{formatDuration(Math.max(0, goal - todayMinutes))}</dd></div>
                            <div><dt className="an-indent">Sessions</dt><dd className="tabular">{sessionsOn(today)}</dd></div>
                        </dl>
                    </section>
                </div>

                <div className="an-row">
                    <section className="card an-status-card" aria-labelledby="an-tb-h">
                        <div className="an-card-head">
                            <h2 id="an-tb-h" className="card-title">Tasks by status</h2>
                            <span className="an-card-note">All time · {allTasks.length} {allTasks.length === 1 ? 'task' : 'tasks'}</span>
                        </div>
                        <div className="an-stack" role="img" aria-label={statuses.map((s) => `${s.label} ${s.n}`).join(', ')}>
                            {allTasks.length
                                ? statuses.filter((s) => s.n).map((s) => <span key={s.label} title={`${s.label}: ${s.n}`} style={{ flexGrow: s.n, background: s.color }} />)
                                : <span className="an-stack-empty" />}
                        </div>
                        <ul className="an-legend">
                            {statuses.map((s) => (
                                <li key={s.label}>
                                    <span className="an-swatch" style={{ background: s.color }} />
                                    <span className="an-legend-label">{s.label}</span>
                                    <span className="an-legend-n tabular">{s.n}</span>
                                    <span className="an-legend-pct tabular">{allTasks.length ? Math.round((s.n / allTasks.length) * 100) : 0}%</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="card an-summary-card" aria-labelledby="an-ws-h">
                        <h2 id="an-ws-h" className="card-title">{range === 'month' ? 'Monthly summary' : 'Weekly summary'}</h2>
                        <div className="table-scroll">
                            <table className="an-table">
                                <thead>
                                    <tr>
                                        <th scope="col">{range === 'month' ? 'Week' : 'Day'}</th>
                                        <th scope="col">Sessions</th>
                                        <th scope="col">Focus</th>
                                        <th scope="col">Goal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summaryRows.map((r) => (
                                        <tr key={r.key} className={r.current ? 'is-today' : ''}>
                                            <th scope="row">{r.label}</th>
                                            <td>{r.sessions}</td>
                                            <td>{r.focus}</td>
                                            <td className="an-muted">{r.goal}</td>
                                        </tr>
                                    ))}
                                    <tr className="an-total">
                                        <th scope="row">Total</th>
                                        <td>{summaryTotalSessions}</td>
                                        <td>{formatDuration(summaryTotalMinutes)}</td>
                                        <td />
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <section className="card an-project-card" aria-labelledby="an-bp-h">
                    <div className="an-card-head">
                        <h2 id="an-bp-h" className="card-title">By project</h2>
                        <span className="an-card-note">Focus time and completed tasks {rangeWord}</span>
                    </div>
                    {projects.length ? (
                        <ul className="an-projects">
                            {projects.map((p) => (
                                <li key={p.key}>
                                    <span className="an-swatch" style={{ background: p.color }} />
                                    <span className="an-project-name">
                                        {p.name}
                                        <span className="an-project-kind">{p.kind === 'project' ? 'Project' : 'Group'}</span>
                                    </span>
                                    <span className="an-project-bar" aria-hidden="true">
                                        <span style={{ width: `${(p.minutes / projectMax) * 100}%`, background: p.color }} />
                                    </span>
                                    <span className="an-project-min tabular">{formatDuration(p.minutes)}</span>
                                    <span className="an-project-done tabular">{p.completed} done</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="an-project-empty">Focus sessions and completed tasks show up here, split by project and task group.</p>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Analytics;
