const Utils = {
    /**
     * Проверка авторизации
     * @returns {boolean} true если пользователь авторизован
     */
    checkAuth() {
        const token = localStorage.getItem('token');
        
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
    },

    /**
     * Получить токен авторизации
     * @returns {string|null}
     */
    getToken() {
        return localStorage.getItem('token');
    },

    /**
     * Получить данные пользователя
     * @returns {Object|null}
     */
    getUser() {
        try {
            const userStr = localStorage.getItem('user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (error) {
            console.error('❌ Ошибка парсинга данных пользователя:', error);
            return null;
        }
    },

    /**
     * Выход из системы
     */
    logout() {
        console.log('🚪 Выход из системы');
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.clear();
        
        if (typeof navigateWithTransition === 'function') {
            navigateWithTransition('/');
        } else {
            window.location.href = '/';
        }
    },

    /**
     * Экранирование HTML для предотвращения XSS
     * @param {string} text - Текст для экранирования
     * @returns {string} Безопасный HTML
     */
    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    },

    /**
     * Форматирование даты в формат DD.MM.YYYY
     * @param {string|Date} dateString - Дата для форматирования
     * @returns {string} Отформатированная дата
     */
    formatDate(dateString) {
        if (!dateString) return '—';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('ru-RU');
    },

    /**
     * Форматирование даты и времени
     * @param {string|Date} dateString - Дата для форматирования
     * @returns {string} Отформатированная дата и время
     */
    formatDateTime(dateString) {
        if (!dateString) return '—';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Преобразование даты в формат для input[type="date"]
     * @param {string|Date} dateString - Дата
     * @returns {string} Дата в формате YYYY-MM-DD
     */
    dateToInput(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    /**
     * Форматирование числа с разделителями тысяч
     * @param {number} num - Число для форматирования
     * @returns {string} Отформатированное число
     */
    formatNumber(num) {
        if (num === undefined || num === null || isNaN(num)) return '—';
        return Number(num).toLocaleString('ru-RU');
    },

    /**
     * Форматирование числа как валюта (рубли)
     * @param {number} num - Сумма
     * @returns {string} Отформатированная сумма
     */
    formatCurrency(num) {
        if (num === undefined || num === null || isNaN(num)) return '—';
        
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    },

    /**
     * Форматирование числа для отображения с двумя знаками после запятой
     * @param {number|string} num - Число
     * @returns {string} Отформатированное число
     */
    formatDecimal(num) {
        const n = parseFloat(num);
        return isNaN(n) ? '' : n.toLocaleString('ru-RU', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
    },

    /**
     * Парсинг числа из строки (удаляет пробелы и заменяет запятую на точку)
     * @param {string} str - Строка с числом
     * @returns {number|null} Число или null
     */
    parseNumber(str) {
        if (!str) return null;
        const cleaned = String(str).replace(/\s/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    },

    /**
     * Получить инициалы из полного имени
     * @param {string} name - Полное имя
     * @returns {string} Инициалы
     */
    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name[0].toUpperCase();
    },

    /**
     * Debounce функция для оптимизации частых вызовов
     * @param {Function} func - Функция для вызова
     * @param {number} wait - Время ожидания в мс
     * @returns {Function} Обёртка с debounce
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle функция для ограничения частоты вызовов
     * @param {Function} func - Функция для вызова
     * @param {number} limit - Минимальный интервал между вызовами в мс
     * @returns {Function} Обёртка с throttle
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Fetch с автоматическими повторными попытками
     * @param {string} url - URL для запроса
     * @param {Object} options - Опции fetch
     * @param {number} retries - Количество повторных попыток
     * @returns {Promise<Response>}
     */
    async fetchWithRetry(url, options = {}, retries = 3) {
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
                console.warn(`⚠️ Попытка ${i + 1}/${retries} не удалась:`, error.message);
                
                // На последней попытке выбрасываем ошибку
                if (i === retries - 1) {
                    throw error;
                }
                
                // Экспоненциальная задержка между попытками
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
            }
        }
    },

    /**
     * Копирование текста в буфер обмена
     * @param {string} text - Текст для копирования
     * @returns {Promise<boolean>} true если успешно
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.error('❌ Ошибка копирования:', error);
            
            // Fallback для старых браузеров
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            
            try {
                document.execCommand('copy');
                document.body.removeChild(textarea);
                return true;
            } catch (fallbackError) {
                document.body.removeChild(textarea);
                return false;
            }
        }
    },

    /**
     * Валидация email адреса
     * @param {string} email - Email для проверки
     * @returns {boolean} true если email валиден
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Генерация UUID v4
     * @returns {string} UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * Задержка выполнения (для async/await)
     * @param {number} ms - Миллисекунды
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Получить название базы данных на русском
     * @param {string} database - Системное имя БД
     * @returns {string} Название на русском
     */
    getDatabaseName(database) {
        const names = {
            'sudeb_vzisk': 'Судебная работа',
            'dos_rabota': 'Досудебная работа',
            'base_zayci': 'База зайцев',
            'custom': 'Кастомный отчет'
        };
        return names[database] || database;
    },

    /**
     * Показать toast уведомление (если доступно)
     * @param {string} message - Сообщение
     * @param {string} type - Тип (success, error, warning, info)
     */
    showToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
};

// Экспорт для использования в других модулях
if (typeof window !== 'undefined') {
    window.Utils = Utils;
    
    // Для обратной совместимости
    window.checkAuth = Utils.checkAuth;
    window.logout = Utils.logout;
    window.getToken = Utils.getToken;
    window.getUser = Utils.getUser;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}