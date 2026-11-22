const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
    },
    durationMinutes: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ["In Progress", "Completed", "Shelved"],
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    taskType: { type: String, enum: ['task', 'projectTask', null], default: null },
    taskId: { type: mongoose.Schema.Types.ObjectId, default: null },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    titleSnapshot: { type: String, default: '' },
    mobileSyncId: {
        type: String,
        unique: true,
        sparse: true,
    },
    isConflict: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
