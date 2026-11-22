import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { clearAuthError, loginUser } from '../../store/slices/authSlice';
import AuthLayout from './AuthLayout';
import PasswordInput from './PasswordInput';

const LoginPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading, error, isAuthenticated } = useSelector((state) => state.auth);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(true);
    const [missing, setMissing] = useState(null);

    useEffect(() => {
        if (isAuthenticated) navigate('/dashboard', { replace: true });
    }, [isAuthenticated, navigate]);

    useEffect(() => () => {
        dispatch(clearAuthError());
    }, [dispatch]);

    const submit = (e) => {
        e.preventDefault();
        if (!email.trim()) return setMissing('email');
        if (!password) return setMissing('password');
        setMissing(null);
        dispatch(loginUser({ email: email.trim(), password, remember }));
    };

    return (
        <AuthLayout
            heading="Welcome back. Let's keep it growing."
            lead="Pick up today's plan, start a focus session, and see where your roadmaps stand."
        >
            <div className="auth-head">
                <h2>Log in</h2>
                <p>Enter your email and password to open your dashboard.</p>
            </div>
            <form className="auth-form" onSubmit={submit} noValidate>
                {error && <p className="auth-error" role="alert">{error}</p>}
                <div className="auth-field">
                    <label htmlFor="login-email">Email</label>
                    <input
                        id="login-email"
                        className="auth-input"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        aria-invalid={missing === 'email'}
                        aria-describedby={missing === 'email' ? 'login-email-err' : undefined}
                    />
                    {missing === 'email' && <span id="login-email-err" className="auth-field-error">Enter your email.</span>}
                </div>
                <div className="auth-field">
                    <label htmlFor="login-password">Password</label>
                    <PasswordInput
                        id="login-password"
                        autoComplete="current-password"
                        placeholder="Your password"
                        value={password}
                        onChange={setPassword}
                        invalid={missing === 'password'}
                        describedBy={missing === 'password' ? 'login-pw-err' : undefined}
                    />
                    {missing === 'password' && <span id="login-pw-err" className="auth-field-error">Enter your password.</span>}
                </div>
                <label className="auth-check">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    Keep me logged in
                </label>
                <button type="submit" className="auth-submit" disabled={loading}>
                    {loading ? 'Logging in…' : 'Log in'}
                    {!loading && <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />}
                </button>
            </form>
            <div className="auth-foot">
                <span>New to Habitree? <Link to="/register">Create an account</Link></span>
                <Link to="/" className="auth-back"><ArrowLeft size={14} aria-hidden="true" /> Back to home</Link>
            </div>
        </AuthLayout>
    );
};

export default LoginPage;
