import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
    LayoutDashboard, ListChecks, Folder, Route, CalendarDays, Settings, LogOut, Menu, Moon, Sun, X,
} from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import BrandMark from '../ui/BrandMark';
import { colorFor } from '../../utils/Colors';
import './Sidebar.css';

const AnalyticsIcon = (props) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M21 20H3" />
    </svg>
);

const Sidebar = ({ user, counts = {}, projects = [], onLogout }) => {
    const [open, setOpen] = useState(false);
    const close = () => setOpen(false);
    const { theme, toggle } = useTheme();
    const isDark = theme === 'dark';

    const nav = [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/tasks', label: 'Tasks', icon: ListChecks, count: counts.tasks },
        { to: '/projects', label: 'Projects', icon: Folder, count: counts.projects, end: true },
        { to: '/roadmaps', label: 'Roadmaps', icon: Route, count: counts.roadmaps, end: true },
        { to: '/calendar', label: 'Calendar', icon: CalendarDays },
        { to: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
    ];

    const initial = (user?.username || '?').charAt(0).toUpperCase();

    return (
        <nav className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Main">
            <div className="sidebar-top">
                <Link to="/" className="sidebar-brand" onClick={close}>
                    <span className="sidebar-logo">
                        <BrandMark />
                    </span>
                    <span className="sidebar-wordmark">Habitree</span>
                </Link>
                <span className="sidebar-top-actions">
                    <button
                        type="button"
                        className="sidebar-theme-btn"
                        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                        title={isDark ? 'Light theme' : 'Dark theme'}
                        onClick={toggle}
                    >
                        {isDark ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                <button
                    type="button"
                    className="sidebar-menu-btn"
                    aria-label={open ? 'Close menu' : 'Open menu'}
                    aria-expanded={open}
                    onClick={() => setOpen((v) => !v)}
                >
                    {open ? <X size={20} /> : <Menu size={20} />}
                </button>
                </span>
            </div>

            <div className="sidebar-body">
                <div className="sidebar-section">
                    <span className="sidebar-overline">Workspace</span>
                    {nav.map((item) => {
                        const Icon = item.icon;
                        return (
                            <NavLink key={item.to} to={item.to} end={item.end} className="sidebar-link" onClick={close}>
                                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                                <span className="sidebar-link-label">{item.label}</span>
                                <span className="sidebar-count">{item.count || ''}</span>
                            </NavLink>
                        );
                    })}
                </div>

                {projects.length > 0 && (
                    <div className="sidebar-section">
                        <span className="sidebar-overline">Projects</span>
                        {projects.map((p) => (
                            <NavLink key={p._id} to={`/projects/${p._id}`} className="sidebar-project" onClick={close}>
                                <span className="sidebar-project-dot" style={{ background: colorFor(p) }} />
                                <span className="sidebar-project-name">{p.name}</span>
                            </NavLink>
                        ))}
                    </div>
                )}

                <div className="sidebar-footer">
                    <NavLink to="/settings" className="sidebar-link" onClick={close}>
                        <Settings size={18} strokeWidth={2} aria-hidden="true" />
                        Settings
                    </NavLink>
                    <div className="sidebar-user">
                        <div className="sidebar-avatar" aria-hidden="true">{initial}</div>
                        <div className="sidebar-user-text">
                            <span className="sidebar-user-name">{user?.username || '—'}</span>
                            <span className="sidebar-user-role">{user?.role || ''}</span>
                        </div>
                        <button type="button" className="sidebar-icon-btn" aria-label="Log out" onClick={onLogout}>
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Sidebar;
