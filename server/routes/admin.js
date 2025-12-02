const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const authMiddleware = require('../middleware/auth');

// Middleware для проверки прав администратора
const adminMiddleware = async (req, res, next) => {
    try {
        const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.userId]);
        
        if (result.rows.length === 0 || !result.rows[0].is_admin) {
            return res.status(403).json({ 
                success: false, 
                message: 'Доступ запрещен. Требуются права администратора.' 
            });
        }
        
        next();
    } catch (error) {
        console.error('Ошибка проверки прав администратора:', error);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
};

/**
 * GET /admin/users - Получение списка всех пользователей
 */
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id, 
                username, 
                email, 
                full_name, 
                is_admin, 
                is_active, 
                created_at, 
                updated_at, 
                last_login
            FROM users
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Ошибка получения списка пользователей:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка сервера при получении пользователей' 
        });
    }
});

/**
 * POST /admin/users - Создание нового пользователя
 */
router.post('/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { username, email, password, full_name, is_admin, is_active } = req.body;

        // Валидация
        if (!username || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Имя пользователя, email и пароль обязательны' 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'Пароль должен содержать минимум 6 символов' 
            });
        }

        // Проверка существования пользователя
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Пользователь с таким именем или email уже существует' 
            });
        }

        // Хеширование пароля
        const hashedPassword = await bcrypt.hash(password, 10);

        // Создание пользователя
        const result = await pool.query(`
            INSERT INTO users (username, email, password, full_name, is_admin, is_active)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, username, email, full_name, is_admin, is_active, created_at
        `, [username, email, hashedPassword, full_name || null, is_admin || false, is_active !== false]);

        res.status(201).json({
            success: true,
            message: 'Пользователь успешно создан',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Ошибка создания пользователя:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка сервера при создании пользователя' 
        });
    }
});

/**
 * PUT /admin/users/:id - Обновление пользователя
 */
router.put('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, full_name, is_admin, is_active } = req.body;

        // Валидация
        if (!username || !email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Имя пользователя и email обязательны' 
            });
        }

        // Проверка существования другого пользователя с таким же username/email
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE (username = $1 OR email = $2) AND id != $3',
            [username, email, id]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Пользователь с таким именем или email уже существует' 
            });
        }

        // Обновление пользователя
        const result = await pool.query(`
            UPDATE users
            SET username = $1, email = $2, full_name = $3, is_admin = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
            RETURNING id, username, email, full_name, is_admin, is_active, updated_at
        `, [username, email, full_name || null, is_admin || false, is_active !== false, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Пользователь не найден' 
            });
        }

        res.json({
            success: true,
            message: 'Пользователь успешно обновлен',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Ошибка обновления пользователя:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка сервера при обновлении пользователя' 
        });
    }
});

/**
 * DELETE /admin/users/:id - Удаление пользователя
 */
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Проверка: нельзя удалить самого себя
        if (id === req.userId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Нельзя удалить собственную учетную запись' 
            });
        }

        // Удаление пользователя
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Пользователь не найден' 
            });
        }

        res.json({
            success: true,
            message: 'Пользователь успешно удален'
        });

    } catch (error) {
        console.error('Ошибка удаления пользователя:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка сервера при удалении пользователя' 
        });
    }
});

module.exports = router;