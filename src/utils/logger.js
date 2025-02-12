const winston = require('winston');

// Winston logger configuration
const winstonLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// Add console transport if not in production
if (process.env.NODE_ENV !== 'production') {
    winstonLogger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Basic console logging functions
const consoleLogger = {
    info: (...args) => console.log(...args),
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args),
    debug: (...args) => console.debug(...args)
};

// Use Winston logger if available, fallback to console
const logger = {
    info: (...args) => {
        try {
            winstonLogger.info(...args);
        } catch (err) {
            consoleLogger.info(...args);
        }
    },
    error: (...args) => {
        try {
            winstonLogger.error(...args);
        } catch (err) {
            consoleLogger.error(...args);
        }
    },
    warn: (...args) => {
        try {
            winstonLogger.warn(...args);
        } catch (err) {
            consoleLogger.warn(...args);
        }
    },
    debug: (...args) => {
        try {
            winstonLogger.debug(...args);
        } catch (err) {
            consoleLogger.debug(...args);
        }
    }
};

module.exports = logger;