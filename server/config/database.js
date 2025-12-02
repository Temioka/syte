require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: String(process.env.DB_PASSWORD || '4762857'),
  database: process.env.DB_NAME || 'Debet-Zayci',
};

console.log('\n📂 Конфигурация БД:');
console.log(`   🖥️  Host: ${dbConfig.host}`);
console.log(`   🔌 Port: ${dbConfig.port}`);
console.log(`   👤 User: ${dbConfig.user}`);
console.log(`   📊 Database: ${dbConfig.database}`);
console.log(`   🔑 Password: ${dbConfig.password ? '✓' : '✗'}\n`);

const pool = new Pool(dbConfig);

pool.on('error', (err) => {
  console.error('❌ Ошибка подключения:', err.message);
});

module.exports = pool;