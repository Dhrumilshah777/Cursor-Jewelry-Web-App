const { checkServiceability } = require('../services/shiprocket');

/**
 * GET /api/delivery-check?pincode=560001
 * Calls Shiprocket serviceability API and returns estimated delivery days and date.
 * Public (no auth).
 */
exports.check = async (req, res) => {
  try {
    const pincode = (req.query.pincode || '').toString().trim();
    if (!pincode) {
      return res.status(400).json({ error: 'Pincode is required', serviceable: false });
    }
    const { serviceable, estimatedDays, availableCouriers } = await checkServiceability(pincode);
    let estimatedDate = null;
    if (serviceable && estimatedDays != null && estimatedDays > 0) {
      const d = new Date();
      d.setDate(d.getDate() + Math.ceil(estimatedDays));
      estimatedDate = d.toISOString().split('T')[0];
    }
    res.json({
      serviceable: !!serviceable,
      estimatedDays: estimatedDays ?? null,
      estimatedDate,
      availableCouriers: availableCouriers || [],
      message: serviceable
        ? estimatedDate
          ? `Delivery by ${formatDeliveryDate(estimatedDate)}`
          : 'Delivery available'
        : 'Delivery not available for this pincode',
    });
  } catch (err) {
    console.error('Delivery check error:', err.message);
    res.status(500).json({
      error: err.message || 'Unable to check delivery',
      serviceable: false,
      estimatedDays: null,
      estimatedDate: null,
      message: 'Unable to check delivery. Please try again.',
    });
  }
};

function formatDeliveryDate(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  const day = d.getUTCDate();
  const month = d.toLocaleDateString('en-IN', { month: 'long' });
  const year = d.getUTCFullYear();
  return `${day} ${month}${year !== new Date().getFullYear() ? ' ' + year : ''}`;
}
