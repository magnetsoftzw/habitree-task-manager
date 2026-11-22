const Project = require('../models/project');
const Planner = require('../models/planner');
const Task = require('../models/task');
const User = require('../models/user');
const Session = require('../models/session');
const Notification = require('../models/notification');
const ProjectTask = require('../models/projectTask');
const ProjectTaskGroup = require('../models/projectTaskGroup');
const { findAccessibleProject, projectColor } = require('../utils/projectAccess');

const KANBAN_COLUMNS = [
    'backendBacklog', 'frontendBacklog', 'mobileBacklog', 'design', 'issues',
    'todo', 'doing', 'testing', 'done', 'blocked', 'onHold', 'trash',
];
const BOARD_COLUMNS = KANBAN_COLUMNS.filter((c) => c !== 'trash');
const TRACK_BY_COLUMN = { backendBacklog: 'Backend', frontendBacklog: 'Frontend', mobileBacklog: 'Mobile', design: 'Design' };

const boardCardCount = (project) =>
    BOARD_COLUMNS.reduce((sum, col) => sum + (project.kanban?.[col]?.length || 0), 0);

const listCounts = async (projectIds) => {
    const rows = await ProjectTask.aggregate([
        { $match: { projectId: { $in: projectIds } } },
        { $group: { _id: '$projectId', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } } } },
    ]);
    return new Map(rows.map((r) => [String(r._id), { total: r.total, done: r.done }]));
};

const progressOf = (project, list = { total: 0, done: 0 }) => {
    const total = boardCardCount(project) + list.total;
    const done = (project.kanban?.done?.length || 0) + list.done;
    return total ? Math.round((done / total) * 100) : 0;
};

// @desc    Create a new project
// @route   POST /api/projects
exports.createProject = async(req, res) => {
    try {
        const { name, description, techStack, color } = req.body;

        const project = await Project.create({
            name,
            description: description || "No Description",
            owner: req.user.id,
            collaborators: [],
            techStack: techStack || [],
            color: color || null,
            progress: 0
        });
        if (!project.color) {
            project.color = projectColor(project);
            await project.save();
        }

        res.status(201).json({ success: true, project });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get project matching ID
// @route   GET /api/projects/:id
exports.getSingleProject = async (req, res) => {
    try {
        const project = await Project.findOne({
            _id: req.params.id,
            $or: [{ owner: req.user.id }, { collaborators: req.user.id }]
        })
            .populate({
                path: BOARD_COLUMNS.map((c) => `kanban.${c}`).join(' '),
                model: 'Task',
                populate: {
                    path: 'userId',
                    model: 'User',
                    select: 'username avatar'
                }
            })
            .populate('owner', 'username avatar')
            .populate('collaborators', 'username avatar');

        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        const cardIds = BOARD_COLUMNS.flatMap((c) => project.kanban[c].map((t) => t._id));
        const minutes = await Session.aggregate([
            { $match: { taskType: 'task', taskId: { $in: cardIds }, status: 'Completed' } },
            { $group: { _id: '$taskId', minutes: { $sum: '$durationMinutes' } } },
        ]);
        const minutesById = new Map(minutes.map((m) => [String(m._id), m.minutes]));
        const list = (await listCounts([project._id])).get(String(project._id)) || { total: 0, done: 0 };

        const result = project.toJSON();
        BOARD_COLUMNS.forEach((c) => {
            result.kanban[c] = result.kanban[c].map((t) => ({ ...t, focusMinutes: minutesById.get(String(t._id)) || 0 }));
        });
        result.color = projectColor(project);
        result.boardCardCount = boardCardCount(project);
        result.openTaskCount = list.total - list.done;
        result.progress = progressOf(project, list);

        res.json({ success: true, project: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all projects user is part of (Owner or Collaborator), sorted by last updated
// @route   GET /api/projects
exports.getProjects = async (req, res) => {
    try {
        const projects = await Project.find({
            $or: [{ owner: req.user.id }, { collaborators: req.user.id }]
        })
        .sort({ updatedAt: -1 }) // Most recently updated first
        .populate('owner', 'username email avatar')
        .populate('collaborators', 'username avatar');

        const counts = await listCounts(projects.map((p) => p._id));
        const result = projects.map((p) => {
            const list = counts.get(String(p._id)) || { total: 0, done: 0 };
            return {
                ...p.toJSON(),
                color: projectColor(p),
                boardCardCount: boardCardCount(p),
                openTaskCount: list.total - list.done,
                progress: progressOf(p, list),
            };
        });

        res.json({ success: true, projects: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update project details
// @route   PUT /api/projects/:id
exports.updateProject = async (req, res) => {
    try {
        const updates = {};
        ['name', 'description', 'techStack', 'color'].forEach((key) => {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        });

        const project = await Project.findOneAndUpdate(
            { _id: req.params.id, owner: req.user.id },
            { $set: updates },
            { new: true, runValidators: true}
        );

        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        res.json({ success: true, project})

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// @desc    Delete a project and its associated tasks
// @route   DELETE /api/projects/:id
exports.deleteProject = async (req, res) => {
    try {
        const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });

        if(!project) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }

        const allTasksIds = KANBAN_COLUMNS.flatMap((c) => project.kanban[c] || []);
        const listTaskIds = (await ProjectTask.find({ projectId: project._id }).select('_id')).map((t) => t._id);
        const today = new Date().toISOString().split('T')[0];

        await Promise.all([
            Task.deleteMany({ $or: [{ _id: { $in: allTasksIds } }, { projectId: project._id }] }),
            ProjectTask.deleteMany({ projectId: project._id }),
            ProjectTaskGroup.deleteMany({ projectId: project._id }),
            Planner.updateMany(
                { date: { $gte: today } },
                { $pull: { tasks: { taskId: { $in: [...allTasksIds, ...listTaskIds] } } } }
            ),
        ]);

        await project.deleteOne();
        res.json({ success: true, message: "Project and associated tasks deleted" });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

exports.addTaskToProject = async (req, res) => {
    const { title, columnId } = req.body;
    const projectId = req.params.id;

    try {
        const project = await findAccessibleProject(projectId, req.user.id);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
        if (!KANBAN_COLUMNS.includes(columnId)) {
            return res.status(400).json({ success: false, message: 'Invalid Kanban column' });
        }

        const newTask = await Task.create({
            title: (typeof title === 'string' && title.trim()) || 'New Task',
            userId: req.user.id,
            projectId: projectId,
            category: 'Project',
            kanban: columnId,
            track: TRACK_BY_COLUMN[columnId] || null,
            status: columnId === 'done' ? 'Completed' : columnId === 'doing' ? 'On-Going' : 'Not Started'
        });

        await Project.findByIdAndUpdate(
            projectId,
            { $push: { [`kanban.${columnId}`]: newTask._id } }
        );

        res.status(201).json({ success: true, task: newTask, columnId });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Move task between Kanban columns (The Bridge)
// @route   PUT /api/projects/:id/move
exports.moveTask = async (req, res) => {
    const { taskId, fromColumn, toColumn } = req.body;
    const projectId = req.params.id;

    try {
        const project = await Project.findOne({
            _id: projectId,
            $or: [{ owner: req.user.id }, { collaborators: req.user.id }]
        });
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        // 0. Validate that both columns are real Kanban columns on this project
        if (!Array.isArray(project.kanban[fromColumn]) || !Array.isArray(project.kanban[toColumn])) {
            return res.status(400).json({ success: false, message: 'Invalid Kanban column' });
        }

        // 1. Move task ID within the Project's kanban arrays
        project.kanban[fromColumn] = project.kanban[fromColumn].filter(id => id.toString() !== taskId);
        project.kanban[toColumn].push(taskId);

        // 2. Define standard task updates
        const taskUpdates = {
            kanban: toColumn,
            status: toColumn === 'done' ? 'Completed' : 'Not Started'
        };

        // 3. Logic for moving to 'doing' (Planner Integration)
        if (toColumn === 'doing') {
            const now = new Date();
            const hourString = `${now.getHours().toString().padStart(2, '0')}:00`;

            const dateString = now.toISOString().split('T')[0];

            await Planner.updateOne(
                { userId: req.user.id, date: dateString },
                { $setOnInsert: { userId: req.user.id, date: dateString } },
                { upsert: true }
            );
            await Planner.updateOne(
                { userId: req.user.id, date: dateString, 'tasks.taskId': { $ne: taskId } },
                { $push: { tasks: { taskType: 'task', taskId, time: hourString, duration: 60, comments: 'Started from Kanban' } } }
            );

            taskUpdates.status = 'On-Going';
        }

        // 4. Update the Task document
        await Task.findOneAndUpdate({ _id: taskId, projectId }, taskUpdates);

        // 5. Save the Project document
        await project.save();

        // 6. Real-time update
        req.io.to(String(projectId)).emit('taskMoved', {
            taskId,
            fromColumn,
            toColumn,
            user: req.user.username
        });

        res.json({ success: true, project });
    } catch (error) {
        console.error("Move Task Error:", error); // Log this for debugging
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add a collaborator to a project
// @route   POST /api/projects/:id/collaborators
exports.addCollaborator = async (req, res) => {

    const { email } = req.body;

    try {
        // 1. Find the project and ensure the requester is the owner
        const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });

        if(!project) return res.status(404).json({ success: false, message: 'Project not found or not authorized '});

        // 2. Find the user to be added
        const userToAdd = await User.findOne({ email });
        if(!userToAdd) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // 3. Prevent adding the owner as a collaborator
        if(userToAdd._id.toString() === project.owner.toString()) {
            return res.status(400).json({ success: false, message: 'Cannot add owner as collaborator' });
        }

        //4. Check if user is already a collabotatot
        if (project.collaborators.includes(userToAdd._id)) {
            return res.status(400).json({ success: false, message: 'User already a collaborator' });
        }

        //5. Add user and save
        project.collaborators.push(userToAdd._id);

        await project.save();
        return res.status(200).json({ success: true, message: 'Collaborator added '});

    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// @desc    Remove a collaborator from a project
// @route   DELETE /api/projects/:id/collaborators/:userId
exports.removeCollaborator = async (req, res) => {
    try{
        const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found or not authorized' });
        }

        // Remove the userId from the list of collaborators
        project.collaborators = project.collaborators.filter(
            (collabId) => collabId.toString() !== req.params.userId
        );

        await project.save();
        return res.status(200).json({ success: true, message: 'Collaborator removed '});

    }catch(error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// @desc    Invite a collaborator via email
// @route   POST /api/projects/:id/invite
exports.inviteCollaborator = async (req, res) => {
    const { email } = req.body;
    const projectId = req.params.id;

    try {
        // 1. Find the project and verify the requester is the owner
        const project = await Project.findOne({ _id: projectId, owner: req.user.id });
        if(!project) return res.status(404).json({ success: false, message: 'Project not found' });

        // 2. Find the recipient user in the database
        const recipient = await User.findOne({ email });
        if(!recipient) return res.status(404).json({ success: false, message: 'User not found' });

        // 3. Prevent adding the owner or duplicate collaborators
        if (recipient._id.toString() === project.owner.toString()) {
            return res.status(400).json({ success: false, message: 'You are already the owner of this project' });
        }

        if (project.collaborators.includes(recipient._id)) {
            return res.status(400).json({ message: 'User already a collaborator'});
        }

        // 4. Update the Project Schema
        project.collaborators.push(recipient._id);
        await project.save();

        // 5. Notify the recipient via Email
        const notification = await Notification.create({
            recipient: recipient._id,
            sender: req.user.id,
            type: 'INVITE',
            message: `You have been added to the project: ${project.name}`,
            projectId: project._id,
        });

        // 6. Send socket io Alert (Live)
        req.io.to(recipient._id.toString()).emit('newNotification', notification);

        // 7. Send Email (Offline)
        //await sendEmail({email: recipient.email, ...});

        res.json({ success: true, message: "Collaborator invited successfully" });

    }catch(error) {
        res.status(500).json({ success: false, message: error.message });
    }
}