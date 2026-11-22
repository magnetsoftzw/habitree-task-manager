const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect } = require('../middleware/authMiddleware');
const c = require('../controllers/projectTaskGroupController');

router.use(protect);

router.route('/')
    .get(c.listGroups)
    .post(c.createGroup);

router.route('/:groupId')
    .put(c.updateGroup)
    .patch(c.updateGroup)
    .delete(c.deleteGroup);

module.exports = router;
