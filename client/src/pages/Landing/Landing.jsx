import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    ArrowRight, BarChart3, CalendarDays, Columns3, Download, RefreshCw, Route, Smartphone, Sparkles, Timer,
} from 'lucide-react';
import BrandMark from '../../components/ui/BrandMark';
import LandingPreview from './LandingPreview';
import './Landing.css';

const APK_URL = import.meta.env.VITE_APK_URL;
const APK_NOTE = import.meta.env.VITE_APK_NOTE;

const FEATURES = [
    { icon: Timer, title: 'Session-driven flow', body: 'Track productive time as focus sessions. Task status updates on its own as you work, so your list is always current.' },
    { icon: Columns3, title: 'Kanban that keeps up', body: 'Projects live on a Kanban board with built-in triggers, so cards move from Not started to Done as sessions happen.' },
    { icon: Route, title: 'Skill roadmaps', body: 'Map out a learning path as connected nodes and see how far along each skill you are.' },
    { icon: CalendarDays, title: 'Daily planning', body: 'Build today’s plan from your task list and see it on a calendar alongside the rest of your week.' },
    { icon: BarChart3, title: 'Analytics', body: 'Focus time against your daily goal, completion rate, and weekly and monthly trends in one place.' },
    { icon: RefreshCw, title: 'Synced everywhere', body: 'Real-time sync across web and mobile, so there is one source of truth wherever you pick up.' },
];

const STEPS = [
    { title: 'Collect your tasks', body: 'Add what you want to watch, read or practise, and sort it into groups like React Native or Forex.' },
    { title: 'Plan the day, then focus', body: "Drop tasks into today's plan and start a session. Habitree times it and moves the task along for you." },
    { title: 'Watch it grow', body: 'See focus time against your daily goal, weekly trends, and how far along each skill roadmap you are.' },
];

const STACK = [
    { name: 'MongoDB', role: 'Database' },
    { name: 'Express', role: 'API server' },
    { name: 'React', role: 'Web app' },
    { name: 'Node.js', role: 'Runtime' },
];

const Landing = () => {
    const signedIn = useSelector((s) => s.auth.isAuthenticated);
    const appLink = signedIn ? '/dashboard' : '/register';

    return (
        <div className="ld">
            <a href="#ld-main" className="ld-skip">Skip to content</a>
            <header className="ld-header">
                <div className="ld-wrap ld-header-inner">
                    <Link to="/" className="ld-logo">
                        <span className="ld-logo-mark"><BrandMark /></span>
                        <span>Habitree</span>
                    </Link>
                    <nav aria-label="Main" className="ld-nav">
                        <a href="#features">Features</a>
                        <a href="#how">How it works</a>
                        <a href="#stack">Technology</a>
                        <a href="#download">Download</a>
                    </nav>
                    <div className="ld-auth">
                        {signedIn ? (
                            <Link to="/dashboard" className="ld-btn ld-btn-primary">Open dashboard</Link>
                        ) : (
                            <>
                                <Link to="/login" className="ld-btn ld-btn-ghost">Log in</Link>
                                <Link to="/register" className="ld-btn ld-btn-primary">Get started</Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main id="ld-main">
                <section className="ld-hero">
                    <div className="ld-wrap ld-hero-inner">
                        <span className="ld-badge"><Sparkles size={14} strokeWidth={2.2} aria-hidden="true" /> Your unified productivity manager</span>
                        <h1>Grow your skills one focused session at a time.</h1>
                        <p>Plan your day, track every focus session, and watch progress build across your projects and skill roadmaps — on the web and on Android.</p>
                        <div className="ld-hero-ctas">
                            <Link to={signedIn ? '/roadmaps' : '/register'} className="ld-btn ld-btn-primary ld-btn-lg">
                                Start your first roadmap <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
                            </Link>
                            <a href="#download" className="ld-btn ld-btn-outline ld-btn-lg">
                                <Smartphone size={16} aria-hidden="true" /> Get the Android app
                            </a>
                        </div>
                        <div className="ld-preview-frame">
                            <LandingPreview />
                        </div>
                    </div>
                </section>

                <section id="features" className="ld-section ld-alt">
                    <div className="ld-wrap ld-stack">
                        <div className="ld-intro">
                            <span className="ld-eyebrow">Features</span>
                            <h2>Everything between “I want to learn this” and “I did it.”</h2>
                        </div>
                        <div className="ld-features">
                            {FEATURES.map((f) => (
                                <div key={f.title} className="ld-feature">
                                    <span className="ld-feature-icon"><f.icon size={22} aria-hidden="true" /></span>
                                    <h3>{f.title}</h3>
                                    <p>{f.body}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="how" className="ld-section">
                    <div className="ld-wrap ld-stack">
                        <div className="ld-intro">
                            <span className="ld-eyebrow">How it works</span>
                            <h2>Three steps, every day.</h2>
                        </div>
                        <ol className="ld-steps">
                            {STEPS.map((s, i) => (
                                <li key={s.title}>
                                    <span className="ld-step-n">{String(i + 1).padStart(2, '0')}</span>
                                    <h3>{s.title}</h3>
                                    <p>{s.body}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                <section id="stack" className="ld-section ld-alt ld-stack-section">
                    <div className="ld-wrap ld-tech">
                        <div className="ld-intro ld-tech-intro">
                            <span className="ld-eyebrow">Technology</span>
                            <h2 className="ld-h2-sm">Built on a modern stack for performance and scale.</h2>
                        </div>
                        <ul className="ld-tech-list">
                            {STACK.map((t) => (
                                <li key={t.name}>
                                    <span>{t.name}</span>
                                    <small>{t.role}</small>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                <section id="download" className="ld-section">
                    <div className="ld-wrap">
                        <div className="ld-download">
                            <div className="ld-download-text">
                                <span className="ld-eyebrow">Android app</span>
                                <h2>Take your sessions with you.</h2>
                                <p>Start a session on your phone and pick it up on the web. Everything stays in sync.</p>
                            </div>
                            <div className="ld-download-cta">
                                {APK_URL ? (
                                    <a href={APK_URL} className="ld-apk" download>
                                        <Download size={18} strokeWidth={2.2} aria-hidden="true" /> Download the APK
                                    </a>
                                ) : (
                                    <span className="ld-apk is-disabled" aria-disabled="true">
                                        <Download size={18} strokeWidth={2.2} aria-hidden="true" /> APK coming soon
                                    </span>
                                )}
                                <span className="ld-apk-note">
                                    {APK_URL ? `For Android phones${APK_NOTE ? ` · ${APK_NOTE}` : ''}` : 'Use the web app in the meantime.'}
                                </span>
                                {!APK_URL && <Link to={appLink} className="ld-apk-alt">Open the web app <ArrowRight size={14} aria-hidden="true" /></Link>}
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="ld-footer">
                <div className="ld-wrap ld-footer-inner">
                    <span className="ld-footer-brand">Habitree</span>
                    <span className="ld-footer-copy">© Habitree Task Manager. Developed by Mark Sharmy.</span>
                    <nav aria-label="Footer" className="ld-footer-nav">
                        <a href="#features">Features</a>
                        <a href="#download">Download</a>
                        <Link to={signedIn ? '/dashboard' : '/login'}>{signedIn ? 'Dashboard' : 'Log in'}</Link>
                    </nav>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
