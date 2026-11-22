import { useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import Modal from '../../ui/Modal';
import { updateProjectTask } from '../../../store/slices/projectTasksSlice';
import './ProjectModals.css';

const STATUSES = [
    { value: 'not_started', label: 'Not started' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'done', label: 'Done' },
];

const toInputDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

const ProjectTaskModal = (props) => (props.isOpen ? <ProjectTaskDialog {...props} /> : null);

const ProjectTaskDialog = ({ onClose, task, projectId, groups = [] }) => {
    const dispatch = useDispatch();
    const [title, setTitle] = useState(task.title);
    const [notes, setNotes] = useState(task.notes || '');
    const [dueDate, setDueDate] = useState(toInputDate(task.dueDate));
    const [status, setStatus] = useState(task.status || 'not_started');
    const [groupId, setGroupId] = useState(groups.some((g) => g._id === task.groupId) ? task.groupId : '');
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            setError({ field: 'title', message: 'Give the task a title' });
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await dispatch(updateProjectTask({
                projectId,
                taskId: task._id,
                changes: {
                    title: title.trim(), notes, dueDate: dueDate || null, status,
                    ...(groups.length > 0 && { groupId: groupId || null }),
                },
            })).unwrap();
            toast.success('Task updated');
            onClose();
        } catch (err) {
            setError({ field: err?.field, message: err?.message || 'Could not save those changes' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Edit details"
            width={520}
            footer={(
                <>
                    <button type="button" className="btn" onClick={onClose}>Cancel</button>
                    <button type="submit" form="project-task-form" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </>
            )}
        >
            <form id="project-task-form" className="pm-form" onSubmit={submit} noValidate>
                <label className="field">
                    <span className="field-label">Title</span>
                    <input
                        className="input"
                        value={title}
                        maxLength={200}
                        aria-invalid={error?.field === 'title'}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </label>
                <label className="field">
                    <span className="field-label">Notes</span>
                    <textarea className="input pm-textarea" rows={4} maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </label>
                <div className="pm-row">
                    <label className="field">
                        <span className="field-label">Status</span>
                        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </label>
                    <label className="field">
                        <span className="field-label">Due date</span>
                        <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </label>
                </div>
                {groups.length > 0 && (
                    <label className="field">
                        <span className="field-label">Group</span>
                        <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                            <option value="">No group</option>
                            {groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
                        </select>
                    </label>
                )}
                {error && <p className="pm-error" role="alert">{error.message}</p>}
            </form>
        </Modal>
    );
};

export default ProjectTaskModal;
