const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET Executive BI Center KPI Metrics & Comprehensive Analytics
router.get('/dashboard', async (req, res) => {
  try {
    let totalSales = 0;
    let totalPurchases = 0;
    let stockValue = 0;
    let totalStockKg = 0;
    let quarantineStockKg = 0;
    let inputKg = 0;
    let outputKg = 0;

    try {
      const salesAgg = await db.query(`
        SELECT 
          COALESCE(SUM(COALESCE(grand_total, total_amt, 0)), 0) as total_sales,
          COALESCE(COUNT(*), 0) as sales_count
        FROM sales
      `);
      if (salesAgg.rows && salesAgg.rows[0]) {
        totalSales = parseFloat(salesAgg.rows[0].total_sales || 0);
      }
    } catch (e) {
      console.warn('Could not query sales metrics for BI:', e.message);
    }

    try {
      const purAgg = await db.query(`
        SELECT 
          COALESCE(SUM(COALESCE(grand_total, net_amount, total_amount, 0)), 0) as total_purchases,
          COALESCE(COUNT(*), 0) as purchase_count
        FROM purchases
      `);
      if (purAgg.rows && purAgg.rows[0]) {
        totalPurchases = parseFloat(purAgg.rows[0].total_purchases || 0);
      }
    } catch (e) {
      console.warn('Could not query purchase metrics for BI:', e.message);
    }

    try {
      const stockAgg = await db.query(`
        SELECT 
          COALESCE(SUM(remaining_quantity * COALESCE(rate, 45)), 0) as stock_value,
          COALESCE(SUM(remaining_quantity), 0) as total_stock_kg,
          COALESCE(SUM(CASE WHEN qc_status = 'QUARANTINE' OR qc_status = 'HOLD' THEN remaining_quantity ELSE 0 END), 0) as quarantine_stock_kg
        FROM stock_lots
      `);
      if (stockAgg.rows && stockAgg.rows[0]) {
        stockValue = parseFloat(stockAgg.rows[0].stock_value || 0);
        totalStockKg = parseFloat(stockAgg.rows[0].total_stock_kg || 0);
        quarantineStockKg = parseFloat(stockAgg.rows[0].quarantine_stock_kg || 0);
      }
    } catch (e) {
      console.warn('Could not query stock_lots metrics for BI:', e.message);
    }

    try {
      const prodAgg = await db.query(`
        SELECT 
          COALESCE((SELECT SUM(COALESCE(total_wt, qty * 50)) FROM grain_input_items), 0) as input_kg,
          COALESCE((SELECT SUM(COALESCE(total_wt, qty * 50)) FROM grain_output_items), 0) as output_kg
      `);
      if (prodAgg.rows && prodAgg.rows[0]) {
        inputKg = parseFloat(prodAgg.rows[0].input_kg || 0);
        outputKg = parseFloat(prodAgg.rows[0].output_kg || 0);
      }
    } catch (e) {
      console.warn('Could not query production metrics for BI:', e.message);
    }

    let qcIssuesCount = 0;
    try {
      const qcRes = await db.query(`SELECT COUNT(*) as cnt FROM qc_inspections WHERE overall_result = 'REJECTED' OR overall_result = 'HOLD'`);
      qcIssuesCount = parseInt(qcRes.rows?.[0]?.cnt || 0, 10);
    } catch (e) {}

    const avgYield = inputKg > 0 ? ((outputKg / inputKg) * 100).toFixed(1) : 0;
    const processingCost = totalPurchases * 0.08;
    const grossMargin = totalSales > 0 ? (totalSales - (totalPurchases + processingCost)) : 0;
    const marginPct = totalSales > 0 ? ((grossMargin / totalSales) * 100).toFixed(1) : 0;

    const kpis = {
      revenue: totalSales,
      purchases: totalPurchases,
      grossMargin: Math.round(grossMargin),
      marginPct: parseFloat(marginPct),
      stockValue,
      totalStockKg,
      quarantineStockKg,
      receivables: 0,
      payables: 0,
      productionInputKg: inputKg,
      productionOutputKg: outputKg,
      yieldPct: parseFloat(avgYield),
      qcIssuesCount,
      inventoryTurnover: stockValue > 0 ? Number((totalPurchases / stockValue).toFixed(1)) : 0
    };

    res.json({ success: true, kpis });
  } catch (err) {
    console.error('Error in BI dashboard:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Purchase Analytics & Supplier Performance
router.get('/purchase-analytics', async (req, res) => {
  try {
    let suppMap = {};
    try {
      const suppMasterRes = await db.query('SELECT id, name, print_name FROM supplier_master');
      (suppMasterRes.rows || []).forEach(s => {
        let display = (s.name || s.print_name || '').trim();
        if (s.id) suppMap[String(s.id)] = display;
        if (s.name) suppMap[String(s.name).toLowerCase().trim()] = display;
        if (s.print_name) suppMap[String(s.print_name).toLowerCase().trim()] = display;
      });
    } catch (e) {
      console.warn('Could not query supplier_master for BI:', e.message);
    }

    let suppliers = [];
    try {
      const purchasesRes = await db.query(`
        SELECT 
          p.id,
          p.supplier,
          COALESCE(s.name, s.print_name, '') as s_name,
          COALESCE(p.grand_total, p.net_amount, p.total_amount, 0) as amount
        FROM purchases p
        LEFT JOIN supplier_master s ON (
          CAST(s.id AS TEXT) = CAST(p.supplier AS TEXT) 
          OR LOWER(TRIM(s.name)) = LOWER(TRIM(CAST(p.supplier AS TEXT))) 
          OR LOWER(TRIM(s.print_name)) = LOWER(TRIM(CAST(p.supplier AS TEXT)))
        )
      `);

      if (purchasesRes.rows && purchasesRes.rows.length > 0) {
        const supplierAgg = {};
        purchasesRes.rows.forEach(p => {
          let rawSupp = String(p.s_name || p.supplier || '').trim();
          let suppName = suppMap[rawSupp] || suppMap[rawSupp.toLowerCase()] || rawSupp;
          if (!suppName || suppName === 'undefined' || suppName === 'null') {
            suppName = `Supplier #${p.supplier || '1'}`;
          }

          if (!supplierAgg[suppName]) {
            supplierAgg[suppName] = {
              supplier: suppName,
              spend: 0,
              orders: 0,
              qualityScore: 95.0,
              deliveryPerformance: '100%',
              returnPct: '0%'
            };
          }
          supplierAgg[suppName].spend += parseFloat(p.amount || 0);
          supplierAgg[suppName].orders += 1;
        });

        suppliers = Object.values(supplierAgg);
      }
    } catch (e) {
      console.warn('Could not query purchases for supplier breakdown:', e.message);
    }

    suppliers.sort((a, b) => b.spend - a.spend);

    let itemTrends = [];
    try {
      const itemPurchaseTrend = await db.query(`
        SELECT 
          COALESCE(item_name, 'Raw Grain') as item_name,
          SUM(COALESCE(amount, 0)) as total_val,
          COUNT(*) as tx_count
        FROM purchase_items
        GROUP BY item_name
        ORDER BY total_val DESC
      `);
      itemTrends = itemPurchaseTrend.rows || [];
    } catch (e) {
      console.warn('Could not query itemPurchaseTrend:', e.message);
    }

    res.json({
      success: true,
      suppliers,
      itemTrends
    });
  } catch (err) {
    console.error('Error in purchase-analytics:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Production Analytics
router.get('/production-analytics', async (req, res) => {
  try {
    let batches = [];
    try {
      const batchesRes = await db.query(`
        SELECT 
          g.id, 
          SUBSTR(COALESCE(CAST(g.date AS TEXT), CAST(g.created_at AS TEXT), ''), 1, 10) as date, 
          COALESCE((SELECT SUM(gi.total_wt) FROM grain_input_items gi WHERE gi.grain_id = g.id), 0) as input_kg,
          COALESCE((SELECT SUM(go.total_wt) FROM grain_output_items go WHERE go.grain_id = g.id), 0) as output_kg,
          g.remarks
        FROM grains g
        ORDER BY g.id DESC
        LIMIT 15
      `);
      batches = batchesRes.rows || [];
    } catch (e) {
      console.warn('Could not query batches for production-analytics:', e.message);
    }

    let monthlyTrends = [];
    try {
      const monthlyRes = await db.query(`
        SELECT 
          SUBSTR(COALESCE(CAST(g.date AS TEXT), CAST(g.created_at AS TEXT), ''), 1, 7) as month,
          SUM(COALESCE((SELECT SUM(gi.total_wt) FROM grain_input_items gi WHERE gi.grain_id = g.id), 0)) as inputKg,
          SUM(COALESCE((SELECT SUM(go.total_wt) FROM grain_output_items go WHERE go.grain_id = g.id), 0)) as outputKg
        FROM grains g
        GROUP BY SUBSTR(COALESCE(CAST(g.date AS TEXT), CAST(g.created_at AS TEXT), ''), 1, 7)
        ORDER BY month DESC
        LIMIT 6
      `);
      monthlyTrends = (monthlyRes.rows || []).map(r => {
        const inp = parseFloat(r.inputKg || 0);
        const out = parseFloat(r.outputKg || 0);
        const yld = inp > 0 ? Number(((out / inp) * 100).toFixed(1)) : 0;
        return {
          month: r.month || 'Current',
          inputKg: inp,
          outputKg: out,
          yieldPct: yld,
          wastagePct: inp > out ? Number((((inp - out) / inp) * 100).toFixed(1)) : 0,
          costPerKg: 0
        };
      });
    } catch (e) {}

    res.json({
      success: true,
      batches,
      monthlyTrends
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Margin & Cost Intelligence
router.get('/margin-intelligence', async (req, res) => {
  try {
    let products = [];
    try {
      const itemsRes = await db.query(`
        SELECT DISTINCT item_name FROM items WHERE status = 'Active' OR status = '1'
        UNION
        SELECT DISTINCT item_name FROM purchase_items
      `);
      products = (itemsRes.rows || []).map(row => ({
        product: row.item_name,
        purchaseCost: 0,
        processingCost: 0,
        jobworkCost: 0,
        packingCost: 0,
        freightCost: 0,
        totalCost: 0,
        sellingPrice: 0,
        margin: 0,
        marginPct: 0
      }));
    } catch (e) {}

    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
