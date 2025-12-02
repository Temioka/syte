const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Создаем папку logs если её нет
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Определяем уровни логирования
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Цвета для консольного вывода
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};

winston.addColors(colors);

// Формат для консоли
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => {
            const { timestamp, level, message, ...meta } = info;
            let metaStr = '';
            
            if (Object.keys(meta).length > 0) {
                metaStr = '\n' + JSON.stringify(meta, null, 2);
            }
            
            return `${timestamp} [${level}]: ${message}${metaStr}`;
        }
    )
);

// Формат для файлов (JSON)
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.metadata(),
    winston.format.json()
);

// Транспорты
const transports = [
    // Консоль
    new winston.transports.Console({
        format: consoleFormat,
        level: process.env.LOG_LEVEL || 'info',
    }),
    
    // Все логи
    new DailyRotateFile({
        filename: path.join(logsDir, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        format: fileFormat,
        level: 'info',
    }),
    
    // Только ошибки
    new DailyRotateFile({
        filename: path.join(logsDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        format: fileFormat,
        level: 'error',
    }),

    // HTTP запросы
    new DailyRotateFile({
        filename: path.join(logsDir, 'http-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: fileFormat,
        level: 'http',
    }),
];

// Создаем логгер
const logger = winston.createLogger({
    levels,
    transports,
    exitOnError: false,
});

// Вспомогательные функции
logger.logRequest = (req, res, duration) => {
    const message = `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`;
    logger.http(message, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.clientIp || req.ip,
        userAgent: req.get('user-agent'),
        userId: req.userId
    });
};

logger.logAuth = (username, success, ip, reason = '') => {
    if (success) {
        logger.info(`✅ Успешный вход: ${username}`, { 
            username, 
            ip, 
            action: 'LOGIN_SUCCESS' 
        });
    } else {
        logger.warn(`❌ Неудачный вход: ${username}`, { 
            username, 
            ip, 
            reason, 
            action: 'LOGIN_FAIL' 
        });
    }
};

logger.logAction = (username, action, table, recordId, ip) => {
    logger.info(`🔧 ${username} | ${action} | ${table}`, {
        username,
        action,
        table,
        recordId,
        ip
    });
};

logger.logError = (error, context = '') => {
    const message = `❌ Ошибка${context ? ` в ${context}` : ''}: ${error.message}`;
    logger.error(message, {
        error: error.message,
        stack: error.stack,
        context,
        code: error.code
    });
};

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('🛑 Получен SIGINT, закрытие логгера...');
    logger.end();
    process.exit(0);
});

module.exports = logger;