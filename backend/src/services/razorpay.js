const Razorpay = require('razorpay');

let razorpayInstance = null;

const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

if (razorpayKeyId && razorpayKeySecret) {
  razorpayInstance = new Razorpay({
    key_id: razorpayKeyId,
    key_secret: razorpayKeySecret,
  });
}

module.exports = {
  razorpayInstance,
  razorpayKeyId,
  razorpayKeySecret
};
