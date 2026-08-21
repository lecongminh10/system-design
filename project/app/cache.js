const Redis = require('ioredis');

const redisHost = process.env.REDIS_HOST || 'redis';
const redisPort = parseInt(process.env.REDIS_PORT || '6379');

const redis = new Redis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 2000)
});

redis.on('connect', () => {
  console.log(`[Redis] Connected to ${redisHost}:${redisPort}`);
});

redis.on('error', (err) => {
  console.error('[Redis Error]', err.message);
});

/**
 * Cache-Aside Pattern Implementation
 * 1. Check Redis Cache
 * 2. Hit -> Return cached data immediately
 * 3. Miss -> Call fetchFn() (DB Query), store in Redis with TTL, then return data
 */
async function getOrSetCache(key, ttlSeconds, fetchFn) {
  try {
    const cachedData = await redis.get(key);
    if (cachedData) {
      return {
        data: JSON.parse(cachedData),
        cacheHit: true
      };
    }
  } catch (err) {
    console.warn(`[Redis Cache Miss/Error] Key: ${key}`, err.message);
  }

  // Cache Miss or Redis Error -> Fetch from DB
  const freshData = await fetchFn();

  if (freshData !== null && freshData !== undefined) {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(freshData));
    } catch (err) {
      console.error(`[Redis Set Error] Key: ${key}`, err.message);
    }
  }

  return {
    data: freshData,
    cacheHit: false
  };
}

/**
 * Invalidate specific cache key or pattern
 */
async function invalidateCache(key) {
  try {
    await redis.del(key);
    console.log(`[Redis Invalidate] Cache key cleared: ${key}`);
  } catch (err) {
    console.error(`[Redis Invalidate Error] Key: ${key}`, err.message);
  }
}

/**
 * Get Redis health status
 */
async function getCacheStatus() {
  try {
    const ping = await redis.ping();
    return { status: 'UP', ping };
  } catch (err) {
    return { status: 'DOWN', error: err.message };
  }
}

module.exports = {
  redis,
  getOrSetCache,
  invalidateCache,
  getCacheStatus
};
