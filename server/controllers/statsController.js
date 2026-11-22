const Session = require('../models/session');
const Task = require('../models/task');
const mongoose = require('mongoose');
const Project = require('../models/project');
const Group = require('../models/group');
const ProjectTask = require('../models/projectTask');
const { projectColor } = require('../utils/projectAccess');

const TZ_RE = /^[+-]\d{2}:\d{2}$/;

const accessibleProjectIds = async (userId) =>
    (await Project.find({ $or: [{ owner: userId }, { collaborators: userId }] }).select('_id')).map((p) => p._id);

// @desc    Get a specific day's productivity overview (defaults to today)
// @route   GET /api/stats/day?date=YYYY-MM-DD
exports.getDayOverview = async (req, res) => {
    try {
        let startOfDay, endOfDay;

        if (req.query.date) {
            startOfDay = new Date(req.query.date + 'T00:00:00.000Z');
            endOfDay   = new Date(req.query.date + 'T23:59:59.999Z');
        } else {
            startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);
        }

        const sessions = await Session.find({
            userId: req.user.id,
            startTime: { $gte: startOfDay, $lte: endOfDay },
            status: 'Completed',
        });

        const totalMinutes = sessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
        const efficiencyScore = Math.round((totalMinutes / 480) * 100) / 100;

        res.json({
            success: true,
            date: startOfDay.toISOString().split('T')[0],
            totalMinutes,
            efficiencyScore,
            sessionsCount: sessions.length,
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Alias so nothing breaks if getTodayOverview is referenced elsewhere
exports.getTodayOverview = exports.getDayOverview;

// @desc    Get Weekly Productivity (Last 7 days aggregation)
// @route   GET /api/stats/weekly
exports.getWeeklyStats = async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const stats = await Session.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(req.user.id),
                    startTime: { $gte: sevenDaysAgo },
                    status: 'Completed',
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
                    totalMinutes: { $sum: '$durationMinutes' },
                    sessionCount: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 1, totalMinutes: 1, sessionCount: 1,
                    totalHours: { $divide: ['$totalMinutes', 60] },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        res.json({ success: true, stats });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Monthly Heatmap Data
// @route   GET /api/stats/monthly
exports.getMonthlyStats = async (req, res) => {
    try {
        let startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        let endOfMonth = null;
        if (/^\d{4}-\d{2}$/.test(req.query.month || '')) {
            const [y, m] = req.query.month.split('-').map(Number);
            startOfMonth = new Date(Date.UTC(y, m - 1, 1));
            endOfMonth = new Date(Date.UTC(y, m, 1));
        }
        const tz = TZ_RE.test(req.query.tz || '') ? { timezone: req.query.tz } : {};

        const monthlyData = await Session.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(req.user.id),
                    startTime: { $gte: startOfMonth, ...(endOfMonth && { $lt: endOfMonth }) },
                    status: 'Completed',
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime', ...tz } },
                    totalMinutes: { $sum: '$durationMinutes' },
                    sessionCount: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 1, totalMinutes: 1, sessionCount: 1,
                    efficiency: { $multiply: [{ $divide: ['$totalMinutes', 480] }, 100] },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        res.json({ success: true, monthlyData });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Task Stats
// @route   GET /api/stats/tasks
exports.getTaskVolumeStats = async (req, res) => {
    try {
        const projectIds = await accessibleProjectIds(req.user.id);
        const [tasks, done, listTasks, listDone] = await Promise.all([
            Task.countDocuments({ userId: req.user.id }),
            Task.countDocuments({ userId: req.user.id, status: 'Completed' }),
            ProjectTask.countDocuments({ projectId: { $in: projectIds } }),
            ProjectTask.countDocuments({ projectId: { $in: projectIds }, status: 'done' }),
        ]);
        const totalTasks = tasks + listTasks;
        const completedTasks = done + listDone;

        res.json({
            success: true,
            totalTasks,
            completedTasks,
            completionRate: totalTasks > 0
                ? `${((completedTasks / totalTasks) * 100).toFixed(1)}%`
                : '0%',
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const offsetMinutes = (timezone) => {
    const sign = timezone[0] === '-' ? -1 : 1;
    return sign * (Number(timezone.slice(1, 3)) * 60 + Number(timezone.slice(4, 6)));
};

// @desc    Focus time per day, sessions, completions and a per project/group breakdown for a range
// @route   GET /api/stats/range?from=ISO&to=ISO&tz=+02:00
exports.getRangeStats = async (req, res) => {
    try {
        const from = new Date(req.query.from);
        const to = new Date(req.query.to);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
            return res.status(400).json({ success: false, message: 'from and to must be valid dates with from before to' });
        }
        const timezone = TZ_RE.test(req.query.tz || '') ? req.query.tz : '+00:00';
        const offset = offsetMinutes(timezone);
        const userId = new mongoose.Types.ObjectId(req.user.id);
        const dayKey = (date) => new Date(date.getTime() + offset * 60000).toISOString().split('T')[0];

        const sessions = await Session.find({
            userId, status: 'Completed', startTime: { $gte: from, $lt: to },
        }).select('startTime durationMinutes taskType taskId projectId titleSnapshot');

        const dayMap = new Map();
        sessions.forEach((s) => {
            const key = dayKey(s.startTime);
            const day = dayMap.get(key) || { date: key, minutes: 0, sessions: 0 };
            day.minutes += s.durationMinutes || 0;
            day.sessions += 1;
            dayMap.set(key, day);
        });

        const taskIds = sessions.filter((s) => s.taskType === 'task').map((s) => s.taskId);
        const tasks = await Task.find({ _id: { $in: taskIds } }).select('projectId groupId');
        const taskMap = new Map(tasks.map((t) => [String(t._id), t]));

        const myProjectIds = await accessibleProjectIds(req.user.id);
        const [completedTasks, completedList] = await Promise.all([
            Task.find({ userId, status: 'Completed', updatedAt: { $gte: from, $lt: to } }).select('projectId'),
            ProjectTask.find({ projectId: { $in: myProjectIds }, status: 'done', completedAt: { $gte: from, $lt: to } }).select('projectId'),
        ]);

        const projectIds = new Set();
        const groupIds = new Set();
        sessions.forEach((s) => {
            if (s.projectId) projectIds.add(String(s.projectId));
            const t = s.taskType === 'task' && taskMap.get(String(s.taskId));
            if (t?.projectId) projectIds.add(String(t.projectId));
            else if (t?.groupId) groupIds.add(String(t.groupId));
        });
        [...completedTasks, ...completedList].forEach((t) => t.projectId && projectIds.add(String(t.projectId)));

        const [projects, groups] = await Promise.all([
            Project.find({ _id: { $in: [...projectIds] } }).select('name color'),
            Group.find({ _id: { $in: [...groupIds] } }).select('name color'),
        ]);
        const projectMap = new Map(projects.map((p) => [String(p._id), p]));
        const groupMap = new Map(groups.map((g) => [String(g._id), g]));

        const buckets = new Map();
        const bucket = (key, kind, name, color) => {
            if (!buckets.has(key)) buckets.set(key, { key, kind, name, color, minutes: 0, completed: 0 });
            return buckets.get(key);
        };

        sessions.forEach((s) => {
            const minutes = s.durationMinutes || 0;
            const t = s.taskType === 'task' && taskMap.get(String(s.taskId));
            const pid = s.projectId ? String(s.projectId) : t?.projectId ? String(t.projectId) : null;
            const project = pid && projectMap.get(pid);
            const group = !project && t?.groupId && groupMap.get(String(t.groupId));
            const b = project ? bucket(`project:${pid}`, 'project', project.name, projectColor(project))
                : group ? bucket(`group:${group._id}`, 'group', group.name, group.color)
                : t ? bucket('group:none', 'group', 'Uncategorized', '#6B7280')
                : bucket('none', 'none', 'No task', '#9AA39C');
            b.minutes += minutes;
        });

        [...completedTasks, ...completedList].forEach((t) => {
            const project = t.projectId && projectMap.get(String(t.projectId));
            if (project) bucket(`project:${project._id}`, 'project', project.name, projectColor(project)).completed += 1;
        });

        const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
        const best = days.reduce((top, d) => (!top || d.minutes > top.minutes ? d : top), null);

        res.json({
            success: true,
            from, to, timezone,
            totalMinutes: days.reduce((sum, d) => sum + d.minutes, 0),
            sessionsCount: sessions.length,
            tasksCompleted: completedTasks.length + completedList.length,
            days,
            bestDay: best && best.minutes > 0 ? best : null,
            byProject: [...buckets.values()].sort((a, b) => b.minutes - a.minutes || b.completed - a.completed),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Recently completed tasks and list tasks
// @route   GET /api/stats/activity
exports.getRecentActivity = async (req, res) => {
    try {
        const projectIds = await accessibleProjectIds(req.user.id);
        const [tasks, listTasks] = await Promise.all([
            Task.find({ userId: req.user.id, status: 'Completed' }).sort({ updatedAt: -1 }).limit(8).select('title updatedAt'),
            ProjectTask.find({ projectId: { $in: projectIds }, status: 'done' }).sort({ completedAt: -1 }).limit(8).select('title completedAt'),
        ]);
        const activity = [
            ...tasks.map((t) => ({ id: String(t._id), verb: 'Completed', title: t.title, at: t.updatedAt, taskType: 'task' })),
            ...listTasks.map((t) => ({ id: String(t._id), verb: 'Completed', title: t.title, at: t.completedAt, taskType: 'projectTask' })),
        ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8);
        res.json({ success: true, activity });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
