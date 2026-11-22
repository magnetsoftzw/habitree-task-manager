import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Archive, Check, ExternalLink, Trash2 } from 'lucide-react';
import API from '../../../api/axiosInstance';
import Modal from '../../ui/Modal';
import StatusPill from '../../ui/StatusPill';
import { removeTaskFromPlanner, updatePlannerEntry } from '../../../store/slices/plannerSlice';
import { updateTaskStatus } from '../../../store/slices/taskSlice';
import { updateProjectTask, updateSubtask } from '../../../store/slices/projectTasksSlice';
import { resolveEntry } from '../../../utils/Planner';
import { addMinutesToTime, formatLongDate, fromDateKey } from '../../../utils/Format';
import useDaySchedule from '../../../hooks/UseDaySchedule';
import TimeHint from '../../schedule/TimeHint';
import '../Project/ProjectModals.css';
import './PlanEntryModal.css';

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const durationLabel = (d) => (d < 60 ? `${d} min` : `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60} min` : ''}`);

const PlanEntryModal = (props) => (props.isOpen && props.item ? <PlanEntryDialog {...props} /> : null);

const PlanEntryDialog = ({ onClose, item, activeDate }) => {
    const dispatch = useDispatch();
    const segments = useDaySchedule(activeDate);
    const navigate = useNavigate();
    const entry = resolveEntry(item);
    const task = item.taskId;
    const isList = item.taskType === 'projectTask';
    const subtask = entry?.subtask;
    const projectId = item.projectId?._id || item.projectId || task?.projectId?._id || task?.groupId?._id;
    const [time, setTime] = useState(item.time || '');
    const [duration, setDuration] = useState(item.duration || 30);
    const [busy, setBusy] = useState(null);
    const done = entry?.state === 'done';
    const dirty = time !== (item.time || '') || duration !== (item.duration || 30);
    const durations = DURATIONS.includes(duration) ? DURATIONS : [...DURATIONS, duration].sort((a, b) => a - b);

    const run = async (key, action, message) => {
        setBusy(key);
        try {
            await action();
            if (message) toast.success(message);
            onClose();
        } catch (err) {
            toast.error(err?.message || "Couldn't do that. Try again.");
            setBusy(null);
        }
    };

    const markDone = () => run('done', async () => {
        if (isList && subtask) {
            await dispatch(updateSubtask({ projectId, taskId: task._id, subtaskId: subtask._id, changes: { done: true } })).unwrap();
        } else if (isList) {
            await dispatch(updateProjectTask({ projectId, taskId: task._id, changes: { status: 'done' } })).unwrap();
        } else if (subtask) {
            const subtasks = task.subtasks.map((s) => (s._id === subtask._id ? { ...s, isCompleted: true, status: 'Completed' } : s));
            await API.put(`/tasks/${task._id}`, { subtasks });
        } else {
            await dispatch(updateTaskStatus({ id: task._id, status: 'Completed' })).unwrap();
        }
    }, 'Marked done');

    const shelve = () => run('shelve', async () => {
        await dispatch(updateTaskStatus({ id: task._id, status: 'Shelved' })).unwrap();
        await dispatch(removeTaskFromPlanner({ date: activeDate, entryId: item._id })).unwrap();
    }, 'Task shelved and removed from the plan');

    const remove = () => run('remove', () => dispatch(removeTaskFromPlanner({ date: activeDate, entryId: item._id })).unwrap(), 'Removed from the plan');

    const saveTiming = () => run('save', () => dispatch(updatePlannerEntry({
        date: activeDate, entryId: item._id, time: time || undefined, duration,
    })).unwrap(), 'Plan updated');

    const openTask = () => {
        onClose();
        navigate(isList ? `/projects/${projectId}?view=list` : `/tasks/${task._id}`);
    };

    if (!entry) {
        return (
            <Modal isOpen onClose={onClose} title="Task unavailable" subtitle="This task was deleted or you no longer have access to it." width={440}
                footer={(
                    <>
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
                        <button type="button" className="btn btn-danger" onClick={remove} disabled={!!busy}>Remove from plan</button>
                    </>
                )}
            />
        );
    }

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={entry.title}
            subtitle={subtask ? `Subtask of ${task.title}` : undefined}
            width={500}
            footer={(
                <>
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
                    <button type="button" className="btn btn-primary" onClick={saveTiming} disabled={!dirty || !!busy}>
                        {busy === 'save' ? 'Saving…' : 'Save changes'}
                    </button>
                </>
            )}
        >
            <div className="pe-body">
                <div className="pe-meta">
                    <span className="pe-group"><span className="pe-dot" style={{ background: entry.color }} />{entry.group}</span>
                    <span aria-hidden="true">·</span>
                    <span>{entry.kind}</span>
                    <StatusPill status={done ? 'Completed' : subtask ? (entry.state === 'now' ? 'On-Going' : 'Not Started') : task.status} />
                </div>

                <p className="pe-when">
                    {formatLongDate(fromDateKey(activeDate))}
                    {item.time ? ` · ${item.time}–${addMinutesToTime(item.time, item.duration || 30)}` : ' · Any time'}
                </p>

                <div className="pm-row">
                    <label className="field">
                        <span className="field-label">Start time <span className="muted">(optional)</span></span>
                        <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
                    </label>
                    <label className="field">
                        <span className="field-label">Duration</span>
                        <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                            {durations.map((d) => <option key={d} value={d}>{durationLabel(d)}</option>)}
                        </select>
                    </label>
                </div>

                {time && <TimeHint segments={segments} time={time} duration={duration} />}

                {item.comments && <p className="pe-notes">{item.comments}</p>}

                <div className="pe-actions">
                    <button type="button" className="btn" onClick={markDone} disabled={done || !!busy}>
                        <Check size={16} aria-hidden="true" /> {done ? 'Done' : busy === 'done' ? 'Saving…' : 'Mark done'}
                    </button>
                    <button type="button" className="btn" onClick={openTask}>
                        <ExternalLink size={16} aria-hidden="true" /> {isList ? 'Open task list' : 'Open task'}
                    </button>
                    {!isList && !subtask && !done && (
                        <button type="button" className="btn" onClick={shelve} disabled={!!busy}>
                            <Archive size={16} aria-hidden="true" /> Shelve
                        </button>
                    )}
                    <button type="button" className="btn btn-danger" onClick={remove} disabled={!!busy}>
                        <Trash2 size={16} aria-hidden="true" /> Remove from plan
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default PlanEntryModal;
