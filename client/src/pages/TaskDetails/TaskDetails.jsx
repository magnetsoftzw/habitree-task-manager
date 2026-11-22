import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { CalendarPlus, ChevronRight, Pencil, Play, Trash2 } from 'lucide-react';
import { clearCurrentTask, deleteTask, fetchTaskById, updateTaskAction } from '../../store/slices/taskSlice';
import { fetchGroups } from '../../store/slices/groupSlice';
import Menu from '../../components/ui/Menu';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import StatusPill from '../../components/ui/StatusPill';
import AddToPlanModal from '../../components/modals/Project/AddToPlanModal';
import FocusSessionFlow from '../../components/session/FocusSessionFlow';
import { colorFor, UNCATEGORIZED_COLOR } from '../../utils/Colors';
import { taskProgress } from '../../utils/Status';
import SubtaskList from './SubtaskList';
import SubtaskImport from './SubtaskImport';
import './TaskDetails.css';

const STATUSES = [
    { value: 'Not Started', label: 'Not started' },
    { value: 'On-Going', label: 'In progress' },
    { value: 'On-Hold', label: 'On hold' },
    { value: 'Completed', label: 'Done' },
    { value: 'Shelved', label: 'Shelved' },
];
const CATEGORIES = ['General', 'Watch', 'Read', 'Practice', 'Note', 'Project'];
const RING = 2 * Math.PI * 52;

const formatDate = (value) => (value
    ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—');

const TitleEditor = ({ title, onSave, onCancel }) => {
    const [value, setValue] = useState(title);
    const commit = () => {
        const next = value.trim();
        if (next && next !== title) onSave(next);
        else onCancel();
    };
    return (
        <input
            className="td-title-input"
            aria-label="Task title"
            value={value}
            autoFocus
            maxLength={200}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') onCancel();
            }}
        />
    );
};

const DescriptionEditor = ({ initial, onSave }) => {
    const [value, setValue] = useState(initial);
    return (
        <textarea
            className="input td-desc"
            aria-label="Description"
            placeholder="Add notes, links or what “done” looks like…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => value !== initial && onSave(value)}
        />
    );
};

const TaskDetails = () => {
    const { id } = useParams();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const task = useSelector((s) => s.tasks.currentTask);
    const groups = useSelector((s) => s.groups.list);
    const [missing, setMissing] = useState(null);
    const [renaming, setRenaming] = useState(false);
    const [planTarget, setPlanTarget] = useState(null);
    const [sessionOpen, setSessionOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        dispatch(fetchTaskById(id)).unwrap().catch(() => setMissing(id));
        dispatch(fetchGroups());
        return () => dispatch(clearCurrentTask());
    }, [dispatch, id]);

    const loaded = task && task._id === id;
    const subtasks = useMemo(() => (loaded ? task.subtasks || [] : []), [loaded, task]);
    const progress = loaded ? taskProgress(task) : 0;
    const doneCount = subtasks.filter((s) => s.isCompleted).length;

    const update = async (updates, success) => {
        try {
            await dispatch(updateTaskAction({ id, updates })).unwrap();
            if (success) toast.success(success);
        } catch (err) {
            toast.error(err?.message || "Couldn't save that change.");
            dispatch(fetchTaskById(id));
        }
    };

    const removeSubtask = (index) => {
        const previous = subtasks;
        const removed = previous[index];
        update({ subtasks: previous.filter((_, i) => i !== index) });
        toast((t) => (
            <span className="td-toast">
                Deleted “{removed.title}”
                <button type="button" onClick={() => { toast.dismiss(t.id); update({ subtasks: previous }); }}>Undo</button>
            </span>
        ), { duration: 5000 });
    };

    const remove = async () => {
        setDeleting(true);
        try {
            await dispatch(deleteTask(id)).unwrap();
            toast.success('Task deleted');
            navigate('/tasks');
        } catch {
            toast.error("Couldn't delete this task.");
            setDeleting(false);
        }
    };

    if (missing === id) {
        return (
            <div className="page">
                <div className="page-inner">
                    <EmptyState
                        title="Task not found"
                        help="It may have been deleted, or the link is wrong."
                        action={<Link to="/tasks" className="btn btn-primary">Back to Tasks</Link>}
                    />
                </div>
            </div>
        );
    }

    if (!loaded) {
        return (
            <div className="page" aria-busy="true">
                <div className="page-inner">
                    <div className="skeleton td-skel-head" />
                    <div className="td-layout">
                        <div className="skeleton td-skel-main" />
                        <div className="skeleton td-skel-side" />
                    </div>
                </div>
            </div>
        );
    }

    const group = task.groupId && typeof task.groupId === 'object' ? task.groupId : null;
    const groupColor = group ? colorFor(group) : UNCATEGORIZED_COLOR;

    return (
        <div className="page">
            <div className="page-inner">
                <nav aria-label="Breadcrumb" className="td-crumbs">
                    <Link to="/tasks">Tasks</Link>
                    <ChevronRight size={14} aria-hidden="true" />
                    <span>{group?.name || 'Uncategorized'}</span>
                </nav>

                <header className="td-header">
                    <span className="td-badge" style={{ background: groupColor }} aria-hidden="true">
                        {(task.title || '?').charAt(0).toUpperCase()}
                    </span>
                    <div className="td-heading">
                        {renaming ? (
                            <TitleEditor
                                title={task.title}
                                onCancel={() => setRenaming(false)}
                                onSave={(title) => {
                                    setRenaming(false);
                                    update({ title });
                                }}
                            />
                        ) : (
                            <h1>{task.title}</h1>
                        )}
                        <div className="td-meta">
                            <StatusPill status={task.status} />
                            <span>{task.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{subtasks.length ? `${doneCount} of ${subtasks.length} subtasks done` : 'No subtasks'}</span>
                        </div>
                    </div>
                    <div className="td-actions">
                        <button type="button" className="btn" onClick={() => setPlanTarget({ subtask: null })}>
                            <CalendarPlus size={16} aria-hidden="true" /> Add to plan
                        </button>
                        <button type="button" className="btn btn-primary" onClick={() => setSessionOpen(true)} disabled={task.status === 'Completed'}>
                            <Play size={14} fill="currentColor" aria-hidden="true" /> Start a session
                        </button>
                        <Menu
                            label="Task actions"
                            items={[
                                { label: 'Rename', icon: <Pencil size={16} />, onSelect: () => setRenaming(true) },
                                { label: 'Delete task', icon: <Trash2 size={16} />, danger: true, onSelect: () => setConfirmDelete(true) },
                            ]}
                        />
                    </div>
                </header>

                <div className="td-layout">
                    <div className="td-main">
                        <section className="card td-card" aria-labelledby="td-desc-h">
                            <h2 id="td-desc-h" className="card-title sm">Description</h2>
                            <DescriptionEditor key={task._id} initial={task.description || ''} onSave={(description) => update({ description }, 'Description saved')} />
                        </section>

                        <section className="card td-card" aria-labelledby="td-subs-h">
                            <div className="td-card-head">
                                <h2 id="td-subs-h" className="card-title sm">Subtasks</h2>
                                <span className="td-count">{doneCount} / {subtasks.length}</span>
                            </div>
                            <SubtaskList
                                subtasks={subtasks}
                                onChange={(next) => update({ subtasks: next })}
                                onPlan={(subtask) => setPlanTarget({ subtask })}
                                onDelete={removeSubtask}
                            />
                            <SubtaskImport
                                subtasks={subtasks}
                                onImport={(titles) => update(
                                    { subtasks: [...subtasks, ...titles.map((title) => ({ title, isCompleted: false }))] },
                                    `Added ${titles.length} ${titles.length === 1 ? 'subtask' : 'subtasks'}`,
                                )}
                            />
                        </section>
                    </div>

                    <aside className="td-side">
                        <section className="card td-card" aria-labelledby="td-prog-h">
                            <h2 id="td-prog-h" className="card-title sm">Progress</h2>
                            <div className="td-ring">
                                <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`${progress} percent complete`}>
                                    <circle cx="66" cy="66" r="52" fill="none" strokeWidth="12" className="td-ring-track" />
                                    <circle
                                        cx="66" cy="66" r="52" fill="none" strokeWidth="12" strokeLinecap="round" className="td-ring-fill"
                                        strokeDasharray={RING} strokeDashoffset={RING * (1 - progress / 100)} transform="rotate(-90 66 66)"
                                    />
                                    <text x="66" y="72" textAnchor="middle" className="td-ring-pct">{progress}%</text>
                                </svg>
                            </div>
                            <p className="td-ring-note">
                                {subtasks.length ? 'Based on completed subtasks.' : 'Add subtasks to track progress step by step.'}
                            </p>
                        </section>

                        <section className="card td-card" aria-labelledby="td-det-h">
                            <h2 id="td-det-h" className="card-title sm">Details</h2>
                            <label className="field">
                                <span className="field-label">Status</span>
                                <select className="input" value={task.status} onChange={(e) => update({ status: e.target.value })}>
                                    {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </label>
                            <label className="field">
                                <span className="field-label">Group</span>
                                <select className="input" value={group?._id || ''} onChange={(e) => update({ groupId: e.target.value || null }, 'Group updated')}>
                                    <option value="">Uncategorized</option>
                                    {groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
                                </select>
                            </label>
                            <label className="field">
                                <span className="field-label">Category</span>
                                <select className="input" value={task.category} onChange={(e) => update({ category: e.target.value })}>
                                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </label>
                            <dl className="td-facts">
                                <div><dt>Created</dt><dd>{formatDate(task.createdAt)}</dd></div>
                                <div><dt>Last updated</dt><dd>{formatDate(task.updatedAt)}</dd></div>
                            </dl>
                        </section>
                    </aside>
                </div>
            </div>

            <AddToPlanModal
                isOpen={Boolean(planTarget)}
                onClose={() => setPlanTarget(null)}
                task={task}
                subtask={planTarget?.subtask}
                taskType="task"
            />
            <FocusSessionFlow isOpen={sessionOpen} task={task} onClose={() => setSessionOpen(false)} onSaved={() => dispatch(fetchTaskById(id))} />
            <Modal
                isOpen={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                title="Delete this task?"
                subtitle={`“${task.title}” and its ${subtasks.length} ${subtasks.length === 1 ? 'subtask' : 'subtasks'} will be removed. This can't be undone.`}
                width={440}
                footer={(
                    <>
                        <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Keep it</button>
                        <button type="button" className="btn btn-danger" onClick={remove} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete task'}</button>
                    </>
                )}
            />
        </div>
    );
};

export default TaskDetails;
