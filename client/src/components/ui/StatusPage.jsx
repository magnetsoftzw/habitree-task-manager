import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BrandMark from './BrandMark';
import './StatusPage.css';

const StatusPage = ({ code, title, message }) => {
    const navigate = useNavigate();
    const signedIn = useSelector((state) => state.auth.isAuthenticated);

    return (
        <main className="status-page">
            <Link to="/" className="status-logo">
                <span className="status-logo-mark"><BrandMark /></span>
                Habitree
            </Link>
            <div className="status-body">
                <span className="status-code tabular">{code}</span>
                <h1 className="status-title">{title}</h1>
                <p className="status-message">{message}</p>
                <div className="status-actions">
                    <button type="button" className="btn" onClick={() => navigate(-1)}>
                        <ArrowLeft size={16} aria-hidden="true" /> Go back
                    </button>
                    <Link to={signedIn ? '/dashboard' : '/'} className="btn btn-primary">
                        {signedIn ? 'Open dashboard' : 'Go to home page'}
                    </Link>
                </div>
            </div>
        </main>
    );
};

export default StatusPage;
