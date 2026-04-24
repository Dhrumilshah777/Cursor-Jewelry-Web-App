const crypto = require('crypto');

function computeWeakEtagFromJson(data) {
  const json = JSON.stringify(data);
  const hash = crypto.createHash('sha1').update(json).digest('base64url');
  return `W/"${hash}"`;
}

/**
 * Sends JSON with a weak ETag and supports If-None-Match -> 304.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {any} data
 * @param {{ cacheControl?: string }} [opts]
 */
function sendJsonWithEtag(req, res, data, opts = {}) {
  const etag = computeWeakEtagFromJson(data);
  res.set('ETag', etag);
  if (opts.cacheControl) res.set('Cache-Control', opts.cacheControl);

  const inm = req.headers['if-none-match'];
  if (typeof inm === 'string' && inm.includes(etag)) {
    return res.status(304).end();
  }
  return res.json(data);
}

module.exports = { sendJsonWithEtag, computeWeakEtagFromJson };

