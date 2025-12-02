/**
 * Показывает всплывающее уведомление (toast)
 * @param {string} message - Сообщение для отображения
 * @param {string} [type='info'] - Тип уведомления ('success', 'error', 'info', 'warning')
 * @param {number} [duration=5000] - Длительность отображения в миллисекундах
 * @param {string} [title=''] - Заголовок уведомления (опционально)
 */
function showToast(message, type = 'info', duration = 5000, title = '') {
    const MAX_TOASTS = 5; // Максимальное количество уведомлений на экране
    
    // ✅ УЛУЧШЕНО: Валидация параметров
    if (! message || typeof message !== 'string') {
        console.warn('⚠️ showToast: message должен быть непустой строкой');
        return;
    }

    const validTypes = ['success', 'error', 'info', 'warning'];
    if (!validTypes. includes(type)) {
        console.warn(`⚠️ showToast: неизвестный тип "${type}", используется "info"`);
        type = 'info';
    }
    
    // Получаем или создаём контейнер для уведомлений
    let container = document.getElementById('toastContainer');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        container.setAttribute('role', 'region');
        container.setAttribute('aria-label', 'Уведомления');
        document. body.appendChild(container);
    }

    // ✅ УЛУЧШЕНО: Проверка на дубликаты с учетом типа
    const existingToasts = Array.from(container.querySelectorAll('.toast'));
    const isDuplicate = existingToasts. some(toast => 
        toast.dataset.message === message && 
        toast.classList.contains(`toast--${type}`)
    );

    if (isDuplicate) {
        console.log('ℹ️ Дубликат уведомления, пропускаем');
        return;
    }

    // Если достигнут лимит, удаляем самое старое уведомление
    if (container.children.length >= MAX_TOASTS) {
        const oldestToast = container.firstElementChild;
        if (oldestToast) {
            removeToast(oldestToast);
        }
    }

    // SVG иконки для разных типов уведомлений
    const icons = {
        success: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2. 5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `,
        error: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
        `,
        warning: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2. 5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10. 29 3.86L1. 82 18a2 2 0 0 0 1. 71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12. 01" y2="17"></line>
            </svg>
        `,
        info: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12. 01" y2="8"></line>
            </svg>
        `
    };

    // Заголовки по умолчанию для каждого типа
    const defaultTitles = {
        success: 'Успешно! ',
        error: 'Ошибка!',
        warning: 'Внимание!',
        info: 'Информация'
    };

    // Используем переданный заголовок или заголовок по умолчанию
    const toastTitle = title || defaultTitles[type] || defaultTitles.info;

    // Создание нового уведомления
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.dataset.message = message; // Сохраняем сообщение для проверки дубликатов
    toast. dataset.type = type;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    // HTML структура уведомления
    toast.innerHTML = `
        <div class="toast__icon" aria-hidden="true">
            ${icons[type] || icons.info}
        </div>
        <div class="toast__body">
            <h4 class="toast__title">${escapeHtml(toastTitle)}</h4>
            <p class="toast__message">${escapeHtml(message)}</p>
        </div>
        <button class="toast__close" aria-label="Закрыть уведомление" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2. 5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `;

    // Добавляем кнопку закрытия
    const closeBtn = toast.querySelector('.toast__close');
    closeBtn.addEventListener('click', (e) => {
        e. stopPropagation();
        removeToast(toast);
    });

    // ✅ УЛУЧШЕНО: Клик на уведомление копирует текст (опционально)
    toast.addEventListener('click', () => {
        // Копируем текст сообщения в буфер обмена (если нужно)
        if (typeof navigator.clipboard !== 'undefined') {
            navigator.clipboard.writeText(message). catch(() => {
                // Игнорируем ошибки копирования
            });
        }
    });

    // Добавляем новое уведомление в контейнер
    container.appendChild(toast);

    // Обновляем CSS переменную для анимации прогресс-бара
    toast.style.setProperty('--toast-duration', `${duration}ms`);

    // Запускаем таймер на удаление
    let timeoutId = setTimeout(() => {
        removeToast(toast);
    }, duration);

    // Сохраняем ID таймера для возможности отмены
    toast.dataset.timeoutId = timeoutId;

    // ✅ УЛУЧШЕНО: Пауза/возобновление при наведении мыши
    let remainingTime = duration;
    let pauseTime = 0;

    toast.addEventListener('mouseenter', () => {
        clearTimeout(timeoutId);
        pauseTime = Date.now();
        toast.style.animationPlayState = 'paused';
        toast.style.setProperty('--animation-play-state', 'paused');
    });

    toast.addEventListener('mouseleave', () => {
        const elapsed = Date.now() - pauseTime;
        remainingTime = Math.max(remainingTime - elapsed, 1000); // Минимум 1 секунда
        
        timeoutId = setTimeout(() => {
            removeToast(toast);
        }, remainingTime);
        
        toast.dataset.timeoutId = timeoutId;
        toast.style.animationPlayState = 'running';
        toast.style.setProperty('--animation-play-state', 'running');
    });

    // ✅ УЛУЧШЕНО: Звуковое уведомление (опционально)
    playToastSound(type);

    return toast;
}

/**
 * Плавно удаляет уведомление
 * @param {HTMLElement} toast - Элемент уведомления для удаления
 */
function removeToast(toast) {
    if (!toast || toast.classList.contains('toast--hiding')) {
        return; // Уже удаляется
    }

    // Отменяем таймер если он есть
    const timeoutId = toast.dataset. timeoutId;
    if (timeoutId) {
        clearTimeout(parseInt(timeoutId));
    }

    toast.classList.add('toast--hiding');
    
    // Удаляем после завершения анимации
    const handleAnimationEnd = () => {
        if (toast.parentNode) {
            toast.remove();
        }
    };
    
    toast.addEventListener('animationend', handleAnimationEnd, { once: true });

    // Fallback на случай если анимация не сработает
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 500);
}

/**
 * Экранирует HTML для предотвращения XSS атак
 * @param {string} text - Текст для экранирования
 * @returns {string} Экранированный текст
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

/**
 * Воспроизводит звук уведомления (опционально)
 * @param {string} type - Тип уведомления
 */
function playToastSound(type) {
    // ✅ Можно раскомментировать для добавления звуков
    /*
    const sounds = {
        success: '/sounds/success.mp3',
        error: '/sounds/error. mp3',
        warning: '/sounds/warning.mp3',
        info: '/sounds/info. mp3'
    };
    
    const soundPath = sounds[type];
    if (soundPath) {
        const audio = new Audio(soundPath);
        audio.volume = 0.3;
        audio.play(). catch(err => console.log('Sound play failed:', err));
    }
    */
}

/**
 * Удаляет все уведомления
 */
function clearAllToasts() {
    const container = document.getElementById('toastContainer');
    if (container) {
        const toasts = container.querySelectorAll('.toast');
        toasts.forEach(toast => removeToast(toast));
    }
}

/**
 * Показывает уведомление об успехе (сокращённая версия)
 * @param {string} message - Сообщение
 * @param {string} [title=''] - Заголовок
 */
function showSuccess(message, title = '') {
    return showToast(message, 'success', 5000, title);
}

/**
 * Показывает уведомление об ошибке (сокращённая версия)
 * @param {string} message - Сообщение
 * @param {string} [title=''] - Заголовок
 */
function showError(message, title = '') {
    return showToast(message, 'error', 7000, title);
}

/**
 * Показывает предупреждение (сокращённая версия)
 * @param {string} message - Сообщение
 * @param {string} [title=''] - Заголовок
 */
function showWarning(message, title = '') {
    return showToast(message, 'warning', 6000, title);
}

/**
 * Показывает информационное уведомление (сокращённая версия)
 * @param {string} message - Сообщение
 * @param {string} [title=''] - Заголовок
 */
function showInfo(message, title = '') {
    return showToast(message, 'info', 5000, title);
}

// ============================================
// ЭКСПОРТ
// ============================================

// Экспорт функций для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        clearAllToasts
    };
}

// Глобальный доступ
if (typeof window !== 'undefined') {
    window.showToast = showToast;
    window.showSuccess = showSuccess;
    window.showError = showError;
    window.showWarning = showWarning;
    window.showInfo = showInfo;
    window.clearAllToasts = clearAllToasts;
}