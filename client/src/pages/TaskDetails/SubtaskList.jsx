import { useState } from 'react';
import { Check, CalendarPlus, Trash2 } from 'lucide-react';

const SubtaskRow = ({ subtask, onToggle, onRename, onPlan, onDelete }) => {
    const [title, setTitle] = useState(subtask.title);
    const done = !!subtask.isCompleted;

    const commit = () => {
        const next = title.trim();
        if (!next) return setTitle(subtask.title);
        if (next !== subtask.title) onRename(next);
    };

    return (
        <li className={`td-sub ${done ? 'is-done' : ''}`}>
            <button
                type="button"
                role="checkbox"
                aria-checked={done}
                aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${subtask.title}`}
                className="td-check"
                onClick={onToggle}
            >
                {done && <Check size={14} strokeWidth={3} aria-hidden="true" />}
            </button>
            <input
                className="td-sub-title"
                aria-label="Subtask title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') {
                        setTitle(subtask.title);
                        e.currentTarget.blur();
                    }
                }}
            />
            <div className="td-sub-actions">
                <button type="button" className="icon-btn td-icon-sm" aria-label={`Add “${subtask.title}” to plan`} title="Add to plan" onClick={onPlan} disabled={!subtask._id}>
                    <CalendarPlus size={16} />
                </button>
                <button type="button" className="icon-btn td-icon-sm td-danger" aria-label={`Delete “${subtask.title}”`} title="Delete" onClick={onDelete}>
                    <Trash2 size={16} />
                </button>
            </div>
        </li>
    );
};

const SubtaskList = ({ subtasks, onChange, onPlan, onDelete }) => {
    const [draft, setDraft] = useState('');

    const add = (e) => {
        e.preventDefault();
        const title = draft.trim();
        if (!title) return;
        onChange([...subtasks, { title, isCompleted: false }]);
        setDraft('');
    };

    const replace = (index, patch) => onChange(subtasks.map((s, i) => (i === index ? { ...s, ...patch } : s)));

    return (
        <>
            {subtasks.length ? (
                <ul className="td-subs">
                    {subtasks.map((s, i) => (
                        <SubtaskRow
                            key={s._id || `new-${i}`}
                            subtask={s}
                            onToggle={() => replace(i, { isCompleted: !s.isCompleted, status: s.isCompleted ? 'Not Started' : 'Completed' })}
                            onRename={(title) => replace(i, { title })}
                            onPlan={() => onPlan(s)}
                            onDelete={() => onDelete(i)}
                        />
                    ))}
                </ul>
            ) : (
                <p className="td-subs-empty">No subtasks yet. Break this task into steps you can tick off — progress fills in as you go.</p>
            )}
            <form className="td-add" onSubmit={add}>
                <input className="input" aria-label="New subtask" placeholder="Add a subtask and press Enter" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} />
                <button type="submit" className="btn" disabled={!draft.trim()}>Add</button>
            </form>
        </>
    );
};

export default SubtaskList;
