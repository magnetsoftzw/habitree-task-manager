import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { clearAuthError, registerUser } from '../../store/slices/authSlice';
import AuthLayout from './AuthLayout';
import PasswordInput from './PasswordInput';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = ({ username, email, password, confirm }) => {
    const errors = {};
    if (!username.trim()) errors.username = 'Choose a username.';
    if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address.';
    if (password.length < 6) errors.password = 'Use at least 6 characters.';
    if (confirm !== password) errors.confirm = "Passwords don't match.";
    return errors;
};

const RegisterPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading, error, isAuthenticated } = useSelector((state) => state.auth);
    const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isAuthenticated) navigate('/dashboard', { replace: true });
    }, [isAuthenticated, navigate]);

    useEffect(() => () => {
        dispatch(clearAuthError());
    }, [dispatch]);

    const set = (key) => (value) => {
        setForm((f) => ({ ...f, [key]: value }));
        if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    };

    const submit = (e) => {
        e.preventDefault();
        const next = validate(form);
        setErrors(next);
        if (Object.keys(next).length) return;
        dispatch(registerUser({ username: form.username.trim(), email: form.email.trim(), password: form.password }));
    };

    const field = (key, label, input) => (
        <div className="auth-field">
            <label htmlFor={`reg-${key}`}>{label}</label>
            {input}
            {errors[key] && <span id={`reg-${key}-err`} className="auth-field-error">{errors[key]}</span>}
        </div>
    );

    const describe = (key) => (errors[key] ? `reg-${key}-err` : undefined);

    return (
        <AuthLayout
            heading="Plant a habit. Watch it grow."
            lead="Plan your days, track focus time, and map skills as roadmaps of connected tasks."
        >
            <div className="auth-head">
                <h2>Create your account</h2>
                <p>It takes less than a minute. You can change these details later in Settings.</p>
            </div>
            <form className="auth-form" onSubmit={submit} noValidate>
                {error && <p className="auth-error" role="alert">{error}</p>}
                {field('username', 'Username', (
                    <input id="reg-username" className="auth-input" autoComplete="username" placeholder="e.g. alex" value={form.username} onChange={(e) => set('username')(e.target.value)} aria-invalid={!!errors.username} aria-describedby={describe('username')} />
                ))}
                {field('email', 'Email', (
                    <input id="reg-email" className="auth-input" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => set('email')(e.target.value)} aria-invalid={!!errors.email} aria-describedby={describe('email')} />
                ))}
                {field('password', 'Password', (
                    <PasswordInput id="reg-password" autoComplete="new-password" placeholder="At least 6 characters" value={form.password} onChange={set('password')} invalid={!!errors.password} describedBy={describe('password')} />
                ))}
                {field('confirm', 'Confirm password', (
                    <PasswordInput id="reg-confirm" autoComplete="new-password" placeholder="Type it again" value={form.confirm} onChange={set('confirm')} invalid={!!errors.confirm} describedBy={describe('confirm')} />
                ))}
                <button type="submit" className="auth-submit" disabled={loading}>
                    {loading ? 'Creating account…' : 'Create account'}
                    {!loading && <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />}
                </button>
            </form>
            <div className="auth-foot">
                <span>Already have an account? <Link to="/login">Log in</Link></span>
                <Link to="/" className="auth-back"><ArrowLeft size={14} aria-hidden="true" /> Back to home</Link>
            </div>
        </AuthLayout>
    );
};

export default RegisterPage;
