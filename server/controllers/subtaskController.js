const Task = require('../models/task');

// @desc    Add a subtask to a task
// @route   POST /api/tasks/:taskId/subtasks
exports.createSubtask = async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.taskId, userId: req.user.id });
        if(!task) return res.status(404).json({ success: false, message: "Task not found" });

        const newSubtask = {
            title: req.body.title,
            scheduledDate: req.body.scheduledDate || null,
            status: 'Not Started'
        };

        task.subtasks.push(newSubtask);
        await task.save(); //Triggers the Roadmap sync Middleware

        res.status(201).json({ success: true, subtasks: task.subtasks });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// @desc    Update a specific subtask (including scheduling)
// @route   PATCH /api/tasks/:taskId/subtasks/:subTaskId
exports.updateSubtask = async (req, res) => {
    try {
        const { taskId, subTaskId } = req.params;
        const updates = req.body;

        const task = await Task.findOne({ _id: taskId, userId: req.user.id });
        const subtask = task?.subtasks.id(subTaskId);

        if (!subtask) {
            return res.status(404).json({ success: false, message: "Task or subtask not found" });
        }

        ['title', 'isCompleted', 'status', 'scheduledDate'].forEach((key) => {
            if (updates[key] !== undefined) subtask[key] = updates[key];
        });
        if (updates.status === 'Completed') subtask.isCompleted = true;

        await task.save();
        res.json({ success: true, task });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// @desc    Delete a subtask
// @route   DELETE /api/tasks/:taskId/subtasks/:subTaskId
exports.deleteSubtask = async (req, res) => {
    try {
        const task = await Task.findOneAndUpdate(
            { _id: req.params.taskId, userId: req.user.id },
            { $pull: { subtasks: { _id: req.params.subTaskId } } },
            { new: true }
        );

        if (!task) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }

        await task.save();
        res.json({ success: true, message: "Subtask removed successfully" });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}