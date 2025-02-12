const request = require('supertest');
const { expect } = require('chai');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const URL = require('../src/models/urlModel');
const User = require('../src/models/userModel');

describe('URL Shortening API Tests', () => {
  let mongoServer;
  let testUser;
  let authToken;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test user
    testUser = new User({
      email: 'test@example.com',
      displayName: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      accountStatus: 'active'
    });
    await testUser.save();
    authToken = testUser.generateAuthToken();
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await URL.deleteMany({});
  });

  describe('POST /api/url/shorten', () => {
    it('should create a new shortened URL', async () => {
      const response = await request(app)
        .post('/api/url/shorten')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          originalUrl: 'https://example.com',
          topic: 'test',
          metadata: {
            createdFrom: 'api',
            userAgent: 'test-agent',
            ipAddress: '127.0.0.1'
          }
        });

      expect(response.status).to.equal(201);
      expect(response.body).to.have.property('shortCode');
      expect(response.body.originalUrl).to.equal('https://example.com');
      expect(response.body.metadata.createdFrom).to.equal('api');
      expect(response.body.topic).to.equal('test');
      expect(response.body.userId).to.equal(testUser.id);
    });

    it('should return existing URL if already shortened by user', async () => {
      const firstResponse = await request(app)
        .post('/api/url/shorten')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          originalUrl: 'https://example.com',
          topic: 'test',
          metadata: {
            createdFrom: 'api',
            userAgent: 'test-agent',
            ipAddress: '127.0.0.1'
          }
        });

      const secondResponse = await request(app)
        .post('/api/url/shorten')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          longUrl: 'https://example.com',
          topic: 'test'
        });

      expect(secondResponse.status).to.equal(200);
      expect(secondResponse.body.shortCode).to.equal(firstResponse.body.shortCode);
    });

    it('should set default topic as uncategorized when not provided', async () => {
      const response = await request(app)
        .post('/api/url/shorten')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          longUrl: 'https://example.com'
        });

      expect(response.status).to.equal(201);
      expect(response.body.topic).to.equal('uncategorized');
    });

    it('should reject invalid URLs', async () => {
      const response = await request(app)
        .post('/api/url/shorten')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          longUrl: 'invalid-url',
          topic: 'test'
        });

      expect(response.status).to.equal(400);
      expect(response.body.error).to.equal('Invalid URL provided');
    });
  });

  describe('POST /api/url/custom', () => {
    it('should create URL with custom alias', async () => {
      const response = await request(app)
        .post('/api/url/custom')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          originalUrl: 'https://example.com',
          customAlias: 'test-alias',
          topic: 'test',
          metadata: {
            createdFrom: 'api',
            userAgent: 'test-agent',
            ipAddress: '127.0.0.1'
          }
        });

      expect(response.status).to.equal(201);
      expect(response.body.shortCode).to.equal('test-alias');
      expect(response.body.originalUrl).to.equal('https://example.com');
      expect(response.body.metadata.createdFrom).to.equal('api');
      expect(response.body.topic).to.equal('test');
    });

    it('should reject duplicate custom aliases', async () => {
      await request(app)
        .post('/api/url/custom')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          longUrl: 'https://example.com',
          customAlias: 'test-alias',
          topic: 'test'
        });

      const response = await request(app)
        .post('/api/url/custom')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          longUrl: 'https://another-example.com',
          customAlias: 'test-alias',
          topic: 'test'
        });

      expect(response.status).to.equal(409);
      expect(response.body.error).to.equal('Custom alias already in use');
    });

    it('should validate custom alias format', async () => {
      const response = await request(app)
        .post('/api/url/custom')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          longUrl: 'https://example.com',
          customAlias: 'invalid@alias',
          topic: 'test'
        });

      expect(response.status).to.equal(400);
      expect(response.body.error).to.equal('Custom alias can only contain letters, numbers, hyphens, and underscores');
    });

    it('should validate custom alias length', async () => {
      const response = await request(app)
        .post('/api/url/custom')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          longUrl: 'https://example.com',
          customAlias: 'abc',
          topic: 'test'
        });

      expect(response.status).to.equal(400);
      expect(response.body.error).to.equal('Custom alias must be between 4 and 15 characters');
    });
  });

  describe('GET /api/url/my-urls', () => {
    it('should return all URLs for authenticated user', async () => {
      await URL.create([
        {
          originalUrl: 'https://example1.com',
          shortCode: 'test1',
          topic: 'test',
          userId: testUser.id,
          isActive: true,
          metadata: {
            createdFrom: 'api',
            userAgent: 'test-agent',
            ipAddress: '127.0.0.1'
          },
          createdAt: new Date()
        },
        {
          longUrl: 'https://example2.com',
          shortId: 'test2',
          topic: 'test',
          userId: testUser.id,
          createdAt: new Date()
        }
      ]);

      const response = await request(app)
        .get('/api/url/my-urls')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf(2);
    });
  });

  describe('GET /api/url/by-topic/:topic', () => {
    it('should return URLs filtered by topic', async () => {
      await URL.create([
        {
          longUrl: 'https://example1.com',
          shortId: 'test1',
          topic: 'topic1',
          userId: testUser.id,
          createdAt: new Date()
        },
        {
          longUrl: 'https://example2.com',
          shortId: 'test2',
          topic: 'topic2',
          userId: testUser.id,
          createdAt: new Date()
        }
      ]);

      const response = await request(app)
        .get('/api/url/by-topic/topic1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0].topic).to.equal('topic1');
    });
  });

  describe('URL Expiration', () => {
    it('should create URL with expiration date', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
      
      const response = await request(app)
        .post('/api/url/shorten')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          originalUrl: 'https://example.com',
          topic: 'test',
          expiresAt: expiresAt.toISOString(),
          metadata: {
            createdFrom: 'api',
            userAgent: 'test-agent',
            ipAddress: '127.0.0.1'
          }
        });

      expect(response.status).to.equal(201);
      expect(response.body).to.have.property('expiresAt');
      expect(new Date(response.body.expiresAt).getTime()).to.equal(expiresAt.getTime());
    });

    it('should not return expired URLs', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1); // Yesterday
      
      await URL.create({
        originalUrl: 'https://example.com',
        shortCode: 'expired',
        topic: 'test',
        userId: testUser.id,
        expiresAt: expiredDate,
        isActive: true,
        metadata: {
          createdFrom: 'api',
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1'
        }
      });

      const response = await request(app)
        .get('/api/url/my-urls')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf(0);
    });
  });
});
