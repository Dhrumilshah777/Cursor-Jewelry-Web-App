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
    const message = serviceable
      ? estimatedDate
        ? `Delivery by ${formatDeliveryDate(estimatedDate)}`
        : 'Delivery available'
      : 'Delivery not available for this pincode';
    res.json({
      serviceable: !!serviceable,
      estimatedDays: estimatedDays ?? null,
      estimatedDate,
      availableCouriers: availableCouriers || [],
      message,
    });
  } catch (err) {
    console.error('Delivery check error:', err.message);
    // Shiprocket API failed: return 200 with fallback message so frontend can show it
    res.status(200).json({
      serviceable: false,
      estimatedDays: null,
      estimatedDate: null,
      availableCouriers: [],
      message: 'Estimated delivery: 4–7 business days.',
      fallback: true,
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
