import { useState } from 'react';
import { Folder, FolderOpen } from 'lucide-react';
import Modal from '../../ui/Modal';
import './MoveCardModal.css';

const MoveToGroupModal = (props) => (props.isOpen ? <MoveToGroupDialog {...props} /> : null);

const MoveToGroupDialog = ({ onClose, task, groups, onMove }) => {
    const current = groups.some((g) => g._id === task.groupId) ? task.groupId : '';
    const options = [{ _id: '', name: 'No group' }, ...groups];
    const [target, setTarget] = useState(groups.find((g) => g._id !== current)?._id ?? '');

    const submit = (e) => {
        e.preventDefault();
        onMove(target || null);
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Add to group"
            subtitle={task.title}
            width={440}
            footer={(
                <>
                    <button type="button" className="btn" onClick={onClose}>Cancel</button>
                    <button type="submit" form="move-group-form" className="btn btn-primary" disabled={target === current}>
                        Move
                    </button>
                </>
            )}
        >
            <form id="move-group-form" onSubmit={submit}>
                <fieldset className="move-card-options">
                    <legend className="sr-only">Group</legend>
                    {options.map((g) => {
                        const Icon = g._id ? Folder : FolderOpen;
                        return (
                            <label key={g._id || 'none'} className={`move-card-option ${target === g._id ? 'is-on' : ''}`}>
                                <input
                                    type="radio"
                                    name="group"
                                    value={g._id}
                                    checked={target === g._id}
                                    disabled={g._id === current}
                                    onChange={() => setTarget(g._id)}
                                />
                                <Icon size={16} aria-hidden="true" />
                                <span className="move-card-name">{g.name}</span>
                                {g._id === current && <span className="move-card-current">Current</span>}
                            </label>
                        );
                    })}
                </fieldset>
            </form>
        </Modal>
    );
};

export default MoveToGroupModal;
