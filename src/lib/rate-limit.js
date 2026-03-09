const bucketStore = new Map();

function now() {
  return Date.now();
}

function toBucketKey(key, windowMs) {
  const currentWindow = Math.floor(now() / windowMs);
  return `${key}:${currentWindow}`;
}

export function rateLimit({ key, limit, windowMs }) {
  const bucketKey = toBucketKey(key, windowMs);
  const current = bucketStore.get(bucketKey) || 0;

  if (current >= limit) {
    return { allowed: false };
  }

  bucketStore.set(bucketKey, current + 1);

  // Opportunistic cleanup keeps this map from growing forever.
  if (bucketStore.size > 2000) {
    const activeWindow = Math.floor(now() / windowMs);
    for (const storedKey of bucketStore.keys()) {
      const suffix = Number(storedKey.split(':').pop());
      if (!Number.isNaN(suffix) && suffix < activeWindow - 2) {
        bucketStore.delete(storedKey);
      }
    }
  }

  return { allowed: true };
}
