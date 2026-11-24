const { withClientId } = require('../utils/clientId');
const Roadmap = require('../models/roadmap');
const Task = require('../models/task');
const { liveNodes } = require('../utils/roadmapNodes');

// @desc    Create or Update a Roadmap (Save Canvas State)
// @route   POST /api/roadmaps
exports.saveRoadmap = async (req, res) => {
    try {
        const { skillName, nodes, edges, zoom, pan } = req.body;

        if (!skillName) {
            return res.status(400).json({ success: false, message: 'skillName is required' });
        }

        const roadmap = await Roadmap.findOneAndUpdate(
            { userId: req.user.id, skillName },
            { nodes, edges, zoom, pan, userId: req.user.id, skillName, ...(withClientId(req.body)._id && { $setOnInsert: withClientId(req.body) }) },
            { upsert: true, new: true, runValidators: true }
        );

        res.json({ success: true, roadmap });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all roadmaps for the user, sorted by most recently updated
// @route   GET /api/roadmaps
exports.getUserRoadmaps = async (req, res) => {
    try {
        const roadmaps = await Roadmap.find({ userId: req.user.id })
            .select('skillName updatedAt nodes edges')
            .sort({ updatedAt: -1 });

        const fresh = await liveNodes(roadmaps.flatMap((r) => r.nodes), req.user.id);
        let i = 0;
        const result = roadmaps.map((r) => {
            const nodes = fresh.slice(i, i + r.nodes.length);
            i += r.nodes.length;
            return { ...r.toObject(), nodes };
        });

        res.json({ success: true, roadmaps: result });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get a specific roadmap with full node/edge data
// @route   GET /api/roadmaps/:id
exports.getRoadmapById = async (req, res) => {
    try {
        const roadmap = await Roadmap.findOne({ _id: req.params.id, userId: req.user.id });

        if (!roadmap) {
            return res.status(404).json({ success: false, message: 'Roadmap not found' });
        }

        const populatedNodes = await liveNodes(roadmap.nodes, req.user.id, { withDetails: true });

        res.json({
            success: true,
            roadmap: { ...roadmap.toObject(), nodes: populatedNodes }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update roadmap name and/or canvas (nodes, edges, viewport)
// @route   PUT /api/roadmaps/:id
exports.updateRoadmap = async (req, res) => {
    try {
        const { skillName, nodes, edges, zoom, pan } = req.body;
        const updates = {};

        if (skillName !== undefined) {
            if (typeof skillName !== 'string' || !skillName.trim()) {
                return res.status(400).json({ success: false, message: 'skillName is required', field: 'skillName' });
            }
            updates.skillName = skillName.trim();
        }
        if (nodes !== undefined) {
            if (!Array.isArray(nodes)) return res.status(400).json({ success: false, message: 'nodes must be an array', field: 'nodes' });
            const owned = await Task.countDocuments({ _id: { $in: nodes.map((n) => n.id) }, userId: req.user.id });
            if (owned !== new Set(nodes.map((n) => String(n.id))).size) {
                return res.status(400).json({ success: false, message: 'Every node must be one of your tasks', field: 'nodes' });
            }
            updates.nodes = await liveNodes(nodes, req.user.id);
        }
        if (edges !== undefined) {
            if (!Array.isArray(edges)) return res.status(400).json({ success: false, message: 'edges must be an array', field: 'edges' });
            const ids = new Set((nodes || []).map((n) => String(n.id)));
            if (nodes && edges.some((e) => !ids.has(String(e.source)) || !ids.has(String(e.target)) || e.source === e.target)) {
                return res.status(400).json({ success: false, message: 'Edges must link two different nodes in this roadmap', field: 'edges' });
            }
            const SIDES = ['top', 'right', 'bottom', 'left'];
            const side = (v) => (SIDES.includes(v) ? v : null);
            updates.edges = edges.map((e) => ({
                id: e.id, source: e.source, target: e.target, label: e.label,
                sourceHandle: side(e.sourceHandle), targetHandle: side(e.targetHandle),
            }));
        }
        if (zoom !== undefined) updates.zoom = zoom;
        if (pan !== undefined) updates.pan = pan;

        const roadmap = await Roadmap.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!roadmap) {
            return res.status(404).json({ success: false, message: 'Roadmap not found' });
        }

        res.json({ success: true, roadmap });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete a roadmap
// @route   DELETE /api/roadmaps/:id
exports.deleteRoadmap = async (req, res) => {
    try {
        const roadmap = await Roadmap.findOneAndDelete({ _id: req.params.id, userId: req.user.id });

        if (!roadmap) {
            return res.status(404).json({ success: false, message: 'Roadmap not found' });
        }

        res.json({ success: true, message: 'Roadmap deleted successfully' });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};