const mongoose = require('mongoose');

const PlannerSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: String,
        required: true
    },
    tasks: [{
        taskType: { type: String, enum: ['task', 'projectTask'], default: 'task' },
        taskId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
        subtaskId: {
            type: String,
            default: null
        },
        time: { type: String, default: "08:00" },
        duration: { type: Number, default: 30 },
        comments: { type: String, default: "" }
    }]
}, { timestamps: true });

PlannerSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Planner', PlannerSchema);
