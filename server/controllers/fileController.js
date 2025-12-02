const xlsx = require('xlsx');
const pool = require('../config/database');
const logger = require('../utils/logger');
const { logActivity } = require('../utils/activityLogger');

/**
 * Маппинг названий колонок Excel на поля БД
 */
const COLUMN_MAPPINGS = {
    sudeb_vzisk: {
        '№ л/с': '№ л/с',
        'Тип клиента': 'Тип клиента',
        'ФИО/Наименование': 'ФИО/Наименование',
        'Сумма подаваемой ДЗ': 'Сумма подаваемой ДЗ , руб#',
        'Дата начала образования долга': 'Дата начала образования долга',
        'Дата окончания образования долга': 'Дата окончания образования долга',
        'Сумма гос.пошлины': 'Сумма подаваемой гос#пошлины,руб#',
        'Сумма неустойки': 'Сумма подаваемой  неустойки,руб#',
        'Паспорт': 'Паспорт',
        'Адрес должника': 'Адрес должника',
        'Судебный участок': 'Судебный участок',
    },
    dos_rabota: {
        '№ л/с': '№ л/с',
        'Тип клиента': 'Тип клиента',
        'ФИО/Наименование': 'ФИО/Наименование',
        'Сумма ДЗ': 'Сумма подаваемой ДЗ , руб.',
        'Дата начала задолженности': 'Дата начала задолженности',
        'Дата окончания задолженности': 'Дата окончания задолженности',
        'ИНН': 'ИНН',
        'Адрес должника': 'Адрес должника',
        'Email': 'Электронная почта должника',
    },
    base_zayci: {
        'ГРН': 'ГРН',
        'Дата поездки': 'Дата поездки',
        'Транзакции': 'Транзакции',
        'ПВП/РВП': 'ПВП/РВП - полоса',
        'Способ оплаты': 'Способ оплаты',
        'Тариф': 'Тариф',
        'Адрес': 'Адрес',
        'Паспорт': 'Паспортные данные',
        'Почта': 'Почта',
        'Телефон': 'Телефон',
    },
};

/**
 * Парсинг даты из различных форматов Excel
 */
const parseExcelDate = (value) => {
    if (!value) return null;
    
    // Если это число (Excel serial date)
    if (typeof value === 'number') {
        const date = xlsx.SSF.parse_date_code(value);
        return new Date(date.y, date.m - 1, date.d).toISOString().split('T')[0];
    }
    
    // Если это строка
    if (typeof value === 'string') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    }
    
    return null;
};

/**
 * Парсинг числа из различных форматов
 */
const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    
    // Если уже число
    if (typeof value === 'number') return value;
    
    // Если строка, убираем пробелы и заменяем запятую на точку
    if (typeof value === 'string') {
        const cleaned = value.replace(/\s/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }
    
    return null;
};

/**
 * Загрузка данных из Excel файла
 */
const uploadExcel = async (req, res) => {
    try {
        const { tableName } = req.params;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'Файл не предоставлен',
            });
        }
        
        logger.info(`📤 Начало загрузки Excel: ${file.originalname} в таблицу ${tableName} | User: ${req.user.username}`);
        
        // Читаем Excel файл
        const workbook = xlsx.read(file.buffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Конвертируем в JSON
        const rawData = xlsx.utils.sheet_to_json(sheet, { defval: null });
        
        logger.info(`📊 Прочитано ${rawData.length} строк из Excel`);
        
        if (rawData.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Excel файл пустой',
            });
        }
        
        // Получаем маппинг для таблицы
        const mapping = COLUMN_MAPPINGS[tableName];
        if (!mapping) {
            return res.status(400).json({
                success: false,
                message: `Маппинг для таблицы ${tableName} не найден`,
            });
        }
        
        // Преобразуем данные согласно маппингу
        const transformedData = [];
        const errors = [];
        
        for (let i = 0; i < rawData.length; i++) {
            const row = rawData[i];
            const transformed = {};
            
            try {
                // Маппим колонки
                for (const [excelCol, dbCol] of Object.entries(mapping)) {
                    let value = row[excelCol];
                    
                    // Обработка дат
                    if (dbCol.toLowerCase().includes('дата')) {
                        value = parseExcelDate(value);
                    }
                    // Обработка чисел
                    else if (dbCol.toLowerCase().includes('сумма') || 
                             dbCol.toLowerCase().includes('тариф') ||
                             dbCol.toLowerCase().includes('кол-во')) {
                        value = parseNumber(value);
                    }
                    
                    transformed[dbCol] = value;
                }
                
                // Добавляем метаданные
                transformed['Сохранил последним'] = req.user.username;
                transformed['Дата сохранения'] = new Date();
                
                transformedData.push(transformed);
                
            } catch (error) {
                errors.push({
                    row: i + 2, // +2 потому что строка 1 - заголовок, и индекс с 0
                    error: error.message,
                    data: row,
                });
                logger.warn(`⚠️ Ошибка обработки строки ${i + 2}: ${error.message}`);
            }
        }
        
        if (transformedData.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Не удалось обработать ни одной строки',
                errors,
            });
        }
        
        // Начинаем транзакцию для массовой вставки
        const client = await pool.connect();
        let insertedCount = 0;
        let updatedCount = 0;
        let failedCount = 0;
        
        try {
            await client.query('BEGIN');
            
            for (const record of transformedData) {
                try {
                    // Определяем уникальный ключ
                    const uniqueKey = tableName === 'base_zayci' ? 'ГРН' : '№ л/с';
                    const uniqueValue = record[uniqueKey];
                    
                    if (!uniqueValue) {
                        failedCount++;
                        errors.push({
                            record: record,
                            error: `Отсутствует ${uniqueKey}`,
                        });
                        continue;
                    }
                    
                    // Проверяем существование записи
                    const checkQuery = `SELECT id FROM "${tableName}" WHERE "${uniqueKey}" = $1`;
                    const checkResult = await client.query(checkQuery, [uniqueValue]);
                    
                    if (checkResult.rows.length > 0) {
                        // Обновляем существующую запись
                        const fields = Object.keys(record);
                        const setClause = fields
                            .map((key, index) => `"${key}" = $${index + 1}`)
                            .join(', ');
                        const values = fields.map(key => record[key]);
                        
                        const updateQuery = `
                            UPDATE "${tableName}"
                            SET ${setClause}
                            WHERE "${uniqueKey}" = $${values.length + 1}
                        `;
                        
                        await client.query(updateQuery, [...values, uniqueValue]);
                        updatedCount++;
                        
                    } else {
                        // Вставляем новую запись
                        const fields = Object.keys(record);
                        const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
                        const values = fields.map(key => record[key]);
                        
                        const insertQuery = `
                            INSERT INTO "${tableName}" (${fields.map(f => `"${f}"`).join(', ')})
                            VALUES (${placeholders})
                        `;
                        
                        await client.query(insertQuery, values);
                        insertedCount++;
                    }
                    
                } catch (error) {
                    failedCount++;
                    errors.push({
                        record: record,
                        error: error.message,
                    });
                    logger.error(`❌ Ошибка вставки записи: ${error.message}`);
                }
            }
            
            await client.query('COMMIT');
            
            // Логируем действие
            await logActivity(
                req.user.id,
                tableName,
                'import_excel',
                null,
                null,
                {
                    fileName: file.originalname,
                    totalRows: rawData.length,
                    inserted: insertedCount,
                    updated: updatedCount,
                    failed: failedCount,
                },
                req.clientIp,
                `Импорт Excel: ${insertedCount} добавлено, ${updatedCount} обновлено, ${failedCount} ошибок`
            );
            
            logger.info(`✅ Excel импорт завершен | Добавлено: ${insertedCount}, Обновлено: ${updatedCount}, Ошибок: ${failedCount}`);
            
            res.json({
                success: true,
                message: 'Excel файл успешно загружен',
                statistics: {
                    totalRows: rawData.length,
                    inserted: insertedCount,
                    updated: updatedCount,
                    failed: failedCount,
                    errors: errors.length > 0 ? errors.slice(0, 10) : [], // Показываем первые 10 ошибок
                },
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        logger.logError(error, 'uploadExcel');
        res.status(500).json({
            success: false,
            message: 'Ошибка при загрузке Excel файла',
            error: error.message,
        });
    }
};

/**
 * Экспорт данных в Excel
 */
const exportToExcel = async (req, res) => {
    try {
        const { tableName } = req.params;
        const { filters, columns } = req.body;
        
        logger.info(`📥 Экспорт в Excel: ${tableName} | User: ${req.user.username}`);
        
        // Строим запрос с фильтрами
        let query = `SELECT * FROM "${tableName}"`;
        const params = [];
        
        if (filters && Object.keys(filters).length > 0) {
            const conditions = [];
            let paramIndex = 1;
            
            for (const [field, value] of Object.entries(filters)) {
                if (value !== null && value !== undefined && value !== '') {
                    conditions.push(`"${field}"::text ILIKE $${paramIndex}`);
                    params.push(`%${value}%`);
                    paramIndex++;
                }
            }
            
            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }
        }
        
        query += ' ORDER BY "Дата сохранения" DESC';
        
        const result = await pool.query(query, params);
        
        logger.info(`📊 Выбрано ${result.rows.length} записей для экспорта`);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Нет данных для экспорта',
            });
        }
        
        // Фильтруем колонки если указаны
        let data = result.rows;
        if (columns && columns.length > 0) {
            data = result.rows.map(row => {
                const filtered = {};
                columns.forEach(col => {
                    if (row.hasOwnProperty(col)) {
                        filtered[col] = row[col];
                    }
                });
                return filtered;
            });
        }
        
        // Создаем Excel файл
        const worksheet = xlsx.utils.json_to_sheet(data);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, tableName);
        
        // Автоширина колонок
        const colWidths = [];
        const firstRow = data[0];
        if (firstRow) {
            Object.keys(firstRow).forEach(key => {
                const maxLength = Math.max(
                    key.length,
                    ...data.map(row => String(row[key] || '').length)
                );
                colWidths.push({ wch: Math.min(maxLength + 2, 50) });
            });
        }
        worksheet['!cols'] = colWidths;
        
        // Генерируем буфер
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        // Логируем действие
        await logActivity(
            req.user.id,
            tableName,
            'export_excel',
            null,
            null,
            { rowsExported: result.rows.length },
            req.clientIp,
            `Экспорт Excel: ${result.rows.length} записей`
        );
        
        // Отправляем файл
        const fileName = `${tableName}_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
        
        logger.info(`✅ Excel экспорт завершен: ${fileName}`);
        
    } catch (error) {
        logger.logError(error, 'exportToExcel');
        res.status(500).json({
            success: false,
            message: 'Ошибка при экспорте в Excel',
            error: error.message,
        });
    }
};

/**
 * Получение шаблона Excel для загрузки
 */
const getExcelTemplate = async (req, res) => {
    try {
        const { tableName } = req.params;
        
        const mapping = COLUMN_MAPPINGS[tableName];
        if (!mapping) {
            return res.status(400).json({
                success: false,
                message: `Шаблон для таблицы ${tableName} не найден`,
            });
        }
        
        // Создаем пустой шаблон с заголовками
        const headers = Object.keys(mapping);
        const template = [headers.reduce((obj, header) => {
            obj[header] = '';
            return obj;
        }, {})];
        
        const worksheet = xlsx.utils.json_to_sheet(template);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Шаблон');
        
        // Автоширина
        worksheet['!cols'] = headers.map(h => ({ wch: h.length + 5 }));
        
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        const fileName = `template_${tableName}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
        
        logger.info(`✅ Шаблон Excel отправлен: ${fileName} | User: ${req.user.username}`);
        
    } catch (error) {
        logger.logError(error, 'getExcelTemplate');
        res.status(500).json({
            success: false,
            message: 'Ошибка при создании шаблона',
            error: error.message,
        });
    }
};

module.exports = {
    uploadExcel,
    exportToExcel,
    getExcelTemplate,
};