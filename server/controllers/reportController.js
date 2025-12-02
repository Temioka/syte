const pool = require('../config/database');
const logger = require('../utils/logger');
const { logActivity } = require('../utils/activityLogger');
const xlsx = require('xlsx');

/**
 * Whitelist разрешенных SQL операций для безопасности
 */
const ALLOWED_SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT',
    'JOIN', 'LEFT JOIN', 'INNER JOIN',
    'AS', 'LIKE', 'ILIKE', 'IN', 'BETWEEN',
    'LIMIT', 'OFFSET',
];

const FORBIDDEN_SQL_KEYWORDS = [
    'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE',
    'TRUNCATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE',
];

/**
 * Валидация SQL запроса
 */
const validateSQL = (sql) => {
    const upperSQL = sql.toUpperCase();
    
    // Проверка на запрещенные операции
    for (const keyword of FORBIDDEN_SQL_KEYWORDS) {
        if (upperSQL.includes(keyword)) {
            return {
                valid: false,
                error: `Запрещенная операция: ${keyword}`,
            };
        }
    }
    
    // Проверка что запрос начинается с SELECT
    if (!upperSQL.trim().startsWith('SELECT')) {
        return {
            valid: false,
            error: 'Разрешены только SELECT запросы',
        };
    }
    
    // Проверка на комментарии (возможная SQL injection)
    if (sql.includes('--') || sql.includes('/*') || sql.includes('*/')) {
        return {
            valid: false,
            error: 'Комментарии в SQL запросах запрещены',
        };
    }
    
    // Проверка на множественные запросы
    if (sql.split(';').length > 2) { // > 2 потому что может быть ; в конце
        return {
            valid: false,
            error: 'Множественные запросы запрещены',
        };
    }
    
    return { valid: true };
};

/**
 * Выполнение пользовательского SQL запроса
 */
const executeCustomQuery = async (req, res) => {
    try {
        const { sql, name, description } = req.body;
        
        if (!sql) {
            return res.status(400).json({
                success: false,
                message: 'SQL запрос не предоставлен',
            });
        }
        
        logger.info(`🔍 Выполнение пользовательского запроса | User: ${req.user.username}`);
        logger.debug(`SQL: ${sql}`);
        
        // Валидация SQL
        const validation = validateSQL(sql);
        if (!validation.valid) {
            logger.warn(`⚠️ Недопустимый SQL запрос от ${req.user.username}: ${validation.error}`);
            return res.status(400).json({
                success: false,
                message: validation.error,
            });
        }
        
        // Выполняем запрос с таймаутом
        const timeoutMs = 30000; // 30 секунд
        const timeoutQuery = `SET statement_timeout = ${timeoutMs};`;
        
        await pool.query(timeoutQuery);
        
        const startTime = Date.now();
        const result = await pool.query(sql);
        const executionTime = Date.now() - startTime;
        
        // Логируем действие
        await logActivity(
            req.user.id,
            'custom_report',
            'execute_query',
            null,
            null,
            {
                name,
                description,
                rowsReturned: result.rows.length,
                executionTime,
            },
            req.clientIp,
            `Выполнен пользовательский запрос: ${name || 'Без названия'}`
        );
        
        logger.info(`✅ Запрос выполнен за ${executionTime}ms, строк: ${result.rows.length}`);
        
        res.json({
            success: true,
            message: 'Запрос успешно выполнен',
            data: result.rows,
            statistics: {
                rowCount: result.rows.length,
                executionTime,
                fields: result.fields?.map(f => ({
                    name: f.name,
                    dataType: f.dataTypeID,
                })),
            },
        });
        
    } catch (error) {
        logger.logError(error, 'executeCustomQuery');
        
        // Обработка специфичных ошибок PostgreSQL
        let message = 'Ошибка выполнения SQL запроса';
        if (error.code === '42P01') {
            message = 'Таблица не существует';
        } else if (error.code === '42703') {
            message = 'Колонка не существует';
        } else if (error.code === '42601') {
            message = 'Синтаксическая ошибка в SQL';
        }
        
        res.status(400).json({
            success: false,
            message,
            error: error.message,
            hint: error.hint,
        });
    }
};

/**
 * Сохранение шаблона отчета
 */
const saveReportTemplate = async (req, res) => {
    try {
        const { name, description, sql, columns, filters } = req.body;
        
        if (!name || !sql) {
            return res.status(400).json({
                success: false,
                message: 'Название и SQL запрос обязательны',
            });
        }
        
        // Валидация SQL
        const validation = validateSQL(sql);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: validation.error,
            });
        }
        
        // Создаем таблицу для шаблонов если её нет
        await pool.query(`
            CREATE TABLE IF NOT EXISTS report_templates (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                sql_query TEXT NOT NULL,
                columns JSONB,
                filters JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        const result = await pool.query(
            `INSERT INTO report_templates (user_id, name, description, sql_query, columns, filters)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [req.user.id, name, description, sql, JSON.stringify(columns), JSON.stringify(filters)]
        );
        
        logger.info(`✅ Шаблон отчета сохранен: ${name} | User: ${req.user.username}`);
        
        res.status(201).json({
            success: true,
            message: 'Шаблон отчета успешно сохранен',
            template: result.rows[0],
        });
        
    } catch (error) {
        logger.logError(error, 'saveReportTemplate');
        res.status(500).json({
            success: false,
            message: 'Ошибка при сохранении шаблона',
            error: error.message,
        });
    }
};

/**
 * Получение списка шаблонов пользователя
 */
const getReportTemplates = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, description, created_at, updated_at
             FROM report_templates
             WHERE user_id = $1
             ORDER BY updated_at DESC`,
            [req.user.id]
        );
        
        res.json({
            success: true,
            templates: result.rows,
        });
        
    } catch (error) {
        logger.logError(error, 'getReportTemplates');
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении шаблонов',
            error: error.message,
        });
    }
};

/**
 * Получение конкретного шаблона
 */
const getReportTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            `SELECT * FROM report_templates
             WHERE id = $1 AND user_id = $2`,
            [id, req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Шаблон не найден',
            });
        }
        
        res.json({
            success: true,
            template: result.rows[0],
        });
        
    } catch (error) {
        logger.logError(error, 'getReportTemplate');
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении шаблона',
            error: error.message,
        });
    }
};

/**
 * Удаление шаблона
 */
const deleteReportTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            `DELETE FROM report_templates
             WHERE id = $1 AND user_id = $2
             RETURNING name`,
            [id, req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Шаблон не найден',
            });
        }
        
        logger.info(`🗑️ Шаблон удален: ${result.rows[0].name} | User: ${req.user.username}`);
        
        res.json({
            success: true,
            message: 'Шаблон успешно удален',
        });
        
    } catch (error) {
        logger.logError(error, 'deleteReportTemplate');
        res.status(500).json({
            success: false,
            message: 'Ошибка при удалении шаблона',
            error: error.message,
        });
    }
};

/**
 * Экспорт результатов отчета в Excel
 */
const exportReportToExcel = async (req, res) => {
    try {
        const { sql, name } = req.body;
        
        if (!sql) {
            return res.status(400).json({
                success: false,
                message: 'SQL запрос не предоставлен',
            });
        }
        
        // Валидация SQL
        const validation = validateSQL(sql);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: validation.error,
            });
        }
        
        // Выполняем запрос
        const result = await pool.query(sql);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Запрос не вернул данных',
            });
        }
        
        // Создаем Excel
        const worksheet = xlsx.utils.json_to_sheet(result.rows);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Отчет');
        
        // Автоширина колонок
        const colWidths = [];
        const firstRow = result.rows[0];
        Object.keys(firstRow).forEach(key => {
            const maxLength = Math.max(
                key.length,
                ...result.rows.map(row => String(row[key] || '').length)
            );
            colWidths.push({ wch: Math.min(maxLength + 2, 50) });
        });
        worksheet['!cols'] = colWidths;
        
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        // Логируем действие
        await logActivity(
            req.user.id,
            'custom_report',
            'export_excel',
            null,
            null,
            { reportName: name, rowsExported: result.rows.length },
            req.clientIp,
            `Экспорт отчета в Excel: ${name || 'Без названия'}`
        );
        
        const fileName = `report_${name || 'custom'}_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
        
        logger.info(`✅ Отчет экспортирован: ${fileName} | User: ${req.user.username}`);
        
    } catch (error) {
        logger.logError(error, 'exportReportToExcel');
        res.status(500).json({
            success: false,
            message: 'Ошибка при экспорте отчета',
            error: error.message,
        });
    }
};

/**
 * Получение списка доступных таблиц и их структуры
 */
const getDatabaseSchema = async (req, res) => {
    try {
        // Получаем список таблиц
        const tablesResult = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            AND table_name IN ('sudeb_vzisk', 'dos_rabota', 'base_zayci', 'users')
            ORDER BY table_name;
        `);
        
        const schema = {};
        
        // Для каждой таблицы получаем структуру колонок
        for (const table of tablesResult.rows) {
            const tableName = table.table_name;
            
            const columnsResult = await pool.query(`
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = $1
                ORDER BY ordinal_position;
            `, [tableName]);
            
            schema[tableName] = columnsResult.rows.map(col => ({
                name: col.column_name,
                type: col.data_type,
                nullable: col.is_nullable === 'YES',
                default: col.column_default,
            }));
        }
        
        res.json({
            success: true,
            schema,
        });
        
    } catch (error) {
        logger.logError(error, 'getDatabaseSchema');
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении схемы БД',
            error: error.message,
        });
    }
};

module.exports = {
    executeCustomQuery,
    saveReportTemplate,
    getReportTemplates,
    getReportTemplate,
    deleteReportTemplate,
    exportReportToExcel,
    getDatabaseSchema,
};