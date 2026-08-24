// Backend service for handling purchase orders using SQLite DbConnection wrapper
const db = require('../config/database');

exports.generateNextPurchaseOrderSNo = async () => {
    try {
        const result = await db.query('SELECT COALESCE(MAX(s_no), 0) + 1 AS next_sno FROM purchase_orders');
        return result.rows[0]?.next_sno || 1;
    } catch (error) {
        console.error('Error generating next Purchase Order S.No:', error);
        throw error;
    }
};

exports.createPurchaseOrder = async (formData, items = [], deductions = []) => {
    const client = await db.getConnection();
    try {
        await client.beginTransaction();

        const s_no = formData.s_no || formData.sNo || await exports.generateNextPurchaseOrderSNo();
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

        const purchase_request_id = formData.purchase_request_id || formData.purchaseRequestId || formData.pr_id || null;
        const pr_no = formData.pr_no || formData.prNo || null;

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
                    `INSERT INTO purchase_deductions (
                        purchase_id, deduction_name, type, value, amount, remarks
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
    }
};

exports.getAllPurchaseOrders = async () => {
    try {
        const purchaseOrdersRes = await db.query(`
            SELECT po.*, COALESCE(s.name, po.supplier_name) as supplier_name, g.godown_name,
                   COALESCE(po.pr_no, pr.pr_no) as pr_no
            FROM purchase_orders po
            LEFT JOIN supplier_master s ON po.supplier_id = s.id
            LEFT JOIN godown_master g ON po.godown_id = g.id
            LEFT JOIN purchase_requests pr ON po.purchase_request_id = pr.id
            ORDER BY po.date DESC, po.s_no DESC
        `);

        const purchaseOrders = [];
        for (const po of (purchaseOrdersRes.rows || [])) {
            const itemsRes = await db.query(`
                SELECT poi.*, COALESCE(i.item_name, poi.item_name) as item_name
                FROM purchase_order_items poi
                LEFT JOIN item_master i ON poi.item_id = i.id
                WHERE poi.purchase_order_id = ?
            `, [po.id]);

            const dedRes = await db.query(`
                SELECT * FROM purchase_deductions WHERE purchase_id = ?
            `, [po.id]);

            const items = itemsRes.rows || [];
            const deductions = dedRes.rows || [];

            const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
            const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
            const mainItemName = items.length > 0 ? items.map(i => i.item_name).filter(Boolean).join(', ') : (po.type || '');
            const mainRate = items.length > 0 ? (items[0].rate || 0) : 0;
            const taxPct = po.tax_percent || po.tax_rate || (items.length > 0 ? items[0].tax_percent : 0) || 0;

            purchaseOrders.push({
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
            });
        }

        return purchaseOrders;
    } catch (error) {
        console.error('Error fetching all Purchase Orders:', error);
        throw error;
    }
};

exports.getPurchaseOrderById = async (id) => {
    try {
        const purchaseOrderResult = await db.query(`
            SELECT po.*, COALESCE(s.name, po.supplier_name) as supplier_name, g.godown_name
            FROM purchase_orders po
            LEFT JOIN supplier_master s ON po.supplier_id = s.id
            LEFT JOIN godown_master g ON po.godown_id = g.id
            WHERE po.id = ?
        `, [id]);
        if (!purchaseOrderResult.rows || purchaseOrderResult.rows.length === 0) return null;

        const purchaseOrder = purchaseOrderResult.rows[0];
        const itemsResult = await db.query(`
            SELECT poi.*, COALESCE(i.item_name, poi.item_name) as item_name
            FROM purchase_order_items poi
            LEFT JOIN item_master i ON poi.item_id = i.id
            WHERE poi.purchase_order_id = ?
        `, [id]);

        const dedResult = await db.query(`
            SELECT * FROM purchase_deductions WHERE purchase_id = ?
        `, [id]);

        return { 
            ...purchaseOrder, 
            items: itemsResult.rows || [],
            deductions: dedResult.rows || []
        };
    } catch (error) {
        console.error('Error fetching Purchase Order by ID:', error);
        throw error;
    }
};

exports.updatePurchaseOrder = async (id, formData, items = [], deductions = []) => {
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

        const purchase_request_id = formData.purchase_request_id || formData.purchaseRequestId || formData.pr_id || null;
        const pr_no = formData.pr_no || formData.prNo || null;

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
                id,
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

        await client.run('DELETE FROM purchase_deductions WHERE purchase_id = ?', [id]);

        if (Array.isArray(deductions)) {
            for (const ded of deductions) {
                if (!ded.deduction && !ded.deduction_name) continue;
                await client.run(
                    `INSERT INTO purchase_deductions (
                        purchase_id, deduction_name, type, value, amount, remarks
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
    }
};

exports.deletePurchaseOrder = async (id) => {
    try {
        await db.run('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [id]);
        await db.run('DELETE FROM purchase_deductions WHERE purchase_id = ?', [id]);
        const result = await db.run('DELETE FROM purchase_orders WHERE id = ?', [id]);
        return result.changes > 0;
    } catch (error) {
        console.error('Error deleting Purchase Order:', error);
        throw error;
    }
};

