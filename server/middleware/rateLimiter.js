const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Rate limiter для логина - защита от брутфорса
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 5, // максимум 5 попыток
    message: {
        success: false,
        message: 'Слишком много попыток входа. Попробуйте через 15 минут.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`⚠️ Rate limit превышен для логина | IP: ${req.clientIp}`);
        res.status(429).json({
            success: false,
            message: 'Слишком много попыток входа. Попробуйте через 15 минут.',
            retryAfter: '15 minutes',
        });
    },
    skip: (req) => {
        // Пропускаем лимит для локальных запросов в режиме разработки
        if (process.env.NODE_ENV === 'development' && req.clientIp.includes('127.0.0.1')) {
            return true;
        }
        return false;
    },
});

/**
 * Rate limiter для регистрации
 */
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 час
    max: 3, // максимум 3 регистрации в час
    message: {
        success: false,
        message: 'Слишком много попыток регистрации. Попробуйте через час.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`⚠️ Rate limit превышен для регистрации | IP: ${req.clientIp}`);
        res.status(429).json({
            success: false,
            message: 'Слишком много попыток регистрации. Попробуйте через час.',
            retryAfter: '1 hour',
        });
    },
});

/**
 * Общий rate limiter для API
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100, // максимум 100 запросов в 15 минут
    message: {
        success: false,
        message: 'Слишком много запросов. Попробуйте позже.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`⚠️ API Rate limit превышен | IP: ${req.clientIp} | Path: ${req.path}`);
        res.status(429).json({
            success: false,
            message: 'Слишком много запросов к API. Попробуйте через несколько минут.',
        });
    },
});

/**
 * Строгий rate limiter для операций записи
 */
const writeLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 минута
    max: 20, // максимум 20 операций записи в минуту
    message: {
        success: false,
        message: 'Слишком много операций записи. Подождите минуту.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    loginLimiter,
    registerLimiter,
    apiLimiter,
    writeLimiter,
};