const mongoose = require('mongoose');

const scheduleDaySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    segments: [{
        _id: false,
        key: { type: String, required: true },
        start: { type: Number, required: true },
        end: { type: Number, required: true },
    }],
}, { timestamps: true });

scheduleDaySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ScheduleDay', scheduleDaySchema);
