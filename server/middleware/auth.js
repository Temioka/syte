const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authMiddleware = async (req, res, next) => {
    try {
        // Получаем токен из заголовка
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Токен авторизации не предоставлен'
            });
        }

        const token = authHeader.split(' ')[1];

        // Верифицируем токен
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // ✅ ИСПРАВЛЕНО: Проверяем что пользователь существует и активен
        const result = await pool.query(
            'SELECT id, username, email, is_admin, is_active FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }

        const user = result.rows[0];

        // ✅ Проверяем что пользователь активен
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Ваш аккаунт заблокирован'
            });
        }

        // ✅ Добавляем данные пользователя в request
        req.userId = user.id;
        req.username = user.username;
        req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            is_admin: user.is_admin,
            role: user.is_admin ? 'admin' : 'user' // Для совместимости
        };

        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Токен истек'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Недействительный токен'
            });
        }

        console.error('❌ Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Ошибка авторизации'
        });
    }
};

module.exports = authMiddleware;