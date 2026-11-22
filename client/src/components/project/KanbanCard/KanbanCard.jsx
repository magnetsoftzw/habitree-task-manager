import { useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { Draggable } from '@hello-pangea/dnd';
import { ArrowRightLeft, Check, Clock, Copy, Pencil, Trash2 } from 'lucide-react';
import Menu from '../../ui/Menu';
import { deleteTask, updateTask } from '../../../store/slices/projectSlice';
import { cardTag, formatHours } from '../../../utils/Board';
import './KanbanCard.css';

const KanbanCard = ({ task, index, columnKey, isSelected, selecting, onToggleSelect, onMove }) => {
    const dispatch = useDispatch();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(task.title);
    const tag = cardTag(task, columnKey);
    const owner = task.userId?.username;

    const save = () => {
        const title = draft.trim();
        setEditing(false);
        if (!title || title === task.title) {
            setDraft(task.title);
            return;
        }
        dispatch(updateTask({ taskId: task._id, updates: { title } }))
            .unwrap()
            .catch(() => {
                setDraft(task.title);
                toast.error('Could not rename that card');
            });
    };

    const copy = () => {
        navigator.clipboard?.writeText(task.title).then(() => toast.success('Title copied'));
    };

    const remove = () => {
        if (!window.confirm(`Delete "${task.title}"?`)) return;
        dispatch(deleteTask({ taskId: task._id, columnId: columnKey }))
            .unwrap()
            .catch(() => toast.error('Could not delete that card'));
    };

    return (
        <Draggable draggableId={task._id} index={index} isDragDisabled={editing}>
            {(provided, snapshot) => (
                <article
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`kanban-card ${snapshot.isDragging ? 'is-dragging' : ''} ${isSelected ? 'is-selected' : ''} ${selecting ? 'is-selecting' : ''}`}
                    aria-label={task.title}
                >
                    <div className="kanban-card-top">
                        <button
                            type="button"
                            role="checkbox"
                            aria-checked={isSelected}
                            aria-label={`Select ${task.title}`}
                            className="kanban-card-select"
                            onClick={() => onToggleSelect(task._id)}
                        >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                        </button>
                        {tag && <span className={`kanban-tag tag-${tag.toLowerCase()}`}>{tag}</span>}
                        <span className="kanban-card-spacer" />
                        <Menu
                            label={`Actions for ${task.title}`}
                            items={[
                                { label: 'Rename', icon: <Pencil size={16} />, onSelect: () => setEditing(true) },
                                { label: 'Move to…', icon: <ArrowRightLeft size={16} />, onSelect: () => onMove(task, columnKey) },
                                { label: 'Copy title', icon: <Copy size={16} />, onSelect: copy },
                                { label: 'Delete', icon: <Trash2 size={16} />, danger: true, onSelect: remove },
                            ]}
                        />
                    </div>

                    {editing ? (
                        <input
                            className="kanban-card-input"
                            aria-label="Card title"
                            value={draft}
                            autoFocus
                            maxLength={200}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={save}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') save();
                                if (e.key === 'Escape') {
                                    setDraft(task.title);
                                    setEditing(false);
                                }
                            }}
                        />
                    ) : (
                        <span className="kanban-card-title" onDoubleClick={() => setEditing(true)}>{task.title || 'Untitled card'}</span>
                    )}

                    <div className="kanban-card-meta">
                        <span className="kanban-card-time" title="Focus time">
                            <Clock size={13} aria-hidden="true" />
                            {formatHours(task.focusMinutes)}
                        </span>
                        <span className="kanban-card-spacer" />
                        {owner && (
                            <span className="kanban-card-avatar" title={owner}>{owner.charAt(0).toUpperCase()}</span>
                        )}
                    </div>
                </article>
            )}
        </Draggable>
    );
};

export default KanbanCard;
