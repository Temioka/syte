-- ============================================
-- ПОЛНАЯ СХЕМА БД ДЛЯ СИСТЕМЫ УВДЗ
-- Версия: 2.0 (улучшенная)
-- ============================================

-- Создание расширений
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- Для дополнительного шифрования

-- ============================================
-- ТАБЛИЦА ПОЛЬЗОВАТЕЛЕЙ
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    role VARCHAR(50) DEFAULT 'user', -- ✅ Добавлена роль
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    
    CONSTRAINT username_length CHECK (LENGTH(username) >= 3),
    CONSTRAINT email_format CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role); -- ✅ Индекс для роли

-- ============================================
-- ЛОГИ ДЕЙСТВИЙ ПОЛЬЗОВАТЕЛЕЙ
-- ============================================
CREATE TABLE IF NOT EXISTS user_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    description TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_logs_user_id ON user_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_logs_created_at ON user_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_logs_action ON user_logs(action);

-- ============================================
-- ЛОГИ ИЗМЕНЕНИЙ ДАННЫХ (ACTIVITY LOGS)
-- ============================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    table_name VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    record_id UUID, -- ✅ Теперь UUID
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    ip_address VARCHAR(45),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_table ON activity_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_record_id ON activity_logs(record_id); -- ✅ Индекс для record_id

-- ✅ Партиционирование activity_logs по месяцам (для производительности)
-- Раскомментируй если нужно:
-- CREATE TABLE activity_logs_2024_12 PARTITION OF activity_logs
-- FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- ============================================
-- ФУНКЦИИ ДЛЯ АВТООБНОВЛЕНИЯ
-- ============================================

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ✅ Функция для автообновления "Дата сохранения"
CREATE OR REPLACE FUNCTION update_last_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW."Дата сохранения" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ТАБЛИЦА: СУДЕБНАЯ РАБОТА (sudeb_vzisk)
-- ============================================
CREATE TABLE IF NOT EXISTS sudeb_vzisk (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "№ л/с" VARCHAR(255) UNIQUE NOT NULL,
    "Тип клиента" VARCHAR(255),
    "ФИО/Наименование" VARCHAR(500),
    "ИНН" VARCHAR(50),
    "Адрес должника" TEXT,
    "Электронная почта должника" VARCHAR(255),
    "Телефон должника" VARCHAR(50),
    "Дата рождения должника" DATE,
    "Место рождения должника" VARCHAR(500),
    "Паспорт" VARCHAR(255),
    "Снилс" VARCHAR(50),
    "ВУ" VARCHAR(50),
    "Проверка" VARCHAR(255),
    "№ ГРЗ" VARCHAR(50),
    "Дата заключения договора" DATE,
    "Сумма подаваемой ДЗ , руб#" NUMERIC(15, 2),
    "Дата начала образования долга" DATE,
    "Дата окончания образования долга" DATE,
    "Сумма подаваемой гос#пошлины,руб#" NUMERIC(15, 2),
    "Сумма подаваемой  неустойки,руб#" NUMERIC(15, 2),
    "Сумма под-ых почтовых расходов" NUMERIC(15, 2),
    "Итого сумма по заявлению,руб#" NUMERIC(15, 2),
    "Дата направления в суд" DATE,
    "ШПИ отправления" VARCHAR(255),
    "Тип подачи" VARCHAR(255),
    "Судебный участок" VARCHAR(255),
    "Адрес судебного участка" TEXT,
    "Результат рассмотрения заявления" VARCHAR(255),
    "Причина" VARCHAR(500),
    "Дата решения" DATE,
    "Дата поступления решения" DATE,
    "№ гражданского дела" VARCHAR(255),
    "Тип подачи (повтр)" VARCHAR(255),
    "Дата повторной подачи" DATE,
    "ШПИ отправления(повтр)" VARCHAR(255),
    "Судебный участок(повтр)" VARCHAR(255),
    "Адрес судебного участка(повтр)" TEXT,
    "Сумма гос#пошлины (повтр)" NUMERIC(15, 2),
    "Результат повторной подачи" VARCHAR(255),
    "Причина повторной" VARCHAR(500),
    "Дата решения (повтр)" DATE,
    "Дата поступления решения(повт)" DATE,
    "№ гражданского дела(повт)" VARCHAR(255),
    "Подтвежденная сумма  ДЗ#" NUMERIC(15, 2),
    "Подтвержденная сумма гос#пошлины#" NUMERIC(15, 2),
    "Подтвержденная сумма неустойки" NUMERIC(15, 2),
    "Подтвержденные почтовые расходы#" NUMERIC(15, 2),
    "Итоговая подтвержденная сумма#" NUMERIC(15, 2),
    "Направлен на исполнение(ФССП/банк)" VARCHAR(255),
    "Дата направления на исполнение" DATE,
    "ШПИ отправления(исполнение)" VARCHAR(255),
    "Результат расс-ия заявления ИП" VARCHAR(255),
    "Статус ИП(на исп-и/исп-но/отозвано)" VARCHAR(255),
    "Дата направления заявления на ИД" DATE,
    "ШПИ отправления(отозвано)" VARCHAR(255),
    "Поступившая сумма ДЗ,руб#" NUMERIC(15, 2),
    "Поступившая сумма гос#пошлины,руб#" NUMERIC(15, 2),
    "Поступившая сумма неустойки,руб" NUMERIC(15, 2),
    "Поступившие почтовые расходы,руб#" NUMERIC(15, 2),
    "Итого поступило,руб#" NUMERIC(15, 2),
    "Остаток ДЗ, руб#" NUMERIC(15, 2),
    "Начислено в 1C" NUMERIC(15, 2),
    "Комментарий" TEXT,
    "Повторы" INTEGER DEFAULT 0,
    "Пользователь" VARCHAR(255),
    "Дата входа в систему" TIMESTAMP,
    "Сохранил последним" VARCHAR(255),
    "Дата сохранения" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "Примечание" TEXT,
    "Баланс" NUMERIC(15, 2),
    "Комментарий фин отдел" TEXT,
    "Дата 2-ой повторной подачи" DATE,
    "Результат 2-ой повторной подачи" VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для sudeb_vzisk
CREATE INDEX IF NOT EXISTS idx_sudeb_vzisk_account ON sudeb_vzisk("№ л/с");
CREATE INDEX IF NOT EXISTS idx_sudeb_vzisk_fio ON sudeb_vzisk("ФИО/Наименование");
CREATE INDEX IF NOT EXISTS idx_sudeb_vzisk_case ON sudeb_vzisk("№ гражданского дела");
CREATE INDEX IF NOT EXISTS idx_sudeb_vzisk_inn ON sudeb_vzisk("ИНН");
CREATE INDEX IF NOT EXISTS idx_sudeb_vzisk_court_date ON sudeb_vzisk("Дата направления в суд");
CREATE INDEX IF NOT EXISTS idx_sudeb_vzisk_debt ON sudeb_vzisk("Сумма подаваемой ДЗ , руб#");

-- ✅ Полнотекстовый поиск для sudeb_vzisk
CREATE INDEX IF NOT EXISTS idx_sudeb_vzisk_fulltext 
ON sudeb_vzisk USING gin(
    to_tsvector('russian', 
        COALESCE("ФИО/Наименование", '') || ' ' || 
        COALESCE("№ л/с", '') || ' ' || 
        COALESCE("№ гражданского дела", '')
    )
);

-- Триггеры для sudeb_vzisk
DROP TRIGGER IF EXISTS trigger_sudeb_vzisk_update ON sudeb_vzisk;
CREATE TRIGGER trigger_sudeb_vzisk_update
BEFORE UPDATE ON sudeb_vzisk
FOR EACH ROW
EXECUTE FUNCTION update_last_modified();

DROP TRIGGER IF EXISTS update_sudeb_vzisk_updated_at ON sudeb_vzisk;
CREATE TRIGGER update_sudeb_vzisk_updated_at 
BEFORE UPDATE ON sudeb_vzisk
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ТАБЛИЦА: ДОСУДЕБНАЯ РАБОТА (dos_rabota)
-- ============================================
CREATE TABLE IF NOT EXISTS dos_rabota (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "№ л/с" VARCHAR(255) UNIQUE NOT NULL,
    "Тип клиента" VARCHAR(255),
    "ФИО/Наименование" VARCHAR(500),
    "ИНН" VARCHAR(50),
    "Адрес должника" TEXT,
    "Электронная почта должника" VARCHAR(255),
    "Проверка" VARCHAR(255),
    "№ ГРЗ" VARCHAR(50),
    "Дата заключения договора" DATE,
    "Сумма подаваемой ДЗ , руб." NUMERIC(15, 2),
    "Дата начала задолженности" DATE,
    "Дата окончания задолженности" DATE,
    "Дата направления претензии" DATE,
    "ШПИ отправления" VARCHAR(255),
    "Дата прибытия в место вручения" DATE,
    "Дата получения адресатом" DATE,
    "Поступили возражения?" VARCHAR(50),
    "Поступившая сумма ДЗ,руб." NUMERIC(15, 2),
    "Остаток ДЗ, руб." NUMERIC(15, 2),
    "Комментарий" TEXT,
    "Пользователь" VARCHAR(255),
    "Дата входа в систему" TIMESTAMP,
    "Сохранил последним" VARCHAR(255),
    "Дата сохранения" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "Примечание" TEXT,
    "Баланс" NUMERIC(15, 2),
    "Комментарий фин отдел" TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для dos_rabota
CREATE INDEX IF NOT EXISTS idx_dos_rabota_account ON dos_rabota("№ л/с");
CREATE INDEX IF NOT EXISTS idx_dos_rabota_fio ON dos_rabota("ФИО/Наименование");
CREATE INDEX IF NOT EXISTS idx_dos_rabota_inn ON dos_rabota("ИНН");
CREATE INDEX IF NOT EXISTS idx_dos_rabota_claim_date ON dos_rabota("Дата направления претензии");

-- ✅ Полнотекстовый поиск для dos_rabota
CREATE INDEX IF NOT EXISTS idx_dos_rabota_fulltext 
ON dos_rabota USING gin(
    to_tsvector('russian', 
        COALESCE("ФИО/Наименование", '') || ' ' || 
        COALESCE("№ л/с", '') || ' ' || 
        COALESCE("ИНН", '')
    )
);

-- Триггеры для dos_rabota
DROP TRIGGER IF EXISTS trigger_dos_rabota_update ON dos_rabota;
CREATE TRIGGER trigger_dos_rabota_update
BEFORE UPDATE ON dos_rabota
FOR EACH ROW
EXECUTE FUNCTION update_last_modified();

DROP TRIGGER IF EXISTS update_dos_rabota_updated_at ON dos_rabota;
CREATE TRIGGER update_dos_rabota_updated_at 
BEFORE UPDATE ON dos_rabota
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ТАБЛИЦА: БАЗА ЗАЙЦЕВ (base_zayci)
-- ============================================
CREATE TABLE IF NOT EXISTS base_zayci (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ГРН" VARCHAR(50) UNIQUE NOT NULL,
    "Дата поездки" TIMESTAMP,
    "Дата создания поездки в ЕСВП" DATE,
    "Транзакции" TEXT, -- ✅ Изменено на TEXT для длинных строк
    "ПВП/РВП - полоса" VARCHAR(255),
    "Способ оплаты" VARCHAR(255),
    "Тариф" NUMERIC(15, 2),
    "Примечание" TEXT,
    "Обработал" VARCHAR(255),
    "Дата обработки" DATE,
    "Почта" VARCHAR(255),
    "Телефон" VARCHAR(50),
    "Тип информирования" VARCHAR(255),
    "Дата информирования" DATE,
    "Оплата" NUMERIC(15, 2),
    "Дата оплаты" DATE,
    "Банк" VARCHAR(255),
    "Адрес" TEXT,
    "Дата сохранения" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "Сохранил последний" VARCHAR(255),
    "Кол-во поездок" INTEGER DEFAULT 0,
    "Кол-во оплат" INTEGER DEFAULT 0,
    "Кол-во неоплат" INTEGER DEFAULT 0,
    "Сумма поездок" NUMERIC(15, 2) DEFAULT 0,
    "Сумма оплат" NUMERIC(15, 2) DEFAULT 0,
    "Сумма задолженности" NUMERIC(15, 2) DEFAULT 0,
    "Дата последней поездки" DATE,
    "Плательщик" VARCHAR(500),
    "Собственник" VARCHAR(500),
    "PAN" VARCHAR(255),
    "Паспортные данные" VARCHAR(255),
    "Дата рождения" DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для base_zayci
CREATE INDEX IF NOT EXISTS idx_base_zayci_grz ON base_zayci("ГРН");
CREATE INDEX IF NOT EXISTS idx_base_zayci_payer ON base_zayci("Плательщик");
CREATE INDEX IF NOT EXISTS idx_base_zayci_owner ON base_zayci("Собственник");
CREATE INDEX IF NOT EXISTS idx_base_zayci_debt ON base_zayci("Сумма задолженности");
CREATE INDEX IF NOT EXISTS idx_base_zayci_last_trip ON base_zayci("Дата последней поездки");

-- ✅ Полнотекстовый поиск для base_zayci
CREATE INDEX IF NOT EXISTS idx_base_zayci_fulltext 
ON base_zayci USING gin(
    to_tsvector('russian', 
        COALESCE("ГРН", '') || ' ' || 
        COALESCE("Плательщик", '') || ' ' || 
        COALESCE("Собственник", '')
    )
);

-- Триггеры для base_zayci
DROP TRIGGER IF EXISTS trigger_base_zayci_update ON base_zayci;
CREATE TRIGGER trigger_base_zayci_update
BEFORE UPDATE ON base_zayci
FOR EACH ROW
EXECUTE FUNCTION update_last_modified();

DROP TRIGGER IF EXISTS update_base_zayci_updated_at ON base_zayci;
CREATE TRIGGER update_base_zayci_updated_at 
BEFORE UPDATE ON base_zayci
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ТАБЛИЦА: ОТЧЕТЫ (reports)
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    report_type VARCHAR(50) NOT NULL,
    start_date DATE,
    end_date DATE,
    format VARCHAR(10) NOT NULL,
    file_data BYTEA NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER, -- ✅ Размер файла в байтах
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для reports
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_dates ON reports(start_date, end_date);

-- Комментарии
COMMENT ON TABLE reports IS 'Сохраненные отчеты пользователей';
COMMENT ON COLUMN reports.file_data IS 'Бинарные данные файла отчета';
COMMENT ON COLUMN reports.format IS 'Формат файла: excel или pdf';

-- ============================================
-- ✅ МАТЕРИАЛИЗОВАННЫЕ ПРЕДСТАВЛЕНИЯ ДЛЯ СТАТИСТИКИ
-- ============================================

-- Статистика по судебной работе
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_judicial_stats AS
SELECT 
    DATE_TRUNC('month', "Дата направления в суд") as month,
    COUNT(*) as total_cases,
    SUM("Сумма подаваемой ДЗ , руб#") as total_debt,
    AVG("Сумма подаваемой ДЗ , руб#") as avg_debt,
    COUNT(CASE WHEN "Результат рассмотрения заявления" LIKE '%Удовлетворено%' THEN 1 END) as satisfied_cases,
    COUNT(CASE WHEN "Результат рассмотрения заявления" LIKE '%Отказ%' THEN 1 END) as rejected_cases
FROM sudeb_vzisk
WHERE "Дата направления в суд" IS NOT NULL
GROUP BY DATE_TRUNC('month', "Дата направления в суд")
ORDER BY month DESC;

CREATE UNIQUE INDEX ON mv_judicial_stats (month);

-- Обновлять каждые 24 часа (настрой через pg_cron или cron)
-- SELECT refresh_materialized_view_concurrently('mv_judicial_stats');
-- Вывод информации о созданных таблицах
SELECT 
    schemaname, 
    tablename, 
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Вывод количества записей
SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'sudeb_vzisk', COUNT(*) FROM sudeb_vzisk
UNION ALL
SELECT 'dos_rabota', COUNT(*) FROM dos_rabota
UNION ALL
SELECT 'base_zayci', COUNT(*) FROM base_zayci
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM activity_logs
UNION ALL
SELECT 'reports', COUNT(*) FROM reports;