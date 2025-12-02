// ============================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 Dashboard загружен');
    console.log('🌐 Хост:', window.location.host);
    
    // Проверяем авторизацию
    if (! checkAuth()) {
        console. warn('⚠️ Не авторизован, редирект на логин');
        return;
    }

    // Загружаем данные пользователя
    loadUserProfile();

    // Загружаем статистику
    loadStatistics();

    // Инициализируем обработчики модулей
    initModuleHandlers();

    // Обработчик кнопки выхода
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
        console.log('✅ Обработчик выхода привязан');
    } else {
        console.warn('⚠️ Кнопка выхода не найдена');
    }

    console.log('✅ Dashboard инициализирован');
});

// ============================================
// ПРОВЕРКА АВТОРИЗАЦИИ
// ============================================

/**
 * Проверяет наличие токена и редиректит на логин если его нет
 * @returns {boolean} true если авторизован
 */
function checkAuth() {
    // ✅ ИСПРАВЛЕНО: Используем Utils если доступен
    if (typeof Utils !== 'undefined' && Utils.checkAuth) {
        return Utils. checkAuth();
    }
    
    const token = localStorage.getItem('token');
    
    if (!token) {
        console.warn('⚠️ Токен не найден');
        
        if (typeof navigateWithTransition === 'function') {
            navigateWithTransition('/');
        } else {
            window.location.href = '/';
        }
        
        return false;
    }
    
    return true;
}

// ============================================
// ЗАГРУЗКА ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ
// ============================================

/**
 * Загружает данные профиля пользователя с сервера
 */
async function loadUserProfile() {
    try {
        const token = localStorage.getItem('token');
        
        console.log('👤 Загрузка профиля.. .');
        
        // ✅ ИСПРАВЛЕНО: Используем retry логику
        const response = await fetchWithRetry(`${API_BASE_URL}/auth/profile`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) {
            const data = await response.json();
            
            console.log('✅ Профиль загружен:', data. user.username);
            
            // Обновляем имя пользователя
            const userNameEl = document.getElementById('userName');
            if (userNameEl) {
                userNameEl. textContent = data.user.username;
            }
            
            // Показываем кнопку админ-панели если пользователь админ
            if (data.user.is_admin) {
                const adminBtn = document.getElementById('adminBtn');
                if (adminBtn) {
                    adminBtn.style.display = 'flex';
                    console.log('🔑 Пользователь - администратор');
                }
            }
        } else {
            console.error('❌ Ошибка загрузки профиля:', response.status);
            
            // Токен невалиден - очищаем и редиректим
            localStorage.removeItem('token');
            localStorage. removeItem('user');
            
            if (typeof navigateWithTransition === 'function') {
                navigateWithTransition('/');
            } else {
                window.location.href = '/';
            }
        }
    } catch (error) {
        console.error('❌ Ошибка при загрузке профиля:', error);
        
        if (typeof showToast === 'function') {
            showToast('Ошибка загрузки профиля пользователя', 'error');
        }
    }
}

// ============================================
// ЗАГРУЗКА СТАТИСТИКИ
// ============================================

/**
 * Загружает статистику по всем таблицам
 */
async function loadStatistics() {
    const token = localStorage.getItem('token');
    
    console.log('📊 Загрузка статистики...');
    
    try {
        // ✅ ИСПРАВЛЕНО: Используем retry логику
        const response = await fetchWithRetry(`${API_BASE_URL}/stats`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (! response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        
        if (! result.success || !result.data) {
            throw new Error('Некорректный формат данных');
        }
        
        const stats = result.data;

        console.log('✅ Статистика загружена:', stats);

        // Обновляем статистику по модулям с анимацией
        animateCount('judicialCount', stats.judicial. count);
        updateElement('judicialDebt', formatCurrency(stats.judicial.debt));
        
        animateCount('preJudicialCount', stats.preJudicial.count);
        updateElement('preJudicialDebt', formatCurrency(stats.preJudicial.debt));
        
        animateCount('baseZayciCount', stats.baseZayci. count);
        updateElement('baseZayciDebt', formatCurrency(stats.baseZayci.debt));
        
        // Общая статистика
        animateCount('totalRecords', stats.total.count);
        updateElement('totalDebt', formatCurrency(stats. total.debt));

    } catch (error) {
        console.error('❌ Ошибка при загрузке статистики:', error);
        
        // Показываем уведомление если есть функция toast
        if (typeof showToast === 'function') {
            showToast('Не удалось загрузить статистику', 'error');
        }
        
        // Показываем прочерки вместо skeleton-loader
        const elementIds = [
            'judicialCount', 'judicialDebt', 
            'preJudicialCount', 'preJudicialDebt', 
            'baseZayciCount', 'baseZayciDebt', 
            'totalRecords', 'totalDebt'
        ];
        
        elementIds. forEach(id => updateElement(id, '—'));
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ МОДУЛЕЙ
// ============================================

/**
 * Добавляет обработчики для карточек модулей
 */
function initModuleHandlers() {
    console.log('🎯 Инициализация обработчиков модулей.. .');
    
    const moduleCards = document.querySelectorAll('.module-card');
    
    if (moduleCards.length === 0) {
        console.warn('⚠️ Карточки модулей не найдены');
        return;
    }
    
    moduleCards.forEach((card, index) => {
        // Эффект hover - поднятие карточки
        card. addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-8px)';
            card.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style. transform = 'translateY(0)';
        });
        
        // Сохранение информации о модуле при клике
        card.addEventListener('click', () => {
            const moduleIndex = card.dataset.moduleIndex || index;
            const moduleTitle = card.querySelector('h3')?.textContent || 'Модуль';
            const moduleUrl = card.getAttribute('href');
            
            // Сохраняем в sessionStorage для использования на других страницах
            sessionStorage.setItem('currentModule', JSON.stringify({
                index: moduleIndex,
                title: moduleTitle,
                url: moduleUrl,
                timestamp: Date.now()
            }));
            
            console.log('📦 Модуль сохранен:', moduleTitle);
        });
    });
    
    console.log(`✅ Обработчики для ${moduleCards.length} модулей инициализированы`);
}

// ============================================
// УТИЛИТЫ ОБНОВЛЕНИЯ UI
// ============================================

/**
 * Обновляет содержимое элемента с анимацией
 * @param {string} elementId - ID элемента
 * @param {string|number} value - Новое значение
 */
function updateElement(elementId, value) {
    const element = document.getElementById(elementId);
    
    if (! element) {
        console.warn(`⚠️ Элемент #${elementId} не найден`);
        return;
    }
    
    // Удаляем skeleton-loader если есть
    const skeleton = element.querySelector('.skeleton-loader');
    if (skeleton) {
        skeleton.remove();
    }
    
    // Анимация появления значения
    element.style.opacity = '0';
    element. textContent = value;
    
    // Плавное появление
    setTimeout(() => {
        element.style.transition = 'opacity 0.3s ease';
        element.style.opacity = '1';
    }, 50);
}

/**
 * Анимация подсчета числа от 0 до целевого значения
 * @param {string} elementId - ID элемента
 * @param {number} targetValue - Целевое значение
 * @param {number} duration - Длительность анимации в мс
 */
function animateCount(elementId, targetValue, duration = 1000) {
    const element = document.getElementById(elementId);
    
    if (!element) {
        console. warn(`⚠️ Элемент #${elementId} не найден`);
        return;
    }
    
    // Удаляем skeleton-loader если есть
    const skeleton = element.querySelector('.skeleton-loader');
    if (skeleton) {
        skeleton.remove();
    }
    
    const startValue = 0;
    const startTime = performance.now();
    
    function updateCount(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out)
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        
        const currentValue = Math.floor(startValue + (targetValue - startValue) * easedProgress);
        element.textContent = formatNumber(currentValue);
        
        if (progress < 1) {
            requestAnimationFrame(updateCount);
        } else {
            element.textContent = formatNumber(targetValue);
        }
    }
    
    requestAnimationFrame(updateCount);
}

/**
 * Форматирует число с разделителями тысяч
 * @param {number} num - Число для форматирования
 * @returns {string} Отформатированное число
 */
function formatNumber(num) {
    if (num === undefined || num === null || isNaN(num)) {
        return '—';
    }
    return Number(num).toLocaleString('ru-RU');
}

/**
 * Форматирует число как валюту (рубли)
 * @param {number} num - Сумма для форматирования
 * @returns {string} Отформатированная сумма
 */
function formatCurrency(num) {
    if (num === undefined || num === null || isNaN(num)) {
        return '—';
    }
    
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

// ============================================
// ВЫХОД ИЗ СИСТЕМЫ
// ============================================

/**
 * Обработчик выхода из системы
 */
async function handleLogout() {
    console.log('🚪 Выход из системы.. .');
    
    try {
        const token = localStorage.getItem('token');
        
        // Отправляем запрос на сервер для инвалидации токена
        await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        
        console.log('✅ Logout запрос отправлен');
    } catch (error) {
        console.error('❌ Ошибка при logout:', error);
        // Продолжаем выход даже если запрос упал
    }

    // Очищаем локальное хранилище
    localStorage. removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    
    console.log('✅ Данные очищены');
    
    // Редирект на страницу логина
    if (typeof navigateWithTransition === 'function') {
        navigateWithTransition('/');
    } else {
        window.location.href = '/';
    }
}

/**
 * Алиас для handleLogout (для совместимости)
 */
function logout() {
    handleLogout();
}

// ============================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С МОДУЛЯМИ
// ============================================

/**
 * Получает информацию о текущем выбранном модуле
 * @returns {Object|null} Данные модуля или null
 */
function getCurrentModule() {
    try {
        const moduleData = sessionStorage.getItem('currentModule');
        return moduleData ? JSON.parse(moduleData) : null;
    } catch (error) {
        console.error('❌ Ошибка парсинга данных модуля:', error);
        return null;
    }
}

/**
 * Очищает данные о текущем модуле
 */
function clearCurrentModule() {
    sessionStorage.removeItem('currentModule');
}

// ============================================
// FETCH С ПОВТОРНЫМИ ПОПЫТКАМИ
// ============================================

/**
 * Fetch с автоматическими повторными попытками
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции fetch
 * @param {number} retries - Количество повторных попыток
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, retries = 3) {
    // ✅ ИСПРАВЛЕНО: Используем Utils если доступен
    if (typeof Utils !== 'undefined' && Utils.fetchWithRetry) {
        return Utils.fetchWithRetry(url, options, retries);
    }
    
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            
            // Если токен истёк - редирект на логин
            if (response.status === 401) {
                console.warn('⚠️ Токен истёк или недействителен');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                
                if (typeof navigateWithTransition === 'function') {
                    navigateWithTransition('/');
                } else {
                    window.location.href = '/';
                }
                
                throw new Error('Unauthorized');
            }
            
            if (response.ok) return response;
            
            // Для других ошибок выбрасываем исключение
            if (i === retries - 1) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {
            console.warn(`⚠️ Попытка ${i + 1}/${retries} не удалась:`, error. message);
            
            // На последней попытке выбрасываем ошибку
            if (i === retries - 1) {
                throw error;
            }
            
            // Экспоненциальная задержка между попытками
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
    }
}

// ============================================
// ЭКСПОРТ ФУНКЦИЙ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
// ============================================

// Делаем функции доступными глобально для других скриптов
window.checkAuth = checkAuth;
window.logout = logout;
window.handleLogout = handleLogout;
window.getCurrentModule = getCurrentModule;
window.clearCurrentModule = clearCurrentModule;