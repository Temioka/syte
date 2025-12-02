require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { types } = require('pg');

// Устанавливаем парсер для типа DATE (OID 1082), чтобы он возвращал строку 'YYYY-MM-DD'
types.setTypeParser(1082, val => val);

const initializeDatabase = require('./db/initialize');
const pool = require('./config/database');

const app = express();

const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const LOCAL_IP = getLocalIP();
const PORT = process.env.PORT || 3001;
const REGISTRATION_TOKEN = process.env.REGISTRATION_TOKEN;

// Функция логирования
const logRequest = (ip, method, requestPath, statusCode, userId = null, action = null) => {
  const timestamp = new Date().toISOString();
  const logFile = path.join(logsDir, `${new Date().toISOString().split('T')[0]}.log`);
  const logLine = `${timestamp} | IP: ${ip} | ${method} ${requestPath} | Status: ${statusCode} | User: ${userId || 'anonymous'} | Action: ${action || 'N/A'}\n`;

  fs.appendFileSync(logFile, logLine);
  console.log(`📝 ${logLine.trim()}`);
};

app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
  const cleanIp = ip.split(',')[0].trim();
  req.clientIp = cleanIp;

  const originalJson = res.json.bind(res);
  res.json = function(data) {
    const userId = req.userId || null;
    const action = req.body?.action || req.query?.action || null;
    logRequest(cleanIp, req.method, req.path, res.statusCode, userId, action);
    return originalJson(data);
  };

  const originalSend = res.send.bind(res);
  res.send = function(data) {
    if (!res.headersSent) {
      const userId = req.userId || null;
      logRequest(cleanIp, req.method, req.path, res.statusCode, userId, null);
    }
    return originalSend(data);
  };

  next();
});

app.use(cors({
    origin: [
        'http://localhost:3001',
        `http://${LOCAL_IP}:3001`,
        'http://10.0.244.160:3001',
    ],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(express.static(path.join(__dirname, '../public')));

app.get('/favicon.ico', (req, res) => {
    res.status(204).send();
});

// ✅ СУЩЕСТВУЮЩИЕ РОУТЫ
app.use('/api/auth', require('./routes/auth'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/data', require('./routes/data'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/files', require('./routes/files'));

console.log('\n🔧 Загрузка новых роутов истории...\n');

// 🆕 JUDICIAL ROUTES
try {
    console.log('   Загрузка judicial.js...');
    const judicialRoutes = require('./routes/judicial');
    app.use('/api/judicial', judicialRoutes);
    console.log('   ✅ /api/judicial зарегистрирован\n');
} catch (error) {
    console.error('   ❌ Ошибка загрузки judicial.js:', error.message);
    console.error('   Stack:', error.stack);
}

// 🆕 PREJUDICIAL ROUTES
try {
    console.log('   Загрузка prejudicial.js...');
    const prejudicialRoutes = require('./routes/prejudicial');
    app.use('/api/prejudicial', prejudicialRoutes);
    console.log('   ✅ /api/prejudicial зарегистрирован\n');
} catch (error) {
    console.error('   ❌ Ошибка загрузки prejudicial.js:', error.message);
    console.error('   Stack:', error.stack);
}

// 🆕 BASE-ZAYCI ROUTES
try {
    console.log('   Загрузка baseZayci.js...');
    const baseZayciRoutes = require('./routes/baseZayci');
    app.use('/api/base-zayci', baseZayciRoutes);
    console.log('   ✅ /api/base-zayci зарегистрирован\n');
} catch (error) {
    console.error('   ❌ Ошибка загрузки baseZayci.js:', error.message);
    console.error('   Stack:', error.stack);
}

app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        ip: LOCAL_IP
    });
});

app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Endpoint not found',
        path: req.path
    });
});

const checkDatabaseConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    return {
      connected: true,
      timestamp: result.rows[0].now,
      message: '✅ Подключено к БД'
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      message: '❌ Ошибка подключения к БД'
    };
  }
};

const startServer = async () => {
    try {
        console.clear();
        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║   🚀 СИСТЕМА УПРАВЛЕНИЯ БАЗАМИ ДАННЫХ УВДЗ ЗАПУЩЕНА   ║');
        console.log('╚════════════════════════════════════════════════════════╝\n');

        console.log('🔍 Проверка подключения к базе данных...');
        const dbCheck = await checkDatabaseConnection();
        console.log(`   ${dbCheck.message}`);
        
        if (!dbCheck.connected) {
          console.error(`   ⚠️  ${dbCheck.error}`);
          console.log('   ⚠️  Сервер запущен, но без БД\n');
        } else {
          console.log(`   Время БД: ${dbCheck.timestamp}\n`);
        }

        const dbInitialized = await initializeDatabase();
        
        if (!dbInitialized) {
            console.warn('⚠️  База данных не инициализирована');
        }
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log('📍 ДОСТУП:');
            console.log(`   http://localhost:${PORT}`);
            console.log(`   http://10.0.244.160:${PORT}\n`);
            
            console.log('📝 РЕГИСТРАЦИЯ:');
            console.log(`   http://localhost:${PORT}/?register=${REGISTRATION_TOKEN}`);
            console.log(`   http://10.0.244.160:${PORT}/?register=${REGISTRATION_TOKEN}\n`);

            console.log('📋 ЛОГИРОВАНИЕ:');
            console.log(`   HTTP логи: ${logsDir}`);
            console.log(`   Действия: таблица activity_logs\n`);
            
            console.log('📊 API ЛОГОВ:');
            console.log(`   GET /api/logs/my-activity - Моя история`);
            console.log(`   GET /api/logs/table-activity/:table - История таблицы (админ)`);
            console.log(`   GET /api/logs/record-activity/:table/:id - История записи`);
            console.log(`   GET /api/logs/stats - Статистика (админ)\n`);
            
            // 🆕 НОВЫЕ ENDPOINTS
            console.log('🆕 API ИСТОРИИ ИЗМЕНЕНИЙ:');
            console.log(`   GET /api/judicial/history - История судебной работы`);
            console.log(`   GET /api/prejudicial/history - История досудебной работы`);
            console.log(`   GET /api/base-zayci/history - История базы зайцев\n`);

            console.log('═══════════════════════════════════════════════════════════\n');

            fs.appendFileSync(
              path.join(logsDir, `${new Date().toISOString().split('T')[0]}.log`),
              `[${new Date().toISOString()}] 🚀 Сервер запущен (TemiokaKon)\n`
            );
        });
    } catch (error) {
        console.error('❌ Ошибка запуска сервера:', error);
        process.exit(1);
    }
};

startServer();