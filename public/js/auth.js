// ============================================
// DOM ЭЛЕМЕНТЫ
// ============================================

const loginCard = document.getElementById('loginCard');
const registerCard = document.getElementById('registerCard');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginMessage = document.getElementById('loginMessage');
const registerMessage = document.getElementById('registerMessage');
const backToLoginBtn = document.getElementById('backToLoginBtn');
const passwordInput = document.getElementById('registerPassword');
const strengthBar = document.querySelector('.strength-fill');
const strengthText = document.getElementById('strengthText');

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 auth.js загружен');
    console.log('🌐 Хост:', window.location.host);
    
    // Проверка токена регистрации в URL
    const params = new URLSearchParams(window.location.search);
    const registrationToken = params.get('register');
    
    // Инициализация форм с учётом токена регистрации
    if (registrationToken) {
        // Если есть токен - показываем форму регистрации
        if (loginCard) {
            loginCard.classList.remove('hidden');
            loginCard.style.display = 'none';
        }
        if (registerCard) {
            registerCard.classList.remove('hidden');
            registerCard.style.display = 'block';
            if (registerForm) {
                registerForm.dataset.registrationToken = registrationToken;
            }
        }
        console.log('📝 Показана форма регистрации (токен найден)');
    } else {
        // Если нет токена - показываем форму логина
        if (loginCard) {
            loginCard.classList.remove('hidden');
            loginCard.style.display = 'block';
        }
        if (registerCard) {
            registerCard.classList.remove('hidden');
            registerCard.style.display = 'none';
        }
        console.log('🔐 Показана форма входа');
    }

    // Привязка событий
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', showLoginCard);
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('input', handlePasswordInput);
    }

    // Очистка сообщений при изменении инпутов
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', clearMessages);
    });

    // Обработчик кнопки выхода (если есть на странице)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            console.log('🚪 Клик на кнопку выхода');
            
            // ✅ ИСПРАВЛЕНО: Используем Utils если доступен
            if (typeof Utils !== 'undefined' && Utils.logout) {
                Utils.logout();
            } else if (typeof logout === 'function') {
                logout();
            } else {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                sessionStorage.clear();
                window.location.href = '/';
            }
        });
    }

    console.log('✅ События привязаны');
});

// ============================================
// НАВИГАЦИЯ МЕЖДУ ФОРМАМИ
// ============================================

/**
 * Показать форму регистрации
 * @param {string} token - Токен регистрации
 */
function showRegisterCard(token) {
    if (loginCard) {
        loginCard.style.display = 'none';
    }
    if (registerCard) {
        registerCard.style.display = 'block';
    }
    
    if (token && registerForm) {
        registerForm.dataset.registrationToken = token;
    }
    
    clearMessages();
    console.log('📝 Показана форма регистрации');
}

/**
 * Показать форму входа
 */
function showLoginCard() {
    if (registerCard) {
        registerCard.style.display = 'none';
    }
    if (loginCard) {
        loginCard.style.display = 'block';
    }
    
    clearMessages();
    console.log('🔐 Показана форма входа');
}

// ============================================
// УПРАВЛЕНИЕ КНОПКАМИ
// ============================================

/**
 * Блокировать кнопку отправки формы
 * @param {HTMLFormElement} form - Форма
 * @param {string} loadingText - Текст загрузки
 */
function disableSubmitButton(form, loadingText = 'Загрузка...') {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.6';
        submitBtn.style.cursor = 'not-allowed';
        
        // Сохраняем оригинальный контент
        submitBtn.dataset.originalHtml = submitBtn.innerHTML;
        
        // Показываем текст загрузки
        const span = submitBtn.querySelector('span');
        if (span) {
            span.textContent = loadingText;
        }
    }
}

/**
 * Разблокировать кнопку отправки формы
 * @param {HTMLFormElement} form - Форма
 */
function enableSubmitButton(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        
        // Восстанавливаем оригинальный контент
        if (submitBtn.dataset.originalHtml) {
            submitBtn.innerHTML = submitBtn.dataset.originalHtml;
        }
    }
}

// ============================================
// СООБЩЕНИЯ
// ============================================

/**
 * Показать сообщение
 * @param {HTMLElement} element - Элемент для сообщения
 * @param {string} message - Текст сообщения
 * @param {string} type - Тип сообщения (error, success, info)
 */
function showMessage(element, message, type = 'error') {
    if (!element) return;
    
    element.textContent = message;
    element.className = `message show ${type}`;
    
    // Автоскрытие для успешных сообщений
    if (type === 'success') {
        setTimeout(() => {
            element.classList.remove('show');
        }, 5000);
    }
}

/**
 * Очистить все сообщения
 */
function clearMessages() {
    if (loginMessage) {
        loginMessage.classList.remove('show');
    }
    if (registerMessage) {
        registerMessage.classList.remove('show');
    }
}

// ============================================
// ПРОВЕРКА НАДЕЖНОСТИ ПАРОЛЯ
// ============================================

/**
 * Обработчик ввода пароля с проверкой надежности
 * @param {Event} e - Событие ввода
 */
async function handlePasswordInput(e) {
    const password = e.target.value;

    if (!password) {
        const strengthContainer = document.getElementById('passwordStrength');
        if (strengthContainer) {
            strengthContainer.style.display = 'none';
        }
        return;
    }

    const strengthContainer = document.getElementById('passwordStrength');
    if (strengthContainer) {
        strengthContainer.style.display = 'block';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/check-password-strength`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password }),
        });

        if (!response.ok) {
            console.warn('⚠️ Ошибка проверки пароля:', response.status);
            return;
        }

        const data = await response.json();

        if (data.success) {
            const { strength, validation } = data;

            // Обновляем визуальный индикатор
            if (strengthBar) {
                strengthBar.className = `strength-fill ${strength}`;
            }
            
            if (strengthText) {
                strengthText.className = `strength-text ${strength}`;
                
                const strengthLabels = {
                    'weak': '🔴 Слабый пароль',
                    'medium': '🟡 Средний пароль',
                    'strong': '🟢 Хороший пароль',
                    'very-strong': '🟢 Надежный пароль'
                };
                
                strengthText.textContent = strengthLabels[strength] || 'Проверка пароля';
            }

            // Обновляем чеклист
            updateCheckItems(validation);
        }
    } catch (error) {
        console.error('❌ Ошибка проверки пароля:', error);
    }
}

/**
 * Обновление чекбоксов валидации пароля
 * @param {Object} validation - Объект с результатами валидации
 */
function updateCheckItems(validation) {
    const checks = [
        { id: 'checkLength', key: 'length' },
        { id: 'checkUpperCase', key: 'hasUpperCase' },
        { id: 'checkLowerCase', key: 'hasLowerCase' },
        { id: 'checkNumbers', key: 'hasNumbers' },
        { id: 'checkSpecial', key: 'hasSpecialChars' }
    ];

    checks.forEach(({ id, key }) => {
        const element = document.getElementById(id);
        if (element) {
            if (validation[key]) {
                element.classList.add('checked');
            } else {
                element.classList.remove('checked');
            }
        }
    });
}

// ============================================
// ОБРАБОТЧИК ВХОДА (ЛОГИН)
// ============================================

/**
 * Обработчик формы входа
 * @param {Event} e - Событие submit
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    
    if (!usernameInput || !passwordInput) {
        console.error('❌ Поля формы не найдены');
        return;
    }
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Валидация
    if (!username || !password) {
        showMessage(loginMessage, '⚠️ Заполните все поля', 'error');
        return;
    }

    if (username.length < 3) {
        showMessage(loginMessage, '⚠️ Имя пользователя должно содержать минимум 3 символа', 'error');
        return;
    }

    try {
        console.log('🔐 Попытка входа для пользователя:', username);
        
        disableSubmitButton(loginForm, 'Вход...');
        clearMessages();

        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (data.success && data.token) {
            console.log('✅ Успешный вход');
            
            // Сохраняем данные в localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            showMessage(loginMessage, '✅ ' + (data.message || 'Успешный вход!'), 'success');
            
            // Редирект на дашборд
            setTimeout(() => {
                if (typeof navigateWithTransition === 'function') {
                    navigateWithTransition('/dashboard.html');
                } else {
                    window.location.href = '/dashboard.html';
                }
            }, 1000);
        } else {
            console.warn('❌ Ошибка входа:', data.message);
            
            let errorMessage = data.message || 'Ошибка при входе';
            
            // Улучшенные сообщения об ошибках
            if (response.status === 401) {
                errorMessage = '❌ Неверное имя пользователя или пароль';
            } else if (response.status === 403) {
                errorMessage = '❌ Доступ запрещён. Обратитесь к администратору';
            } else if (response.status === 429) {
                errorMessage = '❌ Слишком много попыток входа. Попробуйте позже';
            }
            
            showMessage(loginMessage, errorMessage, 'error');
            enableSubmitButton(loginForm);
        }
    } catch (error) {
        console.error('❌ Ошибка подключения:', error);
        showMessage(loginMessage, '❌ Ошибка подключения к серверу. Проверьте соединение', 'error');
        enableSubmitButton(loginForm);
    }
}

// ============================================
// ОБРАБОТЧИК РЕГИСТРАЦИИ
// ============================================

/**
 * Обработчик формы регистрации
 * @param {Event} e - Событие submit
 */
async function handleRegister(e) {
    e.preventDefault();
    
    const usernameInput = document.getElementById('registerUsername');
    const emailInput = document.getElementById('registerEmail');
    const passwordInput = document.getElementById('registerPassword');
    const confirmPasswordInput = document.getElementById('registerConfirmPassword');
    
    if (!usernameInput || !emailInput || !passwordInput || !confirmPasswordInput) {
        console.error('❌ Поля формы не найдены');
        return;
    }
    
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const registrationToken = registerForm.dataset.registrationToken;

    // Валидация на клиенте
    if (!username || !email || !password || !confirmPassword) {
        showMessage(registerMessage, '⚠️ Заполните все поля', 'error');
        return;
    }

    if (username.length < 3) {
        showMessage(registerMessage, '⚠️ Имя пользователя должно содержать минимум 3 символа', 'error');
        return;
    }

    if (password.length < 8) {
        showMessage(registerMessage, '⚠️ Пароль должен содержать минимум 8 символов', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showMessage(registerMessage, '⚠️ Пароли не совпадают', 'error');
        return;
    }

    // ✅ ИСПРАВЛЕНО: Используем Utils для валидации email если доступен
    const isEmailValid = (typeof Utils !== 'undefined' && Utils.isValidEmail) 
        ? Utils.isValidEmail(email)
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        
    if (!isEmailValid) {
        showMessage(registerMessage, '⚠️ Введите корректный email', 'error');
        return;
    }

    try {
        console.log('📝 Попытка регистрации для:', username);
        
        disableSubmitButton(registerForm, 'Регистрация...');
        clearMessages();

        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username,
                email,
                password,
                confirmPassword,
                registrationToken,
            }),
        });

        const data = await response.json();

        if (data.success && data.token) {
            console.log('✅ Успешная регистрация');
            
            // Сохраняем данные в localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            showMessage(registerMessage, '✅ ' + (data.message || 'Регистрация успешна!'), 'success');
            
            // Редирект на дашборд
            setTimeout(() => {
                if (typeof navigateWithTransition === 'function') {
                    navigateWithTransition('/dashboard.html');
                } else {
                    window.location.href = '/dashboard.html';
                }
            }, 1000);
        } else {
            console.warn('❌ Ошибка регистрации:', data.message);
            
            let errorMessage = data.message || 'Ошибка при регистрации';
            
            // Улучшенная обработка конфликтов
            if (response.status === 409) {
                if (data.field === 'username') {
                    errorMessage = `❌ Имя пользователя "${username}" уже занято`;
                } else if (data.field === 'email') {
                    errorMessage = `❌ Email "${email}" уже зарегистрирован`;
                }
            } else if (response.status === 400) {
                errorMessage = '❌ ' + (data.message || 'Некорректные данные');
            } else if (response.status === 403) {
                errorMessage = '❌ Недействительный токен регистрации';
            }
            
            showMessage(registerMessage, errorMessage, 'error');
            enableSubmitButton(registerForm);
        }
    } catch (error) {
        console.error('❌ Ошибка подключения:', error);
        showMessage(registerMessage, '❌ Ошибка подключения к серверу. Проверьте соединение', 'error');
        enableSubmitButton(registerForm);
    }
}

// ============================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С ТОКЕНОМ
// ============================================

/**
 * Получить токен авторизации
 * @returns {string|null} Токен или null
 */
function getToken() {
    return localStorage.getItem('token');
}

/**
 * Получить данные пользователя
 * @returns {Object|null} Данные пользователя или null
 */
function getUser() {
    try {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
        console.error('❌ Ошибка парсинга данных пользователя:', error);
        return null;
    }
}

/**
 * Проверка авторизации
 * @returns {boolean} true если авторизован
 */
function checkAuth() {
    const token = getToken();
    
    if (!token) {
        console.warn('⚠️ Токен не найден, редирект на авторизацию');
        
        if (typeof navigateWithTransition === 'function') {
            navigateWithTransition('/');
        } else {
            window.location.href = '/';
        }
        
        return false;
    }
    
    return true;
}

/**
 * Выход из системы
 */
function logout() {
    console.log('🚪 Выход из системы');
    
    // Очищаем все данные
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    
    // Редирект на главную
    if (typeof navigateWithTransition === 'function') {
        navigateWithTransition('/');
    } else {
        window.location.href = '/';
    }
}

// ============================================
// ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
// ============================================

// Делаем функции доступными глобально для других скриптов
window.checkAuth = checkAuth;
window.logout = logout;
window.getToken = getToken;
window.getUser = getUser;