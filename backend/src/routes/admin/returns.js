const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const returnController = require('../../controllers/returnController');

router.use(adminAuth);

router.patch('/:id', returnController.adminUpdateStatus);

module.exports = router;

