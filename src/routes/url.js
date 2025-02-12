const express = require('express');
const router = express.Router();
const { isURL } = require('validator');
const URL = require('../models/urlModel');
const { isAuthenticated } = require('../middleware/auth'); // Update import
const rateLimiter = require('../middleware/rateLimiter');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');
const { nanoid } = require('nanoid');
require('dotenv').config();

// Validation middleware for URL shortening requests
const validateUrlRequest = (req, res, next) => {
  const { longUrl, customAlias, topic } = req.body;
  
  if (!longUrl || !isURL(longUrl)) {
    return res.status(400).json({ error: 'Invalid URL provided' });
  }

  if (customAlias && (customAlias.length < 4 || customAlias.length > 15)) {
    return res.status(400).json({ error: 'Custom alias must be between 4 and 15 characters' });
  }

  if (customAlias && !/^[a-zA-Z0-9-_]+$/.test(customAlias)) {
    return res.status(400).json({ error: 'Custom alias can only contain letters, numbers, hyphens, and underscores' });
  }

  if (topic && typeof topic !== 'string') {
    return res.status(400).json({ error: 'Topic must be a string' });
  }

  next();
};

// Generate a unique short URL
const generateUniqueShortUrl = async (length = 6) => {
  while (true) {
    const shortId = nanoid(length);
    const existing = await URL.findOne({ shortId });
    if (!existing) {
      return shortId;
    }
  }
};

// Unified Short URL endpoint with optional customAlias and topic support
router.post('/shorten', isAuthenticated, rateLimiter, validateUrlRequest, async (req, res) => {
  try {
    const { longUrl, customAlias, topic } = req.body;
    let shortId;
    const baseUrl = process.env.BASE_URL;
    
    if (customAlias) {
      // Custom alias provided: check its availability
      const existingAlias = await URL.findOne({ shortCode: customAlias });
      if (existingAlias) {
        return res.status(409).json({ error: 'Custom alias already in use' });
      }
      const existingUrl = await URL.findOne({ originalUrl: longUrl, userId: req.user.id });
      if (existingUrl) {
        return res.json(existingUrl);
      }
      shortId = customAlias;
    } else {
      const existingUrl = await URL.findOne({ originalUrl: longUrl, userId: req.user.id });
      if (existingUrl) {
        return res.json(existingUrl);
      }
      shortId = await generateUniqueShortUrl();
    }
    
    // Updated property names to match the model
    const url = new URL({
      originalUrl: longUrl,
      shortCode: shortId,
      topic: topic || 'uncategorized',
      userId: req.user.id,
      createdAt: new Date()
    });
    
    await url.save();
    
    // Invalidate user's URL cache and topic cache if applicable
    const userUrlsCacheKey = cacheService.generateKey('urls', req.user.id);
    await cacheService.delete(userUrlsCacheKey);
    if (topic) {
      const topicCacheKey = cacheService.generateKey('urls', req.user.id, 'topic', topic);
      await cacheService.delete(topicCacheKey);
    }
    
    res.status(201).json({...url.toObject(),
      shortUrl: `${process.env.BASE_URL}/${url.shortCode}`
    });
  } catch (error) {
    logger.error('Error in URL shortening:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all URLs for the authenticated user
router.get('/my-urls', isAuthenticated, async (req, res) => {
  try {
    const cacheKey = cacheService.generateKey('urls', req.user.id);
    const urls = await cacheService.getOrSet(
      cacheKey,
      async () => {
        return await URL.find({ userId: req.user.id })
          .sort({ createdAt: -1 })
          .lean();
      },
      300 // Cache for 5 minutes
    );
    res.json(urls);
  } catch (error) {
    logger.error('Error fetching URLs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get URLs by topic for the authenticated user
router.get('/by-topic/:topic', isAuthenticated, async (req, res) => {
  try {
    const cacheKey = cacheService.generateKey('urls', req.user.id, 'topic', req.params.topic);
    const urls = await cacheService.getOrSet(
      cacheKey,
      async () => {
        return await URL.find({ 
          userId: req.user.id,
          topic: req.params.topic 
        }).sort({ createdAt: -1 }).lean();
      },
      300 // Cache for 5 minutes
    );
    res.json(urls);
  } catch (error) {
    logger.error('Error fetching URLs by topic:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
