require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET || 'your_secret_key',
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};

const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    } catch (error) {
        return null;
    }
};

module.exports = {
    generateToken,
    verifyToken
};