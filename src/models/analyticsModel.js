const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  shortUrlId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShortUrl',
    required: true,
    index: true
  },
  redirectCount: {
    type: Number,
    default: 0,
    required: true
  },
  redirects: [{
    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    },
    userAgent: {
      browser: String,
      version: String,
      os: String,
      platform: String,
      device: String
    },
    geolocation: {
      country: String,
      city: String,
      region: String,
      latitude: Number,
      longitude: Number,
      timezone: String
    },
    ipAddress: {
      type: String,
      required: true
    },
    referrer: String,
    language: String
  }],
  dailyStats: [{
    date: {
      type: Date,
      required: true
    },
    count: {
      type: Number,
      default: 0
    }
  }],
  deviceStats: {
    desktop: {
      type: Number,
      default: 0
    },
    mobile: {
      type: Number,
      default: 0
    },
    tablet: {
      type: Number,
      default: 0
    },
    other: {
      type: Number,
      default: 0
    }
  },
  browserStats: {
    type: Map,
    of: Number,
    default: new Map()
  },
  countryStats: {
    type: Map,
    of: Number,
    default: new Map()
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
analyticsSchema.index({ shortUrlId: 1, 'redirects.timestamp': -1 });
analyticsSchema.index({ 'dailyStats.date': 1 });
analyticsSchema.index({ lastAccessed: -1 });

const Analytics = mongoose.model('Analytics', analyticsSchema);

module.exports = Analytics;