const Redis = require('redis');
const rateLimiter = require('../src/middleware/rateLimiter');

// Mock Redis client
jest.mock('redis', () => {
    const mockIncr = jest.fn();
    const mockExpire = jest.fn();
    const mockTtl = jest.fn();
    
    return {
        createClient: jest.fn(() => ({
            incr: mockIncr,
            expire: mockExpire,
            ttl: mockTtl,
            on: jest.fn(),
            quit: jest.fn()
        })),
        mockIncr,
        mockExpire,
        mockTtl
    };
});

describe('Rate Limiter Middleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup request mock
        mockReq = {
            ip: '127.0.0.1',
            user: null
        };

        // Setup response mock
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            setHeader: jest.fn()
        };

        // Setup next function mock
        mockNext = jest.fn();

        // Reset Redis mock implementations
        Redis.mockIncr.mockImplementation((key, callback) => callback(null, 1));
        Redis.mockExpire.mockImplementation((key, time, callback) => callback(null, 1));
        Redis.mockTtl.mockImplementation((key, callback) => callback(null, 60));
    });

    test('should allow requests within rate limit', async () => {
        Redis.mockIncr.mockImplementation((key, callback) => callback(null, 50));

        await rateLimiter(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 50);
        expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should block requests exceeding rate limit', async () => {
        Redis.mockIncr.mockImplementation((key, callback) => callback(null, 101));

        await rateLimiter(mockReq, mockRes, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(429);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Too Many Requests'
            })
        );
    });

    test('should set correct rate limit headers', async () => {
        Redis.mockIncr.mockImplementation((key, callback) => callback(null, 50));

        await rateLimiter(mockReq, mockRes, mockNext);

        expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
        expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 50);
        expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', 60);
    });

    test('should use user ID as identifier when authenticated', async () => {
        mockReq.user = { id: 'user123' };
        Redis.mockIncr.mockImplementation((key, callback) => {
            expect(key).toContain('user123');
            callback(null, 1);
        });

        await rateLimiter(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
    });

    test('should use IP as identifier when not authenticated', async () => {
        Redis.mockIncr.mockImplementation((key, callback) => {
            expect(key).toContain('127.0.0.1');
            callback(null, 1);
        });

        await rateLimiter(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
    });

    test('should continue if Redis throws an error', async () => {
        Redis.mockIncr.mockImplementation((key, callback) => callback(new Error('Redis error')));

        await rateLimiter(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
    });

    test('should set expiry on first request', async () => {
        Redis.mockIncr.mockImplementation((key, callback) => callback(null, 1));

        await rateLimiter(mockReq, mockRes, mockNext);

        expect(Redis.mockExpire).toHaveBeenCalled();
    });

    test('should not set expiry on subsequent requests', async () => {
        Redis.mockIncr.mockImplementation((key, callback) => callback(null, 2));

        await rateLimiter(mockReq, mockRes, mockNext);

        expect(Redis.mockExpire).not.toHaveBeenCalled();
    });

    test('should calculate remaining requests correctly at limit boundary', async () => {
        Redis.mockIncr.mockImplementation((key, callback) => callback(null, 100));
        Redis.mockTtl.mockImplementation((key, callback) => callback(null, 30));

        await rateLimiter(mockReq, mockRes, mockNext);

        expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
        expect(mockNext).toHaveBeenCalled();
    });

    test('should handle Redis TTL failure gracefully', async () => {
        Redis.mockIncr.mockImplementation((key, callback) => callback(null, 50));
        Redis.mockTtl.mockImplementation((key, callback) => callback(new Error('TTL Error')));

        await rateLimiter(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', 60); // Default TTL
    });

    test('should include retry-after header when rate limit exceeded', async () => {
        Redis.mockIncr.mockImplementation((key, callback) => callback(null, 101));
        Redis.mockTtl.mockImplementation((key, callback) => callback(null, 45));

        await rateLimiter(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(429);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                retryAfter: 45,
                message: expect.stringContaining('45 seconds')
            })
        );
    });
});
