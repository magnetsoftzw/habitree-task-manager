import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { BookOpen, Code, FileText, Hash, PlayCircle, Plus, X } from 'lucide-react';
import Modal from '../../ui/Modal';
import { createGroup, fetchGroups } from '../../../store/slices/groupSlice';
import { IDENTITY_PALETTE } from '../../../utils/Colors';
import '../Project/ProjectModals.css';
import './CreateTaskDialog.css';

const CATEGORIES = [
    { id: 'General', icon: Hash },
    { id: 'Practice', icon: Code },
    { id: 'Read', icon: BookOpen },
    { id: 'Watch', icon: PlayCircle },
    { id: 'Note', icon: FileText },
];

const CreateTaskModal = (props) => (props.isOpen ? <CreateTaskDialog {...props} /> : null);

const CreateTaskDialog = ({ onClose, onCreate }) => {
    const dispatch = useDispatch();
    const groups = useSelector((s) => s.groups.list);
    const [title, setTitle] = useState('');
    const [groupId, setGroupId] = useState('');
    const [category, setCategory] = useState('General');
    const [subtasks, setSubtasks] = useState([]);
    const [draft, setDraft] = useState('');
    const [newGroup, setNewGroup] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        dispatch(fetchGroups());
    }, [dispatch]);

    const selectedGroup = groupId || groups[0]?._id || '';

    const addSubtask = () => {
        const t = draft.trim();
        if (!t) return;
        setSubtasks((list) => [...list, t]);
        setDraft('');
    };

    const saveGroup = async () => {
        const name = newGroup.name.trim();
        if (!name) return;
        try {
            const created = await dispatch(createGroup({ name, color: newGroup.color })).unwrap();
            setGroupId(created._id);
            setNewGroup(null);
            toast.success(`Group “${name}” created`);
        } catch (err) {
            toast.error(err?.message || "Couldn't create that group.");
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return setError('Give the task a title.');
        setSaving(true);
        try {
            await onCreate({
                taskTitle: title.trim(),
                selectedGroupId: selectedGroup || null,
                category,
                subtasks: draft.trim() ? [...subtasks, draft.trim()] : subtasks,
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="New task"
            subtitle="Something to watch, read or practise. Break it into subtasks to track progress."
            width={560}
            footer={(
                <>
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" form="create-task-form" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Creating…' : 'Create task'}
                    </button>
                </>
            )}
        >
            <form id="create-task-form" className="pm-form" onSubmit={submit} noValidate>
                <label className="field">
                    <span className="field-label">Title</span>
                    <input
                        className="input"
                        value={title}
                        maxLength={200}
                        placeholder="e.g. Start the Node.js course"
                        aria-invalid={!!error}
                        onChange={(e) => { setTitle(e.target.value); setError(''); }}
                    />
                    {error && <span className="pm-error">{error}</span>}
                </label>

                <div className="field">
                    <div className="ct-label-row">
                        <label className="field-label" htmlFor="ct-group">Group</label>
                        {!newGroup && (
                            <button type="button" className="ct-link" onClick={() => setNewGroup({ name: '', color: IDENTITY_PALETTE[groups.length % IDENTITY_PALETTE.length] })}>
                                <Plus size={14} aria-hidden="true" /> New group
                            </button>
                        )}
                    </div>
                    {newGroup ? (
                        <div className="ct-new-group">
                            <input
                                className="input"
                                aria-label="New group name"
                                placeholder="e.g. React Native"
                                maxLength={60}
                                value={newGroup.name}
                                autoFocus
                                onChange={(e) => setNewGroup((g) => ({ ...g, name: e.target.value }))}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); saveGroup(); }
                                }}
                            />
                            <div className="ct-swatches" role="radiogroup" aria-label="Group colour">
                                {IDENTITY_PALETTE.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        role="radio"
                                        aria-checked={newGroup.color === c}
                                        aria-label={c}
                                        className="ct-swatch"
                                        style={{ background: c }}
                                        onClick={() => setNewGroup((g) => ({ ...g, color: c }))}
                                    />
                                ))}
                            </div>
                            <div className="ct-new-group-actions">
                                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setNewGroup(null)}>Cancel</button>
                                <button type="button" className="btn btn-sm btn-primary" onClick={saveGroup} disabled={!newGroup.name.trim()}>Add group</button>
                            </div>
                        </div>
                    ) : (
                        <select id="ct-group" className="input" value={selectedGroup} onChange={(e) => setGroupId(e.target.value)}>
                            {groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
                            <option value="">Uncategorized</option>
                        </select>
                    )}
                </div>

                <fieldset className="ct-fieldset">
                    <legend className="field-label">Category</legend>
                    <div className="ct-cats">
                        {CATEGORIES.map((cat) => (
                            <button key={cat.id} type="button" className="ct-cat" aria-pressed={category === cat.id} onClick={() => setCategory(cat.id)}>
                                <cat.icon size={14} aria-hidden="true" /> {cat.id}
                            </button>
                        ))}
                    </div>
                </fieldset>

                <div className="field">
                    <span className="field-label">Subtasks <span className="muted">(optional)</span></span>
                    {subtasks.length > 0 && (
                        <ul className="ct-subs">
                            {subtasks.map((s, i) => (
                                <li key={`${s}-${i}`}>
                                    <span>{s}</span>
                                    <button type="button" className="icon-btn ct-sub-remove" aria-label={`Remove ${s}`} onClick={() => setSubtasks((list) => list.filter((_, j) => j !== i))}>
                                        <X size={14} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="ct-sub-add">
                        <input
                            className="input"
                            aria-label="New subtask"
                            placeholder="Add a step and press Enter"
                            value={draft}
                            maxLength={200}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); addSubtask(); }
                            }}
                        />
                        <button type="button" className="btn" onClick={addSubtask} disabled={!draft.trim()}>Add</button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default CreateTaskModal;
