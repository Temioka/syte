document.addEventListener('DOMContentLoaded', () => {
    class PreJudicialPage extends PageModuleBase {
        constructor() {
            super({
                moduleName: 'prejudicial',        // ← Для API
                moduleTable: 'dos_rabota',        // ← Для БД
                moduleTitle: 'Досудебная работа', // ← Для отображения
                
                // ✅ ПОЛЕ ДЛЯ ФИЛЬТРАЦИИ ПО ДАТЕ
                dateFilterField: 'Дата направления претензии',

                fieldsForCalculation: ['debtAmount', 'receivedDebt'],
                mainTable: {
                    columns: ['ФИО/Наименование', '№ л/с', 'Дата направления претензии', 'ШПИ отправления'],
                    getRowData: (item, context) => {
                        return [
                            item['ФИО/Наименование'] || '',
                            item['№ л/с'] || '',
                            context.dateUtils.format(item['Дата направления претензии']),
                            item['ШПИ отправления'] || ''
                        ];
                    },
                    renderRowHTML: (item, context) => {
                        const rowData = context.config.mainTable.getRowData(item, context);
                        return `<td>${rowData.join('</td><td>')}</td>`
                    },
                },
                fieldMap: {
                    'clientType': 'Тип клиента',
                    'fio': 'ФИО/Наименование',
                    'accountNumber': '№ л/с',
                    'debtAmount': 'Сумма подаваемой ДЗ , руб.',
                    'debtStartDate': 'Дата начала задолженности',
                    'debtEndDate': 'Дата окончания задолженности',
                    'inn': 'ИНН',
                    'debtorAddress': 'Адрес должника',
                    'email': 'Электронная почта должника',
                    'grz': '№ ГРЗ',
                    'comment': 'Комментарий',
                    'claimDate': 'Дата направления претензии',
                    'shippingRpo': 'ШПИ отправления',
                    'arrivalDate': 'Дата прибытия в место вручения',
                    'receiptDate': 'Дата получения адресатом',
                    'objectionsReceived': 'Поступили возражения?',
                    'note': 'Примечание',
                    'receivedDebt': 'Поступившая сумма ДЗ,руб.',
                    'remainingDebt': 'Остаток ДЗ, руб.',
                    'balance': 'Баланс',
                    'financeComment': 'Комментарий фин отдел',
                }
            });
        }

        init() {
            super.init();
            this.initToolbarHandlers();
            this.initDateFilters(); // ✅ Запуск фильтров
        }

        // ✅ Инициализация обработчиков событий фильтра
        initDateFilters() {
            const dateFrom = document.getElementById('filterDateFrom');
            const dateTo = document.getElementById('filterDateTo');
            const resetBtn = document.getElementById('resetFiltersBtn');

            if (dateFrom && dateTo) {
                dateFrom.addEventListener('change', () => this.filterData());
                dateTo.addEventListener('change', () => this.filterData());
            }

            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    if(dateFrom) dateFrom.value = '';
                    if(dateTo) dateTo.value = '';
                    this.filterData();
                });
            }
        }

        // ✅ Логика фильтрации (Поиск + Даты)
        filterData() {
            this.state.currentPage = 1;
            
            const searchTerm = this.dom.searchInput ? this.dom.searchInput.value.toLowerCase().trim() : '';
            
            // Получаем значения дат
            const dateFromEl = document.getElementById('filterDateFrom');
            const dateToEl = document.getElementById('filterDateTo');
            
            const dateFrom = dateFromEl && dateFromEl.value ? new Date(dateFromEl.value) : null;
            const dateTo = dateToEl && dateToEl.value ? new Date(dateToEl.value) : null;
            
            if (dateFrom) dateFrom.setHours(0, 0, 0, 0);
            if (dateTo) dateTo.setHours(23, 59, 59, 999);

            const dateField = this.config.dateFilterField; // Берем поле из конфига

            this.state.filteredData = this.state.allData.filter(item => {
                // 1. Поиск по тексту (по всем полям)
                let matchesSearch = true;
                if (searchTerm) {
                    matchesSearch = Object.values(item).some(val => 
                        String(val || '').toLowerCase().includes(searchTerm)
                    );
                }

                // 2. Фильтр по дате
                let matchesDate = true;
                if ((dateFrom || dateTo) && item[dateField]) {
                    const itemDate = new Date(item[dateField]);
                    if (!isNaN(itemDate)) {
                        if (dateFrom && itemDate < dateFrom) matchesDate = false;
                        if (dateTo && itemDate > dateTo) matchesDate = false;
                    } else {
                        matchesDate = false; 
                    }
                }

                return matchesSearch && matchesDate;
            });
            
            this.renderTable();
            this.setupPagination();
        }

        // ... Остальные методы без изменений ...

        initToolbarHandlers() {
            const uploadBtn = document.getElementById('uploadExcelBtn');
            const fileInput = document.getElementById('excelFileInput');
            
            if (uploadBtn && fileInput) {
                uploadBtn.addEventListener('click', () => fileInput.click());
                fileInput.addEventListener('change', (e) => this.handleExcelUpload(e));
            }
            
            const templateBtn = document.getElementById('downloadTemplateBtn');
            if (templateBtn) {
                templateBtn.addEventListener('click', () => this.downloadTemplate());
            }
        }

        async handleExcelUpload(event) {
            const file = event. target.files[0];
            if (!file) return;
            
            this.showToast('Обработка файла...', 'info');
            
            try {
                const tableName = this.state.moduleTable; // 'sudeb_vzisk', 'dos_rabota', 'base_zayci'
                
                // Создаем FormData для отправки файла
                const formData = new FormData();
                formData. append('file', file);
                
                const response = await fetch(`${API_BASE_URL}/files/upload/${tableName}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.state.token}`
                    },
                    body: formData
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Ошибка загрузки');
                }
                
                const result = await response.json();
                
                // Показываем детальную статистику
                const stats = result.statistics;
                const message = `✅ Добавлено: ${stats.inserted} | Обновлено: ${stats.updated} | Ошибок: ${stats.failed}`;
                
                this.showToast(message, stats.failed > 0 ? 'warning' : 'success');
                
                // Если есть ошибки, выводим в консоль
                if (stats.errors && stats.errors.length > 0) {
                    console.warn('⚠️ Ошибки при импорте:', stats.errors);
                }
                
                // Перезагружаем данные
                await this.loadData();
                
            } catch (error) {
                console.error('❌ Ошибка загрузки:', error);
                this.showToast(error.message || 'Ошибка загрузки файла', 'error');
            } finally {
                event.target. value = ''; // Сбрасываем input
            }
        }

        async downloadTemplate() {
            try {
                const tableName = this. state.moduleTable;
                
                const response = await fetch(`${API_BASE_URL}/files/template/${tableName}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.state.token}`
                    }
                });
                
                if (!response.ok) throw new Error('Ошибка загрузки шаблона');
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Шаблон_${tableName}_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showToast('Шаблон скачан', 'success');
                
            } catch (error) {
                console.error('Ошибка скачивания шаблона:', error);
                this.showToast('Ошибка скачивания шаблона', 'error');
            }
        }

        calculateTotals() {
            const parse = this.formatters.parseNumber;
            const format = this.formatters.number;
            const getVal = (id) => parse(document.getElementById(id)?.value) || 0;
            
            const debtAmount = getVal('debtAmount');
            const receivedDebt = getVal('receivedDebt');
            const remainingDebt = debtAmount - receivedDebt;
            
            const remainingDebtEl = document.getElementById('remainingDebt');
            if (remainingDebtEl) {
                remainingDebtEl.value = format(remainingDebt);
                remainingDebtEl.classList.toggle('negative-balance', remainingDebt < 0);
            }
        }
    }

    const page = new PreJudicialPage();
    window.prejudicialPage = page;
    page.init();
    
    console.log('✅ Досудебная работа инициализирована');
});