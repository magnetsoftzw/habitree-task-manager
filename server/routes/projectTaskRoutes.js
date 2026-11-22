const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect } = require('../middleware/authMiddleware');
const c = require('../controllers/projectTaskController');

router.use(protect);

router.route('/')
    .get(c.listTasks)
    .post(c.createTask);

router.put('/order', c.reorderTasks);

router.route('/:taskId')
    .patch(c.updateTask)
    .delete(c.deleteTask);

router.post('/:taskId/subtasks', c.createSubtask);
router.put('/:taskId/subtasks/order', c.reorderSubtasks);

router.route('/:taskId/subtasks/:subtaskId')
    .patch(c.updateSubtask)
    .delete(c.deleteSubtask);

module.exports = router;
