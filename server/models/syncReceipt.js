const mongoose = require('mongoose');

const syncReceiptSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    key: { type: String, required: true },
    status: Number,
    body: mongoose.Schema.Types.Mixed,
    at: { type: Date, default: Date.now },
});

syncReceiptSchema.index({ userId: 1, key: 1 }, { unique: true });
syncReceiptSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

module.exports = mongoose.model('SyncReceipt', syncReceiptSchema);
