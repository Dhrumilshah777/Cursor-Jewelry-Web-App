const express = require('express');
const router = express.Router();
const userAuth = require('../middleware/userAuth');
const returnController = require('../controllers/returnController');

router.use(userAuth);

router.post('/', returnController.create);

module.exports = router;

