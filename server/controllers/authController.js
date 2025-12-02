require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt');

const validatePassword = (password) => {
    return {
        length: password.length >= 8,
        hasUpperCase: /[A-Z]/.test(password),
        hasLowerCase: /[a-z]/.test(password),
        hasNumbers: /\d/.test(password),
        hasSpecialChars: /[!@#$%^&*]/.test(password),
    };
};

const getPasswordStrength = (password) => {
    const checks = validatePassword(password);
    const passedChecks = Object.values(checks).filter(Boolean).length;
    
    if (passedChecks <= 2) return 'weak';
    if (passedChecks <= 3) return 'medium';
    if (passedChecks <= 4) return 'strong';
    return 'very-strong';
};

const logUserAction = async (userId, action, description, req) => {
    try {
        await pool.query(
            `INSERT INTO user_logs (user_id, action, description, ip_address, user_agent) 
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, action, description, req.clientIp, req.headers['user-agent']]
        );
    } catch (error) {
        console.error('Error logging user action:', error);
    }
};

const register = async (req, res) => {
    try {
        const { username, email, password, confirmPassword, registrationToken } = req.body;

        const expectedToken = process.env.REGISTRATION_TOKEN;

        console.log('📝 Попытка регистрации');
        console.log(`   IP: ${req.clientIp}`);
        console.log(`   Username: ${username}`);
        console.log(`   Email: ${email}`);

        // Проверка токена регистрации
        if (!registrationToken || registrationToken !== process.env.REGISTRATION_TOKEN) {
            console.warn(`❌ Неверный токен регистрации от ${req.clientIp}`);
            return res.status(403).json({ 
                success: false, 
                message: 'Неверная ссылка регистрации. Проверьте корректность токена.'
            });
        }

        // Валидация всех полей
        if (!username || !email || !password || !confirmPassword) {
            return res.status(400).json({ 
                success: false, 
                message: 'Все поля обязательны' 
            });
        }

        // Проверка длины имени пользователя
        if (username.length < 3) {
            return res.status(400).json({ 
                success: false, 
                message: 'Имя пользователя должно содержать минимум 3 символа' 
            });
        }

        // Проверка совпадения паролей
        if (password !== confirmPassword) {
            return res.status(400).json({ 
                success: false, 
                message: 'Пароли не совпадают' 
            });
        }

        // Проверка длины пароля
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'Пароль должен содержать не менее 6 символов' 
            });
        }

        // Валидация email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Введите корректный email' 
            });
        }

        // 🔍 ПРОВЕРКА НА СУЩЕСТВОВАНИЕ ПОЛЬЗОВАТЕЛЯ И EMAIL
        console.log('🔍 Проверка на существование пользователя...');
        const userExists = await pool.query(
            'SELECT id, username, email FROM users WHERE username = $1 OR email = $2',
            [username.toLowerCase(), email.toLowerCase()]
        );

        if (userExists.rows.length > 0) {
            const existingUser = userExists.rows[0];
            let errorMessage = '';

            // Проверяем что именно совпадает
            if (existingUser.username.toLowerCase() === username.toLowerCase()) {
                errorMessage = `❌ Имя пользователя "${username}" уже занято`;
                console.warn(`${errorMessage} (от ${req.clientIp})`);
                return res.status(409).json({ 
                    success: false, 
                    message: `Имя пользователя "${username}" уже используется другим пользователем`,
                    field: 'username'
                });
            }

            if (existingUser.email.toLowerCase() === email.toLowerCase()) {
                errorMessage = `❌ Email "${email}" уже зарегистрирован`;
                console.warn(`${errorMessage} (от ${req.clientIp})`);
                return res.status(409).json({ 
                    success: false, 
                    message: `Email "${email}" уже зарегистрирован в системе`,
                    field: 'email'
                });
            }
        }

        console.log('✅ Проверка пройдена - пользователь и email свободны');

        // Хеширование пароля
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Создание пользователя
        const result = await pool.query(
            `INSERT INTO users (username, email, password, full_name) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, username, email, created_at`,
            [username, email, hashedPassword, username]
        );

        const user = result.rows[0];
        const token = generateToken(user.id);

        // Логирование регистрации
        await logUserAction(user.id, 'REGISTER', `Регистрация пользователя ${username}`, req);

        console.log(`✅ Пользователь ${username} зарегистрирован | IP: ${req.clientIp}`);

        res.status(201).json({
            success: true,
            message: 'Пользователь успешно зарегистрирован',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                created_at: user.created_at,
            },
            token,
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка сервера при регистрации'
        });
    }
};

const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Введите имя пользователя и пароль' 
            });
        }

        console.log(`🔑 Попытка входа: ${username} | IP: ${req.clientIp}`);

        const result = await pool.query(
            'SELECT id, username, email, password, is_active FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            console.warn(`❌ Пользователь не найден: ${username} | IP: ${req.clientIp}`);
            return res.status(401).json({ 
                success: false, 
                message: 'Неверное имя пользователя или пароль' 
            });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            console.warn(`❌ Аккаунт заблокирован: ${username} | IP: ${req.clientIp}`);
            return res.status(403).json({ 
                success: false, 
                message: 'Ваш аккаунт заблокирован' 
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            await logUserAction(user.id, 'LOGIN_FAILED', `Неудачная попытка входа (неверный пароль)`, req);
            console.warn(`❌ Неверный пароль: ${username} | IP: ${req.clientIp}`);
            return res.status(401).json({ 
                success: false, 
                message: 'Неверное имя пользователя или пароль' 
            });
        }

        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        await logUserAction(user.id, 'LOGIN', `Успешный вход в систему`, req);

        const token = generateToken(user.id);

        console.log(`✅ Успешный вход: ${username} | IP: ${req.clientIp}`);

        res.json({
            success: true,
            message: 'Вы успешно вошли в систему',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
            },
            token,
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка сервера при входе' 
        });
    }
};

const getProfile = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, email, full_name, avatar_url, is_admin, 
                    created_at, last_login 
             FROM users 
             WHERE id = $1 AND is_active = TRUE`,
            [req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Пользователь не найден' 
            });
        }

        res.json({
            success: true,
            user: result.rows[0],
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка при получении профиля' 
        });
    }
};

const logout = async (req, res) => {
    try {
        await logUserAction(req.userId, 'LOGOUT', `Выход из системы`, req);
        console.log(`👋 Выход пользователя ${req.userId} | IP: ${req.clientIp}`);

        res.json({
            success: true,
            message: 'Вы вышли из системы',
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка при выходе' 
        });
    }
};

const checkPasswordStrength = (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Пароль не предоставлен' 
            });
        }

        const strength = getPasswordStrength(password);
        const validation = validatePassword(password);

        res.json({
            success: true,
            strength,
            validation,
            message: `Уровень надежности: ${strength}`
        });
    } catch (error) {
        console.error('Check password strength error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка при проверке пароля' 
        });
    }
};

module.exports = {
    register,
    login,
    getProfile,
    logout,
    checkPasswordStrength,
};