const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Middleware для обработки результатов валидации
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => ({
            field: err.param,
            message: err.msg,
            value: err.value,
        }));
        
        logger.warn(`⚠️ Ошибки валидации | IP: ${req.clientIp} | Path: ${req.path}`, {
            errors: errorMessages,
        });
        
        return res.status(400).json({
            success: false,
            message: 'Ошибка валидации данных',
            errors: errorMessages,
        });
    }
    
    next();
};

/**
 * Проверка что пользователь - администратор
 */
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Требуется аутентификация',
        });
    }
    
    if (req.user.role !== 'admin') {
        logger.warn(`⚠️ Попытка доступа к админ функции | User: ${req.user.username} | IP: ${req.clientIp}`);
        return res.status(403).json({
            success: false,
            message: 'Требуются права администратора',
        });
    }
    
    next();
};

/**
 * Валидация UUID
 */
const isValidUUID = (value) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
};

/**
 * Валидация названия таблицы (whitelist)
 */
const ALLOWED_TABLES = ['sudeb_vzisk', 'dos_rabota', 'base_zayci'];

const validateTableName = (req, res, next) => {
    const { tableName } = req.params;
    
    if (!tableName || !ALLOWED_TABLES.includes(tableName)) {
        logger.warn(`⚠️ Попытка доступа к недопустимой таблице: ${tableName} | User: ${req.user?.username} | IP: ${req.clientIp}`);
        return res.status(403).json({
            success: false,
            message: 'Доступ к этой таблице запрещен',
            allowedTables: ALLOWED_TABLES,
        });
    }
    
    next();
};

/**
 * Санитизация входных данных (защита от SQL injection)
 */
const sanitizeInput = (req, res, next) => {
    // Рекурсивная функция для очистки объектов
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            // Удаляем потенциально опасные символы
            return obj.replace(/[<>]/g, '');
        }
        if (Array.isArray(obj)) {
            return obj.map(sanitize);
        }
        if (typeof obj === 'object' && obj !== null) {
            const sanitized = {};
            for (const key in obj) {
                sanitized[key] = sanitize(obj[key]);
            }
            return sanitized;
        }
        return obj;
    };
    
    if (req.body) {
        req.body = sanitize(req.body);
    }
    if (req.query) {
        req.query = sanitize(req.query);
    }
    
    next();
};

module.exports = {
    handleValidationErrors,
    requireAdmin,
    isValidUUID,
    validateTableName,
    sanitizeInput,
    ALLOWED_TABLES,
};