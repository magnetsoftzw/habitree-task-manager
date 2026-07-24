const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { saveSession, syncMobileSessions, resolveConflict } = require('../controllers/sessionController');

router.use(protect);

router.post('/save', saveSession);

// @route   POST /api/sessions/sync (Batch-sync offline sessions queued on mobile)
router.post('/sync', syncMobileSessions);

// @route   POST /api/sessions/resolve-conflict (Resolve an overlapping-session conflict from sync)
router.post('/resolve-conflict', resolveConflict);

module.exports = router;
