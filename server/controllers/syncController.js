const Project = require('../models/project');
const SyncChange = require('../models/syncChange');

const RETENTION_MS = 1000 * 60 * 60 * 24 * 29;

// @route   GET /api/sync/changes?since=ISO   header X-Device-Id
exports.getChanges = async (req, res) => {
    try {
        const now = new Date();
        const since = new Date(req.query.since || '');
        if (Number.isNaN(since.getTime()) || now - since > RETENTION_MS) {
            return res.json({ success: true, now: now.toISOString(), full: true, kinds: [] });
        }
        const device = req.get('X-Device-Id') || null;
        const projects = await Project.find({ $or: [{ owner: req.user.id }, { collaborators: req.user.id }] }).select('_id').lean();
        const changes = await SyncChange.find({
            $or: [{ userId: req.user.id }, { projectId: { $in: projects.map((p) => p._id) } }],
            at: { $gt: since, $lte: now },
            ...(device ? { device: { $ne: device } } : {}),
        }).select('kinds').lean();
        const kinds = [...new Set(changes.flatMap((c) => c.kinds))];
        res.json({ success: true, now: now.toISOString(), full: false, kinds });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
