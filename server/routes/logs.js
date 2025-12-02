const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const logger = require('../utils/logger');
const { 
    getUserActivityHistory, 
    getRecordActivityHistory,
    getActivityStats 
} = require('../utils/activityLogger');

/**
 * GET /logs/my-activity - История действий текущего пользователя
 */
router.get('/my-activity', authMiddleware, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 500); // Макс 500
        const offset = parseInt(req.query.offset) || 0;
        const action = req.query.action; // Фильтр по типу действия

        logger.info(`📊 Запрос истории для пользователя: ${req.userId}, limit: ${limit}, offset: ${offset}`);

        let query = `
            SELECT 
                id,
                action,
                description,
                ip_address,
                user_agent,
                created_at
            FROM user_logs 
            WHERE user_id = $1
        `;
        const params = [req.userId];

        // Фильтр по типу действия
        if (action) {
            query += ` AND action = $${params.length + 1}`;
            params.push(action);
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        // Получаем общее количество
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM user_logs 
            WHERE user_id = $1 ${action ? 'AND action = $2' : ''}
        `;
        const countParams = action ? [req.userId, action] : [req.userId];
        
        const [historyResult, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
        ]);

        const history = historyResult.rows;
        const total = parseInt(countResult.rows[0].total);

        logger.info(`✅ Возвращено записей: ${history.length} из ${total}`);

        res.json({
            success: true,
            data: history,
            pagination: {
                total,
                count: history.length,
                limit,
                offset,
                hasMore: offset + history.length < total
            }
        });

    } catch (error) {
        logger.logError(error, 'logs/my-activity');
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении истории действий'
        });
    }
});

/**
 * GET /logs/table-activity/:tableName - История действий для таблицы (только админы)
 */
router.get('/table-activity/:tableName', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { tableName } = req.params;
        const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
        const offset = parseInt(req.query.offset) || 0;
        const action = req.query.action; // Фильтр по действию
        const userId = req.query.userId; // Фильтр по пользователю

        // Валидация названия таблицы
        const allowedTables = ['sudeb_vzisk', 'dos_rabota', 'base_zayci'];
        if (!allowedTables.includes(tableName)) {
            return res.status(400).json({
                success: false,
                message: 'Недопустимое название таблицы'
            });
        }

        logger.info(`📊 Запрос истории таблицы: ${tableName}, limit: ${limit}, offset: ${offset}`);

        let query = `
            SELECT 
                al.id,
                al.user_id,
                u.username,
                al.action,
                al.record_id,
                al.changed_fields,
                al.ip_address,
                al.description,
                al.created_at
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.table_name = $1
        `;
        const params = [tableName];

        // Фильтр по действию
        if (action) {
            query += ` AND al.action = $${params.length + 1}`;
            params.push(action);
        }

        // Фильтр по пользователю
        if (userId) {
            query += ` AND al.user_id = $${params.length + 1}`;
            params.push(userId);
        }

        query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        // Получаем общее количество
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM activity_logs 
            WHERE table_name = $1
        `;
        let countParams = [tableName];
        
        if (action) {
            countQuery += ` AND action = $${countParams.length + 1}`;
            countParams.push(action);
        }
        
        if (userId) {
            countQuery += ` AND user_id = $${countParams.length + 1}`;
            countParams.push(userId);
        }

        const [historyResult, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
        ]);

        const history = historyResult.rows;
        const total = parseInt(countResult.rows[0].total);

        logger.info(`✅ Возвращено записей для ${tableName}: ${history.length} из ${total}`);

        res.json({
            success: true,
            tableName,
            data: history,
            pagination: {
                total,
                count: history.length,
                limit,
                offset,
                hasMore: offset + history.length < total
            }
        });

    } catch (error) {
        logger.logError(error, 'logs/table-activity');
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении истории таблицы'
        });
    }
});

/**
 * GET /logs/record-activity/:tableName/:recordId - История для конкретной записи
 */
router.get('/record-activity/:tableName/:recordId', authMiddleware, async (req, res) => {
    try {
        const { tableName, recordId } = req.params;
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);

        logger.info(`📊 Запрос истории записи: ${tableName}/${recordId}`);

        const query = `
            SELECT 
                al.id,
                al.user_id,
                u.username,
                al.action,
                al.old_values,
                al.new_values,
                al.changed_fields,
                al.ip_address,
                al.description,
                al.created_at
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.table_name = $1 AND al.record_id = $2
            ORDER BY al.created_at DESC
            LIMIT $3
        `;

        const { rows: history } = await pool.query(query, [tableName, recordId, limit]);

        logger.info(`✅ Найдено записей: ${history.length}`);

        res.json({
            success: true,
            tableName,
            recordId,
            data: history,
            count: history.length
        });

    } catch (error) {
        logger.logError(error, 'logs/record-activity');
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении истории записи'
        });
    }
});

/**
 * GET /logs/stats - Статистика действий (только админы)
 */
router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const days = Math.min(parseInt(req.query.days) || 7, 90); // Макс 90 дней
        
        logger.info(`📊 Запрос статистики за ${days} дней`);

        const stats = await getActivityStats(days);

        // Дополнительная статистика
        const additionalStatsQuery = `
            SELECT 
                COUNT(*) as total_actions,
                COUNT(DISTINCT user_id) as active_users,
                COUNT(DISTINCT table_name) as affected_tables
            FROM activity_logs
            WHERE created_at > NOW() - INTERVAL '${days} days'
        `;

        const { rows: [additionalStats] } = await pool.query(additionalStatsQuery);

        // Топ пользователей по активности
        const topUsersQuery = `
            SELECT 
                u.username,
                COUNT(*) as action_count
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.created_at > NOW() - INTERVAL '${days} days'
            GROUP BY u.username
            ORDER BY action_count DESC
            LIMIT 10
        `;

        const { rows: topUsers } = await pool.query(topUsersQuery);

        logger.info(`✅ Статистика собрана`);

        res.json({
            success: true,
            period: {
                days,
                from: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
                to: new Date()
            },
            summary: {
                total_actions: parseInt(additionalStats.total_actions),
                active_users: parseInt(additionalStats.active_users),
                affected_tables: parseInt(additionalStats.affected_tables)
            },
            daily_stats: stats,
            top_users: topUsers
        });

    } catch (error) {
        logger.logError(error, 'logs/stats');
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении статистики'
        });
    }
});

/**
 * GET /logs/recent - Последние действия в системе (только админы)
 */
router.get('/recent', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);

        logger.info(`📊 Запрос последних ${limit} действий`);

        const query = `
            SELECT 
                al.id,
                al.user_id,
                u.username,
                al.table_name,
                al.action,
                al.record_id,
                al.description,
                al.created_at
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT $1
        `;

        const { rows: recentActivity } = await pool.query(query, [limit]);

        res.json({
            success: true,
            data: recentActivity,
            count: recentActivity.length
        });

    } catch (error) {
        logger.logError(error, 'logs/recent');
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении последних действий'
        });
    }
});

module.exports = router;