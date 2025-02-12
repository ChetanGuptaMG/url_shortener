const mongoose = require('mongoose');
const { isURL } = require('validator');

const urlSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: [true, 'Original URL is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return isURL(v, { protocols: ['http', 'https'], require_protocol: true, allow_fragments: true });
      },
      message: 'Please enter a valid URL'
    }
  },
  shortCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  customAlias: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9-_]+$/.test(v);
      },
      message: 'Custom alias can only contain letters, numbers, hyphens, and underscores'
    }
  },
  topic: {
    type: String,
    trim: true,
    lowercase: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clicks: {
    type: Number,
    default: 0
  },
  lastAccessed: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date
  },
  metadata: {
    createdFrom: {
      type: String,
      enum: ['web', 'api', 'mobile'],
      default: 'web'
    },
    userAgent: String,
    ipAddress: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for user-specific queries
urlSchema.index({ userId: 1, createdAt: -1 });

// TTL index for automatic document expiration
urlSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const URL = mongoose.model('URL', urlSchema);

module.exports = URL;