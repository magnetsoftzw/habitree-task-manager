const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getChanges } = require('../controllers/syncController');

router.get('/changes', protect, getChanges);

module.exports = router;
