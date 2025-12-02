const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

const initializeDatabase = async () => {
    try {
        console.log('📊 Инициализация базы данных...');
        
        // Читаем SQL файл
        const sqlFile = path.join(__dirname, 'init.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');
        
        // Выполняем весь SQL-скрипт как один запрос.
        // Это более надежно для скриптов с функциями и триггерами.
        try {
            await pool.query(sql);
        } catch (error) {
            // Игнорируем ошибки "already exists", чтобы можно было перезапускать сервер
            if (error.code !== 'EEXIST' && !error.message.includes('already exists') && error.code !== '42P07') {
                console.warn('⚠️  ', error.message);
            }
        }
        
        console.log('✨ База данных инициализирована успешно!');
        return true;
    } catch (error) {
        console.error('❌ Ошибка инициализации базы данных:', error.message);
        return false;
    }
};

module.exports = initializeDatabase;