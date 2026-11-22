const Task = require('../models/task');
const ProjectTask = require('../models/projectTask');
const Project = require('../models/project');
const { projectColor } = require('./projectAccess');

const LIST_STATUS_TO_TASK = { not_started: 'Not Started', in_progress: 'On-Going', done: 'Completed' };

const shapeProjectTask = (task, project) => {
    const color = projectColor(project);
    const projectRef = project ? { _id: project._id, name: project.name, color } : null;
    return {
        _id: task._id,
        title: task.title,
        status: LIST_STATUS_TO_TASK[task.status] || 'Not Started',
        listStatus: task.status,
        category: 'Project',
        dueDate: task.dueDate,
        subtasks: task.subtasks.map((s) => ({ _id: s._id, title: s.title, isCompleted: s.done })),
        groupId: projectRef && { _id: project._id, name: project.name, color },
        projectId: projectRef,
    };
};

const populateEntries = async (entries) => {
    const taskIds = entries.filter((e) => e.taskType !== 'projectTask').map((e) => e.taskId);
    const listIds = entries.filter((e) => e.taskType === 'projectTask').map((e) => e.taskId);

    const [tasks, listTasks] = await Promise.all([
        Task.find({ _id: { $in: taskIds } }).populate('groupId', 'name color').populate('projectId', 'name color'),
        ProjectTask.find({ _id: { $in: listIds } }),
    ]);
    const projects = await Project.find({ _id: { $in: listTasks.map((t) => t.projectId) } }).select('name color');

    const taskMap = new Map(tasks.map((t) => {
        const json = t.toJSON();
        if (t.projectId) {
            json.projectId = { _id: t.projectId._id, name: t.projectId.name, color: projectColor(t.projectId) };
            if (!json.groupId) json.groupId = { _id: t.projectId._id, name: t.projectId.name, color: json.projectId.color };
        }
        return [String(t._id), json];
    }));
    const projectMap = new Map(projects.map((p) => [String(p._id), p]));
    const listMap = new Map(listTasks.map((t) => [String(t._id), shapeProjectTask(t, projectMap.get(String(t.projectId)))]));

    return entries.map((e) => {
        const plain = typeof e.toObject === 'function' ? e.toObject() : { ...e };
        const type = plain.taskType || 'task';
        plain.taskType = type;
        plain.taskId = (type === 'projectTask' ? listMap : taskMap).get(String(plain.taskId)) || null;
        return plain;
    });
};

const populatePlanner = async (planner) => {
    if (!planner) return planner;
    const plain = planner.toObject();
    plain.tasks = await populateEntries(planner.tasks);
    return plain;
};

module.exports = { populatePlanner, populateEntries, shapeProjectTask, LIST_STATUS_TO_TASK };
