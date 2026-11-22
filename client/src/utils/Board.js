import { KANBAN_DOTS } from './Colors';

export const COLUMN_KEYS = [
    'backendBacklog', 'frontendBacklog', 'mobileBacklog',
    'design', 'issues', 'todo', 'doing', 'testing', 'done',
];

export const WORKFLOW_KEYS = ['todo', 'doing', 'testing', 'done'];

export const COLUMN_LABELS = {
    backendBacklog: 'Backend backlog',
    frontendBacklog: 'Frontend backlog',
    mobileBacklog: 'Mobile backlog',
    design: 'Design',
    issues: 'Issues',
    todo: 'Todo',
    doing: 'Doing',
    testing: 'Testing',
    done: 'Done',
};

export const columnDot = (key) => KANBAN_DOTS[key] || 'var(--text-faint)';

export const CARD_TAGS = ['Backend', 'Frontend', 'Mobile', 'Design', 'Bug'];

const COLUMN_TAG = {
    backendBacklog: 'Backend',
    frontendBacklog: 'Frontend',
    mobileBacklog: 'Mobile',
    design: 'Design',
    issues: 'Bug',
};

export const cardTag = (card, columnKey) => card.track || COLUMN_TAG[columnKey] || null;

export const formatHours = (minutes = 0) => {
    const m = Math.round(minutes);
    if (m <= 0) return '0h';
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (!h) return `${r}m`;
    return r ? `${h}h ${String(r).padStart(2, '0')}m` : `${h}h`;
};

export const countCards = (kanban = {}) => COLUMN_KEYS.reduce((sum, k) => sum + (kanban[k]?.length || 0), 0);
