// In-flight request deduplication to prevent cache stampedes.
// key -> Promise<data>
const inFlight = new Map();

async function runOnce(key, fn) {
  if (inFlight.has(key)) return inFlight.get(key);

  const p = (async () => fn())();
  inFlight.set(key, p);

  try {
    return await p;
  } finally {
    inFlight.delete(key);
  }
}

module.exports = { inFlight, runOnce };

