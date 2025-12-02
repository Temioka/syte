    const ChangeFormatter = {
    /**
     * Форматирует список измененных полей в человекочитаемый вид
     * @param {Object} oldValues - Объект со старыми значениями
     * @param {Object} newValues - Объект с новыми значениями
     * @param {string[]} changedKeys - Массив ключей, которые были изменены
     * @param {Object} fieldMap - Объект для сопоставления системных имен полей с человекочитаемыми
     * @param {Object} dateUtils - Утилиты для работы с датами
     * @returns {string} - Отформатированная строка с изменениями или сообщение об их отсутствии
     */
    formatChangedFields(oldValues, newValues, changedKeys, fieldMap, dateUtils) {
        try {
            // ✅ УЛУЧШЕНО: Валидация входных параметров
            if (!dateUtils || typeof dateUtils. format !== 'function') {
                console.error('❌ ChangeFormatter: dateUtils обязателен и должен иметь метод format');
                return 'Ошибка: отсутствует dateUtils';
            }

            if (!fieldMap || typeof fieldMap !== 'object') {
                console.warn('⚠️ ChangeFormatter: fieldMap не передан, будут использованы системные имена');
                fieldMap = {};
            }

            const oldData = oldValues || {};
            const newData = newValues || {};
            const keys = Array.isArray(changedKeys) ? changedKeys : [];

            if (keys.length === 0) {
                return 'Нет информации об измененных полях. ';
            }

            /**
             * Форматирует значение для отображения
             * @param {*} val - Значение для форматирования
             * @returns {string} Отформатированное значение
             */
            const formatValue = (val) => {
                // Пустые значения
                if (val === null || val === undefined || val === '') {
                    return '<i style="color: #999;">пусто</i>';
                }

                // ✅ УЛУЧШЕНО: Более точная проверка дат
                if (this.isDateValue(val)) {
                    const formatted = dateUtils.format(val);
                    return formatted ?  `"${formatted}"` : '<i style="color: #999;">пусто</i>';
                }

                // Числа
                if (typeof val === 'number') {
                    return `<strong>${this.formatNumber(val)}</strong>`;
                }

                // Булевы значения
                if (typeof val === 'boolean') {
                    return val 
                        ? '<span style="color: #10b981;">✓ Да</span>' 
                        : '<span style="color: #ef4444;">✗ Нет</span>';
                }

                // ✅ УЛУЧШЕНО: Экранирование HTML для безопасности
                return `"${this.escapeHtml(String(val))}"`;
            };

            // Фильтруем и форматируем изменения
            const formattedChanges = keys
                .map(key => {
                    // Игнорируем служебные поля, которые не нужно показывать пользователю
                    if (this.isSystemField(key)) {
                        return null;
                    }

                    const oldValue = formatValue(oldData[key]);
                    const newValue = formatValue(newData[key]);
                    
                    // Получаем человекочитаемое имя поля
                    const fieldName = fieldMap[key] || this.beautifyFieldName(key);

                    // ✅ УЛУЧШЕНО: Добавляем иконки для визуального различия
                    const changeIcon = this.getChangeIcon(oldData[key], newData[key]);

                    return `
                        <div style="margin-bottom: 8px; padding: 4px 0; border-bottom: 1px solid #f0f0f0;">
                            ${changeIcon} <strong>${this.escapeHtml(fieldName)}:</strong>
                            <br>
                            <span style="margin-left: 24px;">
                                ${oldValue} → ${newValue}
                            </span>
                        </div>
                    `;
                })
                .filter(Boolean) // Убираем null значения (проигнорированные поля)
                .join('');

            return formattedChanges || 'Нет значимых изменений. ';

        } catch (e) {
            console.error("❌ Ошибка форматирования изменений:", e);
            return "Не удалось разобрать изменения.";
        }
    },

    /**
     * Проверяет, является ли значение датой
     * @param {*} value - Значение для проверки
     * @returns {boolean}
     */
    isDateValue(value) {
        if (typeof value !== 'string') return false;
        
        // Проверяем форматы дат: YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS
        const datePatterns = [
            /^\d{4}-\d{2}-\d{2}$/,                    // YYYY-MM-DD
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,  // ISO 8601
            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/   // YYYY-MM-DD HH:MM:SS
        ];

        return datePatterns.some(pattern => pattern.test(value));
    },

    /**
     * Проверяет, является ли поле системным (служебным)
     * @param {string} key - Имя поля
     * @returns {boolean}
     */
    isSystemField(key) {
        const systemFields = [
            'id',
            'record_uuid',
            'created_at',
            'updated_at',
            'created_by',
            'updated_by',
            'Сохранил последним',
            'Дата сохранения'
        ];

        return systemFields.includes(key);
    },

    /**
     * Форматирует число с разделителями тысяч
     * @param {number} num - Число
     * @returns {string}
     */
    formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) return String(num);
        
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(num);
    },

    /**
     * Экранирует HTML для предотвращения XSS
     * @param {string} text - Текст для экранирования
     * @returns {string}
     */
    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    },

    /**
     * Делает имя поля более читабельным
     * @param {string} fieldName - Системное имя поля
     * @returns {string} Красивое имя поля
     */
    beautifyFieldName(fieldName) {
        if (!fieldName) return 'Неизвестное поле';

        // Убираем подчеркивания и делаем первую букву заглавной
        return fieldName
            .replace(/_/g, ' ')
            .replace(/\b\w/g, char => char.toUpperCase());
    },

    /**
     * Возвращает иконку в зависимости от типа изменения
     * @param {*} oldValue - Старое значение
     * @param {*} newValue - Новое значение
     * @returns {string} HTML иконки
     */
    getChangeIcon(oldValue, newValue) {
        // Добавление нового значения
        if ((oldValue === null || oldValue === undefined || oldValue === '') && newValue) {
            return '➕';
        }

        // Удаление значения
        if (oldValue && (newValue === null || newValue === undefined || newValue === '')) {
            return '➖';
        }

        // Изменение значения
        return '✏️';
    },

    /**
     * Форматирует изменения в компактном виде (для уведомлений)
     * @param {Object} oldValues - Старые значения
     * @param {Object} newValues - Новые значения
     * @param {string[]} changedKeys - Измененные ключи
     * @param {Object} fieldMap - Карта полей
     * @returns {string} Краткое описание изменений
     */
    formatCompact(oldValues, newValues, changedKeys, fieldMap = {}) {
        try {
            const oldData = oldValues || {};
            const newData = newValues || {};
            const keys = Array.isArray(changedKeys) ? changedKeys : [];

            if (keys.length === 0) {
                return 'Нет изменений';
            }

            // Фильтруем служебные поля
            const significantKeys = keys.filter(key => ! this.isSystemField(key));

            if (significantKeys. length === 0) {
                return 'Обновлены служебные поля';
            }

            // Берем первые 3 значимых изменения
            const firstChanges = significantKeys.slice(0, 3);
            const remaining = significantKeys.length - firstChanges.length;

            const changesList = firstChanges
                .map(key => {
                    const fieldName = fieldMap[key] || this.beautifyFieldName(key);
                    return fieldName;
                })
                .join(', ');

            if (remaining > 0) {
                return `${changesList} и ещё ${remaining}`;
            }

            return changesList;

        } catch (e) {
            console.error("❌ Ошибка компактного форматирования:", e);
            return "Изменения";
        }
    },

    /**
     * Создает diff-представление изменений (для детального просмотра)
     * @param {Object} oldValues - Старые значения
     * @param {Object} newValues - Новые значения
     * @param {string[]} changedKeys - Измененные ключи
     * @param {Object} fieldMap - Карта полей
     * @returns {Object[]} Массив объектов с описанием изменений
     */
    createDiff(oldValues, newValues, changedKeys, fieldMap = {}) {
        try {
            const oldData = oldValues || {};
            const newData = newValues || {};
            const keys = Array. isArray(changedKeys) ?  changedKeys : [];

            return keys
                .filter(key => !this.isSystemField(key))
                .map(key => {
                    const fieldName = fieldMap[key] || this.beautifyFieldName(key);
                    const oldValue = oldData[key];
                    const newValue = newData[key];

                    return {
                        field: key,
                        fieldName: fieldName,
                        oldValue: oldValue,
                        newValue: newValue,
                        type: this.getChangeType(oldValue, newValue)
                    };
                });

        } catch (e) {
            console.error("❌ Ошибка создания diff:", e);
            return [];
        }
    },

    /**
     * Определяет тип изменения
     * @param {*} oldValue - Старое значение
     * @param {*} newValue - Новое значение
     * @returns {string} Тип изменения: 'added', 'removed', 'modified'
     */
    getChangeType(oldValue, newValue) {
        const isOldEmpty = oldValue === null || oldValue === undefined || oldValue === '';
        const isNewEmpty = newValue === null || newValue === undefined || newValue === '';

        if (isOldEmpty && ! isNewEmpty) return 'added';
        if (! isOldEmpty && isNewEmpty) return 'removed';
        return 'modified';
    }
};

// ============================================
// ЭКСПОРТ
// ============================================

// Для использования в браузере
if (typeof window !== 'undefined') {
    window.ChangeFormatter = ChangeFormatter;
}

// Для использования в Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChangeFormatter;
}