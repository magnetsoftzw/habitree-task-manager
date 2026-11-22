const mongoose = require('mongoose');

const STATUSES = ['not_started', 'in_progress', 'done', 'shelved'];

const subtaskSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    done: { type: Boolean, default: false },
    shelved: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
});

const projectTaskSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    notes: { type: String, default: '', maxlength: 5000 },
    status: { type: String, enum: STATUSES, default: 'not_started' },
    dueDate: { type: Date, default: null },
    order: { type: Number, default: 0 },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectTaskGroup', default: null },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    subtasks: [subtaskSchema],
    completedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

projectTaskSchema.index({ projectId: 1, order: 1 });
projectTaskSchema.index({ projectId: 1, status: 1 });

projectTaskSchema.pre('save', function () {
    if (this.isModified('status')) {
        this.completedAt = this.status === 'done' ? (this.completedAt || new Date()) : null;
    }
});

projectTaskSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('ProjectTask', projectTaskSchema);
