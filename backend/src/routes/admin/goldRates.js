const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const goldRateController = require('../../controllers/goldRateController');

router.use(adminAuth);

router.get('/', goldRateController.list);
router.put('/', goldRateController.updateBulk);
router.put('/:purity', (req, res, next) => {
  req.body.purity = req.params.purity;
  return goldRateController.update(req, res, next);
});

module.exports = router;
