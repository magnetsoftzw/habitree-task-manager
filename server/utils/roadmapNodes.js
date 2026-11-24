const Task = require('../models/task');

const taskProgress = (task) => {
    const subs = task.subtasks || [];
    if (subs.length) return Math.round((subs.filter((s) => s.isCompleted).length / subs.length) * 100);
    return task.status === 'Completed' ? 100 : 0;
};

const plain = (node) => (typeof node.toObject === 'function' ? node.toObject() : node);

const tasksFor = async (nodes, userId, withDetails) => {
    const ids = [...new Set(nodes.map((n) => String(n.id)))];
    if (!ids.length) return new Map();
    let query = Task.find({ _id: { $in: ids }, userId }).select('title status subtasks category scheduledDate groupId');
    if (withDetails) query = query.populate('groupId', 'name color');
    const tasks = await query;
    return new Map(tasks.map((t) => [String(t._id), t]));
};

const withTaskData = (node, task, withDetails) => {
    const n = plain(node);
    if (!task) return n;
    const data = { ...n.data, label: task.title, status: task.status, progress: taskProgress(task) };
    if (withDetails) {
        Object.assign(data, {
            category: task.category,
            dueDate: task.scheduledDate,
            group: task.groupId ? { name: task.groupId.name, color: task.groupId.color } : null,
        });
    }
    return { ...n, data };
};

const liveNodes = async (nodes, userId, { withDetails = false } = {}) => {
    const byId = await tasksFor(nodes, userId, withDetails);
    return nodes.map((n) => withTaskData(n, byId.get(String(n.id)), withDetails));
};

module.exports = { taskProgress, liveNodes };
