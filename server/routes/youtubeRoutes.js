const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { previewPlaylist } = require('../controllers/youtubeController');

router.use(protect);

// @route   POST /api/youtube/playlist-preview
router.post('/playlist-preview', previewPlaylist);

module.exports = router;
