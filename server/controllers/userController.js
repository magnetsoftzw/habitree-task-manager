const User = require('../models/user');
const Task = require('../models/task');
const Group = require('../models/group');
const Planner = require('../models/planner');
const Session = require('../models/session');
const Roadmap = require('../models/roadmap');
const Project = require('../models/project');
const ProjectTask = require('../models/projectTask');
const Notification = require('../models/notification');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { username, email } = req.body;
        const updates = {};

        if (username !== undefined) {
            if (typeof username !== 'string' || !username.trim()) {
                return res.status(400).json({ success: false, message: 'Username is required', field: 'username' });
            }
            updates.username = username.trim();
        }
        if (email !== undefined) {
            const normalized = String(email).trim().toLowerCase();
            if (!EMAIL_RE.test(normalized)) {
                return res.status(400).json({ success: false, message: 'Enter a valid email address', field: 'email' });
            }
            const taken = await User.findOne({ email: normalized, _id: { $ne: req.user.id } });
            if (taken) return res.status(400).json({ success: false, message: 'That email is already in use', field: 'email' });
            updates.email = normalized;
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-password');

        res.json(user);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { autoRollover, dailyGoalMinutes, sessionReminders } = req.body;
        const updates = {};

        if (autoRollover !== undefined) updates['settings.autoRollover'] = Boolean(autoRollover);
        if (sessionReminders !== undefined) updates['settings.sessionReminders'] = Boolean(sessionReminders);
        if (dailyGoalMinutes !== undefined) {
            if (!Number.isInteger(dailyGoalMinutes) || dailyGoalMinutes < 60 || dailyGoalMinutes > 960) {
                return res.status(400).json({ success: false, message: 'dailyGoalMinutes must be between 60 and 960', field: 'dailyGoalMinutes' });
            }
            updates['settings.dailyGoalMinutes'] = dailyGoalMinutes;
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-password');

        res.json({ success: true, settings: user.settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @route   PUT /api/users/password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (typeof newPassword !== 'string' || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters', field: 'newPassword' });
        }

        const user = await User.findById(req.user.id);
        if (!user || !(await user.matchPassword(currentPassword || ''))) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect', field: 'currentPassword' });
        }

        user.password = newPassword;
        await user.save();
        res.json({ success: true, message: 'Password updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @route   DELETE /api/users/me  { password }
exports.deleteAccount = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || !(await user.matchPassword(req.body?.password || ''))) {
            return res.status(400).json({ success: false, message: 'Password is incorrect', field: 'password' });
        }

        const owned = await Project.find({ owner: user._id }).select('_id');
        const ownedIds = owned.map((p) => p._id);

        await Promise.all([
            Task.deleteMany({ $or: [{ userId: user._id }, { projectId: { $in: ownedIds } }] }),
            ProjectTask.deleteMany({ projectId: { $in: ownedIds } }),
            Project.deleteMany({ _id: { $in: ownedIds } }),
            Project.updateMany({ collaborators: user._id }, { $pull: { collaborators: user._id } }),
            Group.deleteMany({ userId: user._id }),
            Planner.deleteMany({ userId: user._id }),
            Session.deleteMany({ userId: user._id }),
            Roadmap.deleteMany({ userId: user._id }),
            Notification.deleteMany({ $or: [{ recipient: user._id }, { sender: user._id }] }),
        ]);
        await user.deleteOne();

        res.json({ success: true, message: 'Account deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
