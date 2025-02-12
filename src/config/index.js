require('dotenv').config();
module.exports = {
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/api/auth/google/callback"
    },
    redis: {
        url: process.env.REDIS_URL,  // For production/cloud Redis
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || '',
        tls: process.env.NODE_ENV === 'production' ? {} : undefined
    }
};
