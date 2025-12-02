document.addEventListener('DOMContentLoaded', () => {
    class JudicialPage extends PageModuleBase {
        constructor() {
            super({
                moduleName: 'judicial',
                moduleTable: 'sudeb_vzisk',
                moduleTitle: 'Судебная работа',
                
                // Поля для фильтрации по дате (выбираем главное поле даты для фильтра)
                dateFilterField: 'Дата направления в суд', 

                // ... (ваш остальной конфиг без изменений) ...
                fieldsForCalculation: [
                    'debtAmount', 'stateFee', 'penaltyAmount', 'postageAmount', 'totalReceived', 
                    'confirmedDebt', 'confirmedFee', 'confirmedPenalty', 'confirmedPostage'
                ],
                mainTable: {
                    columns: ['ФИО/Наименование', '№ гражданского дела', '№ л/с','Сумма ДЗ, руб.', 'Дата направления в суд', 'Дата последнего изменения', 'Статус'],
                    getRowData: (item, context) => {
                        return [
                            item['ФИО/Наименование'] || '',
                            item['№ гражданского дела'] || '',
                            item['№ л/с'] || '',
                            context.formatters.number(item['Сумма подаваемой ДЗ , руб#']) || '0.00',
                            context.dateUtils.format(item['Дата направления в суд']),
                            context.dateUtils.format(item['Дата сохранения']),
                            item['Результат рассмотрения заявления'] || 'В работе'
                        ];
                    },
                    renderRowHTML: (item, context) => {
                        const rowData = context.config.mainTable.getRowData(item, context);
                        return `<td>${rowData.join('</td><td>')}</td>`
                    }
                },
                fieldMap: {
                    'clientType': 'Тип клиента',
                    'fio': 'ФИО/Наименование',
                    'accountNumber': '№ л/с',
                    'debtAmount': 'Сумма подаваемой ДЗ , руб#',
                    'debtStartDate': 'Дата начала образования долга',
                    'debtEndDate': 'Дата окончания образования долга',
                    'stateFee': 'Сумма подаваемой гос#пошлины,руб#',
                    'penaltyAmount': 'Сумма подаваемой  неустойки,руб#',
                    'postageAmount': 'Сумма под-ых почтовых расходов',
                    'courtDate': 'Дата направления в суд',
                    'submissionType': 'Тип подачи',
                    'resubmissionType': 'Тип подачи (повтр)',
                    'resubmissionDate': 'Дата повторной подачи',
                    'resubmissionFee': 'Сумма гос#пошлины (повтр)',
                    'passport': 'Паспорт',
                    'birthDate': 'Дата рождения должника',
                    'birthPlace': 'Место рождения должника',
                    'debtorAddress': 'Адрес должника',
                    'courtAddress': 'Адрес судебного участка',
                    'courtSection': 'Судебный участок',
                    'reviewResult': 'Результат рассмотрения заявления',
                    'reason': 'Причина',
                    'decisionDate': 'Дата решения',
                    'decisionReceiptDate': 'Дата поступления решения',
                    'caseNumber': '№ гражданского дела',
                    'judicialResubmissionDate': 'Дата повторной подачи',
                    'reviewResultRepeat': 'Результат повторной подачи',
                    'reasonRepeat': 'Причина повторной',
                    'decisionDateRepeat': 'Дата решения (повтр)',
                    'decisionReceiptDateRepeat': 'Дата поступления решения(повт)',
                    'caseNumberRepeat': '№ гражданского дела(повт)',
                    'confirmedDebt': 'Подтвежденная сумма  ДЗ#',
                    'confirmedFee': 'Подтвержденная сумма гос#пошлины#',
                    'confirmedPenalty': 'Подтвержденная сумма неустойки',
                    'confirmedPostage': 'Подтвержденные почтовые расходы#',
                    'enforcementDirection': 'Направлен на исполнение(ФССП/банк)',
                    'enforcementDate': 'Дата направления на исполнение',
                    'enforcementStatus': 'Статус ИП(на исп-и/исп-но/отозвано)',
                    'recallDate': 'Дата направления заявления на ИД',
                    'secondResubmissionDate': 'Дата 2-ой повторной подачи',
                    'secondResubmissionResult': 'Результат 2-ой повторной подачи',
                    'note': 'Примечание',
                    'comment': 'Комментарий',
                    'totalReceived': 'Итого поступило,руб#',
                    'receivedDebt': 'Поступившая сумма ДЗ,руб#',
                    'receivedFee': 'Поступившая сумма гос#пошлины,руб#',
                    'receivedPenalty': 'Поступившая сумма неустойки,руб',
                    'receivedPostage': 'Поступившие почтовые расходы,руб#',
                    'balance': 'Баланс',
                    'financeComment': 'Комментарий фин отдел',
                }
            });
        }

        init() {
            super.init();
            this.initToolbarHandlers();
            this.initDateFilters(); // Инициализация фильтров
        }

        // ✅ НОВЫЙ МЕТОД: Инициализация обработчиков дат
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

        // ✅ ПЕРЕОПРЕДЕЛЯЕМ МЕТОД ФИЛЬТРАЦИИ (Добавляем даты)
        filterData() {
            this.state.currentPage = 1;
            
            const searchTerm = this.dom.searchInput ? this.dom.searchInput.value.toLowerCase().trim() : '';
            
            // Получаем даты
            const dateFromEl = document.getElementById('filterDateFrom');
            const dateToEl = document.getElementById('filterDateTo');
            
            const dateFrom = dateFromEl && dateFromEl.value ? new Date(dateFromEl.value) : null;
            const dateTo = dateToEl && dateToEl.value ? new Date(dateToEl.value) : null;
            
            // Устанавливаем время для корректного сравнения
            if (dateFrom) dateFrom.setHours(0, 0, 0, 0);
            if (dateTo) dateTo.setHours(23, 59, 59, 999);

            const dateField = this.config.dateFilterField; // 'Дата направления в суд'

            this.state.filteredData = this.state.allData.filter(item => {
                // 1. Текстовый поиск (Универсальный)
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
                        // Если даты в записи нет или она кривая, но фильтр включен - скрываем запись
                        matchesDate = false; 
                    }
                }

                return matchesSearch && matchesDate;
            });
            
            this.renderTable();
            this.setupPagination();
        }

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
                const response = await fetch('/api/judicial/import', {
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
            // ... (ваш код шаблона) ...
            const templateData = [{ 'ФИО/Наименование': '', '№ л/с': '', 'Дата направления в суд': '2024-01-01' }];
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(templateData);
            XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');
            XLSX.writeFile(wb, `Шаблон_Судебная_работа.xlsx`);
        }

        calculateTotals() {
            const parse = this.formatters.parseNumber;
            const format = this.formatters.number;
            const getVal = (id) => parse(document.getElementById(id)?.value) || 0;
            const setVal = (id, value) => { const el = document.getElementById(id); if (el) el.value = format(value); };

            const debtAmount = getVal('debtAmount');
            const stateFee = getVal('stateFee');
            const penaltyAmount = getVal('penaltyAmount');
            const postageAmount = getVal('postageAmount');
            
            // Считаем расходы
            const totalExpenses = debtAmount + stateFee + penaltyAmount + postageAmount;
            setVal('totalExpenses', totalExpenses);

            // Остальные расчеты можно оставить как у вас были
            // ...
        }
    }

    const page = new JudicialPage();
    window.judicialPage = page;
    page.init();
    
    console.log('✅ Судебная работа инициализирована');
});