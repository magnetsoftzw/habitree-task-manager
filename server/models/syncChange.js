const mongoose = require('mongoose');

const syncChangeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, default: null },
    device: { type: String, default: null },
    kinds: [String],
    resources: [String],
    at: { type: Date, default: Date.now },
});

syncChangeSchema.index({ userId: 1, at: 1 });
syncChangeSchema.index({ projectId: 1, at: 1 });
syncChangeSchema.index({ resources: 1, at: -1 });
syncChangeSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('SyncChange', syncChangeSchema);
