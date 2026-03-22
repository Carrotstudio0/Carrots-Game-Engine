class FallbackLRU {
  constructor(max = 1000, ttl = 0, resetTtl = false) {
    this._max =
      typeof max === 'number' && Number.isFinite(max) && max > 0
        ? Math.floor(max)
        : 0;
    this._ttl =
      typeof ttl === 'number' && Number.isFinite(ttl) && ttl > 0
        ? Math.floor(ttl)
        : 0;
    this._resetTtl = !!resetTtl;
    this._items = new Map();
  }

  _isExpired(entry) {
    return !!entry && entry.expiry > 0 && Date.now() > entry.expiry;
  }

  _computeExpiry() {
    return this._ttl > 0 ? Date.now() + this._ttl : 0;
  }

  _evictIfNeeded() {
    if (this._max <= 0) return;
    while (this._items.size > this._max) {
      const oldestKey = this._items.keys().next().value;
      if (typeof oldestKey === 'undefined') break;
      this._items.delete(oldestKey);
    }
  }

  has(key) {
    const entry = this._items.get(key);
    if (!entry) return false;
    if (this._isExpired(entry)) {
      this._items.delete(key);
      return false;
    }
    return true;
  }

  get(key) {
    const entry = this._items.get(key);
    if (!entry) return undefined;
    if (this._isExpired(entry)) {
      this._items.delete(key);
      return undefined;
    }

    this._items.delete(key);
    this._items.set(key, {
      value: entry.value,
      expiry: this._resetTtl ? this._computeExpiry() : entry.expiry,
    });
    return entry.value;
  }

  set(key, value) {
    if (this._items.has(key)) this._items.delete(key);
    this._items.set(key, { value, expiry: this._computeExpiry() });
    this._evictIfNeeded();
    return this;
  }

  delete(key) {
    return this._items.delete(key);
  }

  clear() {
    this._items.clear();
    return this;
  }

  keys() {
    return Array.from(this._items.keys());
  }

  values() {
    return this.keys().map(key => this.get(key));
  }
}

export const LRU = FallbackLRU;
export const lru = (max = 1000, ttl = 0, resetTtl = false) =>
  new FallbackLRU(max, ttl, resetTtl);

const tinyLruCompat = { LRU, lru };

export default tinyLruCompat;
