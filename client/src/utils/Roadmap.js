export const isNodeDone = (node) => node?.data?.status === 'Completed' || (node?.data?.progress ?? 0) >= 100;

const nodeProgress = (node) => (isNodeDone(node) ? 100 : Math.max(0, Math.min(100, node?.data?.progress || 0)));

export const roadmapProgress = (nodes = []) => {
    if (!nodes.length) return 0;
    return Math.round(nodes.reduce((sum, n) => sum + nodeProgress(n), 0) / nodes.length);
};

export const stepsDone = (nodes = []) => nodes.filter(isNodeDone).length;

export const nextNode = (nodes = [], edges = []) => {
    const done = new Set(nodes.filter(isNodeDone).map((n) => n.id));
    return nodes.find((n) => !done.has(n.id)
        && edges.filter((e) => e.target === n.id).every((e) => done.has(e.source)));
};

export const roadmapHint = (roadmap) => {
    const nodes = roadmap.nodes || [];
    const edges = roadmap.edges || [];
    if (!nodes.length) return 'Add tasks from your list as the first steps.';
    if (nodes.length === 1) return 'Add another task to turn this into a path.';
    if (!edges.length) return `Link the ${nodes.length === 2 ? 'two tasks' : 'tasks'} to set the order you'll learn them.`;
    if (roadmapProgress(nodes) === 100) return 'Every step is done. Time for the next skill.';
    const next = nextNode(nodes, edges);
    return next ? `Next up: ${next.data?.label || 'Untitled task'}` : 'Keep going: finish a step to unlock the next one.';
};

export const previewLayout = (nodes = [], width = 340, height = 180, nodeW = 128, nodeH = 44, pad = 24) => {
    if (!nodes.length) return [];
    const xs = nodes.map((n) => n.position?.x || 0);
    const ys = nodes.map((n) => n.position?.y || 0);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(...xs) - minX;
    const spanY = Math.max(...ys) - minY;
    const availX = Math.max(0, width - nodeW - pad * 2);
    const availY = Math.max(0, height - nodeH - pad * 2);
    const place = (v, min, span, avail, size, full) => (span ? pad + ((v - min) / span) * avail : (full - size) / 2);
    return nodes.map((n) => ({
        id: n.id,
        label: n.data?.label || 'Untitled task',
        done: isNodeDone(n),
        progress: n.data?.progress || 0,
        x: place(n.position?.x || 0, minX, spanX, availX, nodeW, width),
        y: place(n.position?.y || 0, minY, spanY, availY, nodeH, height),
    }));
};
