const pool = require('../config/database');
const logger = require('./logger');

/**
 * Логирует действие пользователя в таблицу user_logs.
 * @param {object} logData - Данные для логирования.
 * @param {string | null} logData.userId - ID пользователя (UUID, может быть null).
 * @param {string} logData.action - Тип действия.
 * @param {string} logData.description - Описание действия.
 * @param {string} logData.ipAddress - IP адрес пользователя.
 * @param {string} logData.userAgent - User-Agent браузера.
 */
const logUserAction = async ({ userId, action, description, ipAddress, userAgent }) => {
    const query = `
        INSERT INTO user_logs (user_id, action, description, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
    `;
    
    try {
        const { rows } = await pool.query(query, [
            userId || null,
            action,
            description,
            ipAddress || 'unknown',
            userAgent || 'unknown'
        ]);

        logger.debug(`✅ User log записан: ID ${rows[0].id}, Action: ${action}, User: ${userId || 'anonymous'}`);
        
        return rows[0].id;

    } catch (error) {
        logger.error(`❌ Ошибка при записи в user_logs: ${error.message}`, {
            userId,
            action,
            error: error.stack
        });
        // Не прерываем основной процесс
        return null;
    }
};

/**
 * Получает последние действия пользователя
 */
const getRecentUserActions = async (userId, limit = 10) => {
    const query = `
        SELECT action, description, ip_address, created_at
        FROM user_logs
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
    `;

    try {
        const { rows } = await pool.query(query, [userId, limit]);
        return rows;
    } catch (error) {
        logger.error(`❌ Ошибка получения user actions: ${error.message}`);
        return [];
    }
};

/**
 * Подсчитывает неудачные попытки входа за последние N минут
 */
const countFailedLoginAttempts = async (ipAddress, minutes = 15) => {
    const query = `
        SELECT COUNT(*) as count
        FROM user_logs
        WHERE action = 'LOGIN_FAIL' 
        AND ip_address = $1
        AND created_at > NOW() - INTERVAL '${minutes} minutes'
    `;

    try {
        const { rows } = await pool.query(query, [ipAddress]);
        return parseInt(rows[0].count);
    } catch (error) {
        logger.error(`❌ Ошибка подсчета failed logins: ${error.message}`);
        return 0;
    }
};

module.exports = { 
    logUserAction,
    getRecentUserActions,
    countFailedLoginAttempts
};