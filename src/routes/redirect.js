const express = require('express');
const router = express.Router();
const URL = require('../models/urlModel');
const Analytics = require('../models/analyticsModel');
const geoip = require('geoip-lite');
const useragent = require('express-useragent');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

// Middleware to parse user agent
router.use(useragent.express());

router.get('/api/shorten/:alias', async (req, res) => {
    try {
        const { alias } = req.params;

        // Try to get URL from cache first
        const cacheKey = `url:${alias}`;
        let url = await cacheService.get(cacheKey);

        if (!url) {
            // If not in cache, get from database
            url = await URL.findOne({ shortCode: alias, isActive: true });
            
            if (url) {
                // Cache the URL for future requests
                await cacheService.set(cacheKey, url, 3600); // Cache for 1 hour
            }
        }

        if (!url) {
            return res.status(404).json({ error: 'URL not found or inactive' });
        }

        if (url.expiresAt && new Date(url.expiresAt) < new Date()) {
            return res.status(410).json({ error: 'URL has expired' });
        }

        // Get geolocation data
        const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const geo = geoip.lookup(ip) || {};

        // Determine device type
        const deviceType = req.useragent.isMobile ? 'mobile' : 
                          (req.useragent.isTablet ? 'tablet' : 
                          (req.useragent.isDesktop ? 'desktop' : 'other'));

        // Create or update analytics
        const analytics = await Analytics.findOneAndUpdate(
            { shortUrlId: url._id },
            {
                $inc: {
                    redirectCount: 1,
                    [`deviceStats.${deviceType}`]: 1,
                    [`browserStats.${req.useragent.browser}`]: 1,
                    [`countryStats.${geo.country || 'unknown'}`]: 1
                },
                $set: { lastAccessed: new Date() },
                $push: {
                    redirects: {
                        timestamp: new Date(),
                        userAgent: {
                            browser: req.useragent.browser,
                            version: req.useragent.version,
                            os: req.useragent.os,
                            platform: req.useragent.platform,
                            device: deviceType
                        },
                        geolocation: {
                            country: geo.country || 'Unknown',
                            city: geo.city || 'Unknown',
                            region: geo.region || 'Unknown',
                            latitude: geo.ll ? geo.ll[0] : null,
                            longitude: geo.ll ? geo.ll[1] : null,
                            timezone: geo.timezone || 'Unknown'
                        },
                        ipAddress: ip,
                        referrer: req.get('referrer') || '',
                        language: req.get('accept-language') || ''
                    }
                }
            },
            { upsert: true, new: true }
        ).catch(err => {
            logger.error('Error updating analytics:', err);
        });

        // Update URL stats
        await URL.findByIdAndUpdate(url._id, {
            $inc: { clicks: 1 },
            $set: { lastAccessed: new Date() }
        }).catch(err => {
            logger.error('Error updating URL stats:', err);
        });

        // Perform redirection
        res.redirect(url.originalUrl);
    } catch (error) {
        console.error('Redirection error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
