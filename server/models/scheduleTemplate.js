const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({
    key: { type: String, required: true },
    kind: { type: String, enum: ['work', 'personal'], required: true },
    label: { type: String, required: true, trim: true, minlength: 1, maxlength: 40 },
    color: { type: String, default: null },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
}, { _id: false });

const scheduleTemplateSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    segments: [segmentSchema],
}, { timestamps: true });

module.exports = mongoose.model('ScheduleTemplate', scheduleTemplateSchema);
