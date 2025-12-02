const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

/**
 * GET /api/base-zayci/history
 */
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let query = `
            SELECT 
                al.id,
                al.record_id,
                al.user_id as changed_by,
                al.created_at as changed_at,
                al.old_values,
                al.new_values,
                al.changed_fields,
                u.username as changed_by_username,
                bz."ГРН" as client_fio,
                bz."Плательщик" as payer
            FROM 
                activity_logs al
            LEFT JOIN 
                users u ON al.user_id = u.id
            LEFT JOIN 
                base_zayci bz ON al.record_id = bz.id
            WHERE 
                al.table_name = 'base_zayci'
        `;
        
        const params = [];
        
        if (startDate) {
            query += ` AND DATE(al.created_at) >= $${params.length + 1}`;
            params.push(startDate);
        }
        
        if (endDate) {
            query += ` AND DATE(al.created_at) <= $${params.length + 1}`;
            params.push(endDate);
        }
        
        query += ` ORDER BY al.created_at DESC LIMIT 1000`;
        
        console.log('📡 Запрос истории base_zayci');
        
        const result = await pool.query(query, params);
        
        const formattedRows = result.rows.map(row => {
            let changedFields = {};
            
            if (row.changed_fields && Array.isArray(row.changed_fields)) {
                row.changed_fields.forEach(field => {
                    changedFields[field] = {
                        old: row.old_values?.[field],
                        new: row.new_values?.[field]
                    };
                });
            }
            
            return {
                ...row,
                changed_fields: JSON.stringify(changedFields)
            };
        });
        
        console.log(`✅ История base_zayci: ${formattedRows.length} записей`);
        res.json(formattedRows);
        
    } catch (error) {
        console.error('❌ Ошибка в /api/base-zayci/history:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка получения истории' 
        });
    }
});

module.exports = router;