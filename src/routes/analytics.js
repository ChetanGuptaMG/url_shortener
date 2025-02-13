const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth'); 
const rateLimiter = require('../middleware/rateLimiter');
const Analytics = require('../models/analyticsModel');
const ShortUrl = require('../models/urlModel');
const { validateObjectId } = require('../utils/validation');
const cacheService = require('../services/cacheService');
const mongoose = require('mongoose');
const URL = require('../models/urlModel');
const logger = require('../utils/logger');

// Get analytics for a specific URL
router.get('/url/:urlId', isAuthenticated, rateLimiter, async (req, res) => {
    try {
        const { urlId } = req.params;

        if (!validateObjectId(urlId)) {
            return res.status(400).json({ error: 'Invalid URL ID format' });
        }

        // get from cache first
        const cachedData = await cacheService.get(`analytics:url:${urlId}`);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }

        const urlAnalytics = await Analytics.aggregate([
            { $match: { shortUrlId: urlId } },
            {
                $project: {
                    redirectCount: 1,
                    deviceStats: 1,
                    browserStats: 1,
                    countryStats: 1,
                    dailyStats: 1,
                    redirects: {
                        $slice: ['$redirects', -50]
                    }
                }
            },
            {
                $project: {
                    totalClicks: 1,
                    uniqueVisitors: { $size: '$uniqueVisitors' },
                    browserStats: 1,
                    locationStats: 1,
                    timeSeriesData: 1
                }
            }
        ]);

        const result = urlAnalytics[0] || { totalClicks: 0, uniqueVisitors: 0, browserStats: [], locationStats: [], timeSeriesData: [] };
        
        await cacheService.set(`analytics:url:${urlId}`, JSON.stringify(result), 300);
        
        res.json(result);
    } catch (error) {
        console.error('Error fetching URL analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
});

// Updated Topic-Based Analytics Endpoint with detailed breakdowns
router.get('/topic/:topic', isAuthenticated, rateLimiter, async (req, res) => {
  try {
    const { topic } = req.params;
    const urls = await ShortUrl.find({ topic }, { _id: 1 });
    const ids = urls.map(u => u._id);
    if (ids.length === 0) {
      return res.status(404).json({ error: 'No URLs found for the specified topic' });
    }
    
    const analyticData = await Analytics.aggregate([
      { $match: { shortUrlId: { $in: ids } } },
      { $unwind: "$redirects" },
      { $facet: {
          totalClicks: [ { $count: "count" } ],
          uniqueUsers: [
            { $group: { _id: "$redirects.ipAddress" } },
            { $count: "count" }
          ],
          byDate: [
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$redirects.timestamp" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
          ],
          byOS: [
            { $group: { _id: "$redirects.userAgent.os", count: { $sum: 1 } } }
          ],
          byDevice: [
            { $group: { _id: "$redirects.userAgent.device", count: { $sum: 1 } } }
          ]
      }},
      { $project: {
          totalClicks: { $arrayElemAt: ["$totalClicks.count", 0] },
          uniqueUsers: { $arrayElemAt: ["$uniqueUsers.count", 0] },
          byDate: 1,
          byOS: 1,
          byDevice: 1
      }}
    ]);
    
    const result = analyticData[0] || { totalClicks: 0, uniqueUsers: 0, byDate: [], byOS: [], byDevice: [] };
    res.json(result);
  } catch (error) {
    console.error('Error fetching topic analytics:', error);
    res.status(500).json({ error: 'Failed to fetch topic analytics' });
  }
});

// Updated Overall Analytics Endpoint with detailed breakdowns
router.get('/overall', isAuthenticated, rateLimiter, async (req, res) => {
  try {
    const analyticsData = await Analytics.aggregate([
      { $unwind: "$redirects" },
      { $facet: {
          totalClicks: [ { $count: "count" } ],
          uniqueUsers: [
            { $group: { _id: "$redirects.ipAddress" } },
            { $count: "count" }
          ],
          byDate: [
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$redirects.timestamp" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
          ],
          byOS: [
            { $group: { _id: "$redirects.userAgent.os", count: { $sum: 1 } } }
          ],
          byDevice: [
            { $group: { _id: "$redirects.userAgent.device", count: { $sum: 1 } } }
          ]
      }},
      { $project: {
          totalClicks: { $arrayElemAt: ["$totalClicks.count", 0] },
          uniqueUsers: { $arrayElemAt: ["$uniqueUsers.count", 0] },
          byDate: 1,
          byOS: 1,
          byDevice: 1
      }}
    ]);
    
    const result = analyticsData[0] || { totalClicks: 0, uniqueUsers: 0, byDate: [], byOS: [], byDevice: [] };
    res.json(result);
  } catch (error) {
    console.error('Error fetching overall analytics:', error);
    res.status(500).json({ error: 'Failed to fetch overall analytics' });
  }
});

// New Detailed Analytics API: GET /api/analytics/:shortCode
router.get('/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;

    const urlRecord = await URL.findOne({ shortCode });
    if (!urlRecord) {
      return res.status(404).json({ error: 'URL not found' });
    }
    
    const analyticsData = await Analytics.aggregate([
      { $match: { shortUrlId: mongoose.Types.ObjectId(urlRecord._id) } },
      { $unwind: "$redirects" },
      { $facet: {
          totalClicks: [ { $count: "count" } ],
          uniqueUsers: [
            { $group: { _id: "$redirects.ipAddress" } },
            { $count: "count" }
          ],
          byDate: [
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$redirects.timestamp" } },
                count: { $sum: 1 }
            }},
            { $sort: { _id: 1 } }
          ],
          byOS: [
            { $group: {
                _id: "$redirects.userAgent.os",
                count: { $sum: 1 }
            }}
          ],
          byDevice: [
            { $group: {
                _id: "$redirects.userAgent.device",
                count: { $sum: 1 }
            }}
          ]
      }},
      { $project: {
          totalClicks: { $arrayElemAt: ["$totalClicks.count", 0] },
          uniqueUsers: { $arrayElemAt: ["$uniqueUsers.count", 0] },
          byDate: 1,
          byOS: 1,
          byDevice: 1
      }}
    ]);
    
    const result = analyticsData[0] || {
      totalClicks: 0,
      uniqueUsers: 0,
      byDate: [],
      byOS: [],
      byDevice: []
    };
    
    res.json(result);
  } catch (error) {
    logger.error('Analytics aggregation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
