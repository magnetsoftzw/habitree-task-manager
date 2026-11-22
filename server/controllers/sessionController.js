const mongoose = require('mongoose');
const Session = require('../models/session');
const Task = require('../models/task');
const ProjectTask = require('../models/projectTask');
const { findAccessibleProject } = require('../utils/projectAccess');

const resolveSessionTask = async (userId, { taskType, taskId, projectId }) => {
    if (!taskType || !taskId) return {};
    if (!mongoose.isValidObjectId(taskId)) return { error: 'taskId must be a valid id' };

    if (taskType === 'projectTask') {
        if (!projectId) return { error: 'projectId is required for project tasks' };
        const project = await findAccessibleProject(projectId, userId);
        const task = project && await ProjectTask.findOne({ _id: taskId, projectId });
        if (!task) return { error: 'Task not found', status: 404 };
        return { taskType, taskId: task._id, projectId: project._id, titleSnapshot: task.title };
    }

    if (taskType !== 'task') return { error: "taskType must be 'task' or 'projectTask'" };
    const task = await Task.findById(taskId).select('userId projectId title');
    if (!task) return { error: 'Task not found', status: 404 };
    if (String(task.userId) !== String(userId)) {
        const project = task.projectId && await findAccessibleProject(task.projectId, userId);
        if (!project) return { error: 'Task not found', status: 404 };
    }
    return { taskType: 'task', taskId: task._id, projectId: task.projectId || null, titleSnapshot: task.title };
};

// @desc    Create a new completed session (sent from Web/Mobile)
// @route   POST /api/sessions/save
exports.saveSession = async (req, res) => {
    try {
        const { startTime, endTime, durationMinutes } = req.body;

        const ref = await resolveSessionTask(req.user.id, req.body);
        if (ref.error) return res.status(ref.status || 400).json({ success: false, message: ref.error });
        delete ref.error;

        const newSession = await Session.create({
            userId: req.user.id,
            startTime,
            endTime,
            durationMinutes,
            status: 'Completed',
            ...ref,
        });

        if (req.io) {
            req.io.to(String(req.user.id)).emit('statsUpdated');
        }

        res.status(201).json({ success: true, session: newSession });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Sync offline sessions from mobile
// @route   POST /api/sessions/sync
exports.syncMobileSessions = async (req, res) => {
    try {
        const { actionQueue } = req.body;

        if (!Array.isArray(actionQueue)) {
            return res.status(400).json({ success: false, message: "actionQueue must be an array" });
        }

        const results = { synced: [], conflicts: [], skipped: 0 };

        for (const mobileSess of actionQueue) {
            const existing = await Session.findOne({ mobileSyncId: mobileSess.mobileId });
            if (existing) {
                results.skipped++;
                continue;
            }

            const overlap = await Session.findOne({
                userId: req.user.id,
                startTime: { $lt: new Date(mobileSess.endTime) },
                endTime: { $gt: new Date(mobileSess.startTime) }
            });

            if (overlap) {
                results.conflicts.push({ ...mobileSess, existingSessionId: overlap._id, reason: "Time Overlap" });
                continue;
            }

            const ref = await resolveSessionTask(req.user.id, mobileSess);
            const newSession = await Session.create({
                userId: req.user.id,
                startTime: mobileSess.startTime,
                endTime: mobileSess.endTime,
                durationMinutes: mobileSess.durationMinutes,
                status: "Completed",
                mobileSyncId: mobileSess.mobileId,
                ...(ref.error ? {} : ref),
            });

            results.synced.push(newSession._id);
        }

        if (results.synced.length > 0 && req.io) {
            req.io.to(String(req.user.id)).emit('statsUpdated', {
                message: "Mobile sessions synced successfully"
            });
        }

        res.json({
            success: true,
            message: "Sync processing complete",
            results
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @route   POST /api/sessions/resolve-conflict
exports.resolveConflict = async (req, res) => {
    try {
        const { action, mobileSession, existingSessionId } = req.body;

        if (action === 'OVERWRITE') {
            if (!mobileSession) return res.status(400).json({ success: false, message: 'mobileSession is required' });
            const ref = await resolveSessionTask(req.user.id, mobileSession);

            await Session.findOneAndDelete({ _id: existingSessionId, userId: req.user.id });
            const newSession = await Session.create({
                startTime: mobileSession.startTime,
                endTime: mobileSession.endTime,
                durationMinutes: mobileSession.durationMinutes,
                status: 'Completed',
                mobileSyncId: mobileSession.mobileId,
                ...(ref.error ? {} : ref),
                userId: req.user.id,
            });
            return res.json({ success: true, session: newSession });
        }

        if (action === 'DISCARD') {
            return res.json({ success: true, message: "Conflict discarded" });
        }

        res.status(400).json({ success: false, message: "action must be 'OVERWRITE' or 'DISCARD'" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
