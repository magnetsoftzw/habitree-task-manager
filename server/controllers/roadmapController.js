const Roadmap = require('../models/roadmap');
const Task = require('../models/task');

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
            { nodes, edges, zoom, pan, userId: req.user.id, skillName },
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

        res.json({ success: true, roadmaps });

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

        // Populate task data for each node so the frontend gets live progress/status
        const populatedNodes = await Promise.all(
            roadmap.nodes.map(async (node) => {
                const task = await Task.findOne({ _id: node.id, userId: req.user.id }).select('title status subtasks category scheduledDate groupId').populate('groupId', 'name color');
                if (!task) return node.toObject();

                const completedSubs = task.subtasks?.filter(s => s.isCompleted).length || 0;
                const totalSubs = task.subtasks?.length || 0;
                const progress = totalSubs > 0
                    ? Math.round((completedSubs / totalSubs) * 100)
                    : (task.status === 'Completed' ? 100 : 0);

                return {
                    ...node.toObject(),
                    data: {
                        ...node.data,
                        label: task.title,
                        progress,
                        status: task.status,
                        category: task.category,
                        dueDate: task.scheduledDate,
                        group: task.groupId ? { name: task.groupId.name, color: task.groupId.color } : null,
                    }
                };
            })
        );

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
            updates.nodes = nodes;
        }
        if (edges !== undefined) {
            if (!Array.isArray(edges)) return res.status(400).json({ success: false, message: 'edges must be an array', field: 'edges' });
            const ids = new Set((nodes || []).map((n) => String(n.id)));
            if (nodes && edges.some((e) => !ids.has(String(e.source)) || !ids.has(String(e.target)) || e.source === e.target)) {
                return res.status(400).json({ success: false, message: 'Edges must link two different nodes in this roadmap', field: 'edges' });
            }
            updates.edges = edges;
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