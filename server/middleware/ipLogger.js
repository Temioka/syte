const logger = require('../utils/logger');

const ipLogger = (req, res, next) => {
    const ip = req.clientIp || req.ip;
    const method = req.method;
    const url = req.originalUrl;
    const userAgent = req.get('user-agent');
    
    // Логируем только важные запросы
    if (url.startsWith('/api/')) {
        logger.info(`📡 ${method} ${url} from ${ip}`);
    }
    
    next();
};

module.exports = ipLogger;