const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const router = express.Router();
const User = require('../models/userModel');
const { validateSession } = require('../middleware/auth'); // Update import
const config = require('../config/index');
const bcrypt = require('bcrypt');

// Configure Google OAuth2 Strategy
passport.use(new GoogleStrategy({
    clientID: config.google.clientId,
    clientSecret: config.google.clientSecret,
    callbackURL: config.google.callbackURL,
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        // Check if user exists
        let user = await User.findOne({ googleId: profile.id });
        
        if (!user) {
            // Create new user if doesn't exist
            user = await User.create({
                googleId: profile.id,
                email: profile.emails[0].value,
                displayName: profile.displayName,
                firstName: profile.name?.givenName || '',
                lastName: profile.name?.familyName || '',
                profilePicture: profile.photos[0]?.value || '',
                accountStatus: 'active',
                lastLogin: new Date()
            });
        }
        
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Serialize user for the session
passport.serializeUser((user, done) => {
    console.log('Serializing user:', user);
    done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        console.log('Deserialized user:', user);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Local user registration
router.post('/register', async (req, res, next) => {
    // ...validate input fields...
    try {
        const { email, password, displayName } = req.body;
        if (!email || !password || !displayName) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        if (await User.findOne({ email })) {
            return res.status(409).json({ message: 'User already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, displayName, password: hashedPassword });
        await user.save();
        return res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        next(error);
    }
});

// Local user login (if needed)
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !user.password) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // Use passport's login method to establish session
        req.login(user, (err) => {
            if (err) return next(err);
            return res.status(200).json({ message: 'Logged in successfully' });
        });
    } catch (error) {
        next(error);
    }
});

// Initiate Google OAuth2 authentication
router.get('/google',
    passport.authenticate('google', {
        scope: ['profile', 'email']
    })
);

// Google OAuth2 callback route
router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/login',
        session: true
    }),
    async (req, res) => {
        try {
            // Update last login time
            await User.findByIdAndUpdate(req.user.id, {
                lastLogin: new Date()
            });
            res.json({ message: 'Logged in successfully' });
        } catch (error) {
            console.error('Login update error:', error);
            res.status(500).json({ error: 'Failed to update last login' });
             
        }
    }
);

// Check authentication status
router.get('/status', validateSession, (req, res) => {
    console.log('Authenticated user:', req.user);
    res.json({
        isAuthenticated: true,
        user: {
            id: req.user.id,
            displayName: req.user.displayName,
            email: req.user.email,
            profilePicture: req.user.profilePicture,
            role: req.user.role,
            preferences: req.user.preferences,
            lastLogin: req.user.lastLogin
        }
    });
});

// Logout route
router.get('/logout', (req, res) => {
    console.log('Logging out user:');
    req.logout(function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error during logout' });
        }
        req.session.destroy(() => {
            // Pass same cookie options if needed (e.g., path, domain)
            res.clearCookie('connect.sid', { path: '/' });
            res.json({ message: 'Logged out successfully' });
        });
    });
});

// Debug endpoint to inspect session and user details
router.get('/debug-session', (req, res) => {
    console.log('Session:', req.session);
    console.log('Is authenticated:', req.isAuthenticated());
    res.json({
        session: req.session,
        user: req.user || null
    });
});

// Error handling middleware
router.use((err, req, res, next) => {
    console.error('Auth Error:', err);
    
    // Handle specific OAuth errors
    if (err.name === 'OAuth2Error') {
        return res.status(401).json({
            error: 'OAuth authentication failed',
            message: 'Failed to authenticate with Google'
        });
    }
    
    // Handle session errors
    if (err.name === 'SessionError') {
        return res.status(403).json({
            error: 'Session error',
            message: 'Invalid or expired session'
        });
    }
    
    // Default error response
    res.status(500).json({
        error: 'Authentication error occurred',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

module.exports = router;
