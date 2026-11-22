import { Link } from 'react-router-dom';
import BrandMark from '../../components/ui/BrandMark';
import './Auth.css';

const PREVIEW_BARS = [40, 58, 25, 75, 52, 6, 6];

const AuthLayout = ({ heading, lead, children }) => (
    <div className="auth">
        <section className="auth-brand" aria-label="About Habitree">
            <Link to="/" className="auth-logo">
                <span className="auth-logo-mark"><BrandMark /></span>
                <span className="auth-wordmark">Habitree</span>
            </Link>
            <div className="auth-pitch">
                <h1>{heading}</h1>
                <p>{lead}</p>
            </div>
            <div className="auth-preview" aria-hidden="true">
                <div className="auth-preview-head">
                    <span>Focus session</span>
                    <span>25 / 5 min</span>
                </div>
                <span className="auth-preview-timer">25:00</span>
                <div className="auth-preview-bars">
                    {PREVIEW_BARS.map((h, i) => (
                        <span key={i} className={i === 4 ? 'is-today' : i > 4 ? 'is-future' : ''} style={{ height: `${h}%` }} />
                    ))}
                </div>
            </div>
        </section>
        <main className="auth-main">
            <div className="auth-panel">{children}</div>
        </main>
    </div>
);

export default AuthLayout;
