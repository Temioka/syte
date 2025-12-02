const logger = require('../utils/logger');

/**
 * Централизованный обработчик ошибок Express
 */
const errorHandler = (err, req, res, next) => {
    // Логируем ошибку
    logger.error(`❌ Ошибка: ${err.message}`, {
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.clientIp,
        user: req.user?.username || 'anonymous',
        body: req.body,
        query: req.query,
    });

    // Определяем тип ошибки и статус код
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Внутренняя ошибка сервера';
    
    // Обработка специфичных типов ошибок
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Ошибка валидации данных';
    } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Ошибка аутентификации';
    } else if (err.name === 'ForbiddenError') {
        statusCode = 403;
        message = 'Доступ запрещен';
    } else if (err.code === '23505') { // PostgreSQL duplicate key
        statusCode = 409;
        message = 'Запись с такими данными уже существует';
    } else if (err.code === '23503') { // PostgreSQL foreign key violation
        statusCode = 400;
        message = 'Нарушение целостности данных';
    } else if (err.code === '22P02') { // PostgreSQL invalid input syntax
        statusCode = 400;
        message = 'Неверный формат данных';
    }

    // В production не показываем детали ошибок
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    const errorResponse = {
        success: false,
        message,
        ...(isDevelopment && {
            error: err.message,
            stack: err.stack,
            code: err.code,
        }),
    };

    res.status(statusCode).json(errorResponse);
};

/**
 * Обработчик для несуществующих роутов (404)
 */
const notFoundHandler = (req, res) => {
    logger.warn(`⚠️ 404: ${req.method} ${req.path} | IP: ${req.clientIp}`);
    
    res.status(404).json({
        success: false,
        message: `Endpoint ${req.method} ${req.path} не найден`,
        availableEndpoints: {
            auth: ['/api/auth/login', '/api/auth/register', '/api/auth/profile'],
            data: ['/api/data/:tableName', '/api/data/:tableName/:id'],
            logs: ['/api/logs/my-activity', '/api/logs/stats'],
        },
    });
};

/**
 * Wrapper для async функций для автоматической обработки ошибок
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
};