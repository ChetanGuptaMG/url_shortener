/**
 * Authentication middleware functions for URL shortener application
 */

/**
 * Middleware to verify if user is authenticated
 * Blocks unauthorized access and returns 401 if not authenticated
 */
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Please login to access this resource' 
    });
};


module.exports = {
    isAuthenticated,
    validateSession: isAuthenticated 
};