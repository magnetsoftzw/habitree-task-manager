import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check } from 'lucide-react';
import Modal from '../../ui/Modal';
import { deleteProject, updateProject } from '../../../store/slices/projectSlice';
import { IDENTITY_PALETTE, colorFor } from '../../../utils/Colors';
import './ProjectModals.css';

const ProjectSettingsModal = (props) => (props.isOpen ? <ProjectSettingsDialog {...props} /> : null);

const ProjectSettingsDialog = ({ onClose, project, canDelete }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description || '');
    const [stack, setStack] = useState((project.techStack || []).join(', '));
    const [color, setColor] = useState(colorFor(project));
    const [saving, setSaving] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        try {
            await dispatch(updateProject({
                projectId: project._id,
                updates: {
                    name: name.trim(),
                    description: description.trim(),
                    techStack: stack.split(',').map((t) => t.trim()).filter(Boolean),
                    color,
                },
            })).unwrap();
            toast.success('Project saved');
            onClose();
        } catch {
            toast.error('Could not save the project');
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!window.confirm(`Delete "${project.name}" with its board and task list? This can't be undone.`)) return;
        try {
            await dispatch(deleteProject(project._id)).unwrap();
            toast.success('Project deleted');
            navigate('/projects');
        } catch {
            toast.error('Could not delete the project');
        }
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Project settings"
            width={560}
            footer={(
                <>
                    {canDelete && (
                        <button type="button" className="btn btn-danger pm-delete" onClick={remove}>Delete project</button>
                    )}
                    <button type="button" className="btn" onClick={onClose}>Cancel</button>
                    <button type="submit" form="project-settings-form" className="btn btn-primary" disabled={saving || !name.trim()}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </>
            )}
        >
            <form id="project-settings-form" className="pm-form" onSubmit={submit}>
                <label className="field">
                    <span className="field-label">Name</span>
                    <input className="input" value={name} maxLength={100} required onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="field">
                    <span className="field-label">Description</span>
                    <textarea className="input pm-textarea" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
                </label>
                <label className="field">
                    <span className="field-label">Tech stack <span className="muted">(comma separated)</span></span>
                    <input className="input" value={stack} placeholder="React, Node, MongoDB" onChange={(e) => setStack(e.target.value)} />
                </label>
                <fieldset className="field pm-colors">
                    <legend className="field-label">Colour</legend>
                    <div className="pm-swatches">
                        {IDENTITY_PALETTE.map((c) => (
                            <label key={c} className="pm-swatch" style={{ background: c }}>
                                <input type="radio" name="project-color" value={c} checked={color === c} onChange={() => setColor(c)} aria-label={c} />
                                {color === c && <Check size={16} strokeWidth={3} aria-hidden="true" />}
                            </label>
                        ))}
                    </div>
                </fieldset>
            </form>
        </Modal>
    );
};

export default ProjectSettingsModal;
