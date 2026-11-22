import { useState } from 'react';
import Modal from '../../ui/Modal';
import { COLUMN_KEYS, COLUMN_LABELS, columnDot } from '../../../utils/Board';
import './MoveCardModal.css';

const MoveCardModal = (props) => (props.isOpen ? <MoveCardDialog {...props} /> : null);

const MoveCardDialog = ({ onClose, title, fromColumn, onMove, moving = false }) => {
    const [target, setTarget] = useState(fromColumn && fromColumn !== 'todo' ? 'todo' : 'doing');

    const submit = (e) => {
        e.preventDefault();
        onMove(target);
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Move to column"
            subtitle={title}
            width={440}
            footer={(
                <>
                    <button type="button" className="btn" onClick={onClose}>Cancel</button>
                    <button type="submit" form="move-card-form" className="btn btn-primary" disabled={moving || target === fromColumn}>
                        {moving ? 'Moving…' : 'Move'}
                    </button>
                </>
            )}
        >
            <form id="move-card-form" onSubmit={submit}>
                <fieldset className="move-card-options">
                    <legend className="sr-only">Column</legend>
                    {COLUMN_KEYS.map((key) => (
                        <label key={key} className={`move-card-option ${target === key ? 'is-on' : ''}`}>
                            <input
                                type="radio"
                                name="column"
                                value={key}
                                checked={target === key}
                                disabled={key === fromColumn}
                                onChange={() => setTarget(key)}
                            />
                            <span className="move-card-dot" style={{ background: columnDot(key) }} aria-hidden="true" />
                            <span className="move-card-name">{COLUMN_LABELS[key]}</span>
                            {key === fromColumn && <span className="move-card-current">Current</span>}
                        </label>
                    ))}
                </fieldset>
            </form>
        </Modal>
    );
};

export default MoveCardModal;
