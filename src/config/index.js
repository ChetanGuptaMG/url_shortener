require('dotenv').config();
module.exports = {
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "https://urlshortner-953263458109.asia-south1.run.app/api/auth/google/callback"
    },
    redis: {
        url: process.env.REDIS_URL, 
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || '',
        tls: process.env.NODE_ENV === 'production' ? {} : undefined
    }
};
