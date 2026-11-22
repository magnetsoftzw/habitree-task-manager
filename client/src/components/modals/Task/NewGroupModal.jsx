import { useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import Modal from '../../ui/Modal';
import { createGroup } from '../../../store/slices/groupSlice';
import { IDENTITY_PALETTE } from '../../../utils/Colors';
import './NewGroupModal.css';

const randomColor = () => IDENTITY_PALETTE[Math.floor(Math.random() * IDENTITY_PALETTE.length)];

const NewGroupModal = (props) => (props.isOpen ? <NewGroupDialog {...props} /> : null);

const NewGroupDialog = ({ onClose, onCreated }) => {
    const dispatch = useDispatch();
    const [name, setName] = useState('');
    const [color, setColor] = useState(randomColor);
    const [saving, setSaving] = useState(false);

    const submit = async (e) => {
        e?.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        try {
            await dispatch(createGroup({ name: name.trim(), color })).unwrap();
            toast.success(`Group "${name.trim()}" created`);
            onCreated?.();
            onClose();
        } catch {
            toast.error('Could not create that group');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="New group"
            subtitle="Groups keep related tasks together on the Tasks page."
            width={440}
            footer={(
                <>
                    <button type="button" className="btn" onClick={onClose}>Cancel</button>
                    <button type="button" className="btn btn-primary" disabled={!name.trim() || saving} onClick={submit}>
                        {saving ? 'Creating…' : 'Create group'}
                    </button>
                </>
            )}
        >
            <form onSubmit={submit} className="new-group-form">
                <label className="field">
                    <span className="field-label">Name</span>
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. React Native" maxLength={60} />
                </label>
                <fieldset className="new-group-colors">
                    <legend className="field-label">Colour</legend>
                    <div className="new-group-swatches">
                        {IDENTITY_PALETTE.map((c) => (
                            <label key={c} className="new-group-swatch" style={{ '--swatch': c }}>
                                <input
                                    type="radio"
                                    name="group-color"
                                    value={c}
                                    checked={color === c}
                                    onChange={() => setColor(c)}
                                    aria-label={`Colour ${c}`}
                                />
                                <span aria-hidden="true" />
                            </label>
                        ))}
                    </div>
                </fieldset>
            </form>
        </Modal>
    );
};

export default NewGroupModal;
