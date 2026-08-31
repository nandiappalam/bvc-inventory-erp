const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET /api/dashboard/stats
 * Fetches real-time application metrics for Dashboard
 */
router.get('/stats', async (req, res) => {
  try {
    // 1. Total Purchases
    let pRes = { rows: [{ count: 0, total_qty: 0, total_weight: 0, total_amount: 0 }] };
    try {
      pRes = await db.query(`
        SELECT 
          COUNT(*) as count, 
          COALESCE(SUM(total_qty), 0) as total_qty,
          COALESCE(SUM(total_weight), 0) as total_weight,
          COALESCE(SUM(COALESCE(grand_total, total_amount, amount, 0)), 0) as total_amount
        FROM purchases
      `);
    } catch (e) {
      try {
        pRes = await db.query(`SELECT COUNT(*) as count, 0 as total_qty, 0 as total_weight, 0 as total_amount FROM purchases`);
      } catch (e2) {}
    }

    // 2. Total Sales
    let sRes = { rows: [{ count: 0, total_qty: 0, total_weight: 0, total_amount: 0 }] };
    try {
      sRes = await db.query(`
        SELECT 
          COUNT(*) as count, 
          COALESCE(SUM(total_qty), 0) as total_qty,
          COALESCE(SUM(total_wt), 0) as total_weight,
          COALESCE(SUM(COALESCE(grand_total, total_amt, 0)), 0) as total_amount
        FROM sales
      `);
    } catch (e) {
      try {
        sRes = await db.query(`SELECT COUNT(*) as count, 0 as total_qty, 0 as total_weight, 0 as total_amount FROM sales`);
      } catch (e2) {}
    }

    // 3. Total Returns (Purchase Returns + Sales Returns + Flour Out Returns + Papad Returns)
    let prRes = { rows: [{ count: 0, total_qty: 0, total_weight: 0, total_amount: 0 }] };
    try {
      prRes = await db.query(`
        SELECT 
          COUNT(*) as count, 
          COALESCE(SUM(total_qty), 0) as total_qty,
          COALESCE(SUM(total_weight), 0) as total_weight,
          COALESCE(SUM(COALESCE(grand_total, total_amount, 0)), 0) as total_amount
        FROM purchase_returns
      `);
    } catch (e) {
      try {
        prRes = await db.query(`SELECT COUNT(*) as count, 0 as total_qty, 0 as total_weight, 0 as total_amount FROM purchase_returns`);
      } catch (e2) {}
    }

    let srRes = { rows: [{ count: 0, total_qty: 0, total_weight: 0, total_amount: 0 }] };
    try {
      srRes = await db.query(`
        SELECT 
          COUNT(*) as count, 
          COALESCE(SUM(total_qty), 0) as total_qty,
          COALESCE(SUM(total_wt), 0) as total_weight,
          COALESCE(SUM(COALESCE(grand_total, total_amt, 0)), 0) as total_amount
        FROM sales_return
      `);
    } catch (e) {}

    let forRes = { rows: [{ count: 0, total_qty: 0, total_weight: 0 }] };
    try {
      forRes = await db.query(`
        SELECT 
          COUNT(*) as count, 
          COALESCE(SUM(total_qty), 0) as total_qty,
          COALESCE(SUM(total_weight), 0) as total_weight
        FROM flour_out_returns
      `);
    } catch (e) {}

    let papadRetCount = 0;
    try {
      const papadRes = await db.query(`SELECT COUNT(*) as count FROM papad_return`);
      papadRetCount = papadRes.rows[0]?.count || 0;
    } catch (e) {}

    const totalReturnsCount = (prRes.rows[0]?.count || 0) + (srRes.rows[0]?.count || 0) + (forRes.rows[0]?.count || 0) + papadRetCount;
    const totalReturnsQty = (prRes.rows[0]?.total_qty || 0) + (srRes.rows[0]?.total_qty || 0) + (forRes.rows[0]?.total_qty || 0);
    const totalReturnsWeight = (prRes.rows[0]?.total_weight || 0) + (srRes.rows[0]?.total_weight || 0) + (forRes.rows[0]?.total_weight || 0);
    const totalReturnsAmount = (prRes.rows[0]?.total_amount || 0) + (srRes.rows[0]?.total_amount || 0);

    // 4. Total Grains (Grinding / Processing)
    let gCount = 0;
    let giWeight = 0;
    let giQty = 0;
    let goWeight = 0;
    let goQty = 0;
    try {
      const gCountRes = await db.query(`SELECT COUNT(*) as count FROM grains`);
      gCount = gCountRes.rows[0]?.count || 0;
    } catch (e) {}

    try {
      const giRes = await db.query(`
        SELECT 
          COALESCE(SUM(COALESCE(total_wt, weight * qty, 0)), 0) as total_weight,
          COALESCE(SUM(qty), 0) as total_qty
        FROM grain_input_items
      `);
      giWeight = giRes.rows[0]?.total_weight || 0;
      giQty = giRes.rows[0]?.total_qty || 0;
    } catch (e) {}

    try {
      const goRes = await db.query(`
        SELECT 
          COALESCE(SUM(COALESCE(total_wt, weight * qty, 0)), 0) as total_weight,
          COALESCE(SUM(qty), 0) as total_qty
        FROM grain_output_items
      `);
      goWeight = goRes.rows[0]?.total_weight || 0;
      goQty = goRes.rows[0]?.total_qty || 0;
    } catch (e) {}

    // 5. Flour Out
    let foCount = 0;
    let foQty = 0;
    let foWeight = 0;
    try {
      const foRes = await db.query(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(total_qty), 0) as total_qty,
          COALESCE(SUM(COALESCE(total_weight, 0)), 0) as total_weight
        FROM flour_out
      `);
      foCount = foRes.rows[0]?.count || 0;
      foQty = foRes.rows[0]?.total_qty || 0;
      foWeight = foRes.rows[0]?.total_weight || 0;
    } catch (e) {}

    // 6. Pending Purchase Requests
    let pendingPRs = 0;
    try {
      const prsRes = await db.query(`
        SELECT COUNT(*) as count FROM purchase_requests WHERE UPPER(COALESCE(status, 'PENDING')) = 'PENDING'
      `);
      pendingPRs = prsRes.rows[0]?.count || 0;
    } catch (e) {}

    // 7. Stock Lots Overview
    let stockSummary = { total_lots: 0, total_qty: 0, total_weight: 0 };
    try {
      const slRes = await db.query(`
        SELECT 
          COUNT(DISTINCT lot_no) as total_lots,
          COALESCE(SUM(remaining_quantity), 0) as total_qty
        FROM stock_lots
        WHERE COALESCE(remaining_quantity, quantity, 0) > 0
          AND (unloading_status IS NULL OR unloading_status != 'RETURNED')
      `);
      stockSummary.total_lots = slRes.rows[0]?.total_lots || 0;
      stockSummary.total_qty = slRes.rows[0]?.total_qty || 0;
    } catch (e) {}

    // 8. Monthly Trends for Charts (Past 6 Months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        key: ym,
        label: monthNames[d.getMonth()] + (d.getFullYear() !== now.getFullYear() ? ` '${String(d.getFullYear()).slice(2)}` : ''),
        purchasesCount: 0,
        purchasesAmount: 0,
        purchasesQty: 0,
        salesCount: 0,
        salesAmount: 0,
        salesQty: 0,
        returnsCount: 0,
        returnsAmount: 0,
        grainsWeight: 0,
        flourOutWeight: 0
      });
    }

    try {
      const pMonthly = await db.query(`
        SELECT strftime('%Y-%m', date) as ym, COUNT(*) as count, SUM(COALESCE(grand_total, total_amount, 0)) as amount, SUM(total_qty) as qty 
        FROM purchases 
        WHERE date IS NOT NULL
        GROUP BY ym
      `);
      for (const row of pMonthly.rows) {
        const m = months.find(item => item.key === row.ym);
        if (m) {
          m.purchasesCount = row.count || 0;
          m.purchasesAmount = row.amount || 0;
          m.purchasesQty = row.qty || 0;
        }
      }

      const sMonthly = await db.query(`
        SELECT strftime('%Y-%m', date) as ym, COUNT(*) as count, SUM(COALESCE(grand_total, total_amt, 0)) as amount, SUM(total_qty) as qty 
        FROM sales 
        WHERE date IS NOT NULL
        GROUP BY ym
      `);
      for (const row of sMonthly.rows) {
        const m = months.find(item => item.key === row.ym);
        if (m) {
          m.salesCount = row.count || 0;
          m.salesAmount = row.amount || 0;
          m.salesQty = row.qty || 0;
        }
      }

      const prMonthly = await db.query(`
        SELECT strftime('%Y-%m', date) as ym, COUNT(*) as count, SUM(COALESCE(grand_total, total_amount, 0)) as amount 
        FROM purchase_returns 
        WHERE date IS NOT NULL
        GROUP BY ym
      `);
      for (const row of prMonthly.rows) {
        const m = months.find(item => item.key === row.ym);
        if (m) {
          m.returnsCount += row.count || 0;
          m.returnsAmount += row.amount || 0;
        }
      }

      const srMonthly = await db.query(`
        SELECT strftime('%Y-%m', date) as ym, COUNT(*) as count, SUM(COALESCE(total_amt, 0)) as amount 
        FROM sales_return 
        WHERE date IS NOT NULL
        GROUP BY ym
      `);
      for (const row of srMonthly.rows) {
        const m = months.find(item => item.key === row.ym);
        if (m) {
          m.returnsCount += row.count || 0;
          m.returnsAmount += row.amount || 0;
        }
      }

      const gMonthly = await db.query(`
        SELECT strftime('%Y-%m', g.date) as ym, 
          COALESCE(SUM(COALESCE(gi.total_wt, gi.weight * gi.qty, 0)), 0) as weight
        FROM grains g
        LEFT JOIN grain_input_items gi ON gi.grain_id = g.id
        WHERE g.date IS NOT NULL
        GROUP BY ym
      `);
      for (const row of gMonthly.rows) {
        const m = months.find(item => item.key === row.ym);
        if (m) {
          m.grainsWeight = row.weight || 0;
        }
      }

      const foMonthly = await db.query(`
        SELECT strftime('%Y-%m', fo.date) as ym, 
          COALESCE(SUM(COALESCE(fo.total_weight, (SELECT SUM(total_wt) FROM flour_out_items WHERE flour_out_items.flour_out_id = fo.id), 0)), 0) as weight
        FROM flour_out fo
        WHERE fo.date IS NOT NULL
        GROUP BY ym
      `);
      for (const row of foMonthly.rows) {
        const m = months.find(item => item.key === row.ym);
        if (m) {
          m.flourOutWeight = row.weight || 0;
        }
      }
    } catch (e) {
      console.error('Error fetching monthly stats:', e);
    }

    // 9. Recent Activities (Real-time live transactions with supplier/customer names)
    const activities = [];
    try {
      const pRecent = await db.query(`
        SELECT p.id, p.s_no, p.date, p.created_at, COALESCE(p.grand_total, p.total_amount, 0) as amount,
          COALESCE(sm.name, p.supplier, 'Supplier') as party_name
        FROM purchases p
        LEFT JOIN supplier_master sm ON (sm.id = p.supplier OR sm.name = p.supplier)
        ORDER BY p.id DESC LIMIT 4
      `);
      for (const r of pRecent.rows) {
        activities.push({
          id: `P-${r.id}`,
          action: `Purchase Invoice #${r.s_no || r.id} received from ${r.party_name}`,
          time: r.created_at || r.date || 'Recently',
          timestamp: new Date(r.created_at || r.date || Date.now()).getTime(),
          type: 'Purchase',
          amount: parseFloat(r.amount) || 0
        });
      }

      const sRecent = await db.query(`
        SELECT s.id, s.s_no, s.date, s.created_at, COALESCE(s.grand_total, s.total_amt, 0) as amount,
          COALESCE(cm.name, s.customer, 'Customer') as party_name
        FROM sales s
        LEFT JOIN customer_master cm ON (cm.id = s.customer OR cm.name = s.customer)
        ORDER BY s.id DESC LIMIT 4
      `);
      for (const r of sRecent.rows) {
        activities.push({
          id: `S-${r.id}`,
          action: `Sales Invoice #${r.s_no || r.id} dispatched to ${r.party_name}`,
          time: r.created_at || r.date || 'Recently',
          timestamp: new Date(r.created_at || r.date || Date.now()).getTime(),
          type: 'Sales',
          amount: parseFloat(r.amount) || 0
        });
      }

      const gRecent = await db.query(`
        SELECT g.id, g.s_no, g.date, g.created_at,
          COALESCE(fm.flourmill, fm.print_name, g.flour_mill, 'Mill') as mill_name,
          (SELECT SUM(COALESCE(total_wt, weight * qty, 0)) FROM grain_input_items WHERE grain_id = g.id) as total_kg
        FROM grains g
        LEFT JOIN flour_mill_master fm ON (fm.id = g.flour_mill OR fm.flourmill = g.flour_mill)
        ORDER BY g.id DESC LIMIT 3
      `);
      for (const r of gRecent.rows) {
        const kgText = r.total_kg ? ` (${r.total_kg} kg)` : '';
        activities.push({
          id: `G-${r.id}`,
          action: `Grains grinding batch #${r.s_no || r.id} processed at ${r.mill_name}${kgText}`,
          time: r.created_at || r.date || 'Recently',
          timestamp: new Date(r.created_at || r.date || Date.now()).getTime(),
          type: 'Grind',
          amount: 0
        });
      }

      const foRecent = await db.query(`
        SELECT fo.id, fo.s_no, fo.date, fo.created_at, fo.total_qty, fo.total_weight,
          COALESCE(pcm.name, fo.papad_company, 'Papad Company') as company_name
        FROM flour_out fo
        LEFT JOIN papad_company_master pcm ON (pcm.id = fo.papad_company OR pcm.name = fo.papad_company)
        ORDER BY fo.id DESC LIMIT 3
      `);
      for (const r of foRecent.rows) {
        const wtText = r.total_weight ? ` (${r.total_weight} kg)` : '';
        activities.push({
          id: `FO-${r.id}`,
          action: `Flour Out batch #${r.s_no || r.id} dispatched to ${r.company_name}${wtText}`,
          time: r.created_at || r.date || 'Recently',
          timestamp: new Date(r.created_at || r.date || Date.now()).getTime(),
          type: 'Flour Out',
          amount: 0
        });
      }

      // Check user activities table as well
      const uActivities = await db.query(`
        SELECT id, user_name, activity_type, remarks, created_at 
        FROM user_activities 
        ORDER BY id DESC LIMIT 4
      `);
      for (const ua of uActivities.rows) {
        activities.push({
          id: `UA-${ua.id}`,
          action: ua.remarks || `${ua.activity_type} performed by ${ua.user_name}`,
          time: ua.created_at || 'Recently',
          timestamp: new Date(ua.created_at || Date.now()).getTime(),
          type: ua.activity_type || 'Activity',
          amount: 0
        });
      }
    } catch (e) {
      console.error('Error fetching recent activities:', e);
    }

    // Sort activities by timestamp descending
    activities.sort((a, b) => b.timestamp - a.timestamp);

    res.json({
      success: true,
      stats: {
        totalPurchases: pRes.rows[0]?.count || 0,
        totalPurchasesQty: pRes.rows[0]?.total_qty || 0,
        totalPurchasesWeight: pRes.rows[0]?.total_weight || 0,
        totalPurchasesAmount: pRes.rows[0]?.total_amount || 0,

        totalSales: sRes.rows[0]?.count || 0,
        totalSalesQty: sRes.rows[0]?.total_qty || 0,
        totalSalesWeight: sRes.rows[0]?.total_weight || 0,
        totalSalesAmount: sRes.rows[0]?.total_amount || 0,

        totalReturns: totalReturnsCount,
        totalReturnsQty,
        totalReturnsWeight,
        totalReturnsAmount,

        totalGrains: giWeight,
        totalGrainsInputQty: giQty,
        totalGrainsOutput: goWeight,
        totalGrainsOutputQty: goQty,
        totalGrainsBatches: gCount,

        totalFlourOut: foWeight,
        totalFlourOutQty: foQty,
        totalFlourOutBatches: foCount,

        pendingPRs,
        stockSummary
      },
      monthlyTrends: months,
      recentActivities: activities.slice(0, 8)
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Error fetching dashboard stats', error: error.message });
  }
});

// GET /api/dashboard - alias
router.get('/', (req, res) => {
  res.redirect('/api/dashboard/stats');
});

module.exports = router;
