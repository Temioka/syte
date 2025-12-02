const pool = require('../config/database');
const logger = require('./logger');

/**
 * Записывает действие в лог активности таблиц
 */
const logActivity = async (userId, tableName, action, recordId, oldValues, newValues, ipAddress, description) => {
    try {
        // Вычисляем измененные поля
        const changedFields = [];
        if (oldValues && newValues) {
            const ignoredFields = ['updated_at', 'created_at', 'Дата сохранения', 'Сохранил последним'];
            const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
            
            allKeys.forEach(key => {
                if (ignoredFields.includes(key)) return;
                
                const oldVal = JSON.stringify(oldValues[key]);
                const newVal = JSON.stringify(newValues[key]);
                
                if (oldVal !== newVal) {
                    changedFields.push(key);
                }
            });
        }

        const query = `
            INSERT INTO activity_logs 
            (user_id, table_name, action, record_id, old_values, new_values, changed_fields, ip_address, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `;

        const { rows } = await pool.query(query, [
            userId,
            tableName,
            action,
            recordId || null,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            changedFields,
            ipAddress || 'unknown',
            description || null
        ]);

        logger.debug(`✅ Activity log записан: ID ${rows[0].id}, ${action} на ${tableName}`);
        
        return rows[0].id;

    } catch (error) {
        logger.error(`❌ Ошибка логирования активности: ${error.message}`, {
            userId,
            tableName,
            action,
            error: error.stack
        });
        return null;
    }
};

/**
 * Получает историю действий пользователя
 */
const getUserActivityHistory = async (userId, limit = 50, offset = 0) => {
    const query = `
        SELECT 
            id,
            table_name,
            action,
            record_id,
            changed_fields,
            description,
            created_at
        FROM activity_logs 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
    `;
    
    try {
        const { rows } = await pool.query(query, [userId, limit, offset]);
        return rows;
    } catch (error) {
        logger.error(`❌ Ошибка getUserActivityHistory: ${error.message}`);
        return [];
    }
};

/**
 * Получает историю для конкретной записи
 */
const getRecordActivityHistory = async (tableName, recordId, limit = 100) => {
    const query = `
        SELECT 
            al.*,
            u.username
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.table_name = $1 AND al.record_id = $2
        ORDER BY al.created_at DESC
        LIMIT $3
    `;
    
    try {
        const { rows } = await pool.query(query, [tableName, recordId, limit]);
        return rows;
    } catch (error) {
        logger.error(`❌ Ошибка getRecordActivityHistory: ${error.message}`);
        return [];
    }
};

/**
 * Получает статистику за последние N дней
 */
const getActivityStats = async (days = 7) => {
    const query = `
        SELECT 
            DATE(created_at) as date, 
            action,
            table_name,
            COUNT(*) as count
        FROM activity_logs
        WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
        GROUP BY DATE(created_at), action, table_name
        ORDER BY date DESC, count DESC
    `;
    
    try {
        const { rows } = await pool.query(query);
        return rows;
    } catch (error) {
        logger.error(`❌ Ошибка getActivityStats: ${error.message}`);
        return [];
    }
};

/**
 * Очистка старых логов (для cron задачи)
 */
const cleanOldLogs = async (daysToKeep = 90) => {
    const queries = [
        `DELETE FROM user_logs WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'`,
        `DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'`
    ];

    try {
        for (const query of queries) {
            const result = await pool.query(query);
            logger.info(`🧹 Удалено старых логов: ${result.rowCount}`);
        }
        return true;
    } catch (error) {
        logger.error(`❌ Ошибка cleanOldLogs: ${error.message}`);
        return false;
    }
};

module.exports = {
    logActivity,
    getUserActivityHistory,
    getRecordActivityHistory,
    getActivityStats,
    cleanOldLogs
};