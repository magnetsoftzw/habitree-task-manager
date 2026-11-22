const Planner = require('../models/planner');
const Task = require('../models/task');
const ProjectTask = require('../models/projectTask');
const Project = require('../models/project');
const ScheduleTemplate = require('../models/scheduleTemplate');
const ScheduleDay = require('../models/scheduleDay');
const { populatePlanner, populateEntries } = require('../utils/plannerPopulate');
const {
    DEFAULT_SEGMENTS, effectiveSegments, entryInterval, containingWork, computeShift, computeResize,
} = require('../utils/scheduleLogic');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

const fail = (res, status, message, field, extra) =>
    res.status(status).json({ success: false, message, ...(field && { field }), ...extra });

const loadTemplate = async (userId) => {
    const existing = await ScheduleTemplate.findOne({ userId });
    if (existing) return existing;
    try {
        return await ScheduleTemplate.create({ userId, segments: DEFAULT_SEGMENTS });
    } catch (error) {
        if (error.code === 11000) return ScheduleTemplate.findOne({ userId });
        throw error;
    }
};

const scheduleFor = async (userId, date) => {
    const [template, override] = await Promise.all([loadTemplate(userId), ScheduleDay.findOne({ userId, date })]);
    return { date, segments: effectiveSegments(template, override), isOverride: !!override };
};

const notifyUser = (req, payload) => {
    if (req.io) req.io.to(String(req.user.id)).emit('scheduleUpdated', payload);
};

const handle = (fn) => async (req, res) => {
    try {
        if (req.params.date !== undefined && !DATE_RE.test(req.params.date)) return fail(res, 400, 'date must be YYYY-MM-DD', 'date');
        await fn(req, res);
    } catch (error) {
        fail(res, 500, error.message);
    }
};

const describeEntry = (entry, populated) => {
    const task = populated?.taskId;
    const sub = entry.subtaskId && task?.subtasks?.find((s) => String(s._id) === String(entry.subtaskId));
    return {
        entryId: String(entry._id),
        title: sub?.title || task?.title || 'Deleted task',
        parentTitle: sub ? task?.title : null,
        time: entry.time,
        duration: entry.duration,
        taskType: entry.taskType || 'task',
        taskId: String(entry.taskId),
        subtaskId: entry.subtaskId || null,
    };
};

const moveCardToTodo = async (task) => {
    const project = await Project.findById(task.projectId);
    if (!project?.kanban) return;
    Object.keys(project.kanban.toObject ? project.kanban.toObject() : project.kanban).forEach((col) => {
        if (Array.isArray(project.kanban[col])) {
            project.kanban[col] = project.kanban[col].filter((id) => String(id) !== String(task._id));
        }
    });
    if (Array.isArray(project.kanban.todo)) project.kanban.todo.push(task._id);
    await project.save();
};

const shelveEntry = async (req, entry) => {
    if ((entry.taskType || 'task') === 'projectTask') {
        const task = await ProjectTask.findById(entry.taskId);
        if (!task) return;
        if (entry.subtaskId) {
            const sub = task.subtasks.id(entry.subtaskId);
            if (!sub || sub.done) return;
            sub.shelved = true;
        } else {
            if (task.status === 'done') return;
            task.status = 'shelved';
        }
        await task.save();
        if (req.io) req.io.to(String(task.projectId)).emit('projectTask:updated', { projectId: String(task.projectId), task });
        return;
    }
    const task = await Task.findById(entry.taskId);
    if (!task) return;
    if (entry.subtaskId) {
        const sub = task.subtasks.id(entry.subtaskId);
        if (!sub || sub.status === 'Completed') return;
        sub.status = 'Shelved';
        await task.save();
        return;
    }
    if (task.status === 'Completed') return;
    task.status = 'Shelved';
    await task.save();
    if (task.projectId) await moveCardToTodo(task);
};

// @route   GET /api/schedule/template
exports.getTemplate = handle(async (req, res) => {
    const template = await loadTemplate(req.user.id);
    res.json({ success: true, template: { segments: effectiveSegments(template) } });
});

const MIDNIGHT_MINUTES = 1440;
const todayKey = () => new Date().toISOString().slice(0, 10);

const retime = (segments, key, changes) => {
    const segs = segments.map((s) => ({ ...s }));
    const idx = segs.findIndex((s) => s.key === key);
    for (const edge of ['start', 'end']) {
        const value = changes[edge];
        if (value === undefined) continue;
        if (!Number.isInteger(value) || value % 5 !== 0) return { error: 'Times must be whole minutes in steps of 5', field: edge };
        const i = edge === 'start' ? idx : idx + 1;
        if (i === 0 || i === segs.length) {
            return { error: `The ${edge} of ${segs[idx].label} is fixed at 4:00 AM, where the day begins`, field: edge };
        }
        const prev = segs[i - 1];
        const cur = segs[i];
        if (value === cur.start) continue;
        const earliest = prev.start + 5;
        const latest = Math.min(cur.end - 5, prev.kind === 'work' ? MIDNIGHT_MINUTES : Infinity);
        if (value < earliest) {
            return { error: `It can move at most ${cur.start - earliest} minutes earlier, because ${prev.label} needs at least 5 minutes`, field: edge };
        }
        if (value > latest) {
            const why = latest === MIDNIGHT_MINUTES ? 'because work periods end by midnight' : `because ${cur.label} needs at least 5 minutes`;
            return { error: `It can move at most ${Math.max(0, latest - cur.start)} minutes later, ${why}`, field: edge };
        }
        prev.end = value;
        cur.start = value;
    }
    return { segments: segs };
};

const plannedDays = async (userId, fromDate, before) => {
    const [planners, overrides] = await Promise.all([
        Planner.find({ userId, date: before ? { $lt: fromDate } : { $gte: fromDate }, 'tasks.0': { $exists: true } }).select('date tasks.time tasks.duration').lean(),
        ScheduleDay.find({ userId }).select('date').lean(),
    ]);
    const custom = new Set(overrides.map((o) => o.date));
    return planners.filter((p) => !custom.has(p.date));
};

const affectedCount = (days, segments) => days.reduce((n, p) => n + p.tasks.filter((e) => {
    const { start, end } = entryInterval(e);
    return !containingWork(segments, start, end);
}).length, 0);

// @route   PATCH /api/schedule/template/segments/:key  { label?, color?, start?, end?, dryRun?, today? }
exports.updateTemplateSegment = handle(async (req, res) => {
    const template = await loadTemplate(req.user.id);
    const segment = template.segments.find((s) => s.key === req.params.key);
    if (!segment) return fail(res, 404, 'Segment not found');
    const { label, color, start, end, dryRun } = req.body;
    const today = DATE_RE.test(req.body.today || '') ? req.body.today : todayKey();
    if (label !== undefined) {
        if (typeof label !== 'string' || !label.trim()) return fail(res, 400, 'Name is required', 'label');
        if (label.trim().length > 40) return fail(res, 400, 'Name must be 40 characters or fewer', 'label');
    }
    if (color !== undefined) {
        if (segment.kind !== 'work') return fail(res, 400, 'Only work periods have a colour', 'color');
        if (!COLOR_RE.test(color || '')) return fail(res, 400, 'Colour must be a hex value like #2563EB', 'color');
    }
    let times = null;
    if (start !== undefined || end !== undefined) {
        times = retime(effectiveSegments(template), segment.key, { start, end });
        if (times.error) return fail(res, 400, times.error, times.field);
    }
    const affected = times ? affectedCount(await plannedDays(req.user.id, today), times.segments) : 0;
    if (dryRun) return res.json({ success: true, preview: { segments: times?.segments || effectiveSegments(template), affected } });
    if (label !== undefined) segment.label = label.trim();
    if (color !== undefined) segment.color = color.toUpperCase();
    if (times) {
        const past = await plannedDays(req.user.id, today, true);
        const snapshot = effectiveSegments(template).map(({ key, start: a, end: b }) => ({ key, start: a, end: b }));
        if (past.length) {
            await ScheduleDay.bulkWrite(past.map((p) => ({
                updateOne: { filter: { userId: req.user.id, date: p.date }, update: { $setOnInsert: { segments: snapshot } }, upsert: true },
            })));
        }
        const byKey = new Map(times.segments.map((s) => [s.key, s]));
        template.segments.forEach((s) => {
            s.start = byKey.get(s.key).start;
            s.end = byKey.get(s.key).end;
        });
    }
    await template.save();
    notifyUser(req, { template: true });
    res.json({ success: true, template: { segments: effectiveSegments(template) }, affected });
});

// @route   GET /api/schedule/:date
exports.getSchedule = handle(async (req, res) => {
    res.json({ success: true, ...(await scheduleFor(req.user.id, req.params.date)) });
});

// @route   DELETE /api/schedule/:date
exports.resetSchedule = handle(async (req, res) => {
    const { date } = req.params;
    const [template, planner] = await Promise.all([loadTemplate(req.user.id), Planner.findOne({ userId: req.user.id, date })]);
    const segments = effectiveSegments(template);
    const outside = (planner?.tasks || []).filter((e) => {
        const { start, end } = entryInterval(e);
        return !containingWork(segments, start, end);
    });
    if (outside.length) {
        const populated = await populateEntries(outside);
        return fail(res, 409, 'Some planned tasks would fall outside the default work periods. Move them first.', null, {
            entries: outside.map((e, i) => describeEntry(e, populated[i])),
        });
    }
    await ScheduleDay.deleteOne({ userId: req.user.id, date });
    notifyUser(req, { date });
    res.json({ success: true, schedule: { date, segments, isOverride: false } });
});

const changeSegments = (compute) => handle(async (req, res) => {
    const { date } = req.params;
    const { confirm, dryRun } = req.body;
    const userId = req.user.id;
    const [current, planner] = await Promise.all([scheduleFor(userId, date), Planner.findOne({ userId, date })]);
    const entries = planner?.tasks || [];

    const result = compute(current.segments, entries, req.body);
    if (result.error) return fail(res, 400, result.error, result.field || 'offsetMinutes');

    const populated = result.removed.length ? await populateEntries(result.removed) : [];
    const preview = {
        segments: result.segments,
        restLostMinutes: result.restLostMinutes,
        workLostMinutes: result.workLostMinutes,
        rest: result.rest && { start: result.rest.start, end: result.rest.end },
        removed: result.removed.map((e, i) => describeEntry(e, populated[i])),
        moved: result.moved.length,
        requiresConfirmation: result.requiresConfirmation,
    };

    if (dryRun) return res.json({ success: true, preview });
    if (result.requiresConfirmation && confirm !== true) {
        return fail(res, 409, 'This change needs confirmation', null, { requiresConfirmation: true, preview });
    }

    await ScheduleDay.findOneAndUpdate(
        { userId, date },
        { $set: { segments: result.segments.map(({ key, start, end }) => ({ key, start, end })) } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    let savedPlanner = planner;
    if (planner && (result.moved.length || result.removed.length)) {
        const removedIds = new Set(result.removed.map((e) => String(e._id)));
        const newTimes = new Map(result.moved.map(({ entry, time }) => [String(entry._id), time]));
        planner.tasks = planner.tasks.filter((e) => !removedIds.has(String(e._id)));
        planner.tasks.forEach((e) => {
            const time = newTimes.get(String(e._id));
            if (time) e.time = time;
        });
        savedPlanner = await planner.save();
        for (const entry of result.removed) await shelveEntry(req, entry);
    }

    notifyUser(req, { date });
    res.json({
        success: true,
        schedule: await scheduleFor(userId, date),
        planner: savedPlanner ? await populatePlanner(savedPlanner) : { date, tasks: [] },
        preview,
    });
});

// @route   POST /api/schedule/:date/shift  { segmentKey, offsetMinutes, confirm?, dryRun? }
exports.shiftSegment = changeSegments((segments, entries, body) =>
    computeShift(segments, entries, body.segmentKey, Number(body.offsetMinutes)));

// @route   POST /api/schedule/:date/resize  { segmentKey, edge, offsetMinutes, confirm?, dryRun? }
exports.resizeSegment = changeSegments((segments, entries, body) =>
    computeResize(segments, entries, body.segmentKey, body.edge, Number(body.offsetMinutes)));

exports.scheduleFor = scheduleFor;
