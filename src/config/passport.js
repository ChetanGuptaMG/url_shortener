const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userModel');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
            user = new User({
                googleId: profile.id,
                displayName: profile.displayName,
                email: (profile.emails && profile.emails[0].value) || undefined,
                profilePicture: (profile.photos && profile.photos[0].value) || undefined
            });
            await user.save();
        }
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    console.log('Serializing user:', user.id);
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try { 
        const user = await require('../models/userModel').findById(id);
        console.log('Deserialized user:', user);
        done(null, user);
    } catch (error) {
        console.error('Error in deserialization:', error);
        done(error, null);
    }
});

module.exports = passport;
