const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const c = require('../controllers/scheduleController');

router.use(protect);

router.get('/template', c.getTemplate);
router.patch('/template/segments/:key', c.updateTemplateSegment);
router.get('/:date', c.getSchedule);
router.delete('/:date', c.resetSchedule);
router.post('/:date/shift', c.shiftSegment);
router.post('/:date/resize', c.resizeSegment);

module.exports = router;
