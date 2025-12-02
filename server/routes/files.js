const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const { validateTableName } = require('../middleware/validator');
const { writeLimiter } = require('../middleware/rateLimiter');
const fileController = require('../controllers/fileController');

// Настройка multer для загрузки в память
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Проверяем расширение файла
    const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Разрешены только Excel файлы (.xlsx, .xls)'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB максимум
    },
});

/**
 * POST /api/files/upload/:tableName - Загрузка Excel файла
 */
router.post(
    '/upload/:tableName',
    authMiddleware,
    validateTableName,
    writeLimiter,
    upload.single('file'),
    fileController.uploadExcel
);

/**
 * POST /api/files/export/:tableName - Экспорт данных в Excel
 */
router.post(
    '/export/:tableName',
    authMiddleware,
    validateTableName,
    fileController.exportToExcel
);

/**
 * GET /api/files/template/:tableName - Получить шаблон Excel
 */
router.get(
    '/template/:tableName',
    authMiddleware,
    validateTableName,
    fileController.getExcelTemplate
);

module.exports = router;