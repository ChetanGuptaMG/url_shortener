const Redis = require('ioredis');
const config = require('../config/index');
const logger = require('../utils/logger');

class CacheService {
    constructor() {
        this.client = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        });

        this.client.on('error', (err) => {
            logger.error('Redis Client Error:', err);
        });

        this.client.on('connect', () => {
            logger.info('Redis Client Connected');
        });
    }

    async set(key, value, ttlSeconds = 3600) {
        try {
            const serializedValue = JSON.stringify(value);
            if (ttlSeconds > 0) {
                await this.client.setex(key, ttlSeconds, serializedValue);
            } else {
                await this.client.set(key, serializedValue);
            }
            return true;
        } catch (error) {
            logger.error('Cache Set Error:', error);
            return false;
        }
    }

    async get(key) {
        try {
            const value = await this.client.get(key);
            if (!value) return null;
            return JSON.parse(value);
        } catch (error) {
            logger.error('Cache Get Error:', error);
            return null;
        }
    }

    async delete(key) {
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            logger.error('Cache Delete Error:', error);
            return false;
        }
    }

    generateKey(...parts) {
        return parts.join(':');
    }

    async getOrSet(key, callback, ttlSeconds = 3600) {
        try {
            const cachedValue = await this.get(key);
            if (cachedValue) return cachedValue;

            const freshValue = await callback();
            await this.set(key, freshValue, ttlSeconds);
            return freshValue;
        } catch (error) {
            logger.error('Cache GetOrSet Error:', error);
            return null;
        }
    }

    async clearPattern(pattern) {
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(...keys);
            }
            return true;
        } catch (error) {
            logger.error('Cache Clear Pattern Error:', error);
            return false;
        }
    }

    async increment(key, ttlSeconds = 3600) {
        try {
            const value = await this.client.incr(key);
            if (ttlSeconds > 0) {
                await this.client.expire(key, ttlSeconds);
            }
            return value;
        } catch (error) {
            logger.error('Cache Increment Error:', error);
            return null;
        }
    }
}

module.exports = new CacheService();