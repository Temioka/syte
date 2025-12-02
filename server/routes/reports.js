const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

/**
 * GET /reports - Получение списка всех отчетов пользователя
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        console.log(`📊 Запрос отчетов от пользователя: ${req.userId}`);
        
        // ✅ ПРОВЕРЯЕМ СУЩЕСТВОВАНИЕ ТАБЛИЦЫ
        const checkTableQuery = `
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'reports'
            );
        `;
        
        const tableCheck = await pool.query(checkTableQuery);
        
        if (!tableCheck.rows[0].exists) {
            console.log('⚠️ Таблица reports не существует, возвращаем пустой массив');
            return res.json({
                success: true,
                data: []
            });
        }
        
        const result = await pool.query(`
            SELECT 
                id,
                title,
                description,
                report_type,
                report_config,
                start_date,
                end_date,
                format,
                file_name,
                created_at,
                created_by
            FROM reports
            WHERE created_by = $1
            ORDER BY created_at DESC
        `, [req.userId]);

        console.log(`✅ Найдено отчетов: ${result.rows.length}`);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('❌ Ошибка получения отчетов:', error);
        
        // ✅ ВОЗВРАЩАЕМ ПУСТОЙ МАССИВ ВМЕСТО ОШИБКИ
        // Чтобы не редиректило на авторизацию
        res.json({
            success: true,
            data: []
        });
    }
});

/**
 * POST /reports - Создание нового отчета
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { 
            title, 
            description, 
            report_type,
            report_config,
            start_date, 
            end_date, 
            format, 
            file_data, 
            file_name 
        } = req.body;

        console.log('📥 Получен запрос на сохранение отчета:', {
            title,
            report_type: report_type || 'custom',
            format,
            file_name,
            fileDataLength: file_data ? file_data.length : 0,
            hasDescription: !!description,
            start_date,
            end_date,
            userId: req.userId
        });

        // Валидация обязательных полей
        if (!title) {
            console.warn('⚠️ Отсутствует название отчета');
            return res.status(400).json({ 
                success: false, 
                message: 'Название отчета обязательно' 
            });
        }

        if (!format) {
            console.warn('⚠️ Не указан формат файла');
            return res.status(400).json({ 
                success: false, 
                message: 'Формат файла обязателен' 
            });
        }

        if (!file_data) {
            console.warn('⚠️ Отсутствуют данные файла');
            return res.status(400).json({ 
                success: false, 
                message: 'Данные файла обязательны' 
            });
        }

        if (!file_name) {
            console.warn('⚠️ Отсутствует имя файла');
            return res.status(400).json({ 
                success: false, 
                message: 'Имя файла обязательно' 
            });
        }

        // Проверка размера base64 строки (не более 100MB в base64)
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file_data.length > maxSize) {
            console.warn(`⚠️ Файл слишком большой: ${file_data.length} байт`);
            return res.status(400).json({ 
                success: false, 
                message: 'Файл слишком большой (максимум 100MB)' 
            });
        }

        console.log('🔄 Конвертация base64 в binary...');
        let fileBuffer;
        try {
            fileBuffer = Buffer.from(file_data, 'base64');
            console.log(`✅ Файл конвертирован, размер: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
        } catch (conversionError) {
            console.error('❌ Ошибка конвертации base64:', conversionError);
            return res.status(400).json({ 
                success: false, 
                message: 'Ошибка обработки файла: некорректный формат base64' 
            });
        }

        // Валидация формата
        const validFormats = ['excel', 'pdf'];
        if (!validFormats.includes(format)) {
            console.warn(`⚠️ Неверный формат: ${format}`);
            return res.status(400).json({ 
                success: false, 
                message: 'Неверный формат файла. Допустимы: excel, pdf' 
            });
        }

        console.log('💾 Сохранение отчета в базу данных...');
        
        // Сохраняем отчет
        const result = await pool.query(`
            INSERT INTO reports (
                title, 
                description, 
                report_type,
                report_config,
                start_date, 
                end_date, 
                format, 
                file_data, 
                file_name, 
                created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, title, created_at
        `, [
            title,
            description || null,
            report_type || 'custom',
            report_config || null,
            start_date || null,
            end_date || null,
            format,
            fileBuffer,
            file_name,
            req.userId
        ]);

        console.log('✅ Отчет успешно сохранен:', {
            id: result.rows[0].id,
            title: result.rows[0].title,
            created_at: result.rows[0].created_at
        });

        res.status(201).json({
            success: true,
            message: 'Отчет успешно сохранен',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Ошибка создания отчета:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });

        // Специфичные ошибки PostgreSQL
        if (error.code === '23505') { // Duplicate key
            return res.status(409).json({ 
                success: false, 
                message: 'Отчет с таким названием уже существует' 
            });
        }

        if (error.code === '22P02') { // Invalid text representation
            return res.status(400).json({ 
                success: false, 
                message: 'Ошибка в формате данных' 
            });
        }

        if (error.code === '23503') { // Foreign key violation
            return res.status(400).json({ 
                success: false, 
                message: 'Пользователь не найден' 
            });
        }

        res.status(500).json({ 
            success: false, 
            message: 'Ошибка сервера при создании отчета',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /reports/:id/download - Скачивание отчета
 */
router.get('/:id/download', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`📥 Запрос на скачивание отчета ID: ${id} от пользователя: ${req.userId}`);

        // Валидация UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            console.warn(`⚠️ Некорректный ID отчета: ${id}`);
            return res.status(400).json({ 
                success: false, 
                message: 'Некорректный ID отчета' 
            });
        }

        const result = await pool.query(`
            SELECT 
                file_data, 
                file_name, 
                format,
                title
            FROM reports
            WHERE id = $1 AND created_by = $2
        `, [id, req.userId]);

        if (result.rows.length === 0) {
            console.warn(`⚠️ Отчет ID: ${id} не найден для пользователя: ${req.userId}`);
            return res.status(404).json({ 
                success: false, 
                message: 'Отчет не найден или у вас нет доступа к нему' 
            });
        }

        const report = result.rows[0];

        console.log(`✅ Отчет найден: ${report.title}, размер: ${(report.file_data.length / 1024).toFixed(2)} KB`);

        // Определяем MIME type
        const mimeTypes = {
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf': 'application/pdf'
        };

        const mimeType = mimeTypes[report.format] || 'application/octet-stream';

        console.log(`📤 Отправка файла: ${report.file_name} (${mimeType})`);

        // Отправляем файл
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(report.file_name)}"`);
        res.setHeader('Content-Length', report.file_data.length);
        res.send(report.file_data);

        console.log(`✅ Файл успешно отправлен`);

    } catch (error) {
        console.error('❌ Ошибка скачивания отчета:', {
            message: error.message,
            reportId: req.params.id,
            userId: req.userId
        });

        res.status(500).json({ 
            success: false, 
            message: 'Ошибка сервера при скачивании отчета',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * DELETE /reports/:id - Удаление отчета
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`🗑️ Запрос на удаление отчета ID: ${id} от пользователя: ${req.userId}`);

        // Валидация UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            console.warn(`⚠️ Некорректный ID отчета: ${id}`);
            return res.status(400).json({ 
                success: false, 
                message: 'Некорректный ID отчета' 
            });
        }

        const result = await pool.query(`
            DELETE FROM reports
            WHERE id = $1 AND created_by = $2
            RETURNING id, title
        `, [id, req.userId]);

        if (result.rows.length === 0) {
            console.warn(`⚠️ Отчет ID: ${id} не найден для удаления`);
            return res.status(404).json({ 
                success: false, 
                message: 'Отчет не найден или у вас нет доступа к нему' 
            });
        }

        console.log(`✅ Отчет удален: ${result.rows[0].title} (ID: ${result.rows[0].id})`);

        res.json({
            success: true,
            message: 'Отчет успешно удален',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Ошибка удаления отчета:', {
            message: error.message,
            reportId: req.params.id,
            userId: req.userId
        });

        res.status(500).json({ 
            success: false, 
            message: 'Ошибка сервера при удалении отчета',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;