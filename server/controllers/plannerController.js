const mongoose = require('mongoose');
const Planner = require('../models/planner');
const Task = require('../models/task');
const ProjectTask = require('../models/projectTask');
const User = require('../models/user');
const { findAccessibleProject } = require('../utils/projectAccess');
const { populatePlanner } = require('../utils/plannerPopulate');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const badRequest = (res, message, field) => res.status(400).json({ success: false, message, ...(field && { field }) });

const resolveTaskRef = async (userId, { taskType = 'task', taskId, projectId }) => {
    if (!mongoose.isValidObjectId(taskId)) return { error: 'taskId is required' };

    if (taskType === 'projectTask') {
        if (!projectId) return { error: 'projectId is required for project tasks' };
        const project = await findAccessibleProject(projectId, userId);
        if (!project) return { notFound: true };
        const task = await ProjectTask.findOne({ _id: taskId, projectId });
        return task ? { ref: { taskType, taskId, projectId } } : { notFound: true };
    }

    if (taskType !== 'task') return { error: "taskType must be 'task' or 'projectTask'" };
    const task = await Task.findById(taskId).select('userId projectId');
    if (!task) return { notFound: true };
    if (String(task.userId) !== String(userId)) {
        const project = task.projectId && await findAccessibleProject(task.projectId, userId);
        if (!project) return { notFound: true };
    }
    return { ref: { taskType: 'task', taskId, projectId: task.projectId || null } };
};

// @route   GET /api/planner/range?from=YYYY-MM-DD&to=YYYY-MM-DD
exports.getPlannerRange = async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '')) {
            return badRequest(res, 'from and to must be YYYY-MM-DD dates');
        }
        const planners = await Planner.find({ userId: req.user.id, date: { $gte: from, $lte: to } }).select('date tasks');
        const days = planners
            .filter((p) => p.tasks.length > 0)
            .map((p) => ({
                date: p.date,
                count: p.tasks.length,
                entries: p.tasks.map((t) => ({ taskType: t.taskType || 'task', taskId: t.taskId, projectId: t.projectId })),
            }));
        res.json({ success: true, days });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @route   GET /api/planner/:date
exports.getPlannerByDate = async (req, res) => {
    try {
        const { date } = req.params;
        const userId = req.user.id;

        let planner = await Planner.findOne({ userId, date });
        if (!planner) {
            planner = await Planner.create({ userId, date, tasks: [] });
        }

        res.status(200).json(await populatePlanner(planner));
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @route   POST /api/planner/:date/add
exports.addTaskToPlanner = async (req, res) => {
    try {
        const { date } = req.params;
        const { subtaskId, time, comments, duration } = req.body;
        const userId = req.user.id;

        if (!DATE_RE.test(date)) return badRequest(res, 'date must be YYYY-MM-DD', 'date');
        if (time !== undefined && !TIME_RE.test(time)) return badRequest(res, 'time must be HH:MM', 'time');
        if (duration !== undefined && (!Number.isFinite(duration) || duration < 5 || duration > 720)) {
            return badRequest(res, 'duration must be between 5 and 720 minutes', 'duration');
        }

        const resolved = await resolveTaskRef(userId, req.body);
        if (resolved.error) return badRequest(res, resolved.error, 'taskId');
        if (resolved.notFound) return res.status(404).json({ success: false, message: 'Task not found' });

        let planner = await Planner.findOne({ userId, date });
        if (!planner) {
            planner = new Planner({ userId, date, tasks: [] });
        }

        const alreadyScheduled = planner.tasks.find((t) =>
            (t.taskType || 'task') === resolved.ref.taskType
            && t.taskId?.toString() === String(resolved.ref.taskId)
            && (t.subtaskId || null) === (subtaskId || null)
        );

        if (!alreadyScheduled) {
            planner.tasks.push({ ...resolved.ref, subtaskId: subtaskId || null, time, duration, comments });
            await planner.save();
        }

        res.status(201).json(await populatePlanner(planner));
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @route   POST /api/planner/rollover  { date }
exports.rolloverPlanner = async (req, res) => {
    try {
        const { date } = req.body;
        if (!DATE_RE.test(date || '')) return badRequest(res, 'date must be YYYY-MM-DD', 'date');

        const user = await User.findById(req.user.id).select('settings');
        if (user?.settings?.autoRollover === false) return res.json({ success: true, moved: 0 });

        const past = await Planner.find({ userId: req.user.id, date: { $lt: date }, 'tasks.0': { $exists: true } })
            .sort({ date: -1 }).limit(14);
        if (past.length === 0) return res.json({ success: true, moved: 0 });

        const allEntries = past.flatMap((p) => p.tasks);
        const taskIds = allEntries.filter((e) => (e.taskType || 'task') === 'task').map((e) => e.taskId);
        const listIds = allEntries.filter((e) => e.taskType === 'projectTask').map((e) => e.taskId);
        const [doneTasks, doneList] = await Promise.all([
            Task.find({ _id: { $in: taskIds }, status: 'Completed' }).select('_id'),
            ProjectTask.find({ _id: { $in: listIds }, status: 'done' }).select('_id'),
        ]);
        const existingTasks = await Task.find({ _id: { $in: taskIds } }).select('_id');
        const existingList = await ProjectTask.find({ _id: { $in: listIds } }).select('_id');
        const alive = new Set([...existingTasks, ...existingList].map((t) => String(t._id)));
        const done = new Set([...doneTasks, ...doneList].map((t) => String(t._id)));

        let target = await Planner.findOne({ userId: req.user.id, date });
        if (!target) target = new Planner({ userId: req.user.id, date, tasks: [] });
        const key = (e) => `${e.taskType || 'task'}:${e.taskId}:${e.subtaskId || ''}`;
        const planned = new Set(target.tasks.map(key));

        let moved = 0;
        for (const planner of past) {
            const keep = [];
            for (const entry of planner.tasks) {
                const id = String(entry.taskId);
                if (!alive.has(id) || done.has(id)) {
                    keep.push(entry);
                    continue;
                }
                if (!planned.has(key(entry))) {
                    const { _id, ...rest } = entry.toObject();
                    target.tasks.push({ ...rest, taskType: rest.taskType || 'task', comments: rest.comments || 'Rolled over' });
                    planned.add(key(entry));
                    moved++;
                }
            }
            if (keep.length !== planner.tasks.length) {
                planner.tasks = keep;
                await planner.save();
            }
        }
        if (moved > 0) await target.save();

        res.json({ success: true, moved });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @route   DELETE /api/planner/:date/:id
exports.deletePlannerTask = async (req, res) => {
    try {
        const { date, id } = req.params;
        const userId = req.user.id;

        const planner = await Planner.findOneAndUpdate(
            { userId, date },
            { $pull: { tasks: { _id: id } } },
            { new: true }
        );

        if (!planner) {
            return res.status(404).json({
                success: false,
                message: "Planner not found for this date"
            });
        }

        res.status(200).json({
            success: true,
            message: "Item removed from planner",
            planner: await populatePlanner(planner)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @route   PATCH /api/planner/:date/:id
exports.updatePlannerEntry = async (req, res) => {
    try {
        const { date, id } = req.params;
        const { time, comments, duration } = req.body;
        const userId = req.user.id;

        if (time !== undefined && !TIME_RE.test(time)) return badRequest(res, 'time must be HH:MM', 'time');
        if (duration !== undefined && (!Number.isFinite(duration) || duration < 5 || duration > 720)) {
            return badRequest(res, 'duration must be between 5 and 720 minutes', 'duration');
        }

        const planner = await Planner.findOneAndUpdate(
            { userId, date, 'tasks._id': id },
            {
                $set: {
                    ...(time     !== undefined && { 'tasks.$.time': time }),
                    ...(comments !== undefined && { 'tasks.$.comments': comments }),
                    ...(duration !== undefined && { 'tasks.$.duration': duration }),
                },
            },
            { new: true }
        );

        if (!planner) {
            return res.status(404).json({ success: false, message: 'Planner entry not found' });
        }

        res.json({ success: true, planner: await populatePlanner(planner) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
