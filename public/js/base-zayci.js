document.addEventListener('DOMContentLoaded', () => {
    class BaseZayciPage extends PageModuleBase {
        constructor() {
            super({
                moduleName: 'base-zayci',       // ← Для API
                moduleTable: 'base_zayci',      // ← Для БД
                moduleTitle: 'База зайцев',     // ← Для отображения
                
                // ✅ ПОЛЕ ДЛЯ ФИЛЬТРАЦИИ ПО ДАТЕ
                dateFilterField: 'Дата поездки', 

                fieldsForCalculation: ['tripsAmount', 'paymentsAmount'],
                mainTable: {
                    // Столбцы таблицы
                    columns: ['Транзакции', 'ГРН', 'Плательщик', 'Сумма задолженности, ₽', 'Дата поездки','Дата информирования', 'Оплата'],
                    
                    getRowData: (item, context) => {
                        return [
                            item['Транзакции'] || '', 
                            item['ГРН'] || '',
                            item['Плательщик'] || item['Собственник'] || '',
                            context.formatters.number(item['Сумма задолженности']) || '0.00',
                            context.formatters.number(item['Оплата']) || '0.00',
                            context.dateUtils.format(item['Дата поездки'])
                        ];
                    },
                    renderRowHTML: (item, context) => {
                        const rowData = context.config.mainTable.getRowData(item, context);
                        return `<td>${rowData.join('</td><td>')}</td>`;
                    },
                },
                fieldMap: {
                    'tripDate': 'Дата поездки',
                    'createDate': 'Дата создания поездки в ЕСВП',
                    'transactions': 'Транзакции',
                    'lane': 'ПВП/РВП - полоса',
                    'paymentMethod': 'Способ оплаты',
                    'tariff': 'Тариф',
                    'grz': 'ГРН',
                    'note': 'Примечание',
                    'processor': 'Обработал',
                    'processingDate': 'Дата обработки',
                    'email': 'Почта',
                    'phone': 'Телефон',
                    'notificationType': 'Тип информирования',
                    'notificationDate': 'Дата информирования',
                    'payment': 'Оплата',
                    'paymentDate': 'Дата оплаты',
                    'bank': 'Банк',
                    'address': 'Адрес',
                    'tripsCount': 'Кол-во поездок',
                    'paymentsCount': 'Кол-во оплат',
                    'nonPaymentsCount': 'Кол-во неоплат',
                    'tripsAmount': 'Сумма поездок',
                    'paymentsAmount': 'Сумма оплат',
                    'debtAmount': 'Сумма задолженности',
                    'lastTripDate': 'Дата последней поездки',
                    'payer': 'Плательщик',
                    'owner': 'Собственник',
                    'pan': 'PAN',
                    'passport': 'Паспортные данные',
                    'birthDate': 'Дата рождения',
                }
            });
        }

        init() {
            super.init();
            this.initToolbarHandlers();
            this.initDateFilters(); // ✅ Запуск фильтров
        }

        // ✅ Инициализация фильтров
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

        // ✅ Логика фильтрации
        filterData() {
            this.state.currentPage = 1;
            
            const searchTerm = this.dom.searchInput ? this.dom.searchInput.value.toLowerCase().trim() : '';
            
            const dateFromEl = document.getElementById('filterDateFrom');
            const dateToEl = document.getElementById('filterDateTo');
            
            const dateFrom = dateFromEl && dateFromEl.value ? new Date(dateFromEl.value) : null;
            const dateTo = dateToEl && dateToEl.value ? new Date(dateToEl.value) : null;
            
            if (dateFrom) dateFrom.setHours(0, 0, 0, 0);
            if (dateTo) dateTo.setHours(23, 59, 59, 999);

            const dateField = this.config.dateFilterField; // 'Дата последней поездки'

            this.state.filteredData = this.state.allData.filter(item => {
                // 1. Поиск
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

        // === ЗАГРУЗКА И ГРУППИРОВКА (Без изменений) ===
        async loadData() {
            this.showSpinner();
            try {
                console.log(`📡 Загрузка и группировка данных для: ${this.state.moduleTable}`);
                
                const url = `${API_BASE_URL}/data/${this.state.moduleTable}`;
                const response = await this.fetchWithRetry(url, {
                    headers: { 'Authorization': `Bearer ${this.state.token}` }
                });
                const rawData = await response.json();
                
                // Группируем
                const groupedData = this.groupDataByGRN(rawData);
                
                console.log(`✅ Загружено строк: ${rawData.length}, Сгруппировано: ${groupedData.length}`);
                
                this.state.allData = groupedData;
                this.state.filteredData = [...groupedData]; // Сначала показываем всё
                
                this.renderTable();
                this.setupPagination();

            } catch (error) {
                console.error('❌ Ошибка:', error);
                this.showToast('Ошибка загрузки данных', 'error');
                if (this.dom.tableBody) this.dom.tableBody.innerHTML = '';
                if (this.dom.noResultsMessage) this.dom.noResultsMessage.style.display = 'block';
            } finally {
                this.hideSpinner();
            }
        }

        groupDataByGRN(data) {
            const groups = {};
            data.forEach(row => {
                const key = row['ГРН'] || row['Транзакции'] || Math.random();
                if (!groups[key]) {
                    groups[key] = {
                        ...row, 
                        'Сумма задолженности': 0,
                        'Кол-во поездок': 0,
                        'Дата последней поездки': null,
                    };
                }
                const currentDebt = parseFloat(row['Сумма задолженности']) || 0;
                groups[key]['Сумма задолженности'] += currentDebt;
                groups[key]['Кол-во поездок'] += 1;
                const rowDate = row['Дата поездки'] || row['Дата последней поездки'];
                if (rowDate) {
                    const currentMax = groups[key]['Дата последней поездки'];
                    if (!currentMax || new Date(rowDate) > new Date(currentMax)) {
                        groups[key]['Дата последней поездки'] = rowDate;
                    }
                }
            });
            return Object.values(groups).map(item => {
                item['Сумма задолженности'] = parseFloat(item['Сумма задолженности'].toFixed(2));
                return item;
            });
        }

        // ... (Остальные методы без изменений) ...
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
            const file = event.target.files[0];
            if (!file) return;
            this.showToast('Обработка файла...', 'info');
            try {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                if (jsonData.length === 0) { this.showToast('Файл пустой', 'error'); return; }
                const response = await fetch('/api/base-zayci/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: JSON.stringify({ data: jsonData })
                });
                if (!response.ok) throw new Error('Ошибка импорта');
                const result = await response.json();
                this.showToast(`Загружено: ${result.imported} записей`, 'success');
                await this.loadData();
            } catch (error) {
                console.error('Ошибка:', error);
                this.showToast('Ошибка загрузки файла', 'error');
            } finally { event.target.value = ''; }
        }

        downloadTemplate() {
            const templateData = [{ 'ГРН': '', 'Дата поездки': '', 'Тариф': '', 'Плательщик': '', 'Собственник': '', 'Сумма задолженности': '' }];
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(templateData);
            XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');
            XLSX.writeFile(wb, `Шаблон_База_зайцев_${new Date().toISOString().split('T')[0]}.xlsx`);
            this.showToast('Шаблон скачан', 'success');
        }

        calculateTotals() {
            const parse = this.formatters.parseNumber;
            const format = this.formatters.number;
            const getVal = (id) => parse(document.getElementById(id)?.value) || 0;
            
            const tariffAmount = getVal('tariff'); // Тариф
            const paymentsAmount = getVal('paymentsAmount'); // Оплаты
            
            const debtAmount = tariffAmount;
            
            const debtAmountEl = document.getElementById('debtAmount');
            if (debtAmountEl) {
                debtAmountEl.value = format(debtAmount);
                debtAmountEl.classList.toggle('negative-balance', debtAmount < 0);
            }
        }
    }

    const page = new BaseZayciPage();
    window.baseZayciPage = page;
    page.init();
    
    console.log('✅ База зайцев инициализирована (с группировкой)');
});