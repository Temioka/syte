const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

/**
 * GET /stats - Получение общей статистики по всем таблицам
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        // Параллельно запрашиваем данные из всех таблиц
        const [judicialResult, preJudicialResult, baseZayciResult] = await Promise.all([
            pool.query(`
                SELECT 
                    COUNT(*) as count,
                    COALESCE(SUM(CAST("Сумма подаваемой ДЗ , руб#" AS NUMERIC)), 0) as total_debt
                FROM sudeb_vzisk
            `),
            pool.query(`
                SELECT 
                    COUNT(*) as count,
                    COALESCE(SUM(CAST("Сумма подаваемой ДЗ , руб." AS NUMERIC)), 0) as total_debt
                FROM dos_rabota
            `),
            pool. query(`
                SELECT 
                    COUNT(*) as count,
                    COALESCE(SUM(
                        CAST("Тариф" AS NUMERIC)
                    ), 0) as total_debt
                FROM base_zayci
            `)
        ]);

        const judicial = {
            count: parseInt(judicialResult.rows[0].count),
            debt: parseFloat(judicialResult.rows[0].total_debt)
        };

        const preJudicial = {
            count: parseInt(preJudicialResult.rows[0].count),
            debt: parseFloat(preJudicialResult.rows[0].total_debt)
        };

        const baseZayci = {
            count: parseInt(baseZayciResult.rows[0].count),
            debt: parseFloat(baseZayciResult.rows[0].total_debt)
        };

        const total = {
            count: judicial. count + preJudicial.count + baseZayci.count,
            debt: judicial.debt + preJudicial.debt + baseZayci.debt
        };

        res.json({
            success: true,
            data: {
                judicial,
                preJudicial,
                baseZayci,
                total
            }
        });

    } catch (error) {
        console. error('Ошибка при получении статистики:', error);
        res.status(500). json({ 
            success: false, 
            message: 'Ошибка сервера при получении статистики' 
        });
    }
});

module.exports = router;