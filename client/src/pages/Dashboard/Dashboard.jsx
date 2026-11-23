import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import {
    Bell, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Folder,
    Plus, Route, Search, Sprout, SquareCheck, Timer,
} from 'lucide-react';

import PageHeader from '../../components/ui/PageHeader';
import GoalRing from '../../components/ui/GoalRing';
import EmptyState from '../../components/ui/EmptyState';
import PlanBlock from '../../components/dashboard/PlanBlock/PlanBlock';
import { planEntryState } from '../../utils/Planner';
import FocusCard from '../../components/dashboard/FocusCard/FocusCard';
import WeekChart from '../../components/dashboard/WeekChart/WeekChart';
import AddBlockModal from '../../components/modals/Planner/AddBlockModal';
import FocusSessionFlow from '../../components/session/FocusSessionFlow';
import PlanEntryModal from '../../components/modals/Planner/PlanEntryModal';
import AddMinutesModal from '../../components/modals/Session/AddMinutesModal';
import CreateTaskModal from '../../components/modals/Task/CreateTaskModal';
import DaySchedule from '../../components/schedule/DaySchedule';
import useDaySchedule from '../../hooks/UseDaySchedule';
import { nextFreeSlot } from '../../utils/Schedule';

import API from '../../api/axiosInstance';
import { fetchTodayStats } from '../../store/slices/statsSlice';
import { fetchWeeklyStats } from '../../store/slices/analyticsSlice';
import {
    discardFailed, logSession, retryFailed, selectMyQueue, selectPendingByDay, syncSessions,
} from '../../store/slices/sessionSlice';
import { setActiveDate, fetchPlannerByDate, assignTaskToDate } from '../../store/slices/plannerSlice';
import { createNewTask, fetchInventoryTasks } from '../../store/slices/taskSlice';
import { fetchGroups } from '../../store/slices/groupSlice';
import { colorFor, UNCATEGORIZED_COLOR } from '../../utils/Colors';
import {
    addMinutesToTime, formatDuration, formatLongDate, formatRelative, fromDateKey, greeting, nextHourTime, shiftDateKey, toDateKey, dailyGoalOf, formatGoal,
} from '../../utils/Format';
import { roadmapProgress } from '../../utils/Roadmap';
import './Dashboard.css';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const sortByTime = (a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
};

const Dashboard = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const searchRef = useRef(null);

    const { profile } = useSelector((state) => state.user);
    const { activeDate, dayData, loading: plannerLoading } = useSelector((state) => state.planner);
    const stats = useSelector((state) => state.stats);
    const weeklySynced = useSelector((state) => state.analytics.weekly);
    const inventory = useSelector((state) => state.tasks.inventory);
    const groups = useSelector((state) => state.groups.list);
    const roadmaps = useSelector((state) => state.roadmaps.list);
    const pendingByDay = useSelector(selectPendingByDay);
    const myQueue = useSelector(selectMyQueue);
    const syncing = useSelector((state) => state.session.syncing);

    const [search, setSearch] = useState('');
    const [notifications, setNotifications] = useState([]);
    const [notifOpen, setNotifOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [isAddBlockOpen, setAddBlockOpen] = useState(false);
    const [addBlockFrom, setAddBlockFrom] = useState(null);
    const [isFocusOpen, setFocusOpen] = useState(false);
    const [isChooseTaskOpen, setChooseTaskOpen] = useState(false);
    const [focusTask, setFocusTask] = useState(null);
    const [isAddMinutesOpen, setAddMinutesOpen] = useState(false);
    const [isCreateOpen, setCreateOpen] = useState(false);

    const today = toDateKey();
    const segments = useDaySchedule(activeDate);
    const isToday = activeDate === today;

    useEffect(() => {
        dispatch(fetchPlannerByDate(activeDate));
        dispatch(fetchTodayStats(activeDate));
    }, [dispatch, activeDate]);

    useEffect(() => {
        dispatch(fetchWeeklyStats());
        dispatch(fetchGroups());
        API.get('/notifications')
            .then(({ data }) => setNotifications(data.notifications || []))
            .catch(() => setNotifications([]));
    }, [dispatch]);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    const allTasks = useMemo(() => Object.values(inventory || {}).flat(), [inventory]);
    const doneCount = allTasks.filter((t) => t.status === 'Completed').length;

    const entries = useMemo(() => [...(dayData?.tasks || [])].sort(sortByTime), [dayData]);
    const doneBlocks = entries.filter((e) => planEntryState(e) === 'done').length;
    const nowEntry = entries.find((e) => planEntryState(e) === 'now');
    const nowTask = nowEntry?.taskId && typeof nowEntry.taskId === 'object'
        ? {
            ...nowEntry.taskId,
            taskType: nowEntry.taskType || 'task',
            projectId: nowEntry.taskType === 'projectTask' || nowEntry.taskType === 'projectTaskGroup' ? nowEntry.taskId.groupId?._id : undefined,
        }
        : null;
    const nowTime = new Date().toTimeString().slice(0, 5);
    const upNextId = isToday
        ? entries.find((e) => planEntryState(e) === 'next' && (!e.time || addMinutesToTime(e.time, e.duration || 30) > nowTime))?._id
        : null;

    const suggestions = useMemo(() => {
        const open = allTasks.filter((t) => t.status !== 'Completed');
        return [...open.filter((t) => t.status === 'On-Going'), ...open.filter((t) => t.status !== 'On-Going')].slice(0, 3);
    }, [allTasks]);

    const taskGroups = useMemo(() => {
        const colorByName = Object.fromEntries((groups || []).map((g) => [g.name, colorFor(g)]));
        return Object.entries(inventory || {})
            .filter(([, list]) => list.length > 0)
            .map(([name, list]) => {
                const done = list.filter((t) => t.status === 'Completed').length;
                const pct = list.length ? Math.round((done / list.length) * 100) : 0;
                const color = name === 'Uncategorized' ? UNCATEGORIZED_COLOR : colorByName[name] || colorFor(list[0]?.groupId);
                return { name, color, total: list.length, done, pct };
            });
    }, [inventory, groups]);

    const [completions, setCompletions] = useState([]);
    useEffect(() => {
        let live = true;
        API.get('/stats/activity')
            .then(({ data }) => live && setCompletions(data.activity || []))
            .catch(() => {});
        return () => { live = false; };
    }, [allTasks]);

    const activity = useMemo(() => [
        ...completions,
        ...allTasks.filter((t) => t.status === 'On-Going')
            .map((t) => ({ id: t._id, verb: 'Started', title: t.title, at: t.updatedAt, taskType: 'task' })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 4), [completions, allTasks]);

    const roadmap = roadmaps?.[0];
    const roadmapPct = roadmapProgress(roadmap?.nodes);

    const unread = notifications.filter((n) => !n.isRead).length;
    const dailyGoal = dailyGoalOf(profile);
    const weekly = useMemo(() => {
        const merged = Object.fromEntries(weeklySynced.map((d) => [d._id, { ...d }]));
        Object.entries(pendingByDay).forEach(([day, p]) => {
            merged[day] = { _id: day, ...merged[day], totalMinutes: (merged[day]?.totalMinutes || 0) + p.minutes };
        });
        return Object.values(merged);
    }, [weeklySynced, pendingByDay]);
    const pendingToday = pendingByDay[activeDate] || { minutes: 0, count: 0 };
    const totalProductivityMinutes = (stats.totalProductivityMinutes || 0) + pendingToday.minutes;
    const sessionsCount = (stats.sessionsCount || 0) + pendingToday.count;
    const waiting = myQueue.filter((q) => !q.failed).length;
    const rejected = myQueue.filter((q) => q.failed);
    const goalPct = Math.round(((totalProductivityMinutes || 0) / dailyGoal) * 100);
    const taskPct = allTasks.length ? (doneCount / allTasks.length) * 100 : 0;

    const refreshDay = () => {
        dispatch(fetchTodayStats(activeDate));
        dispatch(fetchPlannerByDate(activeDate));
        dispatch(fetchWeeklyStats());
    };

    const handleSearch = (e) => {
        e.preventDefault();
        const q = search.trim();
        navigate(q ? `/tasks?q=${encodeURIComponent(q)}` : '/tasks');
    };

    const handleCreateTask = async (taskData) => {
        try {
            await dispatch(createNewTask({
                title: taskData.taskTitle,
                groupId: taskData.selectedGroupId,
                category: taskData.category,
                subtasks: taskData.subtasks.map((title) => ({ title })),
            })).unwrap();
            dispatch(fetchInventoryTasks());
            setCreateOpen(false);
            toast.success('Task created');
        } catch {
            toast.error('Could not create that task');
        }
    };

    const handleAddMinutes = ({ minutes, startTime, endTime }) => {
        dispatch(logSession({ startTime, endTime, durationMinutes: minutes }));
        toast.success(`Logged ${minutes} min`);
        setAddMinutesOpen(false);
    };

    const handleSuggest = (task) => {
        const now = new Date();
        const from = activeDate === today ? now.getHours() * 60 + now.getMinutes() : 0;
        const time = nextFreeSlot(segments, dayData?.tasks || [], 30, from) || nextHourTime();
        dispatch(assignTaskToDate({ date: activeDate, taskId: task._id, subtaskId: null, time, comments: '' }))
            .unwrap()
            .catch((err) => toast.error(err?.message || "Couldn't add that to the plan."));
    };

    const handleNotificationClick = async (n) => {
        if (!n.isRead) {
            setNotifications((list) => list.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)));
            API.put(`/notifications/${n._id}/read`).catch(() => {});
        }
        if (n.projectId) navigate(`/projects/${n.projectId}`);
    };

    const dayLabel = isToday ? 'Today' : activeDate === shiftDateKey(today, 1) ? 'Tomorrow'
        : activeDate === shiftDateKey(today, -1) ? 'Yesterday'
            : fromDateKey(activeDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    return (
        <div className="page">
            <div className="page-inner">
                <PageHeader
                    overline={formatLongDate()}
                    title={`${greeting()}, ${profile?.username || 'there'}`}
                    actions={(
                        <>
                            <form className="search-field" role="search" onSubmit={handleSearch}>
                                <Search size={16} aria-hidden="true" />
                                <label htmlFor="dash-search" className="sr-only">Search tasks</label>
                                <input
                                    id="dash-search"
                                    ref={searchRef}
                                    type="search"
                                    placeholder="Search tasks, projects…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                <span className="kbd" aria-hidden="true">{IS_MAC ? '⌘K' : 'Ctrl K'}</span>
                            </form>
                            <div className="notif-wrap">
                                <button
                                    type="button"
                                    className="icon-btn"
                                    aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
                                    aria-expanded={notifOpen}
                                    onClick={() => setNotifOpen((v) => !v)}
                                >
                                    <Bell size={18} />
                                    {unread > 0 && <span className="badge-dot" />}
                                </button>
                                {notifOpen && (
                                    <div className="notif-pop" role="region" aria-label="Notifications">
                                        {notifications.length === 0 ? (
                                            <p className="notif-empty">You're all caught up.</p>
                                        ) : (
                                            <ul className="notif-list">
                                                {notifications.slice(0, 6).map((n) => (
                                                    <li key={n._id}>
                                                        <button
                                                            type="button"
                                                            className={`notif-item ${n.isRead ? '' : 'is-unread'}`}
                                                            onClick={() => handleNotificationClick(n)}
                                                        >
                                                            <span>{n.message}</span>
                                                            <span className="notif-when">{formatRelative(n.createdAt)}</span>
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button type="button" className="btn" onClick={() => setAddMinutesOpen(true)}>
                                <Clock size={16} aria-hidden="true" />
                                Log time
                            </button>
                            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                                <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
                                New task
                            </button>
                        </>
                    )}
                />

                <section className="stat-grid" aria-label={`${dayLabel} at a glance`}>
                    <div className="stat-tile row">
                        <GoalRing percent={goalPct} />
                        <div className="dash-stat-text">
                            <span className="stat-label">Daily goal</span>
                            <span className="stat-value md">{formatDuration(totalProductivityMinutes)}</span>
                            <span className="stat-caption">of {formatGoal(dailyGoal)} focus target</span>
                        </div>
                    </div>
                    <div className="stat-tile">
                        <div className="stat-tile-head">
                            <span className="stat-label">Focus sessions</span>
                            <Timer size={18} aria-hidden="true" />
                        </div>
                        <span className="stat-value">{sessionsCount || 0}</span>
                        <span className="stat-caption">
                            {sessionsCount ? `Completed ${isToday ? 'today' : 'that day'}` : `None yet ${isToday ? 'today' : 'that day'}`}
                        </span>
                        {waiting > 0 && (
                            <span className="dash-sync" role="status">
                                <span className="dash-sync-dot" aria-hidden="true" />
                                {syncing ? 'Syncing…' : `${waiting} waiting to sync`}
                            </span>
                        )}
                        {rejected.length > 0 && (
                            <span className="dash-sync is-error" role="alert" title={rejected[0].failed}>
                                {rejected.length} couldn&apos;t sync
                                <button type="button" className="dash-sync-btn" onClick={() => { dispatch(retryFailed()); dispatch(syncSessions()); }}>Retry</button>
                                <button type="button" className="dash-sync-btn" onClick={() => dispatch(discardFailed())}>Discard</button>
                            </span>
                        )}
                    </div>
                    <div className="stat-tile">
                        <div className="stat-tile-head">
                            <span className="stat-label">Tasks completed</span>
                            <SquareCheck size={18} aria-hidden="true" />
                        </div>
                        <span className="stat-value">
                            {doneCount} <small>/ {allTasks.length}</small>
                        </span>
                        <div className="progress" role="img" aria-label={`${Math.round(taskPct)} percent of tasks completed`}>
                            <span style={{ width: `${taskPct}%` }} />
                        </div>
                    </div>
                    <div className="stat-tile">
                        <div className="stat-tile-head">
                            <span className="stat-label">Planned {isToday ? 'today' : dayLabel.toLowerCase()}</span>
                            <CalendarDays size={18} aria-hidden="true" />
                        </div>
                        <span className="stat-value">{entries.length}</span>
                        <span className="stat-caption">
                            {entries.length ? `${entries.length === 1 ? 'block' : 'blocks'} · ${doneBlocks} done` : 'No blocks scheduled'}
                        </span>
                    </div>
                </section>

                <div className="dash-grid">
                    <div className="dash-col-main">
                        <section className="card" aria-labelledby="plan-h">
                            <div className="card-head">
                                <h2 id="plan-h" className="card-title">{isToday ? "Today's plan" : `Plan for ${dayLabel}`}</h2>
                                <div className="day-stepper">
                                    <button type="button" aria-label="Previous day" onClick={() => dispatch(setActiveDate(shiftDateKey(activeDate, -1)))}>
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        className="day-stepper-label"
                                        onClick={() => dispatch(setActiveDate(today))}
                                        disabled={isToday}
                                        aria-label={isToday ? 'Showing today' : 'Jump to today'}
                                    >
                                        {dayLabel}
                                    </button>
                                    <button type="button" aria-label="Next day" onClick={() => dispatch(setActiveDate(shiftDateKey(activeDate, 1)))}>
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>

                            {plannerLoading && entries.length === 0 ? (
                                <div className="plan-skeleton" aria-busy="true" aria-label="Loading plan">
                                    {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 72 }} />)}
                                </div>
                            ) : entries.length > 0 ? (
                                <>
                                    <ol className="plan-list">
                                        {entries.map((entry) => (
                                            <PlanBlock
                                                key={entry._id}
                                                entry={entry}
                                                upNext={entry._id === upNextId}
                                                onOpen={(e) => setSelectedEntry({ ...e, date: activeDate })}
                                                onStart={() => setFocusOpen(true)}
                                            />
                                        ))}
                                    </ol>
                                    <button type="button" className="dashed-add plan-add" onClick={() => setAddBlockOpen(true)}>
                                        <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
                                        Add a block from your tasks
                                    </button>
                                </>
                            ) : (
                                <div className="plan-empty">
                                    <EmptyState
                                        icon={<Sprout size={22} />}
                                        title={`Nothing planned for ${isToday ? 'today' : 'this day'} yet`}
                                        help="Pick a few tasks below to build your day, or start a free session."
                                    />
                                    {suggestions.length > 0 ? (
                                        <div className="plan-suggest">
                                            <span className="overline">Suggested from your tasks</span>
                                            {suggestions.map((t) => (
                                                <div key={t._id} className="plan-suggest-row">
                                                    <span className="plan-suggest-bar" style={{ background: t.groupId ? colorFor(t.groupId) : UNCATEGORIZED_COLOR }} />
                                                    <div className="plan-suggest-text">
                                                        <span className="plan-suggest-title">{t.title}</span>
                                                        <span className="plan-suggest-meta">{t.groupId?.name || 'Uncategorized'} · {t.category || 'General'}</span>
                                                    </div>
                                                    <button type="button" className="btn btn-sm plan-suggest-btn" onClick={() => handleSuggest(t)}>
                                                        Add to {isToday ? 'today' : 'plan'}
                                                    </button>
                                                </div>
                                            ))}
                                            <button type="button" className="dashed-add plan-add" onClick={() => setAddBlockOpen(true)}>
                                                <Plus size={16} aria-hidden="true" />
                                                Browse all tasks
                                            </button>
                                        </div>
                                    ) : (
                                        <button type="button" className="btn" onClick={() => setCreateOpen(true)}>
                                            <Plus size={16} aria-hidden="true" /> Create your first task
                                        </button>
                                    )}
                                </div>
                            )}
                        </section>

                        <section className="card" aria-labelledby="sched-h">
                            <div className="card-head tight">
                                <h2 id="sched-h" className="card-title">{isToday ? "Today's schedule" : `Schedule for ${dayLabel}`}</h2>
                                <Link to="/settings#schedule" className="card-link">Edit template</Link>
                            </div>
                            <DaySchedule
                                key={activeDate}
                                date={activeDate}
                                entries={dayData?.tasks || []}
                                onChanged={() => dispatch(fetchPlannerByDate(activeDate))}
                                onAddInPeriod={(period) => {
                                    setAddBlockFrom(period.start);
                                    setAddBlockOpen(true);
                                }}
                            />
                        </section>

                        <section className="card" aria-labelledby="groups-h">
                            <div className="card-head tight">
                                <h2 id="groups-h" className="card-title">Task groups</h2>
                                <Link to="/tasks" className="card-link">All tasks</Link>
                            </div>
                            {taskGroups.length === 0 ? (
                                <EmptyState
                                    icon={<Folder size={22} />}
                                    title="No tasks yet"
                                    help="Group related tasks so you can track progress at a glance."
                                    action={<button type="button" className="btn btn-sm" onClick={() => setCreateOpen(true)}>New task</button>}
                                />
                            ) : (
                                <div className="group-grid">
                                    {taskGroups.map((g) => (
                                        <Link key={g.name} to={`/tasks?group=${encodeURIComponent(g.name)}`} className="group-tile">
                                            <div className="group-tile-head">
                                                <span className="group-tile-icon" style={{ background: g.color }} aria-hidden="true">
                                                    <Folder size={16} />
                                                </span>
                                                <span className="group-tile-name">{g.name}</span>
                                            </div>
                                            <div className="group-tile-meta">
                                                <span>{g.done} of {g.total} done</span>
                                                <span>{g.pct}%</span>
                                            </div>
                                            <div className="progress">
                                                <span style={{ width: `${g.pct}%`, background: g.color }} />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    <div className="dash-col-side">
                        <FocusCard
                            taskTitle={focusTask?.title || nowEntry?.taskId?.title}
                            onStart={() => setFocusOpen(true)}
                            onChooseTask={() => setChooseTaskOpen(true)}
                        />

                        <WeekChart stats={weekly} />

                        <section className="card dash-roadmap" aria-labelledby="road-h">
                            <div className="dash-roadmap-head">
                                <h2 id="road-h" className="card-title sm">Roadmap</h2>
                                {roadmap && <Link to={`/roadmaps/${roadmap._id}`} className="card-link">Open</Link>}
                            </div>
                            {roadmap ? (
                                <>
                                    <div className="dash-roadmap-row">
                                        <span className="dash-roadmap-icon" aria-hidden="true"><Route size={18} /></span>
                                        <div className="dash-roadmap-text">
                                            <span className="dash-roadmap-name">{roadmap.skillName}</span>
                                            <span className="stat-caption">
                                                {roadmap.nodes?.length || 0} nodes · {roadmap.edges?.length || 0} connections · {roadmapPct}% complete
                                            </span>
                                        </div>
                                    </div>
                                    <div className="progress" role="img" aria-label={`Roadmap ${roadmapPct} percent complete`}><span style={{ width: `${roadmapPct}%` }} /></div>
                                </>
                            ) : (
                                <EmptyState
                                    icon={<Route size={20} />}
                                    title="No roadmaps yet"
                                    help="Map out a skill as connected tasks."
                                    action={<Link to="/roadmaps" className="btn btn-sm">Create</Link>}
                                />
                            )}
                        </section>

                        <section className="card" aria-labelledby="act-h">
                            <h2 id="act-h" className="card-title sm dash-activity-title">Recent activity</h2>
                            {activity.length === 0 ? (
                                <p className="muted dash-activity-empty">Start or finish a task and it will show up here.</p>
                            ) : (
                                <ul className="dash-activity">
                                    {activity.map((a) => {
                                        const done = a.verb === 'Completed';
                                        return (
                                            <li key={`${a.verb}-${a.id}`}>
                                                <span className={`dash-activity-icon ${done ? 'is-done' : 'is-started'}`} aria-hidden="true">
                                                    <Check size={14} strokeWidth={2.6} />
                                                </span>
                                                <div className="dash-activity-text">
                                                    <span>
                                                        <span className="muted">{a.verb}</span>{' '}
                                                        {a.taskType === 'task'
                                                            ? <Link to={`/tasks/${a.id}`} className="dash-activity-link">{a.title}</Link>
                                                            : <span className="dash-activity-link">{a.title}</span>}
                                                    </span>
                                                    <span className="stat-caption">{formatRelative(a.at)}</span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    </div>
                </div>
            </div>

            <AddBlockModal isOpen={isAddBlockOpen} onClose={() => { setAddBlockOpen(false); setAddBlockFrom(null); }} date={activeDate} tasks={allTasks} fromMinute={addBlockFrom ?? undefined} />
            <AddBlockModal
                isOpen={isChooseTaskOpen}
                onClose={() => setChooseTaskOpen(false)}
                tasks={allTasks}
                onPick={(task) => {
                    setFocusTask(task);
                    setChooseTaskOpen(false);
                }}
            />

            <CreateTaskModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreateTask} />

            <FocusSessionFlow isOpen={isFocusOpen} task={focusTask || nowTask} onClose={() => setFocusOpen(false)} onSaved={refreshDay} />

            <PlanEntryModal
                isOpen={!!selectedEntry}
                onClose={() => {
                    setSelectedEntry(null);
                    dispatch(fetchPlannerByDate(activeDate));
                }}
                item={selectedEntry}
                activeDate={activeDate}
            />

            <AddMinutesModal
                isOpen={isAddMinutesOpen}
                onClose={() => setAddMinutesOpen(false)}
                onAdd={handleAddMinutes}
                activeDate={activeDate}
            />
        </div>
    );
};

export default Dashboard;
