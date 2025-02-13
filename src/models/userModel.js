const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address'],
    maxlength: [255, 'Email cannot be more than 255 characters']
  },
  password: {
    type: String,
    required: function() { return !this.googleId; }
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, 'Display name must be at least 2 characters'],
    maxlength: [50, 'Display name cannot be more than 50 characters']
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  profilePicture: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  },
  lastLogin: {
    type: Date
  },
  preferences: {
    defaultUrlExpiryDays: {
      type: Number,
      default: 30,
      min: [1, 'Minimum expiry days is 1'],
      max: [365, 'Maximum expiry days is 365']
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    }
  },
  apiKey: {
    type: String,
    unique: true,
    sparse: true,
    match: [/^[A-Za-z0-9-_]{32}$/, 'API key must be 32 characters long and contain only alphanumeric characters, hyphens, and underscores']
  },
  dailyApiLimit: {
    type: Number,
    default: 100,
    min: [10, 'Minimum daily API limit is 10'],
    max: [1000, 'Maximum daily API limit is 1000']
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ apiKey: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
