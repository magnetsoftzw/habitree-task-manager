const { withClientId } = require('../utils/clientId');
const mongoose = require('mongoose');
const ProjectTaskGroup = require('../models/projectTaskGroup');
const ProjectTask = require('../models/projectTask');
const Planner = require('../models/planner');
const { findAccessibleProject } = require('../utils/projectAccess');

const fail = (res, status, message, field) =>
    res.status(status).json({ success: false, message, ...(field && { field }) });

const validateName = (name) => {
    if (typeof name !== 'string' || !name.trim()) return 'Group name is required';
    if (name.trim().length > 60) return 'Group name must be 60 characters or fewer';
    return null;
};

const emit = (req, event, payload) => {
    if (req.io) req.io.to(String(req.params.projectId)).emit(event, { projectId: String(req.params.projectId), ...payload });
};

const handle = (fn) => async (req, res) => {
    try {
        if (!(await findAccessibleProject(req.params.projectId, req.user.id))) return fail(res, 404, 'Project not found');
        await fn(req, res);
    } catch (error) {
        fail(res, 500, error.message);
    }
};

const loadGroup = async (req, res) => {
    const group = mongoose.isValidObjectId(req.params.groupId)
        && await ProjectTaskGroup.findOne({ _id: req.params.groupId, projectId: req.params.projectId });
    if (!group) fail(res, 404, 'Group not found');
    return group || null;
};

// @route   GET /api/projects/:projectId/task-groups
exports.listGroups = handle(async (req, res) => {
    const groups = await ProjectTaskGroup.find({ projectId: req.params.projectId }).sort({ createdAt: 1, _id: 1 });
    res.json({ success: true, groups });
});

// @route   POST /api/projects/:projectId/task-groups
exports.createGroup = handle(async (req, res) => {
    const invalid = validateName(req.body.name);
    if (invalid) return fail(res, 400, invalid, 'name');
    const group = await ProjectTaskGroup.create({ ...withClientId(req.body), projectId: req.params.projectId, name: req.body.name.trim(), createdBy: req.user.id });
    emit(req, 'projectTaskGroup:created', { group });
    res.status(201).json({ success: true, group });
});

// @route   PUT /api/projects/:projectId/task-groups/:groupId
exports.updateGroup = handle(async (req, res) => {
    const invalid = validateName(req.body.name);
    if (invalid) return fail(res, 400, invalid, 'name');
    const group = await loadGroup(req, res);
    if (!group) return;
    group.name = req.body.name.trim();
    await group.save();
    emit(req, 'projectTaskGroup:updated', { group });
    res.json({ success: true, group });
});

// @route   DELETE /api/projects/:projectId/task-groups/:groupId
exports.deleteGroup = handle(async (req, res) => {
    const group = await loadGroup(req, res);
    if (!group) return;
    await ProjectTask.updateMany({ projectId: req.params.projectId, groupId: group._id }, { $set: { groupId: null } });
    await group.deleteOne();
    await Planner.updateMany(
        { date: { $gte: new Date().toISOString().split('T')[0] }, 'tasks.taskId': group._id },
        { $pull: { tasks: { taskType: 'projectTaskGroup', taskId: group._id } } },
    );
    emit(req, 'projectTaskGroup:deleted', { groupId: String(group._id) });
    res.status(204).end();
});
