const Task = require('../models/task');
const ProjectTask = require('../models/projectTask');
const ProjectTaskGroup = require('../models/projectTaskGroup');
const Project = require('../models/project');
const { projectColor } = require('./projectAccess');

const LIST_STATUS_TO_TASK = { not_started: 'Not Started', in_progress: 'On-Going', done: 'Completed', shelved: 'Shelved' };

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
        subtasks: task.subtasks.map((s) => ({ _id: s._id, title: s.title, isCompleted: s.done, status: s.done ? 'Completed' : s.shelved ? 'Shelved' : 'Not Started' })),
        groupId: projectRef && { _id: project._id, name: project.name, color },
        projectId: projectRef,
    };
};

const groupStatus = (tasks) => {
    const live = tasks.filter((t) => t.status !== 'shelved');
    if (live.length && live.every((t) => t.status === 'done')) return 'Completed';
    if (live.some((t) => t.status === 'in_progress' || t.status === 'done')) return 'On-Going';
    return 'Not Started';
};

const groupTitle = (group, project) => `${group.name} - ${project?.name || 'Project'}`;

const shapeTaskGroup = (group, project, tasks) => {
    const color = projectColor(project);
    const projectRef = project ? { _id: project._id, name: project.name, color } : null;
    return {
        _id: group._id,
        isGroup: true,
        title: groupTitle(group, project),
        name: group.name,
        status: groupStatus(tasks),
        listStatus: null,
        category: 'Project',
        taskCount: tasks.length,
        doneCount: tasks.filter((t) => t.status === 'done').length,
        tasks: tasks.map((t) => ({ _id: t._id, title: t.title, status: LIST_STATUS_TO_TASK[t.status] || 'Not Started' })),
        subtasks: [],
        groupId: projectRef,
        projectId: projectRef,
    };
};

const loadTaskGroups = async (groupIds) => {
    if (!groupIds.length) return { groups: [], tasks: [] };
    const groups = await ProjectTaskGroup.find({ _id: { $in: groupIds } });
    const tasks = groups.length
        ? await ProjectTask.find({ groupId: { $in: groups.map((g) => g._id) } }).select('title status groupId order createdAt').sort({ order: 1, createdAt: 1 })
        : [];
    return { groups, tasks };
};

const populateEntries = async (entries) => {
    const type = (e) => e.taskType || 'task';
    const taskIds = entries.filter((e) => type(e) === 'task').map((e) => e.taskId);
    const listIds = entries.filter((e) => type(e) === 'projectTask').map((e) => e.taskId);
    const groupIds = entries.filter((e) => type(e) === 'projectTaskGroup').map((e) => e.taskId);

    const [tasks, listTasks, taskGroups] = await Promise.all([
        Task.find({ _id: { $in: taskIds } }).populate('groupId', 'name color').populate('projectId', 'name color'),
        ProjectTask.find({ _id: { $in: listIds } }),
        loadTaskGroups(groupIds),
    ]);
    const projects = await Project.find({ _id: { $in: [...listTasks, ...taskGroups.groups].map((t) => t.projectId) } }).select('name color');

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
    const groupMap = new Map(taskGroups.groups.map((g) => [String(g._id), shapeTaskGroup(
        g, projectMap.get(String(g.projectId)), taskGroups.tasks.filter((t) => String(t.groupId) === String(g._id)),
    )]));
    const maps = { task: taskMap, projectTask: listMap, projectTaskGroup: groupMap };

    return entries.map((e) => {
        const plain = typeof e.toObject === 'function' ? e.toObject() : { ...e };
        plain.taskType = type(plain);
        plain.taskId = (maps[plain.taskType] || taskMap).get(String(plain.taskId)) || null;
        return plain;
    });
};

const populatePlanner = async (planner) => {
    if (!planner) return planner;
    const plain = planner.toObject();
    plain.tasks = await populateEntries(planner.tasks);
    return plain;
};

module.exports = { populatePlanner, populateEntries, shapeProjectTask, groupStatus, groupTitle, LIST_STATUS_TO_TASK };
