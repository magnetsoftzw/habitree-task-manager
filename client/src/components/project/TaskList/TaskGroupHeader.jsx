import { useState } from 'react';
import { CalendarPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import Menu from '../../ui/Menu';
import { InlineInput } from './TaskListRow';

const TaskGroupHeader = ({ group, count, onRename, onDelete, onAddTask, onPlan }) => {
    const [editing, setEditing] = useState(false);

    return (
        <div className="tl-group-head">
            {editing ? (
                <InlineInput
                    initial={group.name}
                    label="Group name"
                    className="is-group"
                    onSave={(name) => { onRename(name); setEditing(false); }}
                    onCancel={() => setEditing(false)}
                />
            ) : (
                <h3 className="tl-group-name">{group.name}</h3>
            )}
            <span className="tl-group-count tabular">{count}</span>
            {group._id && (
                <div className="tl-group-actions">
                    <button type="button" className="icon-btn tl-group-add" aria-label={`Add task to ${group.name}`} onClick={onAddTask}>
                        <Plus size={16} />
                    </button>
                    <Menu
                        label={`Options for ${group.name}`}
                        items={[
                            ...(onPlan ? [{ label: 'Add to planner', icon: <CalendarPlus size={16} />, onSelect: onPlan }] : []),
                            { label: 'Rename group', icon: <Pencil size={16} />, onSelect: () => setEditing(true) },
                            { label: 'Delete group', icon: <Trash2 size={16} />, danger: true, onSelect: onDelete },
                        ]}
                    />
                </div>
            )}
        </div>
    );
};

export default TaskGroupHeader;
