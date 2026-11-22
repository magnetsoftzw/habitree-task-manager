import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search } from 'lucide-react';
import API from '../../../api/axiosInstance';
import Modal from '../../ui/Modal';
import StatusPill from '../../ui/StatusPill';
import { assignTaskToDate } from '../../../store/slices/plannerSlice';
import { colorFor, UNCATEGORIZED_COLOR } from '../../../utils/Colors';
import { formatLongDate, fromDateKey, nextHourTime, toDateKey } from '../../../utils/Format';
import { conflictFor, nextFreeSlot } from '../../../utils/Schedule';
import useDaySchedule from '../../../hooks/UseDaySchedule';
import TimeHint from '../../schedule/TimeHint';
import '../Project/ProjectModals.css';
import './AddBlockModal.css';

const AddBlockModal = (props) => (props.isOpen ? <AddBlockDialog {...props} /> : null);

const minutesNow = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
};

const AddBlockDialog = ({ onClose, date, tasks = [], onPick, pickTitle, pickSubtitle, pickAction, initialTime, fromMinute }) => {
    const dispatch = useDispatch();
    const { scheduling, dayData, activeDate } = useSelector((state) => state.planner);
    const segments = useDaySchedule(onPick ? null : date);
    const projects = useSelector((state) => state.projects.items);
    const [listTasks, setListTasks] = useState([]);
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [chosenTime, setTime] = useState(initialTime || '');
    const planned = activeDate === date ? dayData?.tasks || [] : [];
    const [startFrom] = useState(() => fromMinute ?? (date === toDateKey() ? minutesNow() : 0));
    const time = chosenTime || nextFreeSlot(segments, planned, 30, startFrom) || nextHourTime();
    const [error, setError] = useState('');

    useEffect(() => {
        if (!projects?.length) return undefined;
        let live = true;
        Promise.all(projects.map((p) => API.get(`/projects/${p._id}/tasks`)
            .then(({ data }) => (data.tasks || [])
                .filter((t) => t.status !== 'done' && t.status !== 'shelved')
                .map((t) => ({ ...t, taskType: 'projectTask', projectId: p._id, project: p })))
            .catch(() => [])))
            .then((lists) => live && setListTasks(lists.flat()));
        return () => { live = false; };
    }, [projects]);

    const q = query.trim().toLowerCase();
    const matches = (t, groupName) => !q || t.title.toLowerCase().includes(q) || groupName?.toLowerCase().includes(q);

    const filtered = tasks.filter((t) => t.status !== 'Completed' && matches(t, t.groupId?.name));
    const projectGroups = (projects || [])
        .map((project) => ({ project, items: listTasks.filter((t) => t.projectId === project._id && matches(t, project.name)) }))
        .filter((g) => g.items.length);

    const handleAdd = async () => {
        if (!selectedId) return;
        if (!onPick && conflictFor(segments, time, 30)) return;
        const picked = tasks.find((t) => t._id === selectedId) || listTasks.find((t) => t._id === selectedId);
        if (onPick) {
            onPick(picked);
            return;
        }
        setError('');
        try {
            await dispatch(assignTaskToDate({
                date,
                taskId: selectedId,
                subtaskId: null,
                time,
                comments: '',
                ...(picked?.taskType === 'projectTask' && { taskType: 'projectTask', projectId: picked.projectId }),
            })).unwrap();
            onClose();
        } catch (err) {
            setError(err?.message || 'Could not add this block. Try again.');
        }
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={onPick ? (pickTitle || 'Choose a task') : 'Add a block'}
            subtitle={onPick ? (pickSubtitle || 'Pick the task this focus session is for.') : `Schedule one of your tasks on ${formatLongDate(fromDateKey(date))}.`}
            footer={(
                <>
                    <button type="button" className="btn" onClick={onClose}>Cancel</button>
                    <button type="button" className="btn btn-primary" disabled={!selectedId || scheduling} onClick={handleAdd}>
                        {onPick ? (pickAction || 'Use this task') : scheduling ? 'Adding…' : 'Add to plan'}
                    </button>
                </>
            )}
        >
            <label className="search-field add-block-search">
                <Search size={16} aria-hidden="true" />
                <span className="sr-only">Search tasks</span>
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks…" />
            </label>

            <div className="add-block-list" role="radiogroup" aria-label="Task to schedule">
                {filtered.length === 0 && projectGroups.length === 0 ? (
                    <p className="muted add-block-empty">
                        {tasks.length === 0 && listTasks.length === 0 ? 'You have no tasks yet. Create one from the Tasks page first.' : 'No open tasks match that search.'}
                    </p>
                ) : (
                    <>
                        {filtered.length > 0 && projectGroups.length > 0 && <p className="add-block-section">Tasks</p>}
                        {filtered.map((t) => (
                            <Option
                                key={t._id}
                                task={t}
                                color={t.groupId ? colorFor(t.groupId) : UNCATEGORIZED_COLOR}
                                meta={`${t.groupId?.name || 'Uncategorized'} · ${t.category || 'General'}`}
                                status={t.status}
                                selected={t._id === selectedId}
                                onSelect={setSelectedId}
                            />
                        ))}
                        {projectGroups.length > 0 && <p className="add-block-section">Project tasks</p>}
                        {projectGroups.map(({ project, items }) => items.map((t) => (
                            <Option
                                key={t._id}
                                task={t}
                                color={colorFor(project)}
                                meta={project.name}
                                status={t.status === 'in_progress' ? 'On-Going' : 'Not Started'}
                                selected={t._id === selectedId}
                                onSelect={setSelectedId}
                            />
                        )))}
                    </>
                )}
            </div>

            {!onPick && (
                <label className="field add-block-time">
                    <span className="field-label">Start time</span>
                    <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
                    <TimeHint segments={segments} time={time} duration={30} />
                </label>
            )}

            {error && <p className="add-block-error" role="alert">{error}</p>}
        </Modal>
    );
};

const Option = ({ task, color, meta, status, selected, onSelect }) => (
    <button
        type="button"
        role="radio"
        aria-checked={selected}
        className={`add-block-option ${selected ? 'is-selected' : ''}`}
        onClick={() => onSelect(task._id)}
    >
        <span className="add-block-bar" style={{ background: color }} />
        <span className="add-block-text">
            <span className="add-block-title">{task.title}</span>
            <span className="add-block-meta">{meta}</span>
        </span>
        <StatusPill status={status} />
    </button>
);

export default AddBlockModal;
