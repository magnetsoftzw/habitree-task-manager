const mongoose = require('mongoose');

const projectTaskGroupSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

projectTaskGroupSchema.index({ projectId: 1, createdAt: 1 });

module.exports = mongoose.model('ProjectTaskGroup', projectTaskGroupSchema);
