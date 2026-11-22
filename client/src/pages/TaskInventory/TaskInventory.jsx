import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarPlus, Clock, ExternalLink, FolderPlus, Play, Plus, Search, Trash2, X } from 'lucide-react';

import PageHeader from '../../components/ui/PageHeader';
import SegmentedControl from '../../components/ui/SegmentedControl';
import StatusPill from '../../components/ui/StatusPill';
import Menu from '../../components/ui/Menu';
import CreateTaskModal from '../../components/modals/Task/CreateTaskModal';
import NewGroupModal from '../../components/modals/Task/NewGroupModal';
import AddToPlanModal from '../../components/modals/Project/AddToPlanModal';
import FocusSessionFlow from '../../components/session/FocusSessionFlow';

import { createNewTask, deleteTask, fetchInventoryTasks, updateTask, updateTaskStatus } from '../../store/slices/taskSlice';
import { fetchGroups } from '../../store/slices/groupSlice';
import { colorFor, UNCATEGORIZED_COLOR } from '../../utils/Colors';
import { taskProgress } from '../../utils/Status';
import { toDateKey, formatDueDate } from '../../utils/Format';
import './TaskInventory.css';

const FILTERS = [
    { label: 'All', match: () => true },
    { label: 'Not started', match: (t) => t.status === 'Not Started' },
    { label: 'In progress', match: (t) => t.status === 'On-Going' },
    { label: 'On hold', match: (t) => t.status === 'On-Hold' },
    { label: 'Shelved', match: (t) => t.status === 'Shelved' },
    { label: 'Done', match: (t) => t.status === 'Completed' },
];

const modifiedAt = (t) => new Date(t.updatedAt || t.createdAt || 0).getTime();

const SORTERS = {
    recent: (a, b) => modifiedAt(b) - modifiedAt(a),
    due: (a, b) => {
        if (!a.scheduledDate && !b.scheduledDate) return a.title.localeCompare(b.title);
        if (!a.scheduledDate) return 1;
        if (!b.scheduledDate) return -1;
        return new Date(a.scheduledDate) - new Date(b.scheduledDate);
    },
    progress: (a, b) => taskProgress(b) - taskProgress(a),
    name: (a, b) => a.title.localeCompare(b.title),
};

const isOverdue = (task, todayKey) =>
    task.status !== 'Completed' && task.scheduledDate && toDateKey(task.scheduledDate) < todayKey;

const TaskInventory = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();

    const { inventory, loading } = useSelector((state) => state.tasks);
    const groups = useSelector((state) => state.groups.list);

    const [query, setQuery] = useState(params.get('q') || '');
    const [groupBy, setGroupBy] = useState('group');
    const [sort, setSort] = useState('recent');
    const [filter, setFilter] = useState('All');
    const [isCreateOpen, setCreateOpen] = useState(false);
    const [isGroupOpen, setGroupOpen] = useState(false);
    const [scheduleTask, setScheduleTask] = useState(null);
    const [isFocusOpen, setFocusOpen] = useState(false);
    const [rescheduling, setRescheduling] = useState(false);

    const groupFilter = params.get('group');
    const todayKey = toDateKey();

    useEffect(() => {
        dispatch(fetchInventoryTasks());
        dispatch(fetchGroups());
    }, [dispatch]);

    const allTasks = useMemo(() => Object.values(inventory || {}).flat(), [inventory]);
    const overdue = allTasks.filter((t) => isOverdue(t, todayKey));

    const colorByName = useMemo(
        () => Object.fromEntries((groups || []).map((g) => [g.name, colorFor(g)])),
        [groups]
    );

    const searched = useMemo(() => {
        const q = query.trim().toLowerCase();
        return allTasks.filter((t) => {
            if (groupFilter && (t.groupId?.name || 'Uncategorized') !== groupFilter) return false;
            if (!q) return true;
            return t.title.toLowerCase().includes(q)
                || (t.category || '').toLowerCase().includes(q)
                || (t.subtasks || []).some((s) => s.title.toLowerCase().includes(q));
        });
    }, [allTasks, query, groupFilter]);

    const activeFilter = FILTERS.find((f) => f.label === filter) || FILTERS[0];

    const sections = useMemo(() => {
        const rows = searched.filter(activeFilter.match);
        const map = new Map();
        rows.forEach((t) => {
            const key = groupBy === 'group' ? (t.groupId?.name || 'Uncategorized') : (t.category || 'General');
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(t);
        });
        return [...map.entries()].map(([name, list]) => ({
            name,
            modified: Math.max(...list.map(modifiedAt)),
            color: groupBy === 'group'
                ? (name === 'Uncategorized' ? UNCATEGORIZED_COLOR : colorByName[name] || colorFor(list[0]?.groupId))
                : 'var(--text-faint)',
            rows: [...list].sort(SORTERS[sort]),
        })).sort((a, b) => b.modified - a.modified);
    }, [searched, activeFilter, groupBy, sort, colorByName]);

    const groupCount = Object.values(inventory || {}).filter((l) => l.length > 0).length;

    const refresh = () => dispatch(fetchInventoryTasks());

    const handleCreateTask = async (taskData) => {
        try {
            await dispatch(createNewTask({
                title: taskData.taskTitle,
                groupId: taskData.selectedGroupId,
                category: taskData.category,
                subtasks: taskData.subtasks.map((title) => ({ title })),
            })).unwrap();
            setCreateOpen(false);
            toast.success('Task created');
            refresh();
        } catch {
            toast.error('Could not create that task');
        }
    };

    const handleToggleDone = async (task) => {
        const status = task.status === 'Completed' ? 'Not Started' : 'Completed';
        try {
            await dispatch(updateTaskStatus({ id: task._id, status })).unwrap();
            refresh();
        } catch (err) {
            toast.error(err?.message || 'Could not update that task');
        }
    };

    const handleDelete = async (task) => {
        if (!window.confirm(`Delete "${task.title}"${task.subtasks?.length ? ` and its ${task.subtasks.length} subtasks` : ''}?`)) return;
        try {
            await dispatch(deleteTask(task._id)).unwrap();
            toast.success('Task deleted');
            refresh();
        } catch {
            toast.error('Could not delete that task');
        }
    };

    const handleRescheduleAll = async () => {
        setRescheduling(true);
        try {
            const today = new Date();
            today.setHours(12, 0, 0, 0);
            await Promise.all(overdue.map((t) => dispatch(updateTask({ id: t._id, updates: { scheduledDate: today.toISOString() } })).unwrap()));
            toast.success(`Moved ${overdue.length} ${overdue.length === 1 ? 'task' : 'tasks'} to today`);
            refresh();
        } catch {
            toast.error('Some tasks could not be rescheduled');
        } finally {
            setRescheduling(false);
        }
    };

    const clearGroupFilter = () => {
        const next = new URLSearchParams(params);
        next.delete('group');
        setParams(next, { replace: true });
    };

    const isEmpty = allTasks.length === 0;

    return (
        <div className="page">
            <div className="page-inner">
                <PageHeader
                    alignEnd
                    title="Tasks"
                    subtitle={isEmpty ? 'Everything you want to learn or get done' : `${allTasks.length} ${allTasks.length === 1 ? 'task' : 'tasks'} across ${groupCount} ${groupCount === 1 ? 'group' : 'groups'}`}
                    actions={(
                        <>
                            <button type="button" className="btn" onClick={() => setGroupOpen(true)}>
                                <FolderPlus size={16} aria-hidden="true" /> New group
                            </button>
                            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                                <Plus size={16} strokeWidth={2.4} aria-hidden="true" /> New task
                            </button>
                        </>
                    )}
                />

                {overdue.length > 0 && (
                    <div className="overdue-banner" role="status">
                        <Clock size={20} aria-hidden="true" />
                        <span className="overdue-banner-text">
                            <strong>
                                {overdue.length === allTasks.length && overdue.length > 1
                                    ? `All ${overdue.length} tasks are past their due date.`
                                    : `${overdue.length} ${overdue.length === 1 ? 'task is' : 'tasks are'} past ${overdue.length === 1 ? 'its' : 'their'} due date.`}
                            </strong>{' '}
                            Push them forward so today's plan stays realistic.
                        </span>
                        <button type="button" className="btn btn-sm overdue-banner-btn" onClick={handleRescheduleAll} disabled={rescheduling}>
                            {rescheduling ? 'Rescheduling…' : 'Reschedule all'}
                        </button>
                    </div>
                )}

                <div className="tasks-toolbar">
                    <label className="search-field tasks-search">
                        <Search size={16} aria-hidden="true" />
                        <span className="sr-only">Search tasks</span>
                        <input type="search" placeholder="Search tasks" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </label>
                    <SegmentedControl
                        label="Group by"
                        value={groupBy}
                        onChange={setGroupBy}
                        options={[{ value: 'group', label: 'By group' }, { value: 'category', label: 'By category' }]}
                    />
                    <label className="tasks-sort">
                        Sort
                        <select value={sort} onChange={(e) => setSort(e.target.value)}>
                            <option value="recent">Last modified</option>
                            <option value="due">Due date</option>
                            <option value="progress">Progress</option>
                            <option value="name">Name</option>
                        </select>
                    </label>
                </div>

                <div className="chip-row" role="group" aria-label="Filter by status">
                    {FILTERS.map((f) => {
                        const on = f.label === filter;
                        return (
                            <button key={f.label} type="button" className={`chip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => setFilter(f.label)}>
                                {f.label} <span className="chip-count">{searched.filter(f.match).length}</span>
                            </button>
                        );
                    })}
                    {groupFilter && (
                        <button type="button" className="chip is-group" onClick={clearGroupFilter} aria-label={`Remove group filter ${groupFilter}`}>
                            Group: {groupFilter} <X size={14} aria-hidden="true" />
                        </button>
                    )}
                </div>

                {loading && isEmpty ? (
                    <div className="card" aria-busy="true">
                        {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 10 }} />)}
                    </div>
                ) : isEmpty ? (
                    <div className="tasks-empty">
                        <span className="tasks-empty-title">No tasks yet</span>
                        <span className="muted">Create a task for anything you want to watch, read, practise or finish.</span>
                        <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                            <Plus size={16} aria-hidden="true" /> New task
                        </button>
                    </div>
                ) : sections.length === 0 ? (
                    <div className="tasks-empty">
                        <span className="tasks-empty-title">{query ? `No tasks match "${query}"` : 'No tasks with this status'}</span>
                        <span className="muted">Try another filter, or start a session to move a task along.</span>
                    </div>
                ) : (
                    sections.map((section) => (
                        <section key={section.name} className="task-group" aria-labelledby={`grp-${section.name}`}>
                            <div className="task-group-head">
                                <span className="task-group-dot" style={{ background: section.color }} />
                                <h2 id={`grp-${section.name}`} className="task-group-title">{section.name}</h2>
                                <span className="task-group-count">{section.rows.length}</span>
                                <span className="task-group-spacer" />
                                <button type="button" className="menu-trigger" aria-label={`Add task to ${section.name}`} onClick={() => setCreateOpen(true)}>
                                    <Plus size={16} strokeWidth={2.2} />
                                </button>
                            </div>
                            <div className="table-scroll">
                                <table className="task-table">
                                    <thead>
                                        <tr>
                                            <th scope="col" className="col-task">Task</th>
                                            <th scope="col">Status</th>
                                            <th scope="col" className="col-progress">Progress</th>
                                            <th scope="col">Due</th>
                                            <th scope="col" className="col-actions"><span className="sr-only">Actions</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {section.rows.map((t) => {
                                            const done = t.status === 'Completed';
                                            const progress = taskProgress(t);
                                            const late = isOverdue(t, todayKey);
                                            return (
                                                <tr key={t._id} className={done ? 'is-done' : ''}>
                                                    <td className="col-task">
                                                        <div className="task-cell">
                                                            <input
                                                                type="checkbox"
                                                                className="check"
                                                                checked={done}
                                                                onChange={() => handleToggleDone(t)}
                                                                aria-label={done ? `Mark ${t.title} not done` : `Mark ${t.title} done`}
                                                            />
                                                            <div className="task-cell-text">
                                                                <Link to={`/tasks/${t._id}`} className="task-cell-title">{t.title}</Link>
                                                                <span className="task-cell-kind">
                                                                    {t.category || 'General'}
                                                                    {groupBy === 'category' && ` · ${t.groupId?.name || 'Uncategorized'}`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td><StatusPill status={t.status} /></td>
                                                    <td className="col-progress">
                                                        <div className="progress-cell">
                                                            <div className="progress" role="img" aria-label={`${progress} percent complete`}>
                                                                <span style={{ width: `${progress}%` }} />
                                                            </div>
                                                            <span className="progress-cell-pct tabular">{progress}%</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {t.scheduledDate ? (
                                                            <div className={`due-cell ${late ? 'is-late' : ''}`}>
                                                                <span className="due-cell-date">{formatDueDate(t.scheduledDate)}</span>
                                                                {late && <span className="due-cell-note">Overdue</span>}
                                                            </div>
                                                        ) : (
                                                            <span className="muted">No date</span>
                                                        )}
                                                    </td>
                                                    <td className="col-actions">
                                                        <div className="row-actions">
                                                            <button
                                                                type="button"
                                                                className="row-play"
                                                                aria-label={`Start session for ${t.title}`}
                                                                onClick={() => setFocusOpen(true)}
                                                                disabled={done}
                                                            >
                                                                <Play size={12} fill="currentColor" />
                                                            </button>
                                                            <Menu
                                                                label={`More actions for ${t.title}`}
                                                                items={[
                                                                    { label: 'Open details', icon: <ExternalLink size={16} />, onSelect: () => navigate(`/tasks/${t._id}`) },
                                                                    { label: 'Add to plan', icon: <CalendarPlus size={16} />, onSelect: () => setScheduleTask(t) },
                                                                    { label: 'Delete', icon: <Trash2 size={16} />, danger: true, onSelect: () => handleDelete(t) },
                                                                ]}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    ))
                )}
            </div>

            <CreateTaskModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreateTask} />
            <NewGroupModal isOpen={isGroupOpen} onClose={() => setGroupOpen(false)} onCreated={refresh} />
            <AddToPlanModal isOpen={!!scheduleTask} onClose={() => setScheduleTask(null)} task={scheduleTask} taskType="task" />
            <FocusSessionFlow isOpen={isFocusOpen} onClose={() => setFocusOpen(false)} />
        </div>
    );
};

export default TaskInventory;
