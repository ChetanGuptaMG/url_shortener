const mongoose = require('mongoose');

// Validate MongoDB ObjectId
const validateObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

// Add URL validation
const validateUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

// Validate topic
const validateTopic = (topic) => {
    return typeof topic === 'string' && topic.length >= 2 && topic.length <= 50;
};

module.exports = {
    validateObjectId,
    validateUrl,
    validateTopic
};
