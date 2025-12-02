const AppConfig = {
    /**
     * Получить базовый URL API
     * @returns {string} URL API
     */
    get apiUrl() {
        const protocol = window.location.protocol;
        const host = window.location.hostname;
        const isDevelopment = (host === 'localhost' || host === '127.0.0.1');
        const port = isDevelopment ? 3001 : (window.location.port || '');
        const portPart = port ? `:${port}` : '';
        
        // ✅ Возвращаем URL БЕЗ /api в конце (добавляется в запросах)
        return `${protocol}//${host}${portPart}/api`;
    },

    /**
     * Модули системы
     */
    modules: [
        { 
            index: 0, 
            name: 'Судебная работа', 
            table: 'sudeb_vzisk', 
            url: '/judicial.html',
            icon: '⚖️'
        },
        { 
            index: 1, 
            name: 'Досудебная работа', 
            table: 'dos_rabota', 
            url: '/prejudicial.html',
            icon: '📝'
        },
        { 
            index: 2, 
            name: 'База зайцев', 
            table: 'base_zayci', 
            url: '/base-zayci.html',
            icon: '🚇'
        }
    ],

    /**
     * Получить модуль по индексу
     * @param {number} index - Индекс модуля
     * @returns {Object|null}
     */
    getModuleByIndex(index) {
        return this.modules.find(m => m.index === index) || null;
    },

    /**
     * Получить модуль по имени таблицы
     * @param {string} tableName - Имя таблицы
     * @returns {Object|null}
     */
    getModuleByTable(tableName) {
        return this.modules.find(m => m.table === tableName) || null;
    },

    /**
     * Настройки приложения
     */
    appName: 'УВДЗ - Управление базами данных',
    appVersion: '1.0.1',
    appDescription: 'Система управления судебной и досудебной работой',
    
    /**
     * Настройки API
     */
    api: {
        timeout: 30000, // 30 секунд
        retries: 3,     // Количество повторных попыток
        retryDelay: 1000 // Задержка между попытками в мс
    },

    /**
     * Настройки пагинации
     */
    pagination: {
        defaultPageSize: 100,
        pageSizeOptions: [50, 100, 200, 500]
    },

    /**
     * Настройки форматов экспорта
     */
    export: {
        formats: ['excel', 'pdf'],
        maxRows: 10000 // Максимальное количество строк для экспорта
    }
};

// ✅ Глобальная переменная API_BASE_URL для обратной совместимости
const API_BASE_URL = AppConfig.apiUrl;

// Экспорт в window
if (typeof window !== 'undefined') {
    window.AppConfig = AppConfig;
    window.API_BASE_URL = API_BASE_URL;
}

// Для Node.js окружения
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppConfig;
}