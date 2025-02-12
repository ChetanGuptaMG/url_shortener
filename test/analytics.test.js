const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const app = require('../src/app');
const Analytics = require('../src/models/analyticsModel');
const URL = require('../src/models/urlModel');
const { cache } = require('../src/utils/cache');

describe('Analytics API Tests', () => {
    let authToken;
    let testUrl;
    let testAnalytics;

    before(async () => {
        // Setup authentication
        authToken = 'test-auth-token';
        
        // Create test URL
        testUrl = await URL.create({
            originalUrl: 'https://example.com',
            shortUrl: 'test123',
            topic: 'technology',
            userId: new mongoose.Types.ObjectId()
        });

        // Create test analytics data
        testAnalytics = await Analytics.create({
            shortUrlId: testUrl._id,
            redirectCount: 1,
            redirects: [{
                timestamp: new Date(),
                userAgent: {
                    browser: 'Chrome',
                    version: '91.0',
                    os: 'Windows',
                    platform: 'desktop',
                    device: 'desktop'
                },
                geolocation: {
                    country: 'US',
                    city: 'New York',
                    region: 'NY'
                },
                ipAddress: '127.0.0.1',
                referrer: 'https://google.com',
                language: 'en-US'
            }],
            dailyStats: [{
                date: new Date(),
                count: 1
            }],
            deviceStats: {
                desktop: 1,
                mobile: 0,
                tablet: 0,
                other: 0
            },
            browserStats: new Map([['Chrome', 1]]),
            countryStats: new Map([['US', 1]]),
            lastAccessed: new Date()
        });
    });

    beforeEach(async () => {
        await cache.flushall();
    });

    after(async () => {
        // Cleanup test data
        await URL.deleteMany({});
        await Analytics.deleteMany({});
    });

    describe('GET /analytics/url/:urlId', () => {
        it('should return correct analytics for a specific URL', async () => {
            const response = await request(app)
                .get(`/analytics/url/${testUrl._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).to.equal(200);
            expect(response.body).to.have.property('redirectCount').equal(1);
            expect(response.body).to.have.property('deviceStats');
            expect(response.body.deviceStats).to.have.property('desktop').equal(1);
            expect(response.body.browserStats).to.have.property('Chrome').equal(1);
            expect(response.body.countryStats).to.have.property('US').equal(1);
            expect(response.body).to.have.property('redirects').to.be.an('array');
            expect(response.body.redirects[0]).to.have.property('userAgent');
            expect(response.body.redirects[0]).to.have.property('geolocation');
            expect(response.body.dailyStats).to.be.an('array');
        });

        it('should return 400 for invalid URL ID', async () => {
            const response = await request(app)
                .get('/analytics/url/invalid-id')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).to.equal(400);
            expect(response.body).to.have.property('error');
        });

        it('should use cached data when available', async () => {
            const cachedData = {
                totalClicks: 5,
                uniqueVisitors: 3
            };
            await cache.set(`analytics:${testUrl._id}`, JSON.stringify(cachedData));

            const response = await request(app)
                .get(`/analytics/url/${testUrl._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).to.equal(200);
            expect(response.body).to.deep.equal(cachedData);
        });
    });

    describe('GET /analytics/topic/:topic', () => {
        it('should return correct analytics for a specific topic', async () => {
            const response = await request(app)
                .get('/analytics/topic/technology')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).to.equal(200);
            expect(response.body).to.have.property('totalUrls');
            expect(response.body).to.have.property('totalClicks');
            expect(response.body).to.have.property('urls').to.be.an('array');
        });

        it('should return empty results for non-existent topic', async () => {
            const response = await request(app)
                .get('/analytics/topic/nonexistent')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).to.equal(200);
            expect(response.body).to.deep.equal({
                totalUrls: 0,
                totalClicks: 0,
                urls: []
            });
        });

        it('should use cached data for topic analytics', async () => {
            const cachedData = {
                totalUrls: 10,
                totalClicks: 50,
                urls: []
            };
            await cache.set('analytics:topic:technology', JSON.stringify(cachedData));

            const response = await request(app)
                .get('/analytics/topic/technology')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).to.equal(200);
            expect(response.body).to.deep.equal(cachedData);
        });
    });

    describe('GET /analytics/overall', () => {
        it('should return correct overall system statistics', async () => {
            const response = await request(app)
                .get('/analytics/overall')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).to.equal(200);
            expect(response.body).to.have.property('urls');
            expect(response.body).to.have.property('analytics');
            expect(response.body.urls).to.have.property('totalUrls');
            expect(response.body.analytics).to.have.property('totalClicks');
            expect(response.body.analytics).to.have.property('uniqueVisitors');
        });

        it('should use cached data for overall statistics', async () => {
            const cachedData = {
                urls: { totalUrls: 100, topicDistribution: [] },
                analytics: {
                    totalClicks: 500,
                    uniqueVisitors: 200,
                    browserDistribution: [],
                    locationDistribution: []
                }
            };
            await cache.set('analytics:overall', JSON.stringify(cachedData));

            const response = await request(app)
                .get('/analytics/overall')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).to.equal(200);
            expect(response.body).to.deep.equal(cachedData);
        });
    });

    describe('Cache Invalidation', () => {
        it('should invalidate cache when analytics are updated', async () => {
            // First request to cache the data
            await request(app)
                .get(`/analytics/url/${testUrl._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            // Update analytics
            await Analytics.updateOne(
                { shortUrlId: testUrl._id },
                { $inc: { redirectCount: 1 } }
            );

            // Second request should have updated data
            const response = await request(app)
                .get(`/analytics/url/${testUrl._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).to.equal(200);
            expect(response.body.redirectCount).to.equal(2);
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            const stub = sinon.stub(Analytics, 'aggregate').throws(new Error('Database error'));
            const cacheStub = sinon.stub(cache, 'get').resolves(null);

            const response = await request(app)
                .get(`/analytics/url/${testUrl._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).to.equal(500);
            expect(response.body).to.have.property('error');

            stub.restore();
            cacheStub.restore();
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get(`/analytics/url/${testUrl._id}`);

            expect(response.status).to.equal(401);
        });

        it('should handle rate limiting', async () => {
            // Simulate rate limit exceeded
            const promises = Array(11).fill().map(() =>
                request(app)
                    .get(`/analytics/url/${testUrl._id}`)
                    .set('Authorization', `Bearer ${authToken}`)
            );

            const responses = await Promise.all(promises);
            const lastResponse = responses[responses.length - 1];

            expect(lastResponse.status).to.equal(429);
        });
    });
});
