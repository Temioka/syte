// ==========================================================================
// 1. API SERVICE
// ==========================================================================
const ApiService = {
    getHeaders() {
        const token = localStorage.getItem('token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    },

    async request(endpoint, options = {}) {
        try {
            const url = `${API_BASE_URL}${endpoint}`;
            const config = {
                headers: this.getHeaders(),
                ...options
            };

            const response = await fetch(url, config);

            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/'; 
                throw new Error('Сессия истекла');
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Ошибка API: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Request failed for ${endpoint}:`, error);
            throw error;
        }
    },

    get(endpoint) { return this.request(endpoint, { method: 'GET' }); },
    post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); },
    put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); },
    delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); },
    
    async download(endpoint) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers: this.getHeaders() });
        if (!response.ok) throw new Error('Ошибка скачивания файла');
        return await response.blob();
    }
};

// ==========================================================================
// 2. UTILS
// ==========================================================================
const Utils = {
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    formatNumber(n) { return n.toLocaleString('ru-RU'); },
    formatCurrency(n) { return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(n); },
    
    formatDate(d) { 
        if (!d) return '—';
        const date = new Date(d);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('ru-RU'); 
    },
    
    formatDateTime(d) { 
        if (!d) return '—';
        const date = new Date(d);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); 
    },
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    },
    
    sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
    
    getDatabaseName(db) {
        const map = { 'sudeb_vzisk': 'Судебная', 'dos_rabota': 'Досудебная', 'base_zayci': 'Зайцы' };
        return map[db] || db;
    },

    triggerDownload(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

// ==========================================================================
// 3. ADVANCED FORMULA ENGINE
// ==========================================================================
const FormulaEngine = {
    apply(data, customColumns) {
        const validCustoms = customColumns.filter(c => c.name && c.formula);
        if (validCustoms.length === 0) return data;
        
        return data.map(row => {
            const newRow = { ...row };
            validCustoms.forEach(col => {
                try {
                    newRow[col.name] = this.calculate(col.formula, row);
                } catch (e) {
                    newRow[col.name] = "Ошибка";
                }
            });
            return newRow;
        });
    },

    calculate(formula, rowData) {
        let processed = formula;
        
        // 1. Подстановка значений колонок [Имя]
        const columnMatches = formula.match(/\[([^\]]+)\]/g);
        if (columnMatches) {
            columnMatches.forEach(match => {
                const colName = match.slice(1, -1);
                let val = rowData[colName];
                
                if (val === undefined || val === null) val = 0;
                
                // Очистка чисел
                if (typeof val === 'string') {
                    // Если это дата (простая проверка)
                    if (val.match(/^\d{4}-\d{2}-\d{2}/)) {
                        val = `"${val}"`; // Оборачиваем в кавычки для дат
                    } else {
                        const cleaned = val.replace(/\s/g, '').replace(/,/g, '.');
                        const num = parseFloat(cleaned);
                        if (!isNaN(num)) val = num;
                        else val = `"${val}"`; // Если строка не число
                    }
                }
                processed = processed.replace(match, val);
            });
        }

        // 2. Расширение синтаксиса для JS (замена псевдо-функций на JS методы)
        // IF(усл, да, нет) -> (усл ? да : нет)
        processed = processed.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/g, '($1 ? $2 : $3)');
        
        // DATE функции
        // NOW() -> new Date()
        processed = processed.replace(/NOW\(\)/g, 'new Date()');
        // DAYS(d1, d2) -> разница в днях
        processed = processed.replace(/DAYS\(([^,]+),([^)]+)\)/g, 'Math.ceil((new Date($1) - new Date($2)) / (1000 * 60 * 60 * 24))');
        
        // Математика
        // ROUND(x) -> Math.round(x)
        processed = processed.replace(/ROUND\(([^)]+)\)/g, 'Math.round($1)');

        try {
            // 3. Вычисление
            const result = new Function(`return ${processed}`)();
            
            if (typeof result === 'number') {
                if (!isFinite(result)) return 0;
                return Math.round(result * 100) / 100;
            }
            return result;
        } catch (error) {
            console.warn('Ошибка вычисления формулы:', processed, error);
            return 0;
        }
    },

    validate(formula) {
        // Проверка на опасные ключевые слова
        const forbidden = ['window', 'document', 'alert', 'fetch', 'localStorage', 'eval', 'elem'];
        for (const word of forbidden) {
            if (formula.includes(word)) return { valid: false, error: `Использование "${word}" запрещено` };
        }
        
        // Проверка баланса скобок
        let balance = 0;
        for (const char of formula) {
            if (char === '(') balance++;
            if (char === ')') balance--;
            if (balance < 0) return { valid: false, error: 'Лишняя закрывающая скобка' };
        }
        if (balance !== 0) return { valid: false, error: 'Не закрыта скобка' };

        return { valid: true };
    }
};

// ==========================================================================
// 4. UI MANAGER
// ==========================================================================
const UIManager = {
    progress: {
        el: document.getElementById('progressModal'),
        bar: document.getElementById('progressBar'),
        text: document.getElementById('progressPercentage'),
        title: document.getElementById('progressTitle'),
        desc: document.getElementById('progressDescription'),
        
        show() { if(this.el) this.el.style.display = 'flex'; },
        hide() { if(this.el) this.el.style.display = 'none'; },
        update(pct, title, desc) {
            if(this.bar) this.bar.style.width = pct + '%';
            if(this.text) this.text.textContent = pct + '%';
            if(title && this.title) this.title.textContent = title;
            if(desc && this.desc) this.desc.textContent = desc;
        }
    }
};

// ==========================================================================
// 5. REPORT MANAGER
// ==========================================================================
const ReportManager = {
    state: {
        currentTab: 'create',
        editingReportId: null,
        savedReports: [],
        tableColumns: {},
        tableDataCache: {},
        customColumns: [],
        customColumnCounter: 0
    },

    init() {
        if (!this.checkAuth()) return;
        this.cacheDOM();
        this.bindEvents();
        this.loadUserProfile();
        this.loadStatistics();
        this.setupDateDefaults();
    },

    checkAuth() {
        const token = localStorage.getItem('token');
        if (!token) { window.location.href = '/'; return false; }
        return true;
    },

    cacheDOM() {
        this.dom = {
            tabs: document.querySelectorAll('.tab-btn'),
            contents: document.querySelectorAll('.tab-content'),
            reportTitle: document.getElementById('reportTitle'),
            reportDesc: document.getElementById('reportDescription'),
            startDate: document.getElementById('startDate'),
            endDate: document.getElementById('endDate'),
            saveBtn: document.getElementById('saveReportBtn'),
            saveBtnText: document.getElementById('saveBtnText'),
            downloadBtn: document.getElementById('downloadReportBtn'),
            resetBtn: document.getElementById('resetFormBtn'),
            addCustomColBtn: document.getElementById('addCustomColumnBtn'),
            generatorTitle: document.getElementById('generatorTitle'),
            customList: document.getElementById('customColumnsList'),
            reportsGrid: document.getElementById('reportsGrid'),
            noReports: document.getElementById('noReports'),
            savedCount: document.getElementById('savedReportsCount'),
            previewSummary: document.getElementById('previewSummary'),
            searchReports: document.getElementById('searchReports')
        };
    },

    bindEvents() {
        this.dom.tabs.forEach(btn => btn.addEventListener('click', () => this.switchTab(btn.dataset.tab)));
        
        document.querySelectorAll('input[name="selectedTables"]').forEach(cb => {
            cb.addEventListener('change', (e) => this.handleTableSelection(e));
        });

        document.querySelectorAll('.select-all-columns').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectAllColumns(e.target.dataset.table));
        });

        this.dom.addCustomColBtn.addEventListener('click', () => this.addCustomColumnUI());

        this.dom.downloadBtn.addEventListener('click', () => this.handleGenerate(false));
        this.dom.saveBtn.addEventListener('click', () => this.handleGenerate(true));
        this.dom.resetBtn.addEventListener('click', () => this.resetForm());

        const debouncedSearch = Utils.debounce((e) => this.filterSavedReports(e.target.value), 300);
        this.dom.searchReports.addEventListener('input', debouncedSearch);

        this.dom.startDate.addEventListener('change', () => this.updatePreview());
        this.dom.endDate.addEventListener('change', () => this.updatePreview());
        
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });
    },

    setupDateDefaults() {
        const today = new Date().toISOString().split('T')[0];
        this.dom.endDate.value = today;
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        this.dom.startDate.value = monthAgo.toISOString().split('T')[0];
    },

    switchTab(tabName) {
        this.state.currentTab = tabName;
        this.dom.tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
        this.dom.contents.forEach(c => c.classList.toggle('active', c.dataset.tab === tabName));
        if (tabName === 'saved') this.loadSavedReports();
    },

    // --- Загрузка данных ---
    async loadUserProfile() {
        try {
            const data = await ApiService.get('/auth/profile');
            document.getElementById('userName').textContent = data.user.username;
        } catch (e) {}
    },

    async loadStatistics() {
        try {
            const tables = ['sudeb_vzisk', 'dos_rabota', 'base_zayci'];
            const results = await Promise.allSettled(tables.map(t => ApiService.get(`/data/${t}`)));
            let stats = { judicial: 0, preJudicial: 0, base: 0, debt: 0 };

            results.forEach((res, index) => {
                if (res.status === 'fulfilled') {
                    const data = res.value;
                    const count = data.length;
                    let debt = 0;
                    const sumKey = Object.keys(data[0] || {}).find(k => k.toLowerCase().includes('сумма') && (k.toLowerCase().includes('дз') || k.toLowerCase().includes('задолж')));
                    if (sumKey) debt = data.reduce((s, item) => s + (parseFloat(item[sumKey]) || 0), 0);

                    if (index === 0) stats.judicial = count;
                    if (index === 1) stats.preJudicial = count;
                    if (index === 2) stats.base = count;
                    stats.debt += debt;
                }
            });
            this.updateStatsUI(stats);
        } catch (e) { showToast('Не удалось загрузить статистику', 'error'); }
    },

    updateStatsUI(stats) {
        document.getElementById('judicialTotal').textContent = Utils.formatNumber(stats.judicial);
        document.getElementById('preJudicialTotal').textContent = Utils.formatNumber(stats.preJudicial);
        document.getElementById('baseZayciTotal').textContent = Utils.formatNumber(stats.base);
        document.getElementById('totalDebt').textContent = Utils.formatCurrency(stats.debt);
        document.getElementById('judicialRecords').textContent = `${Utils.formatNumber(stats.judicial)} записей`;
        document.getElementById('preJudicialRecords').textContent = `${Utils.formatNumber(stats.preJudicial)} записей`;
        document.getElementById('baseZayciRecords').textContent = `${Utils.formatNumber(stats.base)} записей`;
    },

    // --- Конструктор ---
    async handleTableSelection(e) {
        if (e.target.checked) await this.loadTableStructure(e.target.value);
        this.updateTableVisibility();
        this.updatePreview();
    },

    async loadTableStructure(tableName) {
        if (this.state.tableColumns[tableName] && this.state.tableColumns[tableName].length > 0) return;
        const container = document.getElementById(`columns-${tableName}`);
        this.renderSkeleton(container);
        try {
            const data = await ApiService.get(`/data/${tableName}?limit=1`);
            if (data.length > 0) {
                this.state.tableColumns[tableName] = Object.keys(data[0]);
                this.renderColumnSelectors(tableName);
            } else {
                container.innerHTML = '<p class="text-muted p-3">Таблица пуста</p>';
            }
        } catch (e) { container.innerHTML = `<p class="error-text p-3">Ошибка: ${e.message}</p>`; }
    },

    renderColumnSelectors(tableName) {
        const container = document.getElementById(`columns-${tableName}`);
        const columns = this.state.tableColumns[tableName];
        const exclude = ['id', 'created_at', 'updated_at', 'created_by'];
        
        container.innerHTML = columns.filter(c => !exclude.includes(c)).map(c => `
            <label class="column-checkbox-option">
                <input type="checkbox" name="column_${tableName}" value="${c}">
                <span class="checkbox-custom-small"></span>
                <span class="column-label">${c}</span>
            </label>
        `).join('');

        container.querySelectorAll('input').forEach(cb => cb.addEventListener('change', () => this.updatePreview()));
    },

    updateTableVisibility() {
        const selected = this.getSelectedTables();
        document.querySelectorAll('.table-columns-config').forEach(block => {
            block.style.display = selected.includes(block.dataset.table) ? 'block' : 'none';
        });
    },

    selectAllColumns(tableName) {
        const cbs = document.querySelectorAll(`input[name="column_${tableName}"]`);
        const allChecked = Array.from(cbs).every(cb => cb.checked);
        cbs.forEach(cb => cb.checked = !allChecked);
        this.updatePreview();
    },

    // --- Кастомные колонки (УЛУЧШЕНО) ---
    addCustomColumnUI(name = '', formula = '') {
        this.state.customColumnCounter++;
        const id = `custom_${Date.now()}`;
        
        const div = document.createElement('div');
        div.className = 'custom-column-item';
        div.dataset.columnId = id;
        div.innerHTML = `
            <div class="custom-column-header">
                <span class="custom-column-number">#${this.state.customColumnCounter}</span>
                <button type="button" class="btn-remove-column"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
            <div class="custom-column-fields">
                <div class="form-group">
                    <label>Название колонки</label>
                    <input type="text" class="column-name form-control" value="${name}" placeholder="Итого" required>
                </div>
                <div class="form-group">
                    <label>Формула <span class="formula-hint" title="Используйте названия колонок в квадратных скобках">[?]</span></label>
                    <div class="formula-input-wrapper">
                        <textarea class="column-formula form-control" placeholder="Например: [Сумма ДЗ] * 1.20" rows="2">${formula}</textarea>
                        <div class="formula-tools">
                            <button type="button" class="btn-mini" onclick="ReportManager.insertColumn('${id}')" title="Вставить колонку">➕ Добавить колонку</button>
                            <button type="button" class="btn-mini" onclick="ReportManager.checkFormula('${id}')" title="Проверить">🔍 Проверка на синтаксис</button>
                        </div>
                    </div>
                    <small class="formula-error" style="color: var(--error); display: none; margin-top: 5px; font-size: 11px;"></small>
                </div>
            </div>
        `;
        
        this.dom.customList.appendChild(div);

        div.querySelector('.btn-remove-column').addEventListener('click', () => {
            div.remove();
            this.updateCustomColumnsState();
            this.updatePreview();
        });

        div.querySelectorAll('input, textarea').forEach(i => i.addEventListener('input', () => {
            this.updateCustomColumnsState();
            this.updatePreview();
        }));
        
        this.updateCustomColumnsState();
    },

    insertColumn(columnId) {
        const item = document.querySelector(`[data-column-id="${columnId}"]`);
        const textarea = item.querySelector('.column-formula');
        
        // Собираем доступные колонки
        const selectedTables = this.getSelectedTables();
        let options = '';
        selectedTables.forEach(t => {
            const cols = this.state.tableColumns[t] || [];
            cols.forEach(c => options += `<option value="[${c}]">${Utils.getDatabaseName(t)}: ${c}</option>`);
        });

        if (!options) {
            showToast('Сначала выберите таблицы и загрузите их', 'warning');
            return;
        }


        
        const colName = prompt("Введите название колонки (как в таблице):", "Сумма ДЗ");
        if (colName) {
            const textToInsert = `[${colName}]`;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, start) + textToInsert + textarea.value.substring(end);
            textarea.focus();
            this.updateCustomColumnsState();
        }
    },

    checkFormula(columnId) {
        const item = document.querySelector(`[data-column-id="${columnId}"]`);
        const formula = item.querySelector('.column-formula').value;
        const errorEl = item.querySelector('.formula-error');
        
        const validation = FormulaEngine.validate(formula);
        if (!validation.valid) {
            errorEl.textContent = `❌ ${validation.error}`;
            errorEl.style.display = 'block';
        } else {
            errorEl.textContent = '✅ Синтаксис корректен';
            errorEl.style.color = 'var(--success)';
            errorEl.style.display = 'block';
            setTimeout(() => errorEl.style.display = 'none', 2000);
        }
    },

    updateCustomColumnsState() {
        this.state.customColumns = Array.from(document.querySelectorAll('.custom-column-item')).map(item => ({
            id: item.dataset.columnId,
            name: item.querySelector('.column-name').value,
            formula: item.querySelector('.column-formula').value
        }));
    },

    // --- Редактирование и Сброс ---
    async editReport(reportId) {
        const report = this.state.savedReports.find(r => r.id === reportId);
        if (!report) return;
        this.resetForm();
        this.state.editingReportId = reportId;
        this.dom.generatorTitle.textContent = 'Редактирование отчета';
        this.dom.saveBtnText.textContent = 'Обновить отчет';
        this.dom.resetBtn.style.display = 'flex';
        document.querySelector('.tab-btn[data-tab="create"]').click();

        let config;
        try {
            config = typeof report.report_config === 'string' ? JSON.parse(report.report_config) : report.report_config;
        } catch (e) { showToast('Ошибка данных конфига', 'error'); return; }

        this.dom.reportTitle.value = report.title;
        this.dom.reportDesc.value = report.description || '';
        if (config.startDate) this.dom.startDate.value = config.startDate;
        if (config.endDate) this.dom.endDate.value = config.endDate;
        document.querySelectorAll('.format-btn').forEach(b => b.classList.toggle('active', b.dataset.format === report.format));

        for (const tableName of config.tables) {
            const cb = document.querySelector(`input[name="selectedTables"][value="${tableName}"]`);
            if (cb) {
                cb.checked = true;
                await this.loadTableStructure(tableName);
                (config.columns[tableName] || []).forEach(col => {
                    const colCb = document.querySelector(`input[name="column_${tableName}"][value="${col}"]`);
                    if (colCb) colCb.checked = true;
                });
            }
        }
        this.updateTableVisibility();
        (config.customColumns || []).forEach(c => this.addCustomColumnUI(c.name, c.formula));
        this.updatePreview();
        showToast('Режим редактирования', 'info');
    },

    resetForm() {
        this.state.editingReportId = null;
        this.dom.generatorTitle.textContent = 'Конструктор отчетов';
        this.dom.saveBtnText.textContent = 'Сохранить отчет';
        this.dom.resetBtn.style.display = 'none';
        this.dom.reportTitle.value = '';
        this.dom.reportDesc.value = '';
        this.setupDateDefaults();
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        document.querySelectorAll('.table-columns-config').forEach(el => el.style.display = 'none');
        this.dom.customList.innerHTML = '';
        this.state.customColumns = [];
        this.state.customColumnCounter = 0;
        this.updatePreview();
    },

    // --- Генерация и Экспорт ---
    async handleGenerate(saveToDb) {
        const title = this.dom.reportTitle.value.trim();
        if (saveToDb && !title) { showToast('Укажите название отчета', 'warning'); this.dom.reportTitle.focus(); return; }
        const selectedTables = this.getSelectedTables();
        if (selectedTables.length === 0) { showToast('Выберите хотя бы одну таблицу', 'warning'); return; }

        // Валидация формул перед генерацией
        for (const col of this.state.customColumns) {
            if (col.name && col.formula) {
                const val = FormulaEngine.validate(col.formula);
                if (!val.valid) {
                    showToast(`Ошибка в формуле "${col.name}": ${val.error}`, 'error');
                    return;
                }
            }
        }

        UIManager.progress.show();
        UIManager.progress.update(0, 'Старт', 'Подготовка...');

        try {
            const dataMap = {};
            for (let i = 0; i < selectedTables.length; i++) {
                const table = selectedTables[i];
                UIManager.progress.update(10 + (i * 10), 'Загрузка...', Utils.getDatabaseName(table));
                if (this.state.tableDataCache[table]) dataMap[table] = this.state.tableDataCache[table];
                else {
                    const data = await ApiService.get(`/data/${table}`);
                    this.state.tableDataCache[table] = data; 
                    dataMap[table] = data;
                }
            }

            UIManager.progress.update(50, 'Обработка...', 'Фильтрация и формулы');
            const processedData = {};
            const config = this.buildConfig(selectedTables);

            selectedTables.forEach(table => {
                let rows = this.filterByDate(dataMap[table], config.startDate, config.endDate);
                rows = FormulaEngine.apply(rows, this.state.customColumns);
                const finalCols = [...config.columns[table], ...this.state.customColumns.map(c => c.name)];
                processedData[table] = rows.map(row => {
                    const newRow = {};
                    finalCols.forEach(c => newRow[c] = row[c]);
                    return newRow;
                });
            });

            const format = document.querySelector('.format-btn.active').dataset.format;
            UIManager.progress.update(75, `Создание ${format.toUpperCase()}...`, 'Сборка файла');
            const exportResult = format === 'excel' ? exportToExcel(processedData, config) : exportToPdf(processedData, config);

            if (saveToDb) {
                UIManager.progress.update(90, 'Сохранение...', 'Запись в базу');
                await this.saveReport({
                    title, description: this.dom.reportDesc.value, config: JSON.stringify(config),
                    format, blob: exportResult.blob, fileName: exportResult.fileName
                });
            }

            Utils.triggerDownload(exportResult.blob, exportResult.fileName);
            UIManager.progress.update(100, 'Готово!', 'Успешно');
            await Utils.sleep(800);
            UIManager.progress.hide();
            if (saveToDb) { if (this.state.editingReportId) this.loadSavedReports(); showToast('Отчет сохранен и скачан', 'success'); }
        } catch (e) {
            UIManager.progress.hide();
            showToast('Ошибка генерации: ' + e.message, 'error');
            console.error(e);
        }
    },

    buildConfig(tables) {
        return {
            tables,
            columns: tables.reduce((acc, t) => {
                acc[t] = Array.from(document.querySelectorAll(`input[name="column_${t}"]:checked`)).map(cb => cb.value);
                return acc;
            }, {}),
            customColumns: this.state.customColumns.filter(c => c.name && c.formula),
            startDate: this.dom.startDate.value,
            endDate: this.dom.endDate.value
        };
    },

    async saveReport(data) {
        const url = this.state.editingReportId ? `/reports/${this.state.editingReportId}` : `/reports`;
        const base64 = await Utils.blobToBase64(data.blob);
        const payload = {
            title: data.title, description: data.description, report_type: 'custom',
            report_config: data.config, format: data.format, file_data: base64, file_name: data.fileName
        };
        if (this.state.editingReportId) { await ApiService.put(url, payload); this.resetForm(); }
        else { await ApiService.post(url, payload); }
    },

    filterByDate(data, startDate, endDate) {
        if (!data || !Array.isArray(data)) return [];
        if (!startDate || !endDate) return data;
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return data.filter(item => {
            const dateField = Object.values(item).find(val => typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val));
            if (!dateField) return true;
            const itemDate = new Date(dateField);
            return itemDate >= start && itemDate <= end;
        });
    },

    async loadSavedReports() {
        this.dom.reportsGrid.innerHTML = '<div class="skeleton-table">Загрузка...</div>';
        try {
            const res = await ApiService.get('/reports');
            this.state.savedReports = res.data || [];
            this.dom.savedCount.textContent = this.state.savedReports.length;
            this.renderReportsList(this.state.savedReports);
        } catch (e) { this.dom.reportsGrid.innerHTML = '<p class="error-text">Ошибка загрузки списка</p>'; }
    },

    renderReportsList(reports) {
        if (reports.length === 0) { this.dom.reportsGrid.innerHTML = ''; this.dom.noReports.style.display = 'block'; return; }
        this.dom.noReports.style.display = 'none';
        this.dom.reportsGrid.innerHTML = reports.map(r => `
            <div class="report-card">
                <div class="report-card-header">
                    <div class="report-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></div>
                </div>
                <div class="report-card-body">
                    <h4 class="report-card-title">${Utils.escapeHtml(r.title)}</h4>
                    <p class="report-card-description">${Utils.escapeHtml(r.description || 'Нет описания')}</p>
                    <div class="report-card-meta"><div class="report-meta-item"><span>📅 ${Utils.formatDateTime(r.created_at)}</span></div></div>
                </div>
                <div class="report-card-footer"><span class="report-format-badge ${r.format}">${r.format.toUpperCase()}</span></div>
                <div class="report-card-actions">
                    <button class="report-action-btn" onclick="ReportManager.downloadReport('${r.id}')"><span>Скачать</span></button>
                    <button class="report-action-btn" onclick="ReportManager.editReport('${r.id}')" title="Редактировать"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                    <button class="report-action-btn delete" onclick="ReportManager.deleteReport('${r.id}')" title="Удалить"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                </div>
            </div>
        `).join('');
    },

    filterSavedReports(term) {
        const lower = term.toLowerCase();
        this.renderReportsList(this.state.savedReports.filter(r => r.title.toLowerCase().includes(lower) || (r.description && r.description.toLowerCase().includes(lower))));
    },

    async deleteReport(id) { if (!confirm('Удалить этот отчет?')) return; try { await ApiService.delete(`/reports/${id}`); this.loadSavedReports(); showToast('Отчет удален', 'success'); } catch(e) { showToast('Ошибка удаления', 'error'); } },
    async downloadReport(id) { const r = this.state.savedReports.find(x => x.id === id); try { const blob = await ApiService.download(`/reports/${id}/download`); Utils.triggerDownload(blob, r.file_name); } catch(e) { showToast('Ошибка скачивания', 'error'); } },
    
    updatePreview() {
        const selected = this.getSelectedTables();
        if (selected.length === 0) { this.dom.previewSummary.textContent = '⚠️ Выберите таблицы'; return; }
        let text = selected.map(t => { const cols = document.querySelectorAll(`input[name="column_${t}"]:checked`).length; return `${Utils.getDatabaseName(t)}: ${cols} кол.`; }).join(', ');
        const customCount = this.state.customColumns.filter(c => c.name && c.formula).length;
        if (customCount) text += ` + ${customCount} кастомных`;
        const start = this.dom.startDate.value; const end = this.dom.endDate.value;
        if (start && end) text += ` | 📅 ${Utils.formatDate(start)} - ${Utils.formatDate(end)}`;
        this.dom.previewSummary.textContent = text;
    },

    getSelectedTables() { return Array.from(document.querySelectorAll('input[name="selectedTables"]:checked')).map(cb => cb.value); },
    renderSkeleton(container) { container.innerHTML = `<div class="skeleton-table"><div class="skeleton-row"></div><div class="skeleton-row"></div></div>`; }
};

// ==========================================================================
// 6. ЭКСПОРТ
// ==========================================================================
function exportToExcel(reportData, config) {
    const wb = XLSX.utils.book_new();
    config.tables.forEach(table => {
        if (reportData[table] && reportData[table].length > 0) {
            const ws = XLSX.utils.json_to_sheet(reportData[table]);
            XLSX.utils.book_append_sheet(wb, ws, Utils.getDatabaseName(table));
        }
    });
    const dateStr = new Date().toISOString().split('T')[0];
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return { blob: new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName: `Otchet_${dateStr}.xlsx` };
}

function exportToPdf(reportData, config) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Сводный отчет', 14, 15);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(`Дата формирования: ${new Date().toLocaleDateString('ru-RU')}`, 14, 22);
    let startY = 30;
    config.tables.forEach((table, index) => {
        if (reportData[table] && reportData[table].length > 0) {
            if (index > 0) { doc.addPage(); startY = 15; }
            doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(Utils.getDatabaseName(table), 14, startY);
            const headers = Object.keys(reportData[table][0]);
            const rows = reportData[table].map(row => Object.values(row).map(String));
            doc.autoTable({ head: [headers], body: rows, startY: startY + 5, styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [139, 92, 246] } });
            startY = doc.lastAutoTable.finalY + 15;
        }
    });
    const dateStr = new Date().toISOString().split('T')[0];
    return { blob: doc.output('blob'), fileName: `Otchet_${dateStr}.pdf` };
}

document.addEventListener('DOMContentLoaded', () => ReportManager.init());