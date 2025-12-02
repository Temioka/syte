const { logActivity } = require('../utils/activityLogger');

/**
 * Middleware для автоматического логирования действий в роутах
 */
const activityLoggerMiddleware = (tableName, action) => {
    return async (req, res, next) => {
        const originalJson = res.json.bind(res);
        let requestBody = req.body;
        let recordId = req.params.id || req.body.id;

        res.json = async function(data) {
            // Логируем только успешные ответы
            if (data.success && req.userId) {
                const description = `${action} в таблице ${tableName}`;
                
                await logActivity(
                    req.userId,
                    tableName,
                    action,
                    recordId,
                    null, // oldValues если нужны
                    requestBody,
                    req.clientIp,
                    description
                );
            }

            return originalJson(data);
        };

        next();
    };
};

module.exports = activityLoggerMiddleware;