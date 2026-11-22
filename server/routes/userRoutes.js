const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getCurrentUser,
    updateProfile,
    updateSettings,
    changePassword,
    deleteAccount,
} = require('../controllers/userController');

router.use(protect);

// @route   GET /api/users/me
// @route   PUT /api/users/me
// @route   DELETE /api/users/me
router.route('/me')
    .get(getCurrentUser)
    .put(updateProfile)
    .delete(deleteAccount);

// @route   PATCH /api/users/settings
router.patch('/settings', updateSettings);

// @route   PUT /api/users/password
router.put('/password', changePassword);

module.exports = router;
