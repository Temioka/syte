const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

// Белый список таблиц для безопасности
const ALLOWED_TABLES = ['sudeb_vzisk', 'dos_rabota', 'base_zayci'];

// Конфигурация таблиц (ключевое поле для каждой таблицы)
const TABLE_CONFIG = {
    'sudeb_vzisk': {
        primaryKey: '№ л/с',
        searchFields: ['ФИО/Наименование', '№ л/с', '№ гражданского дела'],
        displayName: 'ФИО/Наименование'
    },
    'dos_rabota': {
        primaryKey: '№ л/с',
        searchFields: ['ФИО/Наименование', '№ л/с', 'ИНН'],
        displayName: 'ФИО/Наименование'
    },
    'base_zayci': {
        primaryKey: 'ГРН',
        searchFields: ['ГРН', 'Плательщик', 'Собственник', 'Транзакции'],
        displayName: 'Плательщик',
        customSearch: true
    }
};

// Белый список столбцов для сортировки
const ALLOWED_SORT_COLUMNS = [
    '№ л/с', 
    'ГРН',
    'updatedAt', 
    'ФИО/Наименование',
    'Плательщик',
    'Сумма подаваемой ДЗ , руб#',
    'Сумма подаваемой ДЗ , руб.',
    'Сумма задолженности',
    'Дата направления в суд',
    'Дата направления претензии',
    'ШПИ отправления',
    'Дата последней поездки'
];

/**
 * GET /:tableName - Получение всех записей из таблицы
 */
router.get('/:tableName', authMiddleware, async (req, res) => {
    const { tableName } = req.params;
    const { page, limit, search, sort, order } = req.query;

    if (!ALLOWED_TABLES.includes(tableName)) {
        return res.status(403).json({ success: false, message: 'Доступ к этой таблице запрещен' });
    }

    try {
        const searchTerm = search || '';
        const config = TABLE_CONFIG[tableName];

        // Определяем колонку и порядок сортировки
        const defaultSort = config.primaryKey;
        const sortColumn = ALLOWED_SORT_COLUMNS.includes(sort) ? `"${sort}"` : `"${defaultSort}"`;
        const sortOrder = order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        let query = `SELECT * FROM "${tableName}"`;
        const queryParams = [];

        // Поиск
        if (searchTerm) {
            if (tableName === 'base_zayci') {
                // Кастомный поиск для base_zayci с транслитерацией
                const translitMap = {
                    // Кириллица → Латиница
                    'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H',
                    'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y', 'Х': 'X',
                    'а': 'a', 'в': 'b', 'е': 'e', 'к': 'k', 'м': 'm', 'н': 'h',
                    'о': 'o', 'р': 'p', 'с': 'c', 'т': 't', 'у': 'y', 'х': 'x',
                    // Латиница → Кириллица
                    'A': 'А', 'B': 'В', 'E': 'Е', 'K': 'К', 'M': 'М', 'H': 'Н',
                    'O': 'О', 'P': 'Р', 'C': 'С', 'T': 'Т', 'Y': 'У', 'X': 'Х',
                    'a': 'а', 'b': 'в', 'e': 'е', 'k': 'к', 'm': 'м', 'h': 'н',
                    'o': 'о', 'p': 'р', 'c': 'с', 't': 'т', 'y': 'у', 'x': 'х'
                };
                
                // Создаем альтернативный вариант поиска с транслитерацией
                let searchVariant = searchTerm.split('').map(char => translitMap[char] || char).join('');
                
                query += ` WHERE (
                    "ГРН" ILIKE $1 OR 
                    "ГРН" ILIKE $2 OR 
                    "Плательщик" ILIKE $1 OR 
                    "Собственник" ILIKE $1 OR 
                    "Транзакции" ILIKE $1
                )`;
                queryParams.push(`%${searchTerm}%`, `%${searchVariant}%`);
            } else {
                // Обычный поиск для sudeb_vzisk и dos_rabota
                const searchConditions = config.searchFields.map(field => `"${field}" ILIKE $1`).join(' OR ');
                query += ` WHERE ${searchConditions}`;
                queryParams.push(`%${searchTerm}%`);
            }
        }

        // Сортировка
        if (tableName === 'base_zayci') {
            // Для base_zayci пустые ГРН в конец списка
            query += ` ORDER BY 
                CASE WHEN "ГРН" IS NULL OR "ГРН" = '' THEN 1 ELSE 0 END,
                ${sortColumn} ${sortOrder}`;
        } else {
            query += ` ORDER BY ${sortColumn} ${sortOrder}`;
        }
        
        const { rows } = await pool.query(query, queryParams);

        res.json(rows);

    } catch (error) {
        console.error(`Ошибка при получении данных из таблицы ${tableName}:`, error);
        res.status(500).json({ success: false, message: 'Ошибка сервера при получении данных' });
    }
});

/**
 * PUT /:tableName/:id - Обновление записи в таблице
 */
router.put('/:tableName/:id', authMiddleware, async (req, res) => {
    const { tableName, id } = req.params;
    const dataToUpdate = req.body;

    if (!ALLOWED_TABLES.includes(tableName)) {
        return res.status(403).json({ success: false, message: 'Доступ к этой таблице запрещен' });
    }

    try {
        const config = TABLE_CONFIG[tableName];
        const primaryKey = config.primaryKey;

        // Удаляем служебное поле record_uuid
        delete dataToUpdate.record_uuid;

        // 1. Получаем старые значения ПЕРЕД обновлением
        const oldDataResult = await pool.query(`SELECT * FROM "${tableName}" WHERE "${primaryKey}" = $1`, [id]);
        if (oldDataResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Запись для обновления не найдена' });
        }
        const oldValues = oldDataResult.rows[0];

        // 2. Готовим описание для лога
        const displayValue = dataToUpdate[config.displayName] || oldValues[config.displayName] || id;
        const description = `Изменение данных для '${displayValue}'`;

        // 3. Готовим запрос на обновление
        const columns = Object.keys(dataToUpdate).map(col => `"${col}"`).join(', ');
        const values = Object.values(dataToUpdate);
        const valuePlaceholders = Object.keys(dataToUpdate).map((_, i) => `$${i + 1}`).join(', ');

        const query = `
            UPDATE "${tableName}"
            SET (${columns}, "Сохранил последним", "Дата сохранения") = (${valuePlaceholders}, $${values.length + 1}, CURRENT_TIMESTAMP)
            WHERE "${primaryKey}" = $${values.length + 2}
            RETURNING *;
        `;

        // 4. Получаем имя пользователя
        const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [req.userId]);
        const username = userResult.rows[0].username;

        const queryValues = [...values, username, id];

        // 5. Выполняем обновление
        const { rows } = await pool.query(query, queryValues);
        const newValues = rows[0];

        // 6. Логируем действие
        await logActivity(
            req.userId,
            tableName,
            'UPDATE',
            oldValues.id,
            oldValues,
            newValues,
            req.clientIp,
            description
        );

        res.json({ success: true, message: 'Данные успешно обновлены', data: rows[0] });
        
    } catch (error) {
        console.error(`Ошибка при обновлении данных в таблице ${tableName}:`, error);
        res.status(500).json({ success: false, message: 'Ошибка сервера при обновлении данных' });
    }
});

module.exports = router;