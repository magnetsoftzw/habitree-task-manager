import { useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { Check, X } from 'lucide-react';
import Modal from '../../ui/Modal';
import { createProject } from '../../../store/slices/projectSlice';
import { IDENTITY_PALETTE } from '../../../utils/Colors';
import './ProjectModals.css';

const randomColor = () => IDENTITY_PALETTE[Math.floor(Math.random() * IDENTITY_PALETTE.length)];

const CreateProjectModal = (props) => (props.isOpen ? <CreateProjectDialog {...props} /> : null);

const CreateProjectDialog = ({ onClose, onCreated }) => {
    const dispatch = useDispatch();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [techInput, setTechInput] = useState('');
    const [techStack, setTechStack] = useState([]);
    const [color, setColor] = useState(randomColor);
    const [saving, setSaving] = useState(false);

    const addTech = () => {
        const parts = techInput.split(',').map((t) => t.trim()).filter(Boolean);
        if (!parts.length) return;
        setTechStack((prev) => [...prev, ...parts.filter((p) => !prev.includes(p))]);
        setTechInput('');
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        try {
            const project = await dispatch(createProject({
                name: name.trim(),
                description: description.trim(),
                techStack,
                color,
            })).unwrap();
            toast.success(`Project "${name.trim()}" created`);
            onCreated?.(project);
            onClose();
        } catch (err) {
            toast.error(err?.message || 'Could not create the project');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="New project"
            subtitle="Gets its own board with backlog and workflow columns, plus a task list."
            width={560}
            footer={(
                <>
                    <button type="button" className="btn" onClick={onClose}>Cancel</button>
                    <button type="submit" form="create-project-form" className="btn btn-primary" disabled={saving || !name.trim()}>
                        {saving ? 'Creating…' : 'Create project'}
                    </button>
                </>
            )}
        >
            <form id="create-project-form" className="pm-form" onSubmit={submit}>
                <label className="field">
                    <span className="field-label">Name</span>
                    <input className="input" value={name} maxLength={100} required placeholder="e.g. Habitree Task Manager" onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="field">
                    <span className="field-label">Description</span>
                    <textarea className="input pm-textarea" rows={4} value={description} placeholder="What is this project about?" onChange={(e) => setDescription(e.target.value)} />
                </label>
                <div className="field">
                    <label className="field-label" htmlFor="project-tech">Tech stack</label>
                    <div className="pm-tech-row">
                        <input
                            id="project-tech"
                            className="input"
                            value={techInput}
                            placeholder="Type a technology and press Enter"
                            onChange={(e) => setTechInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ',') {
                                    e.preventDefault();
                                    addTech();
                                }
                            }}
                        />
                        <button type="button" className="btn" onClick={addTech} disabled={!techInput.trim()}>Add</button>
                    </div>
                    {techStack.length > 0 && (
                        <ul className="pm-tags" aria-label="Added technologies">
                            {techStack.map((t) => (
                                <li key={t}>
                                    {t}
                                    <button type="button" aria-label={`Remove ${t}`} onClick={() => setTechStack((prev) => prev.filter((x) => x !== t))}>
                                        <X size={12} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <fieldset className="field pm-colors">
                    <legend className="field-label">Colour</legend>
                    <div className="pm-swatches">
                        {IDENTITY_PALETTE.map((c) => (
                            <label key={c} className="pm-swatch" style={{ background: c }}>
                                <input type="radio" name="new-project-color" value={c} checked={color === c} onChange={() => setColor(c)} aria-label={c} />
                                {color === c && <Check size={16} strokeWidth={3} aria-hidden="true" />}
                            </label>
                        ))}
                    </div>
                </fieldset>
            </form>
        </Modal>
    );
};

export default CreateProjectModal;
