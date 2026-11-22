const jwt = require('jsonwebtoken');
const SyncChange = require('../models/syncChange');
const SyncReceipt = require('../models/syncReceipt');

const ID = '([a-f0-9]{24})';
const DATE = '(\\d{4}-\\d{2}-\\d{2})';
const MAX_SKEW_MS = 1000 * 60 * 60 * 24 * 30;

const RULES = [
    { re: new RegExp(`^/api/tasks/${ID}/subtasks/${ID}$`), describe: (m) => ({ kinds: ['tasks'], resources: [`task:${m[1]}`] }) },
    { re: new RegExp(`^/api/tasks/${ID}(/.*)?$`), describe: (m) => ({ kinds: ['tasks'], resources: [`task:${m[1]}`] }) },
    { re: /^\/api\/tasks\/?$/, describe: () => ({ kinds: ['tasks'] }) },
    { re: /^\/api\/groups/, describe: () => ({ kinds: ['groups', 'tasks'] }) },
    { re: new RegExp(`^/api/projects/${ID}/tasks/${ID}/subtasks/${ID}$`), describe: (m) => ({ projectId: m[1], kinds: [`projectTasks:${m[1]}`], resources: [`projectSubtask:${m[3]}`] }) },
    { re: new RegExp(`^/api/projects/${ID}/tasks/${ID}(/.*)?$`), describe: (m) => ({ projectId: m[1], kinds: [`projectTasks:${m[1]}`], resources: [`projectTask:${m[2]}`] }) },
    { re: new RegExp(`^/api/projects/${ID}/task-groups/${ID}$`), describe: (m) => ({ projectId: m[1], kinds: [`projectTasks:${m[1]}`], resources: [`projectTaskGroup:${m[2]}`] }) },
    { re: new RegExp(`^/api/projects/${ID}/(tasks|task-groups)`), describe: (m) => ({ projectId: m[1], kinds: [`projectTasks:${m[1]}`] }) },
    {
        re: new RegExp(`^/api/projects/${ID}/move$`),
        describe: (m, body) => ({ projectId: m[1], kinds: ['projects', `project:${m[1]}`, 'tasks'], resources: body?.taskId ? [`task:${body.taskId}`] : [] }),
    },
    { re: new RegExp(`^/api/projects/${ID}(/.*)?$`), describe: (m) => ({ projectId: m[1], kinds: ['projects', `project:${m[1]}`, 'tasks'], resources: [`project:${m[1]}`] }) },
    { re: /^\/api\/projects\/?$/, describe: () => ({ kinds: ['projects'] }) },
    { re: /^\/api\/planner\/rollover$/, describe: () => ({ kinds: ['planner'] }) },
    { re: new RegExp(`^/api/planner/${DATE}/${ID}$`), describe: (m) => ({ kinds: [`planner:${m[1]}`], resources: [`plannerEntry:${m[2]}`] }) },
    { re: new RegExp(`^/api/planner/${DATE}`), describe: (m) => ({ kinds: [`planner:${m[1]}`] }) },
    { re: /^\/api\/schedule\/template/, describe: () => ({ kinds: ['template'] }) },
    { re: new RegExp(`^/api/schedule/${DATE}`), describe: (m) => ({ kinds: [`schedule:${m[1]}`, `planner:${m[1]}`, 'tasks', 'projectTasks'] }) },
    { re: new RegExp(`^/api/roadmaps/${ID}$`), describe: (m) => ({ kinds: ['roadmaps'], resources: [`roadmap:${m[1]}`] }) },
    { re: /^\/api\/roadmaps/, describe: () => ({ kinds: ['roadmaps'] }) },
    { re: /^\/api\/sessions/, describe: () => ({ kinds: ['sessions'] }) },
    { re: /^\/api\/notifications/, describe: () => ({ kinds: ['notifications'] }) },
    { re: /^\/api\/users/, describe: () => ({ kinds: ['user'] }) },
];

const describe = (path, body) => {
    for (const rule of RULES) {
        const m = path.match(rule.re);
        if (m) return { kinds: [], resources: [], projectId: null, ...rule.describe(m, body) };
    }
    return null;
};

const userFromToken = (req) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return null;
    try {
        return jwt.verify(header.slice(7), process.env.JWT_SECRET).id || null;
    } catch {
        return null;
    }
};

const editedAtOf = (req) => {
    const edited = Date.parse(req.get('X-Edited-At') || '');
    if (Number.isNaN(edited)) return null;
    const clientNow = Date.parse(req.get('X-Client-Time') || '');
    const skew = Number.isNaN(clientNow) ? 0 : Date.now() - clientNow;
    return new Date(edited + (Math.abs(skew) < MAX_SKEW_MS ? skew : 0));
};

const syncLayer = () => async (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const userId = userFromToken(req);
    if (!userId) return next();
    const path = req.originalUrl.split('?')[0];
    const device = (req.get('X-Device-Id') || '').slice(0, 64) || null;
    const key = (req.get('Idempotency-Key') || '').slice(0, 100) || null;
    const info = describe(path, req.body);

    try {
        if (key) {
            const receipt = await SyncReceipt.findOne({ userId, key }).lean();
            if (receipt) return res.status(receipt.status).json(receipt.body);
        }

        const editedAt = editedAtOf(req);
        if (editedAt && info?.resources.length && req.method !== 'POST') {
            const newer = await SyncChange.exists({
                resources: { $in: info.resources },
                at: { $gt: editedAt },
                ...(device ? { device: { $ne: device } } : {}),
            });
            if (newer) {
                return res.status(409).json({ success: false, stale: true, message: 'This was changed on another device more recently, so the newer version was kept.' });
            }
        }
    } catch (error) {
        return next(error);
    }

    const json = res.json.bind(res);
    res.json = (body) => {
        const status = res.statusCode;
        const writes = [];
        if (key && status < 500) writes.push(SyncReceipt.create({ userId, key, status, body }));
        if (info && status < 400) writes.push(SyncChange.create({ userId, device, projectId: info.projectId, kinds: info.kinds, resources: info.resources }));
        if (!writes.length) return json(body);
        Promise.allSettled(writes).then(() => json(body));
        return res;
    };
    return next();
};

module.exports = { syncLayer, describe };
