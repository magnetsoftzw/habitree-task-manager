const mongoose = require('mongoose');
const ProjectTask = require('../models/projectTask');
const ProjectTaskGroup = require('../models/projectTaskGroup');
const Planner = require('../models/planner');
const { findAccessibleProject } = require('../utils/projectAccess');

const STATUSES = ProjectTask.STATUSES;

const fail = (res, status, message, field) =>
    res.status(status).json({ success: false, message, ...(field && { field }) });

const validateTitle = (title, required) => {
    if (title === undefined) return required ? 'Title is required' : null;
    if (typeof title !== 'string' || !title.trim()) return 'Title is required';
    if (title.trim().length > 200) return 'Title must be 200 characters or fewer';
    return null;
};

const validateTaskFields = (body, isCreate) => {
    const titleError = validateTitle(body.title, isCreate);
    if (titleError) return { field: 'title', message: titleError };
    if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 5000)) {
        return { field: 'notes', message: 'Notes must be text of 5,000 characters or fewer' };
    }
    if (body.status !== undefined && !STATUSES.includes(body.status)) {
        return { field: 'status', message: `Status must be one of: ${STATUSES.join(', ')}` };
    }
    if (body.dueDate !== undefined && body.dueDate !== null && Number.isNaN(new Date(body.dueDate).getTime())) {
        return { field: 'dueDate', message: 'dueDate must be a valid date' };
    }
    if (body.assigneeId !== undefined && body.assigneeId !== null && !mongoose.isValidObjectId(body.assigneeId)) {
        return { field: 'assigneeId', message: 'assigneeId must be a valid id' };
    }
    return null;
};

const validateGroup = async (groupId, projectId) => {
    if (groupId === undefined || groupId === null) return null;
    if (!mongoose.isValidObjectId(groupId) || !(await ProjectTaskGroup.exists({ _id: groupId, projectId }))) {
        return { field: 'groupId', message: 'groupId must be null or a group in this project' };
    }
    return null;
};

const sortSubtasks = (task) => {
    task.subtasks.sort((a, b) => a.order - b.order);
    return task;
};

const emit = (req, event, payload) => {
    if (req.io) req.io.to(String(req.params.projectId)).emit(event, { projectId: String(req.params.projectId), ...payload });
};

const loadProject = async (req, res) => {
    const project = await findAccessibleProject(req.params.projectId, req.user.id);
    if (!project) {
        fail(res, 404, 'Project not found');
        return null;
    }
    return project;
};

const loadTask = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.taskId)) {
        fail(res, 404, 'Task not found');
        return null;
    }
    const task = await ProjectTask.findOne({ _id: req.params.taskId, projectId: req.params.projectId });
    if (!task) {
        fail(res, 404, 'Task not found');
        return null;
    }
    return task;
};

const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const [field, detail] = Object.entries(error.errors)[0];
            return fail(res, 400, detail.message, field);
        }
        fail(res, 500, error.message);
    }
};

// @route   GET /api/projects/:projectId/tasks
exports.listTasks = handle(async (req, res) => {
    if (!(await loadProject(req, res))) return;
    const filter = { projectId: req.params.projectId };
    if (req.query.status === 'open') filter.status = { $ne: 'done' };
    const tasks = await ProjectTask.find(filter).sort({ order: 1, createdAt: 1 });
    res.json({ success: true, tasks: tasks.map(sortSubtasks) });
});

// @route   POST /api/projects/:projectId/tasks
exports.createTask = handle(async (req, res) => {
    if (!(await loadProject(req, res))) return;
    const invalid = validateTaskFields(req.body, true) || await validateGroup(req.body.groupId, req.params.projectId);
    if (invalid) return fail(res, 400, invalid.message, invalid.field);

    const last = await ProjectTask.findOne({ projectId: req.params.projectId }).sort({ order: -1 }).select('order');
    const task = await ProjectTask.create({
        projectId: req.params.projectId,
        title: req.body.title.trim(),
        notes: req.body.notes || '',
        dueDate: req.body.dueDate || null,
        status: req.body.status || 'not_started',
        groupId: req.body.groupId || null,
        order: last ? last.order + 1 : 0,
        createdBy: req.user.id,
    });

    emit(req, 'projectTask:created', { task });
    res.status(201).json({ success: true, task });
});

// @route   PUT /api/projects/:projectId/tasks/order
exports.reorderTasks = handle(async (req, res) => {
    if (!(await loadProject(req, res))) return;
    const { taskIds } = req.body;
    const existing = await ProjectTask.find({ projectId: req.params.projectId }).select('_id');
    const existingIds = new Set(existing.map((t) => String(t._id)));

    if (!Array.isArray(taskIds) || taskIds.length !== existingIds.size
        || new Set(taskIds.map(String)).size !== taskIds.length
        || !taskIds.every((id) => existingIds.has(String(id)))) {
        return fail(res, 400, "taskIds must contain exactly this project's task ids", 'taskIds');
    }

    await ProjectTask.bulkWrite(taskIds.map((id, index) => ({
        updateOne: { filter: { _id: id, projectId: req.params.projectId }, update: { $set: { order: index } } },
    })));

    emit(req, 'projectTask:reordered', { taskIds: taskIds.map(String) });
    res.status(204).end();
});

// @route   PATCH /api/projects/:projectId/tasks/:taskId
exports.updateTask = handle(async (req, res) => {
    if (!(await loadProject(req, res))) return;
    const invalid = validateTaskFields(req.body, false) || await validateGroup(req.body.groupId, req.params.projectId);
    if (invalid) return fail(res, 400, invalid.message, invalid.field);
    const task = await loadTask(req, res);
    if (!task) return;

    ['title', 'notes', 'dueDate', 'status', 'assigneeId', 'groupId'].forEach((key) => {
        if (req.body[key] !== undefined) task[key] = key === 'title' ? req.body.title.trim() : req.body[key];
    });
    await task.save();

    emit(req, 'projectTask:updated', { task: sortSubtasks(task) });
    res.json({ success: true, task });
});

// @route   DELETE /api/projects/:projectId/tasks/:taskId
exports.deleteTask = handle(async (req, res) => {
    if (!(await loadProject(req, res))) return;
    const task = await loadTask(req, res);
    if (!task) return;

    await task.deleteOne();
    const today = new Date().toISOString().split('T')[0];
    await Planner.updateMany(
        { date: { $gte: today }, 'tasks.taskId': task._id },
        { $pull: { tasks: { taskType: 'projectTask', taskId: task._id } } }
    );

    emit(req, 'projectTask:deleted', { taskId: String(task._id) });
    res.status(204).end();
});

// @route   POST /api/projects/:projectId/tasks/:taskId/subtasks
exports.createSubtask = handle(async (req, res) => {
    if (!(await loadProject(req, res))) return;
    const titleError = validateTitle(req.body.title, true);
    if (titleError) return fail(res, 400, titleError, 'title');
    const task = await loadTask(req, res);
    if (!task) return;

    const maxOrder = task.subtasks.reduce((max, s) => Math.max(max, s.order), -1);
    task.subtasks.push({ title: req.body.title.trim(), order: maxOrder + 1 });
    await task.save();

    emit(req, 'projectTask:updated', { task: sortSubtasks(task) });
    res.status(201).json({ success: true, task });
});

// @route   PUT /api/projects/:projectId/tasks/:taskId/subtasks/order
exports.reorderSubtasks = handle(async (req, res) => {
    if (!(await loadProject(req, res))) return;
    const task = await loadTask(req, res);
    if (!task) return;

    const { subtaskIds } = req.body;
    const existingIds = new Set(task.subtasks.map((s) => String(s._id)));
    if (!Array.isArray(subtaskIds) || subtaskIds.length !== existingIds.size
        || new Set(subtaskIds.map(String)).size !== subtaskIds.length
        || !subtaskIds.every((id) => existingIds.has(String(id)))) {
        return fail(res, 400, "subtaskIds must contain exactly this task's subtask ids", 'subtaskIds');
    }

    subtaskIds.forEach((id, index) => { task.subtasks.id(id).order = index; });
    await task.save();

    emit(req, 'projectTask:updated', { task: sortSubtasks(task) });
    res.json({ success: true, task });
});

// @route   PATCH /api/projects/:projectId/tasks/:taskId/subtasks/:subtaskId
exports.updateSubtask = handle(async (req, res) => {
    if (!(await loadProject(req, res))) return;
    const titleError = validateTitle(req.body.title, false);
    if (titleError) return fail(res, 400, titleError, 'title');
    if (req.body.done !== undefined && typeof req.body.done !== 'boolean') {
        return fail(res, 400, 'done must be true or false', 'done');
    }
    const task = await loadTask(req, res);
    if (!task) return;

    const subtask = mongoose.isValidObjectId(req.params.subtaskId) && task.subtasks.id(req.params.subtaskId);
    if (!subtask) return fail(res, 404, 'Subtask not found');

    if (req.body.title !== undefined) subtask.title = req.body.title.trim();
    if (req.body.done !== undefined) subtask.done = req.body.done;
    await task.save();

    emit(req, 'projectTask:updated', { task: sortSubtasks(task) });
    res.json({ success: true, task });
});

// @route   DELETE /api/projects/:projectId/tasks/:taskId/subtasks/:subtaskId
exports.deleteSubtask = handle(async (req, res) => {
    if (!(await loadProject(req, res))) return;
    const task = await loadTask(req, res);
    if (!task) return;

    const subtask = mongoose.isValidObjectId(req.params.subtaskId) && task.subtasks.id(req.params.subtaskId);
    if (!subtask) return fail(res, 404, 'Subtask not found');

    subtask.deleteOne();
    await task.save();

    emit(req, 'projectTask:updated', { task: sortSubtasks(task) });
    res.json({ success: true, task });
});
