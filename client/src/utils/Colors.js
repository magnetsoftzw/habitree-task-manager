export const IDENTITY_PALETTE = ['#C2410C', '#1F5FAD', '#1E6B47', '#C2185B', '#0E7C7B', '#6B5BD2', '#B45309', '#4D7C0F'];

export const UNCATEGORIZED_COLOR = '#6B7280';

export const KANBAN_DOTS = {
    backendBacklog: '#9AA39C',
    frontendBacklog: '#9AA39C',
    mobileBacklog: '#9AA39C',
    design: '#6B5BD2',
    issues: '#C2410C',
    todo: '#6B7280',
    doing: '#D99A2B',
    testing: '#1F5FAD',
    done: '#1E6B47',
};

const hash = (value = '') => {
    let h = 0;
    for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
    return h;
};

export const colorFor = (entity) => {
    if (!entity) return UNCATEGORIZED_COLOR;
    if (entity.color) return entity.color;
    return IDENTITY_PALETTE[hash(String(entity._id || entity.name || '')) % IDENTITY_PALETTE.length];
};
