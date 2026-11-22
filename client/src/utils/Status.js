const STATUS_MAP = {
    'Not Started': { label: 'Not started', tone: 'not-started' },
    'On-Going': { label: 'In progress', tone: 'in-progress' },
    'In Progress': { label: 'In progress', tone: 'in-progress' },
    'On-Hold': { label: 'On hold', tone: 'on-hold' },
    Shelved: { label: 'Shelved', tone: 'shelved' },
    Completed: { label: 'Done', tone: 'done' },
    not_started: { label: 'Not started', tone: 'not-started' },
    in_progress: { label: 'In progress', tone: 'in-progress' },
    done: { label: 'Done', tone: 'done' },
};

export const statusInfo = (status) => STATUS_MAP[status] || STATUS_MAP['Not Started'];

export const isDone = (status) => status === 'Completed' || status === 'done';

export const taskProgress = (task) => {
    if (!task) return 0;
    const subs = task.subtasks || [];
    if (subs.length === 0) return isDone(task.status) ? 100 : 0;
    const done = subs.filter((s) => s.isCompleted || s.done).length;
    return Math.round((done / subs.length) * 100);
};
