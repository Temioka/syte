const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
    register,
    login,
    getProfile,
    logout,
    checkPasswordStrength,
} = require('../controllers/authController');

// Публичные маршруты
router.post('/register', register);
router.post('/login', login);
router.post('/check-password-strength', checkPasswordStrength);

// Защищенные маршруты
router.get('/profile', authMiddleware, getProfile);
router.post('/logout', authMiddleware, logout);

module.exports = router;