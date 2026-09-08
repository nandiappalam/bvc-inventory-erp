// Backend service for handling purchase orders using SQLite / PostgreSQL DbConnection wrapper
const db = require('../config/database');

let schemaEnsured = false;
async function ensurePurchaseOrderSchema() {
    if (schemaEnsured) return;
    try {
        await db.run(`
            CREATE TABLE IF NOT EXISTS purchase_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                s_no INTEGER,
                supplier_id INTEGER,
                supplier_name TEXT,
                date TEXT,
                inv_no TEXT,
                inv_date TEXT,
                po_date TEXT,
                godown_id INTEGER,
                pay_type TEXT DEFAULT 'Cash',
                tax_type TEXT DEFAULT 'Exclusive',
                tax_rate REAL DEFAULT 0,
                type TEXT,
                terms TEXT,
                fob TEXT,
                ship_via TEXT,
                sign TEXT,
                address TEXT,
                sender TEXT,
                remarks TEXT,
                tax_percent REAL DEFAULT 0,
                amount REAL DEFAULT 0,
                bill_amt REAL DEFAULT 0,
                tax_amt REAL DEFAULT 0,
                total_amt REAL DEFAULT 0,
                status TEXT DEFAULT 'Active',
                purchase_request_id INTEGER,
                pr_no TEXT,
                inward_purchase_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await db.run(`
            CREATE TABLE IF NOT EXISTS purchase_order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                purchase_order_id INTEGER NOT NULL,
                item_id INTEGER,
                item_name TEXT,
                qty REAL DEFAULT 0,
                rate REAL DEFAULT 0,
                amount REAL DEFAULT 0,
                uom TEXT,
                weight_id INTEGER,
                weight REAL DEFAULT 0,
                tot_wt REAL DEFAULT 0,
                discount_percent REAL DEFAULT 0,
                tax_percent REAL DEFAULT 0,
                ed_percent REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await db.run(`
            CREATE TABLE IF NOT EXISTS purchase_order_deductions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                purchase_order_id INTEGER NOT NULL,
                deduction_name TEXT,
                type TEXT DEFAULT 'less',
                value REAL DEFAULT 0,
                amount REAL DEFAULT 0,
                remarks TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        schemaEnsured = true;
    } catch (e) {
        console.warn('Notice ensuring purchase order tables:', e.message);
    }
}

// Auto-run schema check once at module startup
ensurePurchaseOrderSchema().catch(() => {});

exports.generateNextPurchaseOrderSNo = async () => {
    try {
        await ensurePurchaseOrderSchema();
        const result = await db.query('SELECT COALESCE(MAX(s_no), 0) + 1 AS next_sno FROM purchase_orders');
        return (result.rows && result.rows[0]?.next_sno) || 1;
    } catch (error) {
        console.error('Error generating next Purchase Order S.No:', error);
        return 1;
    }
};

exports.createPurchaseOrder = async (formData, items = [], deductions = []) => {
    await ensurePurchaseOrderSchema();
    const client = await db.getConnection();
    try {
        await client.beginTransaction();

        let s_no = parseInt(formData.s_no || formData.sNo, 10);
        if (!s_no || isNaN(s_no)) {
            s_no = await exports.generateNextPurchaseOrderSNo();
        }
        let inv_no = (formData.inv_no || formData.invNo || '').trim();
        if (!inv_no) {
            inv_no = `PO-${s_no}`;
        }
        try {
            const checkInv = await client.query('SELECT id FROM purchase_orders WHERE inv_no = ? LIMIT 1', [inv_no]);
            if (checkInv.rows && checkInv.rows.length > 0) {
                inv_no = `${inv_no}-${Date.now().toString().slice(-4)}`;
            }
        } catch (e) {}
        
        let supplier_id = formData.supplier_id || formData.supplierId || null;
        let supplier_name = formData.supplier_name || formData.supplierName || '';

        if (!supplier_id && supplier_name) {
            try {
                const sRes = await client.query('SELECT id FROM supplier_master WHERE LOWER(name) = LOWER(?)', [supplier_name]);
                if (sRes.rows && sRes.rows.length > 0) {
                    supplier_id = sRes.rows[0].id;
                }
            } catch (e) {}
        }

        const purchaseRequestReference = formData.purchase_request_id || formData.purchaseRequestId || formData.pr_id || null;
        let purchase_request_id = purchaseRequestReference && /^\d+$/.test(String(purchaseRequestReference))
            ? Number(purchaseRequestReference)
            : null;
        const pr_no = formData.pr_no || formData.prNo || null;

        if (purchaseRequestReference && purchase_request_id === null) {
            try {
                const prLookup = await client.query(
                    'SELECT id FROM purchase_requests WHERE pr_no = ? LIMIT 1',
                    [purchaseRequestReference]
                );
                if (prLookup.rows && prLookup.rows[0]) {
                    purchase_request_id = prLookup.rows[0].id;
                }
            } catch (e) {}
        }

        const purchaseOrderResult = await client.run(
            `INSERT INTO purchase_orders (
                s_no, supplier_id, supplier_name, date, inv_no, inv_date, po_date, godown_id, pay_type, tax_type, tax_rate, type, 
                terms, fob, ship_via, sign, address, sender, remarks, tax_percent, amount, bill_amt, tax_amt, total_amt,
                purchase_request_id, pr_no
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                s_no,
                supplier_id,
                supplier_name,
                formData.date,
                inv_no,
                formData.inv_date || formData.invDate || null,
                formData.po_date || formData.poDate || formData.date,
                formData.godown_id || formData.godownId || null,
                formData.pay_type || formData.payType || 'Cash',
                formData.tax_type || formData.taxType || 'Exclusive',
                parseFloat(formData.tax_rate || formData.taxRate || 0),
                formData.type || null,
                formData.terms || '',
                formData.fob || '',
                formData.ship_via || formData.shipVia || '',
                formData.sign || '',
                formData.address || '',
                formData.sender || '',
                formData.remarks || '',
                parseFloat(formData.tax_percent || formData.taxPercent || 0),
                parseFloat(formData.amount || 0),
                parseFloat(formData.bill_amt || formData.billAmt || 0),
                parseFloat(formData.tax_amt || formData.taxAmt || 0),
                parseFloat(formData.total_amt || formData.totAmt || 0),
                purchase_request_id,
                pr_no
            ]
        );
        const purchaseOrderId = purchaseOrderResult.lastID;

        // If linked to a purchase request, mark the PR as converted
        if (purchase_request_id) {
            try {
                await client.run(
                    `UPDATE purchase_requests 
                     SET converted_to_po_id = ?, po_no = ?, status = 'Converted', updated_at = CURRENT_TIMESTAMP 
                     WHERE id = ?`,
                    [purchaseOrderId, inv_no, purchase_request_id]
                );
            } catch (err) {
                console.error('Error updating purchase request status on PO creation:', err);
            }
        }

        for (const item of items) {
            let item_id = item.item_id || item.itemId || null;
            let item_name = item.item_name || item.itemName || '';

            if (!item_id && item_name) {
                try {
                    const iRes = await client.query('SELECT id FROM item_master WHERE LOWER(item_name) = LOWER(?)', [item_name]);
                    if (iRes.rows && iRes.rows.length > 0) {
                        item_id = iRes.rows[0].id;
                    }
                } catch (e) {}
            }

            await client.run(
                `INSERT INTO purchase_order_items (
                    purchase_order_id, item_id, item_name, qty, rate, amount, uom, weight_id, weight, tot_wt, discount_percent, tax_percent, ed_percent
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    purchaseOrderId, 
                    item_id,
                    item_name,
                    parseFloat(item.qty) || 0, 
                    parseFloat(item.rate || item.purc_rate) || 0, 
                    parseFloat(item.amount) || 0,
                    item.uom || '',
                    item.weight_id || item.weightId || null,
                    parseFloat(item.weight) || 0,
                    parseFloat(item.tot_wt || item.totWt) || 0,
                    parseFloat(item.discount_percent || item.discountPercent) || 0,
                    parseFloat(item.tax_percent || item.taxPercent) || 0,
                    parseFloat(item.ed_percent || item.edPercent) || 0
                ]
            );
        }

        if (Array.isArray(deductions)) {
            for (const ded of deductions) {
                if (!ded.deduction && !ded.deduction_name) continue;
                await client.run(
                    `INSERT INTO purchase_order_deductions (
                        purchase_order_id, deduction_name, type, value, amount, remarks
                     ) VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        purchaseOrderId,
                        ded.deduction || ded.deduction_name || '',
                        ded.type || 'less',
                        parseFloat(ded.percent || ded.value) || 0,
                        parseFloat(ded.amount) || 0,
                        ded.remarks || ''
                    ]
                );
            }
        }

        await client.commit();
        return { id: purchaseOrderId, s_no, inv_no, ...formData, items, deductions };
    } catch (error) {
        try { await client.rollback(); } catch (e) {}
        console.error('Error in createPurchaseOrder transaction:', error);
        throw error;
    } finally {
        if (client && typeof client.release === 'function') {
            try { client.release(); } catch (e) {}
        }
    }
};

exports.getAllPurchaseOrders = async () => {
    try {
        await ensurePurchaseOrderSchema();
        const purchaseOrdersRes = await db.query(`
            SELECT po.*, COALESCE(s.name, po.supplier_name) as supplier_name, g.godown_name,
                   COALESCE(po.pr_no, pr.pr_no) as pr_no
            FROM purchase_orders po
            LEFT JOIN supplier_master s ON CAST(po.supplier_id AS TEXT) = CAST(s.id AS TEXT)
            LEFT JOIN godown_master g ON CAST(po.godown_id AS TEXT) = CAST(g.id AS TEXT)
            LEFT JOIN purchase_requests pr ON CAST(po.purchase_request_id AS TEXT) = CAST(pr.id AS TEXT)
            ORDER BY po.date DESC, po.s_no DESC
        `);

        const rows = purchaseOrdersRes.rows || [];
        if (rows.length === 0) return [];

        let allItems = [];
        try {
            const itemsRes = await db.query(`
                SELECT poi.*, COALESCE(i.item_name, poi.item_name) as item_name
                FROM purchase_order_items poi
                LEFT JOIN item_master i ON CAST(poi.item_id AS TEXT) = CAST(i.id AS TEXT)
            `);
            allItems = itemsRes.rows || [];
        } catch (e) {}

        let allDeductions = [];
        try {
            const dedRes = await db.query('SELECT * FROM purchase_order_deductions');
            allDeductions = dedRes.rows || [];
        } catch (e) {}

        const itemsByPo = {};
        for (const item of allItems) {
            const poId = item.purchase_order_id;
            if (!itemsByPo[poId]) itemsByPo[poId] = [];
            itemsByPo[poId].push(item);
        }

        const dedsByPo = {};
        for (const ded of allDeductions) {
            const poId = ded.purchase_order_id;
            if (!dedsByPo[poId]) dedsByPo[poId] = [];
            dedsByPo[poId].push(ded);
        }

        return rows.map(po => {
            const items = itemsByPo[po.id] || [];
            const deductions = dedsByPo[po.id] || [];

            const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
            const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
            const mainItemName = items.length > 0 ? items.map(i => i.item_name).filter(Boolean).join(', ') : (po.type || '');
            const mainRate = items.length > 0 ? (items[0].rate || 0) : 0;
            const taxPct = po.tax_percent || po.tax_rate || (items.length > 0 ? items[0].tax_percent : 0) || 0;

            return {
                ...po,
                inv_no: po.inv_no || `PO-${po.s_no}`,
                item_name: mainItemName,
                qty: totalQty,
                rate: mainRate,
                amount: po.amount || totalAmount,
                tax_percent: taxPct,
                tax_amt: po.tax_amt || 0,
                total_amt: po.total_amt || po.bill_amt || (totalAmount + (po.tax_amt || 0)),
                items,
                deductions
            };
        });
    } catch (error) {
        console.error('Error fetching all Purchase Orders:', error);
        throw error;
    }
};

exports.getPurchaseOrderById = async (id) => {
    try {
        await ensurePurchaseOrderSchema();
        const purchaseOrderResult = await db.query(`
            SELECT po.*, COALESCE(s.name, po.supplier_name) as supplier_name, g.godown_name
            FROM purchase_orders po
            LEFT JOIN supplier_master s ON CAST(po.supplier_id AS TEXT) = CAST(s.id AS TEXT)
            LEFT JOIN godown_master g ON CAST(po.godown_id AS TEXT) = CAST(g.id AS TEXT)
            WHERE po.id = ?
        `, [id]);
        if (!purchaseOrderResult.rows || purchaseOrderResult.rows.length === 0) return null;

        const purchaseOrder = purchaseOrderResult.rows[0];
        let items = [];
        try {
            const itemsResult = await db.query(`
                SELECT poi.*, COALESCE(i.item_name, poi.item_name) as item_name
                FROM purchase_order_items poi
                LEFT JOIN item_master i ON CAST(poi.item_id AS TEXT) = CAST(i.id AS TEXT)
                WHERE poi.purchase_order_id = ?
            `, [id]);
            items = itemsResult.rows || [];
        } catch (e) {}

        let deductions = [];
        try {
            const dedResult = await db.query(`
                SELECT * FROM purchase_order_deductions WHERE purchase_order_id = ?
            `, [id]);
            deductions = dedResult.rows || [];
        } catch (e) {}

        return { 
            ...purchaseOrder, 
            items,
            deductions
        };
    } catch (error) {
        console.error('Error fetching Purchase Order by ID:', error);
        throw error;
    }
};

exports.updatePurchaseOrder = async (id, formData, items = [], deductions = []) => {
    await ensurePurchaseOrderSchema();
    const client = await db.getConnection();
    try {
        await client.beginTransaction();

        const s_no = formData.s_no || formData.sNo;
        const inv_no = formData.inv_no || formData.invNo || `PO-${s_no}`;

        let supplier_id = formData.supplier_id || formData.supplierId || null;
        let supplier_name = formData.supplier_name || formData.supplierName || '';

        if (!supplier_id && supplier_name) {
            try {
                const sRes = await client.query('SELECT id FROM supplier_master WHERE LOWER(name) = LOWER(?)', [supplier_name]);
                if (sRes.rows && sRes.rows.length > 0) {
                    supplier_id = sRes.rows[0].id;
                }
            } catch (e) {}
        }

        const purchaseRequestReference = formData.purchase_request_id || formData.purchaseRequestId || formData.pr_id || null;
        let purchase_request_id = purchaseRequestReference && /^\d+$/.test(String(purchaseRequestReference))
            ? Number(purchaseRequestReference)
            : null;
        const pr_no = formData.pr_no || formData.prNo || null;

        if (purchaseRequestReference && purchase_request_id === null) {
            try {
                const prLookup = await client.query(
                    'SELECT id FROM purchase_requests WHERE pr_no = ? LIMIT 1',
                    [purchaseRequestReference]
                );
                if (prLookup.rows && prLookup.rows[0]) {
                    purchase_request_id = prLookup.rows[0].id;
                }
            } catch (e) {}
        }

        const updateResult = await client.run(
            `UPDATE purchase_orders SET
                s_no = ?, supplier_id = ?, supplier_name = ?, date = ?, inv_no = ?, inv_date = ?, po_date = ?, godown_id = ?, pay_type = ?,
                tax_type = ?, tax_rate = ?, type = ?, terms = ?, fob = ?, ship_via = ?, sign = ?, address = ?, sender = ?, 
                remarks = ?, tax_percent = ?, amount = ?, bill_amt = ?, tax_amt = ?, total_amt = ?,
                purchase_request_id = ?, pr_no = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                s_no, 
                supplier_id,
                supplier_name,
                formData.date, 
                inv_no, 
                formData.inv_date || formData.invDate || null,
                formData.po_date || formData.poDate || formData.date,
                formData.godown_id || formData.godownId || null, 
                formData.pay_type || formData.payType || 'Cash', 
                formData.tax_type || formData.taxType || 'Exclusive', 
                parseFloat(formData.tax_rate || formData.taxRate || 0), 
                formData.type || null, 
                formData.terms || '', 
                formData.fob || '', 
                formData.ship_via || formData.shipVia || '', 
                formData.sign || '', 
                formData.address || '', 
                formData.sender || '', 
                formData.remarks || '', 
                parseFloat(formData.tax_percent || formData.taxPercent || 0),
                parseFloat(formData.amount || 0),
                parseFloat(formData.bill_amt || formData.billAmt || 0),
                parseFloat(formData.tax_amt || formData.taxAmt || 0),
                parseFloat(formData.total_amt || formData.totAmt || 0),
                purchase_request_id,
                pr_no,
                id
            ]
        );

        if (updateResult.changes === 0) {
            try { await client.rollback(); } catch (e) {}
            return null;
        }

        await client.run('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [id]);

        for (const item of items) {
            let item_id = item.item_id || item.itemId || null;
            let item_name = item.item_name || item.itemName || '';

            if (!item_id && item_name) {
                try {
                    const iRes = await client.query('SELECT id FROM item_master WHERE LOWER(item_name) = LOWER(?)', [item_name]);
                    if (iRes.rows && iRes.rows.length > 0) {
                        item_id = iRes.rows[0].id;
                    }
                } catch (e) {}
            }

            await client.run(
                `INSERT INTO purchase_order_items (
                    purchase_order_id, item_id, item_name, qty, rate, amount, uom, weight_id, weight, tot_wt, discount_percent, tax_percent, ed_percent
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, 
                    item_id,
                    item_name,
                    parseFloat(item.qty) || 0, 
                    parseFloat(item.rate || item.purc_rate) || 0, 
                    parseFloat(item.amount) || 0,
                    item.uom || '',
                    item.weight_id || item.weightId || null,
                    parseFloat(item.weight) || 0,
                    parseFloat(item.tot_wt || item.totWt) || 0,
                    parseFloat(item.discount_percent || item.discountPercent) || 0,
                    parseFloat(item.tax_percent || item.taxPercent) || 0,
                    parseFloat(item.ed_percent || item.edPercent) || 0
                ]
            );
        }

        try {
            await client.run('DELETE FROM purchase_order_deductions WHERE purchase_order_id = ?', [id]);
        } catch (e) {}

        if (Array.isArray(deductions)) {
            for (const ded of deductions) {
                if (!ded.deduction && !ded.deduction_name) continue;
                await client.run(
                    `INSERT INTO purchase_order_deductions (
                        purchase_order_id, deduction_name, type, value, amount, remarks
                     ) VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        id,
                        ded.deduction || ded.deduction_name || '',
                        ded.type || 'less',
                        parseFloat(ded.percent || ded.value) || 0,
                        parseFloat(ded.amount) || 0,
                        ded.remarks || ''
                    ]
                );
            }
        }

        await client.commit();
        return { id, ...formData, items, deductions };
    } catch (error) {
        try { await client.rollback(); } catch (e) {}
        console.error('Error in updatePurchaseOrder transaction:', error);
        throw error;
    } finally {
        if (client && typeof client.release === 'function') {
            try { client.release(); } catch (e) {}
        }
    }
};

exports.deletePurchaseOrder = async (id) => {
    try {
        await db.run('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [id]);
        try {
            await db.run('DELETE FROM purchase_order_deductions WHERE purchase_order_id = ?', [id]);
        } catch (e) {}
        const result = await db.run('DELETE FROM purchase_orders WHERE id = ?', [id]);
        return result.changes > 0;
    } catch (error) {
        console.error('Error deleting Purchase Order:', error);
        throw error;
    }
};
