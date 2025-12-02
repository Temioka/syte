/**
 * Middleware для проверки прав администратора
 */
const adminMiddleware = (req, res, next) => {
    // Проверяем что пользователь авторизован
    if (!req.userId) {
        return res.status(401).json({
            success: false,
            message: 'Требуется авторизация'
        });
    }

    // Проверяем роль администратора
    if (req.userRole !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Доступ запрещен. Требуются права администратора'
        });
    }

    next();
};

module.exports = adminMiddleware;