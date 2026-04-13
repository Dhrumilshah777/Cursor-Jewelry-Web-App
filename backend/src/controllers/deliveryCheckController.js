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
    const { serviceable, estimatedDays, availableCouriers, selectedCourier } = await checkServiceability(pincode);

    if (!serviceable) {
      return res.json({
        serviceable: false,
        estimatedDays: null,
        estimatedDateMin: null,
        estimatedDateMax: null,
        availableCouriers: [],
        selectedCourier: null,
        message: '📦 Delivery not available for this location',
      });
    }

    // UX rule:
    // minDays = estimated_delivery_days
    // maxDays = estimated_delivery_days + 2
    const minDays = estimatedDays != null && estimatedDays > 0 ? Math.ceil(estimatedDays) : null;
    const maxDays = minDays != null ? minDays + 2 : null;

    let estimatedDateMin = null;
    let estimatedDateMax = null;
    if (minDays != null && maxDays != null) {
      const d1 = new Date();
      d1.setDate(d1.getDate() + minDays);
      estimatedDateMin = d1.toISOString().split('T')[0];

      const d2 = new Date();
      d2.setDate(d2.getDate() + maxDays);
      estimatedDateMax = d2.toISOString().split('T')[0];
    }

    const message =
      estimatedDateMin && estimatedDateMax
        ? `Delivery Date ${formatDeliveryDate(estimatedDateMin)} - ${formatDeliveryDate(estimatedDateMax)}`
        : 'Delivery available';
    res.json({
      serviceable: true,
      estimatedDays: estimatedDays ?? null,
      estimatedDateMin,
      estimatedDateMax,
      availableCouriers: availableCouriers || [],
      selectedCourier: selectedCourier || null,
      message,
    });
  } catch (err) {
    console.error('Delivery check error:', err.message);
    // Shiprocket API failed: return 200 with fallback message so frontend can show it
    res.status(200).json({
      serviceable: false,
      estimatedDays: null,
      estimatedDateMin: null,
      estimatedDateMax: null,
      availableCouriers: [],
      selectedCourier: null,
      message: '📦 Delivery not available for this location',
      fallback: true,
    });
  }
};

function formatDeliveryDate(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  const day = d.getUTCDate();
  const month = d.toLocaleDateString('en-IN', { month: 'long' });
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}
