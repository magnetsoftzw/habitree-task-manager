const express = require('express');
const router = express.Router();
const {
    getPlannerByDate,
    getPlannerRange,
    addTaskToPlanner,
    rolloverPlanner,
    deletePlannerTask,
    updatePlannerEntry,
} = require('../controllers/plannerController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/range', getPlannerRange);
router.post('/rollover', rolloverPlanner);
router.get('/:date', getPlannerByDate);
router.post('/:date/add', addTaskToPlanner);
router.patch('/:date/:id', updatePlannerEntry);
router.delete('/:date/:id', deletePlannerTask);

module.exports = router;
