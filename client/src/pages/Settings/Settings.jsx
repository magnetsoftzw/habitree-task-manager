import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import { logout } from '../../store/slices/authSlice';
import { updateUserProfile, updateUserSettings } from '../../store/slices/userSlice';
import { useTheme } from '../../theme/ThemeContext';
import { dailyGoalOf, formatGoal } from '../../utils/Format';
import { DeleteAccountDialog, PasswordDialog } from './SettingsDialogs';
import './Settings.css';

const GOAL_OPTIONS = [240, 300, 360, 420, 480, 540, 600];
const SECTIONS = [
    { id: 'profile', label: 'Profile' },
    { id: 'prefs', label: 'Preferences' },
    { id: 'danger', label: 'Account' },
];

const Switch = ({ checked, onChange, labelledBy, describedBy, disabled }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`st-switch ${checked ? 'is-on' : ''}`}
        onClick={() => onChange(!checked)}
        disabled={disabled}
    >
        <span />
    </button>
);

const ProfileForm = ({ profile }) => {
    const dispatch = useDispatch();
    const [username, setUsername] = useState(profile.username || '');
    const [email, setEmail] = useState(profile.email || '');
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [pwOpen, setPwOpen] = useState(false);
    const dirty = username !== (profile.username || '') || email !== (profile.email || '');

    const reset = () => {
        setUsername(profile.username || '');
        setEmail(profile.email || '');
        setError(null);
    };

    const save = async (e) => {
        e.preventDefault();
        if (!username.trim()) return setError({ field: 'username', message: 'Username is required.' });
        setSaving(true);
        setError(null);
        try {
            await dispatch(updateUserProfile({ username: username.trim(), email: email.trim() })).unwrap();
            toast.success('Profile saved');
        } catch (message) {
            const field = /email/i.test(message || '') ? 'email' : /username/i.test(message || '') ? 'username' : 'form';
            setError({ field, message: message || "Couldn't save your profile." });
        } finally {
            setSaving(false);
        }
    };

    const initial = (profile.username || profile.email || '?').charAt(0).toUpperCase();
    const since = profile.createdAt
        ? new Date(profile.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

    return (
        <section id="profile" className="st-card" aria-labelledby="st-profile-h">
            <div className="st-profile-head">
                <div className="st-avatar" aria-hidden="true">{initial}</div>
                <div className="st-profile-id">
                    <h2 id="st-profile-h">{profile.username}</h2>
                    <div className="st-profile-meta">
                        {profile.role && <span className="st-role">{profile.role}</span>}
                        {since && <span>Member since {since}</span>}
                    </div>
                </div>
            </div>
            <form onSubmit={save} noValidate>
                <div className="st-fields">
                    <label className="field">
                        <span className="field-label">Username</span>
                        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" aria-invalid={error?.field === 'username'} />
                        {error?.field === 'username' && <span className="st-error">{error.message}</span>}
                    </label>
                    <label className="field">
                        <span className="field-label">Email</span>
                        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={error?.field === 'email'} />
                        {error?.field === 'email' && <span className="st-error">{error.message}</span>}
                    </label>
                    <div className="field">
                        <span className="field-label">Role</span>
                        <span className="st-readonly">{profile.role || '—'}</span>
                    </div>
                    <div className="field">
                        <span className="field-label">Password</span>
                        <button type="button" className="btn st-pw-btn" onClick={() => setPwOpen(true)}>Change password</button>
                    </div>
                </div>
                {error?.field === 'form' && <p className="st-error st-form-error" role="alert">{error.message}</p>}
                <div className="st-actions">
                    <button type="button" className="btn btn-ghost" onClick={reset} disabled={!dirty || saving}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save changes'}</button>
                </div>
            </form>
            {pwOpen && <PasswordDialog onClose={() => setPwOpen(false)} />}
        </section>
    );
};

const Preferences = ({ profile }) => {
    const dispatch = useDispatch();
    const { theme, setTheme } = useTheme();
    const settings = profile.settings || {};
    const goal = dailyGoalOf(profile);
    const goalOptions = GOAL_OPTIONS.includes(goal) ? GOAL_OPTIONS : [...GOAL_OPTIONS, goal].sort((a, b) => a - b);

    const update = async (patch) => {
        try {
            await dispatch(updateUserSettings(patch)).unwrap();
            toast.success('Preferences saved');
        } catch (message) {
            toast.error(message || "Couldn't save that change.");
        }
    };

    return (
        <section id="prefs" className="st-card st-prefs" aria-labelledby="st-prefs-h">
            <h2 id="st-prefs-h" className="st-section-title">Preferences</h2>
            <div className="st-pref">
                <div className="st-pref-text">
                    <span id="st-theme-l" className="st-pref-label">Theme</span>
                    <span className="st-pref-help">Light is the default. Your choice is saved on this device.</span>
                </div>
                <div role="group" aria-labelledby="st-theme-l" className="segmented">
                    <button type="button" className="segmented-option" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Light</button>
                    <button type="button" className="segmented-option" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Dark</button>
                </div>
            </div>
            <div className="st-pref">
                <div className="st-pref-text">
                    <span id="st-roll-l" className="st-pref-label">Auto rollover</span>
                    <span id="st-roll-d" className="st-pref-help">Unfinished tasks carry over to the next day's plan.</span>
                </div>
                <Switch checked={settings.autoRollover !== false} onChange={(v) => update({ autoRollover: v })} labelledBy="st-roll-l" describedBy="st-roll-d" />
            </div>
            <div className="st-pref">
                <div className="st-pref-text">
                    <span id="st-rem-l" className="st-pref-label">Session reminders</span>
                    <span id="st-rem-d" className="st-pref-help">Play a bell and show a notification when a focus session ends.</span>
                </div>
                <Switch checked={settings.sessionReminders !== false} onChange={(v) => update({ sessionReminders: v })} labelledBy="st-rem-l" describedBy="st-rem-d" />
            </div>
            <div className="st-pref is-last">
                <div className="st-pref-text">
                    <label htmlFor="st-goal" className="st-pref-label">Daily focus goal</label>
                    <span className="st-pref-help">Used for the goal ring on the dashboard and in analytics.</span>
                </div>
                <select id="st-goal" className="input st-select" value={goal} onChange={(e) => update({ dailyGoalMinutes: Number(e.target.value) })}>
                    {goalOptions.map((m) => <option key={m} value={m}>{formatGoal(m).replace(/h$/, ' hours').replace(/^1 hours$/, '1 hour')}</option>)}
                </select>
            </div>
        </section>
    );
};

const Settings = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { profile, loading, error } = useSelector((s) => s.user);
    const [active, setActive] = useState('profile');
    const [deleteOpen, setDeleteOpen] = useState(false);

    const onDeleted = () => {
        dispatch(logout());
        toast.success('Your account was deleted');
        navigate('/');
    };

    return (
        <div className="page">
            <div className="page-inner st-inner">
                <PageHeader title="Settings" subtitle="Manage your account and how Habitree plans your days." />

                <div className="st-wrap">
                <div className="st-layout">
                    <nav aria-label="Settings sections" className="st-nav">
                        {SECTIONS.map((s) => (
                            <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? 'true' : undefined} onClick={() => setActive(s.id)}>
                                {s.label}
                            </a>
                        ))}
                    </nav>

                    <div className="st-main">
                        {!profile ? (
                            <div className="st-card st-loading" aria-busy={loading}>
                                {error ? "Couldn't load your account. Refresh to try again." : 'Loading your account…'}
                            </div>
                        ) : (
                            <>
                                <ProfileForm key={`${profile._id}:${profile.username}:${profile.email}`} profile={profile} />
                                <Preferences profile={profile} />
                                <section id="danger" className="st-danger" aria-labelledby="st-danger-h">
                                    <div className="st-danger-text">
                                        <h2 id="st-danger-h">Delete account</h2>
                                        <span>Permanently removes your account, tasks, projects and roadmaps. This can't be undone.</span>
                                    </div>
                                    <button type="button" className="btn btn-danger" onClick={() => setDeleteOpen(true)}>Delete account…</button>
                                </section>
                            </>
                        )}
                    </div>
                </div>
                </div>
            </div>
            {deleteOpen && <DeleteAccountDialog onClose={() => setDeleteOpen(false)} onDeleted={onDeleted} />}
        </div>
    );
};

export default Settings;
