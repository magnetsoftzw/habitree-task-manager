import { useState } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import {
    ArrowDown, ArrowUp, ArrowUpToLine, CalendarDays, CalendarPlus, Check, ChevronRight, FolderInput, GripVertical, Pencil, Plus, Trash2, X,
} from 'lucide-react';
import Menu from '../../ui/Menu';
import StatusPill from '../../ui/StatusPill';
import { formatDueDate, fromDateKey, shiftDateKey, toDateKey } from '../../../utils/Format';

const plannedLabel = (key) => {
    const today = toDateKey();
    if (key === today) return 'Today';
    if (key === shiftDateKey(today, 1)) return 'Tomorrow';
    return fromDateKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const isOverdue = (task) => task.dueDate && task.status !== 'done' && toDateKey(new Date(task.dueDate)) < toDateKey();

const InlineInput = ({ initial = '', label, onSave, onCancel, keepOpen = false, className = '' }) => {
    const [value, setValue] = useState(initial);
    const commit = () => {
        const v = value.trim();
        if (!v || v === initial) return onCancel();
        onSave(v);
        if (keepOpen) setValue('');
        return undefined;
    };
    return (
        <input
            className={`tl-input ${className}`}
            aria-label={label}
            value={value}
            autoFocus
            maxLength={200}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => (value.trim() && !keepOpen ? commit() : onCancel())}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commit();
                }
                if (e.key === 'Escape') onCancel();
            }}
        />
    );
};

const Checkbox = ({ checked, label, size = 22, onChange }) => (
    <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        className={`tl-check ${checked ? 'is-on' : ''}`}
        style={{ width: size, height: size }}
        onClick={onChange}
    >
        {checked && <Check size={size - 8} strokeWidth={3} aria-hidden="true" />}
    </button>
);

const SubtaskItem = ({ sub, index, onToggle, onRename, onDelete }) => {
    const [editing, setEditing] = useState(false);
    return (
        <Draggable draggableId={`sub:${sub._id}`} index={index} isDragDisabled={editing}>
            {(provided, snapshot) => (
                <li
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`tl-sub ${snapshot.isDragging ? 'is-dragging' : ''}`}
                >
                    <span className="tl-grip tl-grip-sub" {...provided.dragHandleProps} aria-label={`Reorder ${sub.title}`}>
                        <GripVertical size={14} aria-hidden="true" />
                    </span>
                    <Checkbox checked={sub.done} size={20} label={`Mark ${sub.title} done`} onChange={onToggle} />
                    {editing ? (
                        <InlineInput
                            initial={sub.title}
                            label="Subtask title"
                            onSave={(title) => { onRename(title); setEditing(false); }}
                            onCancel={() => setEditing(false)}
                        />
                    ) : (
                        <button type="button" className={`tl-sub-title ${sub.done ? 'is-done' : ''}`} onClick={() => setEditing(true)}>
                            {sub.title}
                        </button>
                    )}
                    <button type="button" className="tl-sub-delete" aria-label={`Delete ${sub.title}`} onClick={onDelete}>
                        <X size={14} />
                    </button>
                </li>
            )}
        </Draggable>
    );
};

const TaskListRow = ({
    task, index, expanded, isFirst, isLast, onToggleExpand, onToggleDone, onRename, onMove, onDelete, onPlan, onEdit,
    onAddSubtask, onToggleSubtask, onRenameSubtask, onDeleteSubtask, onMarkDone, plannedDate, onMoveToGroup,
}) => {
    const [editing, setEditing] = useState(false);
    const [addingSub, setAddingSub] = useState(false);
    const done = task.status === 'done';
    const subs = task.subtasks || [];
    const subDone = subs.filter((s) => s.done).length;
    const allSubsDone = subs.length > 0 && subDone === subs.length && !done;
    const overdue = isOverdue(task);

    return (
        <Draggable draggableId={task._id} index={index} isDragDisabled={editing}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`tl-item ${expanded ? 'is-expanded' : ''} ${snapshot.isDragging ? 'is-dragging' : ''}`}
                >
                    <div className="tl-row">
                        <span className="tl-grip" {...provided.dragHandleProps} aria-label={`Reorder ${task.title}`}>
                            <GripVertical size={14} aria-hidden="true" />
                        </span>
                        <div className="tl-cell-title">
                            <button
                                type="button"
                                className="tl-chevron"
                                aria-expanded={expanded}
                                aria-label={`${expanded ? 'Hide' : 'Show'} subtasks for ${task.title}`}
                                onClick={onToggleExpand}
                            >
                                <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
                            </button>
                            <Checkbox checked={done} label={`Mark ${task.title} done`} onChange={onToggleDone} />
                            {editing ? (
                                <InlineInput
                                    initial={task.title}
                                    label="Task title"
                                    className="is-task"
                                    onSave={(title) => { onRename(title); setEditing(false); }}
                                    onCancel={() => setEditing(false)}
                                />
                            ) : (
                                <button type="button" className={`tl-title ${done ? 'is-done' : ''}`} title={task.title} onClick={() => setEditing(true)}>
                                    {task.title}
                                </button>
                            )}
                            {plannedDate && !done && (
                                <span className="tl-planned" title={`Planned for ${fromDateKey(plannedDate).toDateString()}`}>
                                    <CalendarDays size={12} aria-hidden="true" />
                                    <span className="sr-only">Planned for </span>{plannedLabel(plannedDate)}
                                </span>
                            )}
                        </div>
                        <div className="tl-cell-subs">
                            {subs.length ? (
                                <>
                                    <div className="tl-mini-bar" aria-hidden="true">
                                        <span style={{ width: `${Math.round((subDone / subs.length) * 100)}%` }} />
                                    </div>
                                    <span className="tl-sub-count tabular">{subDone} / {subs.length}</span>
                                </>
                            ) : (
                                <span className="tl-sub-count muted" aria-label="No subtasks">—</span>
                            )}
                        </div>
                        <span><StatusPill status={task.status} /></span>
                        <span className={`tl-due ${done ? 'is-done' : ''} ${overdue ? 'is-overdue' : ''}`}>
                            {task.dueDate ? formatDueDate(task.dueDate) : <span className="muted">No date</span>}
                            {overdue && <span className="sr-only"> (overdue)</span>}
                        </span>
                        <Menu
                            label={`More actions for ${task.title}`}
                            items={[
                                { label: 'Add to plan', icon: <CalendarPlus size={16} />, onSelect: onPlan },
                                { label: 'Edit details', icon: <Pencil size={16} />, onSelect: onEdit },
                                onMoveToGroup && { label: 'Add to group', icon: <FolderInput size={16} />, onSelect: onMoveToGroup },
                                !isFirst && { label: 'Move to top', icon: <ArrowUpToLine size={16} />, onSelect: () => onMove('top') },
                                !isFirst && { label: 'Move up', icon: <ArrowUp size={16} />, onSelect: () => onMove('up') },
                                !isLast && { label: 'Move down', icon: <ArrowDown size={16} />, onSelect: () => onMove('down') },
                                { label: 'Delete', icon: <Trash2 size={16} />, danger: true, onSelect: onDelete },
                            ]}
                        />
                    </div>

                    {allSubsDone && (
                        <div className="tl-prompt" role="status">
                            <span>All subtasks done — mark task done?</span>
                            <button type="button" className="tl-link-btn" onClick={onMarkDone}>Mark done</button>
                        </div>
                    )}

                    {expanded && (
                        <Droppable droppableId={`subs:${task._id}`} type={`sub:${task._id}`}>
                            {(dropProvided) => (
                                <ul className="tl-subs" ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                                    {subs.map((sub, i) => (
                                        <SubtaskItem
                                            key={sub._id}
                                            sub={sub}
                                            index={i}
                                            onToggle={() => onToggleSubtask(sub)}
                                            onRename={(title) => onRenameSubtask(sub, title)}
                                            onDelete={() => onDeleteSubtask(sub)}
                                        />
                                    ))}
                                    {dropProvided.placeholder}
                                    <li className="tl-sub tl-sub-add">
                                        {addingSub ? (
                                            <InlineInput
                                                label="New subtask title"
                                                keepOpen
                                                onSave={onAddSubtask}
                                                onCancel={() => setAddingSub(false)}
                                            />
                                        ) : (
                                            <button type="button" className="tl-add-btn sm" onClick={() => setAddingSub(true)}>
                                                <Plus size={14} strokeWidth={2.4} aria-hidden="true" /> Add subtask
                                            </button>
                                        )}
                                    </li>
                                </ul>
                            )}
                        </Droppable>
                    )}
                </div>
            )}
        </Draggable>
    );
};

export { InlineInput };
export default TaskListRow;
