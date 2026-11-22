import { useState } from 'react';
import Modal from '../../ui/Modal';

const CreateRoadmap = (props) => (props.isOpen ? <CreateRoadmapDialog {...props} /> : null);

const CreateRoadmapDialog = ({ onClose, onSubmit, initialData, loading }) => {
    const [skillName, setSkillName] = useState(initialData?.skillName || '');
    const editing = Boolean(initialData);

    const submit = (e) => {
        e.preventDefault();
        if (!skillName.trim()) return;
        onSubmit({ skillName: skillName.trim() });
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={editing ? 'Rename roadmap' : 'New roadmap'}
            subtitle={editing ? undefined : 'Start from a skill you want to learn, then add tasks as steps.'}
            width={460}
            footer={(
                <>
                    <button type="button" className="btn" onClick={onClose}>Cancel</button>
                    <button type="submit" form="roadmap-form" className="btn btn-primary" disabled={loading || !skillName.trim()}>
                        {loading ? 'Saving…' : editing ? 'Save' : 'Create roadmap'}
                    </button>
                </>
            )}
        >
            <form id="roadmap-form" onSubmit={submit}>
                <label className="field">
                    <span className="field-label">Skill</span>
                    <input
                        className="input"
                        value={skillName}
                        maxLength={100}
                        placeholder="e.g. Mastering MERN Stack"
                        onChange={(e) => setSkillName(e.target.value)}
                    />
                </label>
            </form>
        </Modal>
    );
};

export default CreateRoadmap;
