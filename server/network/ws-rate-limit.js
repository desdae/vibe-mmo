"use strict";

function normalizeLimitValue(value) {
  const numeric = Math.floor(Number(value) || 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function createSlidingWindowRateLimiter(options = {}) {
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const buckets = new Map();

  function prune(key, currentTime, windowMs) {
    const bucket = buckets.get(key);
    if (!Array.isArray(bucket) || bucket.length === 0) {
      buckets.delete(key);
      return [];
    }
    let firstLiveIndex = 0;
    while (firstLiveIndex < bucket.length && currentTime - bucket[firstLiveIndex] >= windowMs) {
      firstLiveIndex += 1;
    }
    const live = firstLiveIndex > 0 ? bucket.slice(firstLiveIndex) : bucket;
    if (live.length > 0) {
      buckets.set(key, live);
      return live;
    }
    buckets.delete(key);
    return [];
  }

  function check(key, options = {}) {
    const normalizedKey = typeof key === "string" ? key.trim() : "";
    const windowMs = normalizeLimitValue(options.windowMs);
    const maxEvents = normalizeLimitValue(options.maxEvents);
    const consume = options.consume !== false;

    if (!normalizedKey || windowMs <= 0 || maxEvents <= 0) {
      return {
        allowed: true,
        remaining: null,
        retryAfterMs: 0
      };
    }

    const currentTime = now();
    const live = prune(normalizedKey, currentTime, windowMs);
    if (live.length >= maxEvents) {
      const oldestEvent = live[0];
      const retryAfterMs = Math.max(1, windowMs - (currentTime - oldestEvent));
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs
      };
    }

    if (consume) {
      live.push(currentTime);
      buckets.set(normalizedKey, live);
    }

    return {
      allowed: true,
      remaining: Math.max(0, maxEvents - live.length),
      retryAfterMs: 0
    };
  }

  function clear(key) {
    const normalizedKey = typeof key === "string" ? key.trim() : "";
    if (normalizedKey) {
      buckets.delete(normalizedKey);
    }
  }

  return {
    check,
    clear
  };
}

module.exports = {
  createSlidingWindowRateLimiter
};
