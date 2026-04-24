const express = require('express');
const router = express.Router();
const goldRateController = require('../controllers/goldRateController');

// Public cached gold rates
router.get('/', goldRateController.publicList);

module.exports = router;

