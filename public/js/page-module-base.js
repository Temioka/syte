class PageModuleBase {
    constructor(config) {
        this.config = config;

        // Состояние
        this.state = {
            allData: [],
            filteredData: [],
            historyLogs: [],
            currentItem: null,
            currentPage: 1,
            rowsPerPage: 100,
            searchTimeout: null,
            historySearchTimeout: null,
            token: localStorage.getItem('token'),
            moduleName: config.moduleName,
            moduleTable: config.moduleTable,
            moduleTitle: config.moduleTitle,
        };

        // DOM элементы
        this.dom = {};

        console.log('🔍 Инициализация модуля:', this.state.moduleName);
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ ====================

    init() {
        if (! this.state.token) {
            console.warn("⚠️ Токен отсутствует.");
            if (typeof navigateWithTransition === 'function') {
                navigateWithTransition('/');
            } else {
                window.location.href = '/';
            }
            return;
        }

        if (!this.state.moduleName || !this.state.moduleTable) {
            console.error("⚠️ Модуль не определен!");
            if (typeof navigateWithTransition === 'function') {
                navigateWithTransition('/');
            } else {
                window.location.href = '/';
            }
            return;
        }

        console.log(`✅ Инициализация модуля: ${this.state.moduleName}`);

        this.cacheDom();
        this.bindEvents();
        this.initPassportFormatting();
        this.loadUserProfile();
        this.loadData();
    }

    cacheDom() {
        // Основная таблица
        this.dom.tableBody = document.getElementById('dataTableBody');
        this.dom.noResultsMessage = document.getElementById('noResults');
        this.dom.paginationContainer = document.getElementById('paginationContainer');
        this.dom.searchInput = document.getElementById('searchInput');
        this.dom.userName = document.getElementById('userName');

        // Модальное окно карточки
        this.dom.cardModal = document.getElementById('userCardModal');
        this.dom.closeCardModalBtn = document.getElementById('closeModalBtn');
        this.dom.cancelCardBtn = document.getElementById('cancelBtn');
        this.dom.saveChangesBtn = document.getElementById('saveChangesBtn');
        this.dom.cardFio = document.getElementById('cardFio');
        this.dom.updateInfo = {
            dateBlock: document.getElementById('updateDateBlock'),
            userBlock: document.getElementById('updateUserBlock'),
            date: document.getElementById('lastUpdateDate'),
            user: document.getElementById('lastUpdateUser'),
        };

        // Модальное окно подтверждения
        this.dom.confirmationModal = document.getElementById('confirmationModal');
        this.dom.confirmSaveBtn = document.getElementById('confirmSaveBtn');
        this.dom.cancelSaveBtn = document.getElementById('cancelSaveBtn');

        // Модальное окно истории
        this.dom.historyModal = document.getElementById('historyModal');
        this.dom.showHistoryBtn = document.getElementById('showHistoryBtn');
        this.dom.closeHistoryModalBtn = document.getElementById('closeHistoryModalBtn');
        this.dom.historyTableBody = document.getElementById('historyTableBody');
        this.dom.historyStartDate = document.getElementById('historyStartDate');
        this.dom.historyEndDate = document.getElementById('historyEndDate');

        // Кнопки экспорта
        this.dom.exportMainExcelBtn = document.getElementById('exportMainExcel');
        this.dom.exportMainPdfBtn = document.getElementById('exportMainPdf');
        this.dom.exportCardExcelBtn = document.getElementById('exportCardExcel');
        this.dom.exportCardPdfBtn = document.getElementById('exportCardPdf');
        this.dom.exportHistoryExcelBtn = document.getElementById('exportHistoryExcel');
        this.dom.exportHistoryPdfBtn = document.getElementById('exportHistoryPdf');
    }

    bindEvents() {
        // Поиск с debounce
        if (this.dom.searchInput) {
            const debouncedSearch = this.debounce(() => this.filterData(), 300);
            this.dom.searchInput.addEventListener('input', debouncedSearch);
        }

        // Модальное окно карточки
        if (this.dom.closeCardModalBtn) {
            this.dom.closeCardModalBtn.addEventListener('click', () => this.closeCardModal());
        }
        if (this.dom.cancelCardBtn) {
            this.dom.cancelCardBtn.addEventListener('click', () => this.closeCardModal());
        }
        if (this.dom.cardModal) {
            this.dom.cardModal.addEventListener('click', (e) => {
                if (e.target === this.dom.cardModal) this.closeCardModal();
            });
        }

        // Сохранение
        if (this.dom.saveChangesBtn) {
            this.dom.saveChangesBtn.addEventListener('click', () => {
                if (this.dom.confirmationModal) {
                    this.dom.confirmationModal.style.display = 'flex';
                }
            });
        }
        if (this.dom.cancelSaveBtn) {
            this.dom.cancelSaveBtn.addEventListener('click', () => {
                if (this.dom.confirmationModal) {
                    this.dom.confirmationModal.style.display = 'none';
                }
            });
        }
        if (this.dom.confirmSaveBtn) {
            this.dom.confirmSaveBtn.addEventListener('click', () => this.performSaveChanges());
        }
        if (this.dom.confirmationModal) {
            this.dom.confirmationModal.addEventListener('click', (e) => {
                if (e.target === this.dom.confirmationModal) {
                    this.dom.confirmationModal.style.display = 'none';
                }
            });
        }

        // История
        if (this.dom.showHistoryBtn) {
            this.dom.showHistoryBtn.addEventListener('click', () => this.fetchAndRenderHistory());
        }
        if (this.dom.closeHistoryModalBtn) {
            this.dom.closeHistoryModalBtn.addEventListener('click', () => this.closeHistoryModal());
        }
        if (this.dom.historyModal) {
            this.dom.historyModal.addEventListener('click', (e) => {
                if (e.target === this.dom.historyModal) this.closeHistoryModal();
            });
        }
        if (this.dom.historyStartDate) {
            this.dom.historyStartDate.addEventListener('change', () => this.renderHistoryTable());
        }
         if (this.dom.historyEndDate) {
            this.dom.historyEndDate.addEventListener('change', () => this.renderHistoryTable());
        }
        
        const historySearch = document.getElementById('historySearch');
        if (historySearch) {
            const debouncedHistorySearch = this.debounce(() => this.renderHistoryTable(), 300);
            historySearch.addEventListener('input', debouncedHistorySearch);
        }

        // Экспорт
        if (this.dom.exportMainExcelBtn) {
            this.dom.exportMainExcelBtn.addEventListener('click', () => this.exportMainData('excel'));
        }
        if (this.dom.exportMainPdfBtn) {
            this.dom.exportMainPdfBtn.addEventListener('click', () => this.exportMainData('pdf'));
        }
        if (this.dom.exportCardExcelBtn) {
            this.dom.exportCardExcelBtn.addEventListener('click', () => this.exportCardData('excel'));
        }
        if (this.dom.exportCardPdfBtn) {
            this.dom.exportCardPdfBtn.addEventListener('click', () => this.exportCardData('pdf'));
        }
        if (this.dom.exportHistoryExcelBtn) {
            this.dom.exportHistoryExcelBtn.addEventListener('click', () => this.exportHistoryData('excel'));
        }
        if (this.dom.exportHistoryPdfBtn) {
            this.dom.exportHistoryPdfBtn.addEventListener('click', () => this.exportHistoryData('pdf'));
        }

        // Автопересчет
        (this.config.fieldsForCalculation || []).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.calculateTotals());
            }
        });
    }

    initPassportFormatting() {
        const passportInput = document.getElementById('passport');
        if (passportInput) {
            passportInput.setAttribute('maxlength', '12'); // XX-XX-XXXXXX = 12 символов
            
            passportInput.addEventListener('input', (e) => {
                const cursorPosition = e.target.selectionStart;
                const oldValue = e.target.value;
                const newValue = Utils.formatPassport(oldValue);
                
                e.target.value = newValue;
                
                // Корректируем позицию курсора при добавлении дефисов
                let newCursorPosition = cursorPosition;
                if (newValue.length > oldValue.length) {
                    newCursorPosition = cursorPosition + (newValue.length - oldValue. length);
                }
                e.target.setSelectionRange(newCursorPosition, newCursorPosition);
            });
        }
    }

    // ==================== ЗАГРУЗКА ДАННЫХ ====================

    async loadData() {
        await this.fetchData();
    }

    async fetchData() {
        this.showSpinner();
        try {
            console.log(`📡 Загрузка данных из таблицы: ${this.state.moduleTable}`);
            
            // ✅ ИСПРАВЛЕНО: Убран дублирующий /api
            const url = `${API_BASE_URL}/data/${this.state.moduleTable}`;
            console.log(`🔗 URL запроса: ${url}`);
            
            const response = await this.fetchWithRetry(url, {
                headers: { 'Authorization': `Bearer ${this.state.token}` }
            });
            
            const data = await response.json();
            
            console.log(`✅ Загружено записей: ${data.length}`);
            
            this.state.allData = data;
            this.state.filteredData = [...data];
            
            this.renderTable();
            this.setupPagination();

        } catch (error) {
            console.error('❌ Ошибка при загрузке данных:', error);
            this.showToast('Не удалось загрузить данные. Проверьте соединение.', 'error');
            if (this.dom.tableBody) this.dom.tableBody.innerHTML = '';
            if (this.dom.noResultsMessage) this.dom.noResultsMessage.style.display = 'block';
        } finally {
            this.hideSpinner();
        }
    }

    async loadUserProfile() {
        try {
            // ✅ ИСПРАВЛЕНО: Правильный путь к API
            const url = `${API_BASE_URL}/auth/profile`;
            const response = await this.fetchWithRetry(url, {
                headers: { 'Authorization': `Bearer ${this.state.token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (this.dom.userName) {
                    this.dom.userName.textContent = data.user.username || 'Пользователь';
                }
            } else {
                localStorage.removeItem('token');
                if (typeof navigateWithTransition === 'function') {
                    navigateWithTransition('/');
                } else {
                    window.location.href = '/';
                }
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки профиля:', error);
        }
    }

    async performSaveChanges() {
        if (!this.state.currentItem) return;

        const originalButtonText = this.dom.confirmSaveBtn.innerHTML;
        this.dom.confirmSaveBtn.disabled = true;
        this.dom.confirmSaveBtn.innerHTML = '<span class="btn-spinner"></span>Сохранение...';
        this.dom.cancelSaveBtn.disabled = true;

        try {
            const finalData = this.collectDataFromModal();
            
            let recordKey;
            if (this.state.moduleTable === 'base_zayci') {
                recordKey = this.state.currentItem['ГРН'];
            } else {
                recordKey = this.state.currentItem['№ л/с'];
            }

            // ✅ ИСПРАВЛЕНО: Правильный путь к API
            const url = `${API_BASE_URL}/data/${this.state.moduleTable}/${encodeURIComponent(recordKey)}`;
            
            const response = await this.fetchWithRetry(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.state.token}`
                },
                body: JSON.stringify(finalData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Ошибка при сохранении');
            }

            this.showToast('✅ Данные успешно сохранены!', 'success');
            if (this.dom.confirmationModal) this.dom.confirmationModal.style.display = 'none';
            this.closeCardModal();
            await this.loadData();

        } catch (error) {
            console.error('❌ Ошибка при сохранении:', error);
            this.showToast(`Ошибка: ${error.message}`, 'error');
        } finally {
            this.dom.confirmSaveBtn.disabled = false;
            this.dom.confirmSaveBtn.innerHTML = originalButtonText;
            this.dom.cancelSaveBtn.disabled = false;
        }
    }

    // ==================== ОТРИСОВКА ====================

    renderTable() {
        if (!this.dom.tableBody || !this.dom.noResultsMessage) return;

        if (!this.state.filteredData || this.state.filteredData.length === 0) {
            this.dom.noResultsMessage.style.display = 'block';
            this.dom.tableBody.innerHTML = '';
            return;
        }

        this.dom.noResultsMessage.style.display = 'none';

        const start = (this.state.currentPage - 1) * this.state.rowsPerPage;
        const end = Math.min(start + this.state.rowsPerPage, this.state.filteredData.length);
        const pageData = this.state.filteredData.slice(start, end);

        this.dom.tableBody.innerHTML = '';

        const fragment = document.createDocumentFragment();
        pageData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.dataset.id = item['№ л/с'] || item['ГРН'];
            row.innerHTML = this.config.mainTable.renderRowHTML(item, this);
            row.classList.add('row-fade-in');
            row.style.animationDelay = `${index * 0.03}s`;
            row.addEventListener('click', () => this.openCardModal(item));
            fragment.appendChild(row);
        });
        this.dom.tableBody.appendChild(fragment);
    }

    setupPagination() {
        if (!this.dom.paginationContainer) return;

        this.dom.paginationContainer.innerHTML = '';
        const pageCount = Math.ceil(this.state.filteredData.length / this.state.rowsPerPage);

        if (pageCount <= 1) return;

        const createButton = (text, page, isDisabled = false, isActive = false, isDots = false) => {
            const btn = document.createElement('button');
            btn.className = isDots ? 'pagination-dots' : 'pagination-btn';
            if (!isDots) {
                btn.textContent = text;
                btn.disabled = isDisabled;
                if (isActive) btn.classList.add('active');
                btn.addEventListener('click', () => {
                    this.state.currentPage = page;
                    this.renderTable();
                    this.setupPagination();
                    // Прокрутка к началу таблицы
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
            } else {
                btn.textContent = '...';
            }
            return btn;
        };

        this.dom.paginationContainer.appendChild(createButton('‹', this.state.currentPage - 1, this.state.currentPage === 1));

        const maxButtons = 7;
        if (pageCount <= maxButtons) {
            for (let i = 1; i <= pageCount; i++) {
                this.dom.paginationContainer.appendChild(createButton(i, i, false, i === this.state.currentPage));
            }
        } else {
            this.dom.paginationContainer.appendChild(createButton(1, 1, false, 1 === this.state.currentPage));
            if (this.state.currentPage > 3) {
                this.dom.paginationContainer.appendChild(createButton('...', null, true, false, true));
            }
            let startPage = Math.max(2, this.state.currentPage - 1);
            let endPage = Math.min(pageCount - 1, this.state.currentPage + 1);
            if (this.state.currentPage <= 3) endPage = 4;
            if (this.state.currentPage >= pageCount - 2) startPage = pageCount - 3;
            for (let i = startPage; i <= endPage; i++) {
                this.dom.paginationContainer.appendChild(createButton(i, i, false, i === this.state.currentPage));
            }
            if (this.state.currentPage < pageCount - 2) {
                this.dom.paginationContainer.appendChild(createButton('...', null, true, false, true));
            }
            this.dom.paginationContainer.appendChild(createButton(pageCount, pageCount, false, pageCount === this.state.currentPage));
        }

        this.dom.paginationContainer.appendChild(createButton('›', this.state.currentPage + 1, this.state.currentPage === pageCount));
    }

    showSpinner() {
        if (this.dom.noResultsMessage) this.dom.noResultsMessage.style.display = 'none';
        if (this.dom.tableBody) {
            this.dom.tableBody.innerHTML = `
                <tr>
                    <td colspan="${this.config.mainTable.columns.length}" style="text-align: center; padding: 60px 20px;">
                        <div class="spinner-container">
                            <div class="spinner-circle"></div>
                            <span class="spinner-text">Загрузка данных...</span>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    hideSpinner() {}

    // ==================== МОДАЛЬНЫЕ ОКНА ====================

    filterData() {
        this.state.currentPage = 1;
        const searchTerm = this.dom.searchInput.value.toLowerCase().trim();
        
        if (!searchTerm) {
            this.state.filteredData = [...this.state.allData];
        } else {
            this.state.filteredData = this.state.allData.filter(item =>
                (item['ФИО/Наименование'] || '').toLowerCase().includes(searchTerm) ||
                (item['№ л/с'] || '').toLowerCase().includes(searchTerm) ||
                (item['№ гражданского дела'] || '').toLowerCase().includes(searchTerm) ||
                (item['ГРН'] || '').toLowerCase().includes(searchTerm) ||
                (item['Плательщик'] || '').toLowerCase().includes(searchTerm) ||
                (item['Собственник'] || '').toLowerCase().includes(searchTerm)
            );
        }
        
        this.renderTable();
        this.setupPagination();
    }

    openCardModal(item) {
        this.state.currentItem = item;
        if (this.dom.cardFio) {
            if (this.state.moduleTable === 'base_zayci') {
                this.dom.cardFio.textContent = item['ГРН'] || '';
            } else {
                this.dom.cardFio.textContent = item['ФИО/Наименование'] || '';
            }
        }

        this.populateModalWithData(item);
        this.calculateTotals();

        const { dateBlock, userBlock, date, user } = this.dom.updateInfo;
        
        if (dateBlock && date && user) {
            if (item['Дата сохранения']) {
                date.textContent = this.dateUtils.formatDateTime(item['Дата сохранения']);
                user.textContent = item['Сохранил последним'] || '—';
                dateBlock.style.display = 'flex';
                userBlock.style.display = 'flex';
            } else {
                dateBlock.style.display = 'none';
                userBlock.style.display = 'none';
            }
        }

        if (this.dom.cardModal) this.dom.cardModal.style.display = 'flex';
    }

    closeCardModal() {
        if (this.dom.cardModal) this.dom.cardModal.style.display = 'none';
        this.state.currentItem = null;
        if (this.dom.confirmationModal) this.dom.confirmationModal.style.display = 'none';
    }

    populateModalWithData(item) {
        for (const id in this.config.fieldMap) {
            const dbColumnName = this.config.fieldMap[id];
            const el = document.getElementById(id);
            if (! el) continue;

            const value = item[dbColumnName] ??  '';
            
            if (el.type === 'date') {
                el.value = this.dateUtils.toInput(value);
            } else if (el.closest('.input-with-currency')) {
                el.value = this.formatters.number(value);
            } else if (id === 'passport') {
                // ✅ Форматируем паспорт при загрузке данных
                el.value = Utils.formatPassport(value);
            } else {
                el. value = value;
            }
        }
    }

    collectDataFromModal() {
        const finalData = {};
        
        for (const id in this.config.fieldMap) {
            const dbColumnName = this.config.fieldMap[id];
            const el = document.getElementById(id);
            if (!el) continue;

            const value = el.value;
            
            if (el.closest('.input-with-currency')) {
                finalData[dbColumnName] = this.formatters.parseNumber(value);
            } else {
                finalData[dbColumnName] = value || null;
            }
        }

        finalData.record_uuid = this.state.currentItem.id;
        return finalData;
    }

    calculateTotals() {
        
    }

    // ==================== ИСТОРИЯ ИЗМЕНЕНИЙ ====================

    async fetchAndRenderHistory() {
        try {
            const moduleName = this.state.moduleName;
            
            if (!moduleName) {
                console.error('❌ moduleName не определен');
                this.showToast('Ошибка: модуль не определен', 'error');
                return;
            }
            
            // ✅ ИСПРАВЛЕНО: Правильный путь к API
            const url = `${API_BASE_URL}/${moduleName}/history`;
            console.log(`📡 Запрос истории: ${url}`);
            
            const response = await this.fetchWithRetry(url, {
                headers: { 
                    'Authorization': `Bearer ${this.state.token}`
                }
            });
            
            const historyData = await response.json();
            
            console.log('✅ Загружено записей истории:', historyData.length);
            
            this.state.historyLogs = historyData.sort((a, b) => 
                new Date(b.changed_at || b.created_at) - new Date(a.changed_at || a.created_at)
            );
            
            if (this.dom.historyEndDate) {
                this.dom.historyEndDate.value = new Date().toISOString().split('T')[0];
            }
            
            this.renderHistoryTable();
            
            if (this.dom.historyModal) {
                this.dom.historyModal.style.display = 'flex';
            }

        } catch (error) {
            console.error('❌ Ошибка загрузки истории:', error);
            this.showToast('Не удалось загрузить историю изменений', 'error');
        }
    }

    renderHistoryTable() {
        if (!this.dom.historyTableBody) return;

        const startDate = this.dom.historyStartDate?.value 
            ? new Date(this.dom.historyStartDate.value).setHours(0, 0, 0, 0) 
            : null;
        const endDate = this.dom.historyEndDate?.value 
            ? new Date(this.dom.historyEndDate.value).setHours(23, 59, 59, 999) 
            : null;

        const searchText = document.getElementById('historySearch')?.value.toLowerCase().trim() || '';

        const filteredLogs = this.state.historyLogs.filter(log => {
            // Фильтр по дате
            const logDate = new Date(log.changed_at || log.created_at);
            const isAfterStart = startDate ? logDate >= startDate : true;
            const isBeforeEnd = endDate ? logDate <= endDate : true;
            
            if (!isAfterStart || !isBeforeEnd) {
                return false;
            }

            // Фильтр по тексту поиска
            if (searchText) {
                const clientName = (log.client_fio || '').toLowerCase();
                const accountNumber = (log.account_number || '').toLowerCase();
                const changedBy = (log.changed_by_username || log.username || '').toLowerCase();
                const payer = (log.payer || '').toLowerCase();
                const grn = (log.grn || '').toLowerCase();
                
                const matchesSearch = 
                    clientName.includes(searchText) || 
                    accountNumber.includes(searchText) || 
                    changedBy.includes(searchText) ||
                    payer.includes(searchText) ||
                    grn.includes(searchText);
                
                if (!matchesSearch) {
                    return false;
                }
            }

            return true;
        });

        this.dom.historyTableBody.innerHTML = '';
        
        if (filteredLogs.length === 0) {
            this.dom.historyTableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 40px;">
                        ${searchText ? '🔍 Ничего не найдено' : '📭 Нет записей истории'}
                    </td>
                </tr>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();
        
        filteredLogs.forEach((log, index) => {
            const row = document.createElement('tr');
            row.classList.add('row-fade-in');
            row.style.animationDelay = `${index * 0.03}s`;
            
            const formattedDate = this.dateUtils.formatDateTime(log.changed_at || log.created_at);
            
            let clientName = '';
            if (log.client_fio) {
                clientName = `<strong>${this.escapeHtml(log.client_fio)}</strong>`;
                if (log.account_number) {
                    clientName += ` <span style="color: #888; font-size: 12px;">(л/с: ${this.escapeHtml(log.account_number)})</span>`;
                }
                if (log.payer) {
                    clientName += `<br><span style="color: #888; font-size: 12px;">${this.escapeHtml(log.payer)}</span>`;
                }
                if (log.grn) {
                    clientName += `<br><span style="color: #888; font-size: 12px;">ГРН: ${this.escapeHtml(log.grn)}</span>`;
                }
            }
            
            const changedBy = this.escapeHtml(log.changed_by_username || log.username || 'Неизвестно');
            
            let changesText = '';
            try {
                const changes = JSON.parse(log.changed_fields);
                changesText = this.formatChanges(changes);
            } catch (e) {
                changesText = this.escapeHtml(log.changed_fields || 'Нет данных');
            }
            
            row.innerHTML = `
                <td><span style="font-family: monospace; font-size: 13px;">${formattedDate}</span></td>
                <td><span style="font-weight: 600;">${changedBy}</span></td>
                <td>${clientName}</td>
                <td style="font-size: 13px;">${changesText}</td>
            `;
            
            fragment.appendChild(row);
        });
        
        this.dom.historyTableBody.appendChild(fragment);
    }

    formatChanges(changes) {
        if (!changes || typeof changes !== 'object') {
            return 'Нет данных';
        }
        
        const formatted = Object.entries(changes).map(([field, data]) => {
            const oldValue = (data.old !== null && data.old !== undefined && data.old !== '') 
                ? `<span style="color: #ef4444;">${this.escapeHtml(String(data.old))}</span>` 
                : '<i>пусто</i>';
            
            const newValue = (data.new !== null && data.new !== undefined && data.new !== '') 
                ? `<span style="color: #10b981;">${this.escapeHtml(String(data.new))}</span>` 
                : '<i>пусто</i>';
            
            return `<div style="margin-bottom: 4px;"><strong>${this.escapeHtml(field)}:</strong> ${oldValue} → ${newValue}</div>`;
        }).join('');
        
        return formatted || 'Нет изменений';
    }

    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    closeHistoryModal() {
        if (this.dom.historyModal) this.dom.historyModal.style.display = 'none';
    }

    // ==================== ЭКСПОРТ ====================

    exportMainData(format) {
        const data = this.state.filteredData;
        if (data.length === 0) {
            this.showToast('Нет данных для экспорта', 'warning');
            return;
        }

        const headers = this.config.mainTable.columns;
        const body = data.map(item => this.config.mainTable.getRowData(item, this));

        if (format === 'excel') {
            this.exportToExcel([headers, ...body], 'main_data');
        } else if (format === 'pdf') {
            this.exportToPdf(headers, body, 'main_data', 'Список');
        }
    }

    exportCardData(format) {
        const item = this.state.currentItem;
        if (!item) {
            this.showToast('Нет данных', 'warning');
            return;
        }

        const headers = ['Поле', 'Значение'];
        const body = Object.keys(this.config.fieldMap).map(id => {
            const dbKey = this.config.fieldMap[id];
            const labelEl = document.querySelector(`label[for="${id}"]`);
            const label = labelEl ? labelEl.textContent.replace(/,руб#?/, '') : dbKey;
            
            const el = document.getElementById(id);
            let value = el ? el.value : (item[dbKey] || '');

            return [label, value];
        });

        if (format === 'excel') {
            this.exportToExcel([headers, ...body], `card_${item['№ л/с'] || item['ГРН']}`);
        } else if (format === 'pdf') {
            this.exportToPdf(headers, body, `card`, 'Карточка');
        }
    }

    exportHistoryData(format) {
        if (!this.dom.historyTableBody) return;

        const rows = Array.from(this.dom.historyTableBody.querySelectorAll('tr'));
        if (rows.length === 0 || rows[0].querySelector('td[colspan]')) {
            this.showToast('Нет данных', 'warning');
            return;
        }

        const headers = ['Дата', 'Кто', 'ФИО', 'Изменения'];
        const body = rows.map(row => {
            const cells = row.querySelectorAll('td');
            return [
                cells[0]?.textContent || '',
                cells[1]?.textContent || '',
                cells[2]?.textContent || '',
                cells[3]?.textContent || ''
            ];
        });

        if (format === 'excel') {
            this.exportToExcel([headers, ...body], 'history');
        } else if (format === 'pdf') {
            this.exportToPdf(headers, body, 'history', 'История');
        }
    }

    exportToExcel(data, fileName) {
        try {
            if (typeof XLSX === 'undefined') {
                this.showToast('Библиотека экспорта не загружена', 'error');
                return;
            }
            
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Данные');
            XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
            this.showToast('Экспорт завершен', 'success');
        } catch (error) {
            console.error('❌ Ошибка экспорта:', error);
            this.showToast('Ошибка при экспорте в Excel', 'error');
        }
    }

    exportToPdf(headers, body, fileName, title) {
        try {
            if (typeof window.jspdf === 'undefined') {
                this.showToast('Библиотека PDF не загружена', 'error');
                return;
            }
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.text(title, 14, 15);
            doc.autoTable({
                head: [headers],
                body: body,
                startY: 20,
                styles: { font: 'helvetica', fontSize: 8 },
                headStyles: { fillColor: [79, 70, 229] }
            });
            doc.save(`${fileName}_${new Date().toISOString().slice(0, 10)}.pdf`);
            this.showToast('Экспорт завершен', 'success');
        } catch (error) {
            console.error('❌ Ошибка экспорта:', error);
            this.showToast('Ошибка при экспорте в PDF', 'error');
        }
    }

    // ==================== УТИЛИТЫ ====================

    showToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    /**
     * Fetch с повторными попытками
     */
    async fetchWithRetry(url, options = {}, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                
                if (response.status === 401) {
                    console.warn('⚠️ Токен истёк');
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
                
                if (i === retries - 1) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
            } catch (error) {
                console.warn(`⚠️ Попытка ${i + 1}/${retries}:`, error.message);
                
                if (i === retries - 1) throw error;
                
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
            }
        }
    }

    /**
     * Debounce функция
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    formatters = {
        number: (num) => {
            const n = parseFloat(num);
            return isNaN(n) ? '' : n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        },
        parseNumber: (str) => {
            if (!str) return null;
            const cleaned = String(str).replace(/\s/g, '').replace(',', '.');
            const num = parseFloat(cleaned);
            return isNaN(num) ? null : num;
        },
    };

    dateUtils = {
        format(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString.split('T')[0] + 'T00:00:00');
            if (isNaN(date)) return '';
            return date.toLocaleDateString('ru-RU');
        },
        formatDateTime(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            if (isNaN(date)) return '';
            return date.toLocaleString('ru-RU');
        },
        toInput(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            if (isNaN(date)) return '';
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
    };
}