// Simple in-memory TTL cache for small deployments.
// Note: This cache is per-process; in multi-instance deployments use Redis instead.
class AppCache {
  constructor({ maxItems = 500 } = {}) {
    /** @type {Map<string, { value: any, expiresAt: number }>} */
    this.store = new Map();
    this.maxItems = Number.isFinite(maxItems) && maxItems > 0 ? maxItems : 500;
  }

  get(key) {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return hit.value;
  }

  set(key, value, ttlMs) {
    const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 0;
    if (!ttl) return;
    if (this.store.size >= this.maxItems) {
      // Evict oldest entry (Map iteration order is insertion order).
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttl });
  }

  del(key) {
    this.store.delete(key);
  }

  delPrefix(prefix) {
    if (!prefix) return;
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }
}

module.exports = new AppCache({ maxItems: 500 });

