import { useState } from 'react';
import toast from 'react-hot-toast';
import API from '../../api/axiosInstance';
import Modal from '../../components/ui/Modal';

const PasswordDialog = ({ onClose }) => {
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (next.length < 6) return setErrors({ newPassword: 'Use at least 6 characters.' });
        if (next !== confirm) return setErrors({ confirm: "Passwords don't match." });
        setSaving(true);
        setErrors({});
        try {
            await API.put('/users/password', { currentPassword: current, newPassword: next });
            toast.success('Password updated');
            onClose();
        } catch (err) {
            const data = err.response?.data;
            setErrors({ [data?.field || 'form']: data?.message || "Couldn't update your password." });
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Change password"
            subtitle="You'll stay signed in on this device."
            width={440}
            footer={(
                <>
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" form="pw-form" className="btn btn-primary" disabled={saving || !current || !next}>
                        {saving ? 'Saving…' : 'Update password'}
                    </button>
                </>
            )}
        >
            <form id="pw-form" className="st-form" onSubmit={submit} noValidate>
                <label className="field">
                    <span className="field-label">Current password</span>
                    <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-invalid={!!errors.currentPassword} autoFocus />
                    {errors.currentPassword && <span className="st-error">{errors.currentPassword}</span>}
                </label>
                <label className="field">
                    <span className="field-label">New password</span>
                    <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={!!errors.newPassword} />
                    {errors.newPassword && <span className="st-error">{errors.newPassword}</span>}
                </label>
                <label className="field">
                    <span className="field-label">Confirm new password</span>
                    <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!errors.confirm} />
                    {errors.confirm && <span className="st-error">{errors.confirm}</span>}
                </label>
                {errors.form && <p className="st-error" role="alert">{errors.form}</p>}
            </form>
        </Modal>
    );
};

const DeleteAccountDialog = ({ onClose, onDeleted }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setDeleting(true);
        setError('');
        try {
            await API.delete('/users/me', { data: { password } });
            onDeleted();
        } catch (err) {
            setError(err.response?.data?.message || "Couldn't delete your account.");
            setDeleting(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Delete account"
            subtitle="This permanently removes your account, tasks, projects and roadmaps. It can't be undone."
            width={460}
            footer={(
                <>
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Keep my account</button>
                    <button type="submit" form="del-form" className="btn st-danger-solid" disabled={deleting || !password}>
                        {deleting ? 'Deleting…' : 'Delete account'}
                    </button>
                </>
            )}
        >
            <form id="del-form" className="st-form" onSubmit={submit} noValidate>
                <label className="field">
                    <span className="field-label">Enter your password to confirm</span>
                    <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error} autoFocus />
                    {error && <span className="st-error" role="alert">{error}</span>}
                </label>
            </form>
        </Modal>
    );
};

export { PasswordDialog, DeleteAccountDialog };
