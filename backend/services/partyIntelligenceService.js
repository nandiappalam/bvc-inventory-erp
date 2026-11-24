const db = require('../config/database');
const {
  loadPartyDirectory,
  resolveSupplierFromDirectory,
  resolveCustomerFromDirectory
} = require('./PartyNameResolver');

function resolveCompanyId(companyId) {
  const id = parseInt(companyId, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : 1;
}

function normKey(v) {
  return String(v || '').trim().toLowerCase();
}

function normLot(v) {
  return String(v || '').trim().toUpperCase();
}

function daysBetween(dateA, dateB) {
  if (!dateA || !dateB) return null;
  const t1 = Date.parse(String(dateA).slice(0, 10));
  const t2 = Date.parse(String(dateB).slice(0, 10));
  if (Number.isNaN(t1) || Number.isNaN(t2)) return null;
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

function buildPartyMatcher(record) {
  const keys = new Set();
  if (record.id !== undefined && record.id !== null && String(record.id).trim() !== '') {
    keys.add(String(record.id).trim().toLowerCase());
  }
  if (record.name) keys.add(normKey(record.name));
  if (record.print_name) keys.add(normKey(record.print_name));
  if (record.contact_person) keys.add(normKey(record.contact_person));
  return keys;
}

function computeSupplierOutstanding({ ledgerRows = [], openingBalance = 0, balanceType = 'Dr', fallbackPurchase = 0, fallbackReturn = 0 }) {
  const op = Number(openingBalance) || 0;
  const bt = String(balanceType || 'Dr').toUpperCase();
  const opPayable = bt === 'CR' ? op : -op;

  if (ledgerRows.length > 0) {
    let dr = 0;
    let cr = 0;
    for (const r of ledgerRows) {
      dr += Number(r.debit) || 0;
      cr += Number(r.credit) || 0;
    }
    return Number((opPayable + cr - dr).toFixed(2));
  }
  return Number((opPayable + (Number(fallbackPurchase) || 0) - (Number(fallbackReturn) || 0)).toFixed(2));
}

function computeCustomerOutstanding({ ledgerRows = [], openingBalance = 0, balanceType = 'Dr', fallbackSales = 0, fallbackReturn = 0 }) {
  const op = Number(openingBalance) || 0;
  const bt = String(balanceType || 'Cr').toUpperCase();
  const opReceivable = bt === 'DR' ? op : -op;

  if (ledgerRows.length > 0) {
    let dr = 0;
    let cr = 0;
    for (const r of ledgerRows) {
      dr += Number(r.debit) || 0;
      cr += Number(r.credit) || 0;
    }
    return Number((opReceivable + dr - cr).toFixed(2));
  }
  return Number((opReceivable + (Number(fallbackSales) || 0) - (Number(fallbackReturn) || 0)).toFixed(2));
}

class PartyIntelligenceService {
  /**
   * High-Level Dashboard Summary for Party Intelligence (Company-Scoped, Real Data Only)
   */
  async getDashboardSummary(companyId = 1) {
    const cId = resolveCompanyId(companyId);
    const runner = db.forCompany(cId);
    try {
      const suppCountRes = await runner.get(
        `SELECT COUNT(*) as cnt FROM supplier_master WHERE COALESCE(status, 'Active') = 'Active'`
      );
      const custCountRes = await runner.get(
        `SELECT COUNT(*) as cnt FROM customer_master WHERE COALESCE(status, 'Active') = 'Active'`
      );

      const purSumRes = await runner.get(`
        SELECT 
          SUM(COALESCE(NULLIF(grand_total, 0), NULLIF(total_amount, 0), NULLIF(net_amount, 0), total_amt, 0)) as total_pur,
          SUM(COALESCE(total_weight, 0)) as total_wt
        FROM purchases
      `);
      const salesSumRes = await runner.get(`
        SELECT 
          SUM(COALESCE(NULLIF(grand_total, 0), NULLIF(total_amt, 0), total_amount, 0)) as total_sales,
          SUM(COALESCE(NULLIF(total_wt, 0), total_weight, 0)) as total_wt
        FROM sales
      `);

      let totalQc = 0;
      let passedCnt = 0;
      let rejectedCnt = 0;
      try {
        const qcSumRes = await runner.get(`
          SELECT 
            COUNT(*) as total_qc,
            SUM(CASE WHEN UPPER(TRIM(COALESCE(overall_result, ''))) IN ('PASSED', 'ACCEPTED') THEN 1 ELSE 0 END) as passed_cnt,
            SUM(CASE WHEN UPPER(TRIM(COALESCE(overall_result, ''))) IN ('REJECTED', 'FAILED') THEN 1 ELSE 0 END) as rejected_cnt
          FROM qc_inspections
        `);
        totalQc = parseInt(qcSumRes?.total_qc || 0, 10);
        passedCnt = parseInt(qcSumRes?.passed_cnt || 0, 10);
        rejectedCnt = parseInt(qcSumRes?.rejected_cnt || 0, 10);
      } catch (_) {}

      // Real On-Time Delivery Rate from linked PO -> Purchase dates
      let onTimeDeliveryRate = null;
      let linkedPoCount = 0;
      try {
        const poRows = await runner.all(`
          SELECT po.id, COALESCE(po.po_date, po.date) as order_date, p.date as receipt_date
          FROM purchase_orders po
          JOIN purchases p ON p.id = po.inward_purchase_id
          WHERE po.inward_purchase_id IS NOT NULL
        `);
        if (poRows && poRows.length > 0) {
          linkedPoCount = poRows.length;
          let onTime = 0;
          for (const row of poRows) {
            const diff = daysBetween(row.order_date, row.receipt_date);
            if (diff !== null && diff <= 3) onTime++;
          }
          onTimeDeliveryRate = Number(((onTime / poRows.length) * 100).toFixed(1));
        }
      } catch (_) {}

      const totalPurVal = parseFloat(purSumRes?.total_pur || 0);
      const totalPurWt = parseFloat(purSumRes?.total_wt || 0);
      const totalSalesVal = parseFloat(salesSumRes?.total_sales || 0);
      const totalSalesWt = parseFloat(salesSumRes?.total_wt || 0);
      const passRate = totalQc > 0 ? Math.round((passedCnt / totalQc) * 100) : null;

      return {
        totalSuppliers: parseInt(suppCountRes?.cnt || 0, 10),
        totalCustomers: parseInt(custCountRes?.cnt || 0, 10),
        totalPurchaseValue: totalPurVal,
        totalPurchaseWeightMT: Number((totalPurWt / 1000).toFixed(2)),
        totalSalesValue: totalSalesVal,
        totalSalesWeightMT: Number((totalSalesWt / 1000).toFixed(2)),
        totalQCTests: totalQc,
        passedQCTests: passedCnt,
        rejectedQCTests: rejectedCnt,
        overallQCPassRate: passRate,
        avgQcScore: passRate,
        onTimeDeliveryRate,
        linkedPoCount
      };
    } catch (err) {
      console.error('Error in getDashboardSummary:', err);
      return {
        totalSuppliers: 0,
        totalCustomers: 0,
        totalPurchaseValue: 0,
        totalPurchaseWeightMT: 0,
        totalSalesValue: 0,
        totalSalesWeightMT: 0,
        totalQCTests: 0,
        passedQCTests: 0,
        rejectedQCTests: 0,
        overallQCPassRate: null,
        avgQcScore: null,
        onTimeDeliveryRate: null,
        linkedPoCount: 0
      };
    }
  }

  /**
   * Supplier List with Real Performance, Quality, Ledger & Delivery Metrics
   */
  async getSupplierList(companyId = 1) {
    const cId = resolveCompanyId(companyId);
    const runner = db.forCompany(cId);
    try {
      const suppliers = (await runner.all(`
        SELECT 
          s.id,
          s.name,
          s.print_name,
          s.contact_person,
          s.mobile1,
          s.phone_off,
          s.email,
          s.gst_number,
          s.area,
          COALESCE(NULLIF(s.city, ''), NULLIF(s.address3, ''), NULLIF(s.area, ''), NULLIF(s.address4, ''), s.state, '') as city,
          s.limit_days,
          s.limit_amount,
          s.opening_balance,
          s.balance_type
        FROM supplier_master s
        ORDER BY s.name ASC
      `)) || [];

      const purchases = (await runner.all(`
        SELECT 
          p.id,
          p.s_no,
          p.supplier,
          p.date,
          COALESCE(p.total_weight, 0) as total_weight,
          COALESCE(NULLIF(p.grand_total, 0), NULLIF(p.total_amount, 0), NULLIF(p.net_amount, 0), p.total_amt, 0) as amount,
          p.po_no
        FROM purchases p
      `)) || [];

      const purchaseItems = (await runner.all(`
        SELECT purchase_id, lot_no FROM purchase_items WHERE lot_no IS NOT NULL AND TRIM(lot_no) <> ''
      `)) || [];

      let qcList = [];
      try {
        qcList = (await runner.all(`
          SELECT id, qc_no, purchase_id, rm_lot_no, overall_result
          FROM qc_inspections
        `)) || [];
      } catch (_) {}

      let poList = [];
      try {
        poList = (await runner.all(`
          SELECT id, supplier_id, supplier_name, COALESCE(po_date, date) as order_date, inward_purchase_id
          FROM purchase_orders
        `)) || [];
      } catch (_) {}

      let prList = [];
      try {
        prList = (await runner.all(`
          SELECT id, supplier, COALESCE(NULLIF(grand_total, 0), NULLIF(net_amount, 0), total_amount, 0) as amount
          FROM purchase_returns
        `)) || [];
      } catch (_) {}

      let ledgerEntries = [];
      try {
        ledgerEntries = (await runner.all(`
          SELECT ledger_name, debit, credit, voucher_type
          FROM ledger_entries
          WHERE COALESCE(is_reversed, 0) = 0
        `)) || [];
      } catch (_) {}

      const purDateById = new Map();
      for (const p of purchases) {
        purDateById.set(Number(p.id), p.date);
      }

      const lotsByPurchaseId = new Map();
      for (const pi of purchaseItems) {
        const pid = Number(pi.purchase_id);
        if (!lotsByPurchaseId.has(pid)) lotsByPurchaseId.set(pid, new Set());
        lotsByPurchaseId.get(pid).add(normLot(pi.lot_no));
      }

      return suppliers.map((supp) => {
        const keys = buildPartyMatcher(supp);

        const suppPurchases = purchases.filter((p) => keys.has(normKey(p.supplier)));
        const purIdSet = new Set(suppPurchases.map((p) => Number(p.id)));
        const suppLotSet = new Set();
        for (const pid of purIdSet) {
          const lots = lotsByPurchaseId.get(pid);
          if (lots) lots.forEach((l) => suppLotSet.add(l));
        }

        const totalPurValue = suppPurchases.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        const totalWeightKg = suppPurchases.reduce((acc, p) => acc + (parseFloat(p.total_weight) || 0), 0);
        const avgRate = totalWeightKg > 0 ? totalPurValue / totalWeightKg : 0;

        // QC inspections matched via purchase_id OR supplier's lot_no
        const suppQc = qcList.filter((q) => {
          if (q.purchase_id && purIdSet.has(Number(q.purchase_id))) return true;
          if (q.rm_lot_no && suppLotSet.has(normLot(q.rm_lot_no))) return true;
          return false;
        });
        const qcTotal = suppQc.length;
        const qcPassed = suppQc.filter((q) => ['PASSED', 'ACCEPTED'].includes(String(q.overall_result || '').trim().toUpperCase())).length;
        const qcRejected = suppQc.filter((q) => ['REJECTED', 'FAILED'].includes(String(q.overall_result || '').trim().toUpperCase())).length;

        const qcScore = qcTotal > 0 ? Math.round((qcPassed / qcTotal) * 100) : null;
        const rejectedPct = qcTotal > 0 ? Number(((qcRejected / qcTotal) * 100).toFixed(1)) : 0;

        // Real delivery delay from PO -> Purchase dates
        const suppPos = poList.filter((po) => {
          if (po.supplier_id && Number(po.supplier_id) === Number(supp.id)) return true;
          return keys.has(normKey(po.supplier_name));
        });
        const delays = [];
        for (const po of suppPos) {
          if (!po.inward_purchase_id) continue;
          const rDate = purDateById.get(Number(po.inward_purchase_id));
          const diff = daysBetween(po.order_date, rDate);
          if (diff !== null) delays.push(Math.max(0, diff));
        }
        const deliveryDelayDays = delays.length > 0
          ? Number((delays.reduce((a, b) => a + b, 0) / delays.length).toFixed(1))
          : null;

        // Returns & Real Ledger Outstanding
        const suppReturns = prList.filter((pr) => keys.has(normKey(pr.supplier)));
        const totalReturnVal = suppReturns.reduce((acc, pr) => acc + (parseFloat(pr.amount) || 0), 0);

        const suppLedger = ledgerEntries.filter((le) => {
          const ln = normKey(le.ledger_name);
          return (supp.name && ln === normKey(supp.name)) || (supp.print_name && ln === normKey(supp.print_name));
        });

        const outstanding = computeSupplierOutstanding({
          ledgerRows: suppLedger,
          openingBalance: supp.opening_balance,
          balanceType: supp.balance_type,
          fallbackPurchase: totalPurValue,
          fallbackReturn: totalReturnVal
        });

        return {
          id: supp.id,
          name: supp.print_name || supp.name,
          rawName: supp.name,
          contactPerson: supp.contact_person,
          mobile: supp.mobile1 || supp.phone_off,
          gstNo: supp.gst_number,
          area: supp.area,
          city: supp.city,
          creditDays: supp.limit_days || 30,
          purchaseValue: totalPurValue,
          totalPurchaseValue: totalPurValue,
          purchaseQtyMT: Number((totalWeightKg / 1000).toFixed(2)),
          totalPurchaseQtyMT: Number((totalWeightKg / 1000).toFixed(2)),
          averageRatePerKg: Number(avgRate.toFixed(2)),
          avgRate: Number(avgRate.toFixed(2)),
          totalInwards: suppPurchases.length,
          qcTotal,
          qcPassRate: qcScore,
          averageQCScore: qcScore,
          rejectionRate: rejectedPct,
          rejectedQtyPct: rejectedPct,
          deliveryDelayDays,
          averageDeliveryDelayDays: deliveryDelayDays,
          returnsCount: suppReturns.length,
          outstandingBalance: outstanding
        };
      });
    } catch (err) {
      console.error('Error in getSupplierList:', err);
      return [];
    }
  }

  /**
   * Supplier 360° Comprehensive Dossier (Company-Scoped, Real Data)
   */
  async getSupplier360(supplierName, companyId = 1) {
    const cId = resolveCompanyId(companyId);
    const runner = db.forCompany(cId);
    try {
      const dir = await loadPartyDirectory(cId, runner);
      const resolved = resolveSupplierFromDirectory(dir, supplierName);

      const suppRow = resolved.id
        ? await runner.get(`SELECT * FROM supplier_master WHERE id = ?`, [resolved.id])
        : await runner.get(
            `SELECT * FROM supplier_master WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) OR CAST(id AS TEXT) = CAST(? AS TEXT) OR LOWER(TRIM(print_name)) = LOWER(TRIM(?))`,
            [supplierName, supplierName, supplierName]
          );

      const profile = suppRow || { name: supplierName, contact_person: supplierName };
      const suppKeys = buildPartyMatcher(profile);
      if (!profile.id) suppKeys.add(normKey(supplierName));

      // 1. Purchase History with item breakdowns
      const allPurchases = (await runner.all(`
        SELECT 
          p.id,
          p.s_no,
          p.date,
          p.inv_no,
          p.supplier,
          COALESCE(NULLIF(p.grand_total, 0), NULLIF(p.total_amount, 0), NULLIF(p.net_amount, 0), p.total_amt, 0) as amount,
          COALESCE(p.total_weight, 0) as total_weight,
          p.total_qty,
          p.vehicle_no,
          p.lorry_no,
          p.remarks,
          pi.id as purchase_item_id,
          pi.item_name,
          pi.qty,
          pi.rate,
          pi.lot_no,
          COALESCE(pi.amount, 0) as item_amt,
          COALESCE(NULLIF(pi.total_weight, 0), pi.weight, 0) as item_wt
        FROM purchases p
        LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
        ORDER BY p.date DESC, p.id DESC
      `)) || [];

      const rawPurchases = allPurchases.filter((p) => suppKeys.has(normKey(p.supplier)));

      const purchasesFormatted = rawPurchases.map((r) => ({
        id: r.id,
        s_no: r.inv_no || r.s_no || `PUR-${r.id}`,
        date: r.date,
        item_name: r.item_name || 'Raw Material / Grain',
        qty: r.qty || r.total_qty || 0,
        rate: r.rate || (r.total_weight > 0 ? Number((r.amount / r.total_weight).toFixed(2)) : 0),
        amount: r.item_amt || r.amount || 0,
        lot_no: r.lot_no || '',
        total_weight: r.item_wt || r.total_weight || 0
      }));

      // 2. Purchase Orders
      let poRecords = [];
      try {
        const allPos = (await runner.all(`
          SELECT * FROM purchase_orders ORDER BY COALESCE(po_date, date) DESC, id DESC
        `)) || [];
        poRecords = allPos.filter((po) => {
          if (profile.id && po.supplier_id && Number(po.supplier_id) === Number(profile.id)) return true;
          return suppKeys.has(normKey(po.supplier_name));
        });
      } catch (_) {}

      // 3. QC History (matching real columns ONLY — no status/inspection_no!)
      const purIds = Array.from(new Set(rawPurchases.map((p) => Number(p.id)).filter(Boolean)));
      const supplierLotNos = Array.from(new Set(rawPurchases.map((p) => normLot(p.lot_no)).filter(Boolean)));
      const itemByPurId = new Map();
      const itemByLot = new Map();
      for (const r of rawPurchases) {
        if (r.id && r.item_name && !itemByPurId.has(Number(r.id))) itemByPurId.set(Number(r.id), r.item_name);
        if (r.lot_no && r.item_name) itemByLot.set(normLot(r.lot_no), r.item_name);
      }

      let qcRecords = [];
      try {
        const allQc = (await runner.all(`
          SELECT 
            q.id,
            q.qc_no,
            q.purchase_id,
            q.purchase_item_id,
            q.rm_lot_no,
            q.inspection_date,
            q.inspector,
            q.overall_result,
            q.remarks,
            pi.item_name as pi_item_name,
            p.date as p_date
          FROM qc_inspections q
          LEFT JOIN purchases p ON p.id = q.purchase_id
          LEFT JOIN purchase_items pi ON pi.id = q.purchase_item_id
          ORDER BY q.inspection_date DESC, q.id DESC
        `)) || [];

        qcRecords = allQc
          .filter((q) => {
            if (q.purchase_id && purIds.includes(Number(q.purchase_id))) return true;
            if (q.rm_lot_no && supplierLotNos.includes(normLot(q.rm_lot_no))) return true;
            return false;
          })
          .map((q) => ({
            id: q.id,
            qc_no: q.qc_no || `QC-${q.id}`,
            date: q.inspection_date || q.p_date || null,
            inspection_date: q.inspection_date || q.p_date || null,
            rm_lot_no: q.rm_lot_no || '',
            item_name: q.pi_item_name || (q.rm_lot_no ? itemByLot.get(normLot(q.rm_lot_no)) : null) || itemByPurId.get(Number(q.purchase_id)) || 'Raw Materials',
            inspector: q.inspector || '-',
            result: q.overall_result || 'PENDING',
            overall_result: q.overall_result || 'PENDING',
            status: q.overall_result || 'PENDING',
            remarks: q.remarks || '-',
            notes: q.remarks || '-'
          }));
      } catch (_) {}

      const qcByLot = new Map();
      for (const q of qcRecords) {
        if (q.rm_lot_no) qcByLot.set(normLot(q.rm_lot_no), q.overall_result);
      }

      // 4. Lot History enriched with real stock_lots + clean physical stock_movements + milling outputs/wastage
      let stockLotMap = new Map();
      let lotBalanceMap = new Map();
      let lotMillingMap = new Map();
      if (supplierLotNos.length > 0) {
        try {
          const ph = supplierLotNos.map(() => '?').join(',');
          const slRows = (await runner.all(
            `SELECT * FROM stock_lots WHERE UPPER(TRIM(lot_no)) IN (${ph})`,
            supplierLotNos
          )) || [];
          for (const sl of slRows) {
            stockLotMap.set(normLot(sl.lot_no), sl);
          }

          const mvRows = (await runner.all(
            `SELECT
              UPPER(TRIM(lot_no)) as lot_key,
              godown_name,
              SUM(CASE WHEN direction = 'IN' THEN COALESCE(qty, 0) ELSE -COALESCE(qty, 0) END) as bal_bags,
              SUM(CASE WHEN direction = 'IN' THEN COALESCE(weight, 0) ELSE -COALESCE(weight, 0) END) as bal_kg
             FROM stock_movements
             WHERE COALESCE(is_reversed, 0) = 0
               AND COALESCE(is_reversal, 0) = 0
               AND COALESCE(is_physical_stock, 1) = 1
               AND UPPER(TRIM(lot_no)) IN (${ph})
             GROUP BY UPPER(TRIM(lot_no)), godown_name`,
            supplierLotNos
          )) || [];
          for (const mv of mvRows) {
            const cur = lotBalanceMap.get(mv.lot_key) || { bags: 0, kg: 0, activeGodowns: [], allGodowns: [] };
            const b = Number(mv.bal_bags) || 0;
            const k = Number(mv.bal_kg) || 0;
            cur.bags += b;
            cur.kg += k;
            if (mv.godown_name) {
              cur.allGodowns.push(mv.godown_name);
              if (b > 0.001) cur.activeGodowns.push(`${mv.godown_name} (${b} Bags)`);
            }
            lotBalanceMap.set(mv.lot_key, cur);
          }

          // Milling batches linked to supplier's raw material lots
          const gRows = (await runner.all(
            `SELECT DISTINCT UPPER(TRIM(gii.lot_no)) as input_lot, g.id as grain_id, COALESCE(g.work_order_no, 'GRD-' || CAST(g.s_no AS TEXT)) as batch_no
             FROM grain_input_items gii
             JOIN grains g ON g.id = gii.grain_id
             WHERE UPPER(TRIM(gii.lot_no)) IN (${ph})`,
            supplierLotNos
          )) || [];
          for (const gr of gRows) {
            const cur = lotMillingMap.get(gr.input_lot) || { batches: [], outputLots: [], wastageKg: 0 };
            cur.batches.push(gr.batch_no);
            const outs = (await runner.all(`SELECT lot_no, item_name FROM grain_output_items WHERE grain_id = ?`, [gr.grain_id])) || [];
            outs.forEach(o => o.lot_no && cur.outputLots.push(o.lot_no));
            const wsts = (await runner.all(`SELECT total_wt FROM grain_wastage_items WHERE grain_id = ?`, [gr.grain_id])) || [];
            cur.wastageKg += wsts.reduce((s, w) => s + (parseFloat(w.total_wt) || 0), 0);
            lotMillingMap.set(gr.input_lot, cur);
          }
        } catch (_) {}
      }

      const seenLots = new Set();
      const lotHistory = [];
      for (const r of rawPurchases) {
        if (!r.lot_no) continue;
        const lKey = normLot(r.lot_no);
        if (seenLots.has(lKey)) continue;
        seenLots.add(lKey);

        const sl = stockLotMap.get(lKey);
        const mvBal = lotBalanceMap.get(lKey);
        const millInfo = lotMillingMap.get(lKey);
        const initQtyBags = Number(r.qty || sl?.quantity || 0);
        const initWtKg = Number(r.item_wt || r.total_weight || 0);
        const remBags = mvBal ? Number(mvBal.bags.toFixed(3)) : Number(sl?.remaining_quantity ?? initQtyBags);
        const remKg = mvBal ? Number(mvBal.kg.toFixed(3)) : initWtKg;
        const qcStat = qcByLot.get(lKey) || sl?.qc_status || 'QC_PENDING';
        const godownDisplay = mvBal?.activeGodowns?.length > 0
          ? mvBal.activeGodowns.join(', ')
          : (mvBal?.allGodowns?.[0] || sl?.godown_name || '-');

        lotHistory.push({
          lot_no: r.lot_no,
          lotNo: r.lot_no,
          item_name: r.item_name || sl?.item_name || 'Raw Material',
          itemName: r.item_name || sl?.item_name || 'Raw Material',
          inwardDate: r.date,
          qtyBags: initQtyBags,
          quantity: initWtKg || initQtyBags,
          weightKg: initWtKg,
          remainingBags: remBags,
          remaining_quantity: remKg,
          remainingKg: remKg,
          rate: r.rate || sl?.rate || 0,
          qc_status: qcStat,
          qcStatus: qcStat,
          godown: godownDisplay,
          milledBatches: millInfo?.batches || [],
          outputLots: Array.from(new Set(millInfo?.outputLots || [])),
          wastageKg: millInfo?.wastageKg || 0,
          voucherNo: `PUR-${r.inv_no || r.s_no || r.id}`,
          vehicleNo: r.vehicle_no || r.lorry_no || '-'
        });
      }

      // 5. Purchase Returns
      let purchaseReturns = [];
      try {
        const allPr = (await runner.all(`SELECT * FROM purchase_returns ORDER BY date DESC, id DESC`)) || [];
        purchaseReturns = allPr.filter((pr) => suppKeys.has(normKey(pr.supplier)));
      } catch (_) {}

      // 6. Payments & Vouchers (combined from ledger_entries & voucher_entry, deduplicated)
      const ledgerNameKeys = Array.from(new Set([profile.name, profile.print_name].filter(Boolean).map((n) => normKey(n))));
      const vouchersList = await this._fetchPartyVouchers(runner, ledgerNameKeys, 'Payment');

      return {
        profile,
        purchases: purchasesFormatted,
        purchaseOrders: poRecords,
        purchaseReturns,
        qcHistory: qcRecords,
        qcReports: qcRecords,
        lotHistory,
        lots: lotHistory,
        vouchers: vouchersList
      };
    } catch (err) {
      console.error('Error in getSupplier360:', err);
      return {
        profile: { name: supplierName },
        purchases: [],
        purchaseOrders: [],
        purchaseReturns: [],
        qcHistory: [],
        qcReports: [],
        lotHistory: [],
        lots: [],
        vouchers: []
      };
    }
  }

  /**
   * Customer List with Real Performance, Ledger & Payment-Cycle Metrics
   */
  async getCustomerList(companyId = 1) {
    const cId = resolveCompanyId(companyId);
    const runner = db.forCompany(cId);
    try {
      const customers = (await runner.all(`
        SELECT 
          c.id,
          c.name,
          c.print_name,
          c.contact_person,
          c.mobile1,
          c.phone_off,
          c.email,
          c.gst_number,
          c.area,
          COALESCE(NULLIF(c.city, ''), NULLIF(c.address3, ''), NULLIF(c.area, ''), NULLIF(c.address4, ''), c.state, '') as city,
          c.limit_days,
          c.limit_amount,
          c.opening_balance,
          c.balance_type
        FROM customer_master c
        ORDER BY c.name ASC
      `)) || [];

      const sales = (await runner.all(`
        SELECT 
          s.id,
          s.s_no,
          s.customer,
          s.customer_id,
          s.date,
          COALESCE(NULLIF(s.total_wt, 0), s.total_weight, 0) as total_weight,
          COALESCE(NULLIF(s.grand_total, 0), NULLIF(s.total_amt, 0), s.total_amount, 0) as amount
        FROM sales s
      `)) || [];

      let salesReturns = [];
      try {
        salesReturns = (await runner.all(`
          SELECT id, customer, date,
            COALESCE(NULLIF(grand_total, 0), NULLIF(total_amt, 0), total_amount, 0) as amount
          FROM sales_return
        `)) || [];
      } catch (_) {}

      let ledgerEntries = [];
      try {
        ledgerEntries = (await runner.all(`
          SELECT ledger_name, date, voucher_type, debit, credit
          FROM ledger_entries
          WHERE COALESCE(is_reversed, 0) = 0
        `)) || [];
      } catch (_) {}

      return customers.map((cust) => {
        const keys = buildPartyMatcher(cust);

        const custSales = sales.filter((s) => {
          if (s.customer_id && Number(s.customer_id) === Number(cust.id)) return true;
          return keys.has(normKey(s.customer));
        });

        const totalSalesVal = custSales.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
        const totalWtKg = custSales.reduce((acc, s) => acc + (parseFloat(s.total_weight) || 0), 0);

        const sortedSales = [...custSales].sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastPurchaseDate = sortedSales[0]?.date || null;

        const custReturns = salesReturns.filter((sr) => keys.has(normKey(sr.customer)));
        const totalReturnVal = custReturns.reduce((acc, sr) => acc + (parseFloat(sr.amount) || 0), 0);

        const custLedger = ledgerEntries.filter((le) => {
          const ln = normKey(le.ledger_name);
          return (cust.name && ln === normKey(cust.name)) || (cust.print_name && ln === normKey(cust.print_name));
        });

        const outstanding = computeCustomerOutstanding({
          ledgerRows: custLedger,
          openingBalance: cust.opening_balance,
          balanceType: cust.balance_type,
          fallbackSales: totalSalesVal,
          fallbackReturn: totalReturnVal
        });

        // Compute real average payment days only if Receipt entries exist against Sales invoices
        const receipts = custLedger
          .filter((le) => String(le.voucher_type || '').toLowerCase() === 'receipt' && Number(le.credit) > 0 && le.date)
          .sort((a, b) => String(a.date).localeCompare(String(b.date)));
        let averagePaymentDays = null;
        if (receipts.length > 0 && custSales.length > 0) {
          const oldestSale = [...custSales].filter((s) => s.date).sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
          if (oldestSale) {
            const diffs = receipts.map((r) => daysBetween(oldestSale.date, r.date)).filter((d) => d !== null && d >= 0);
            if (diffs.length > 0) {
              averagePaymentDays = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
            }
          }
        }

        return {
          id: cust.id,
          name: cust.print_name || cust.name,
          rawName: cust.name,
          contactPerson: cust.contact_person,
          mobile: cust.mobile1 || cust.phone_off,
          gstNo: cust.gst_number,
          area: cust.area,
          city: cust.city,
          creditDays: cust.limit_days || 30,
          salesValue: totalSalesVal,
          totalSalesValue: totalSalesVal,
          salesQtyMT: Number((totalWtKg / 1000).toFixed(2)),
          totalSalesQtyMT: Number((totalWtKg / 1000).toFixed(2)),
          ordersCount: custSales.length,
          outstandingBalance: outstanding,
          averagePaymentDays,
          returnsCount: custReturns.length,
          cancelledOrdersCount: 0,
          lastPurchaseDate
        };
      });
    } catch (err) {
      console.error('Error in getCustomerList:', err);
      return [];
    }
  }

  /**
   * Customer 360° Comprehensive Dossier (Company-Scoped, Real Data + Dispatched Lots)
   */
  async getCustomer360(customerName, companyId = 1) {
    const cId = resolveCompanyId(companyId);
    const runner = db.forCompany(cId);
    try {
      const dir = await loadPartyDirectory(cId, runner);
      const resolved = resolveCustomerFromDirectory(dir, customerName);

      const custRow = resolved.id
        ? await runner.get(`SELECT * FROM customer_master WHERE id = ?`, [resolved.id])
        : await runner.get(
            `SELECT * FROM customer_master WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) OR CAST(id AS TEXT) = CAST(? AS TEXT) OR LOWER(TRIM(print_name)) = LOWER(TRIM(?))`,
            [customerName, customerName, customerName]
          );

      const profile = custRow || { name: customerName, contact_person: customerName };
      const custKeys = buildPartyMatcher(profile);
      if (!profile.id) custKeys.add(normKey(customerName));

      // 1. Sales Invoices + line items
      const allSales = (await runner.all(`
        SELECT 
          s.id,
          s.s_no,
          s.voucher_no,
          s.inv_no,
          s.date,
          s.customer,
          s.customer_id,
          COALESCE(NULLIF(s.grand_total, 0), NULLIF(s.total_amt, 0), s.total_amount, 0) as amount,
          COALESCE(NULLIF(s.total_wt, 0), s.total_weight, 0) as total_weight,
          s.total_qty,
          si.item_name,
          si.lot_no,
          si.qty,
          si.weight as bag_weight,
          si.rate,
          COALESCE(NULLIF(si.total_amt, 0), si.amount, 0) as item_amt,
          COALESCE(NULLIF(si.total_wt, 0), CASE WHEN si.weight > 0 AND si.qty > 0 THEN si.weight * si.qty ELSE si.weight END, 0) as item_wt
        FROM sales s
        LEFT JOIN sales_items si ON si.sales_id = s.id
        ORDER BY s.date DESC, s.id DESC
      `)) || [];

      const rawSales = allSales.filter((s) => {
        if (profile.id && s.customer_id && Number(s.customer_id) === Number(profile.id)) return true;
        return custKeys.has(normKey(s.customer));
      });

      const salesFormatted = rawSales.map((r) => ({
        id: r.id,
        s_no: r.voucher_no || r.inv_no || r.s_no || `INV-${r.id}`,
        date: r.date,
        item_name: r.item_name || 'Finished Goods',
        lot_no: r.lot_no || '',
        qty: r.qty || r.total_qty || 0,
        rate: r.rate || 0,
        amount: r.item_amt || r.amount || 0,
        total_weight: r.item_wt || r.total_weight || 0
      }));

      // Dispatched Lots for Tab 2 ("Associated Stock Lots")
      const custLotNos = Array.from(new Set(rawSales.map((r) => normLot(r.lot_no)).filter(Boolean)));
      let stockLotMap = new Map();
      let mvMap = new Map();
      if (custLotNos.length > 0) {
        try {
          const ph = custLotNos.map(() => '?').join(',');
          const slRows = (await runner.all(
            `SELECT * FROM stock_lots WHERE UPPER(TRIM(lot_no)) IN (${ph})`,
            custLotNos
          )) || [];
          for (const sl of slRows) stockLotMap.set(normLot(sl.lot_no), sl);

          const mvRows = (await runner.all(
            `SELECT
              UPPER(TRIM(lot_no)) as lot_key,
              godown_name,
              SUM(CASE WHEN direction = 'IN' THEN COALESCE(qty, 0) ELSE -COALESCE(qty, 0) END) as bal_bags,
              SUM(CASE WHEN direction = 'IN' THEN COALESCE(weight, 0) ELSE -COALESCE(weight, 0) END) as bal_kg
             FROM stock_movements
             WHERE COALESCE(is_reversed, 0) = 0
               AND COALESCE(is_reversal, 0) = 0
               AND COALESCE(is_physical_stock, 1) = 1
               AND UPPER(TRIM(lot_no)) IN (${ph})
             GROUP BY UPPER(TRIM(lot_no)), godown_name`,
            custLotNos
          )) || [];
          for (const mv of mvRows) {
            const cur = mvMap.get(mv.lot_key) || { bags: 0, kg: 0, activeGodowns: [] };
            const b = Number(mv.bal_bags) || 0;
            const k = Number(mv.bal_kg) || 0;
            cur.bags += b;
            cur.kg += k;
            if (mv.godown_name && b > 0.001) cur.activeGodowns.push(`${mv.godown_name} (${b} Bags)`);
            mvMap.set(mv.lot_key, cur);
          }
        } catch (_) {}
      }

      const lotHistory = [];
      const seenLots = new Set();
      for (const r of rawSales) {
        if (!r.lot_no) continue;
        const lKey = normLot(r.lot_no);
        if (seenLots.has(lKey)) continue;
        seenLots.add(lKey);
        const sl = stockLotMap.get(lKey);
        const mvBal = mvMap.get(lKey);
        const soldKg = Number(r.item_wt || r.total_weight || 0);
        const remKg = mvBal ? Number(mvBal.kg.toFixed(3)) : Number(sl?.remaining_quantity ?? 0);
        const remBags = mvBal ? Number(mvBal.bags.toFixed(3)) : Number(sl?.remaining_quantity ?? 0);

        lotHistory.push({
          lot_no: r.lot_no,
          lotNo: r.lot_no,
          item_name: r.item_name || sl?.item_name || 'Finished Goods',
          itemName: r.item_name || sl?.item_name || 'Finished Goods',
          dispatchDate: r.date,
          dispatchedBags: Number(r.qty || 0),
          quantity: soldKg,
          weightKg: soldKg,
          remaining_quantity: remKg,
          remainingKg: remKg,
          remainingBags: remBags,
          godown: mvBal?.activeGodowns?.length > 0 ? mvBal.activeGodowns.join(', ') : (sl?.godown_name || '-'),
          qc_status: sl?.qc_status || 'PASSED',
          qcStatus: sl?.qc_status || 'PASSED',
          voucherNo: r.voucher_no || r.inv_no || `INV-${r.s_no || r.id}`
        });
      }

      // 2. Quotations (match flexibly across ID, name, print_name)
      let quotRecords = [];
      try {
        const allQuots = (await runner.all(`
          SELECT 
            q.*,
            COALESCE(NULLIF(q.bill_no, ''), CAST(q.s_no AS TEXT), CAST(q.id AS TEXT)) as quote_no,
            q.date as quote_date
          FROM quotations q
          ORDER BY q.date DESC, q.id DESC
        `)) || [];
        quotRecords = allQuots
          .filter((q) => custKeys.has(normKey(q.customer)))
          .map((q) => ({
            ...q,
            result: q.type || 'Quoted',
            status: q.type || 'Quoted',
            notes: q.remarks || `Qty: ${q.qty || 0} | Amt: ₹${q.total_amt || q.amount || 0}`
          }));
      } catch (_) {}

      // 3. Sales Returns (no customer_id column in sales_return — match via customer string/ID)
      let retRecords = [];
      try {
        const allRets = (await runner.all(`SELECT * FROM sales_return ORDER BY date DESC, id DESC`)) || [];
        retRecords = allRets.filter((sr) => custKeys.has(normKey(sr.customer)));
      } catch (_) {}

      // 4. Receipts & Vouchers
      const ledgerNameKeys = Array.from(new Set([profile.name, profile.print_name].filter(Boolean).map((n) => normKey(n))));
      const vouchersList = await this._fetchPartyVouchers(runner, ledgerNameKeys, 'Receipt');

      return {
        profile,
        sales: salesFormatted,
        quotations: quotRecords,
        returns: retRecords,
        lotHistory,
        lots: lotHistory,
        vouchers: vouchersList
      };
    } catch (err) {
      console.error('Error in getCustomer360:', err);
      return {
        profile: { name: customerName },
        sales: [],
        quotations: [],
        returns: [],
        lotHistory: [],
        lots: [],
        vouchers: []
      };
    }
  }

  /**
   * Shared helper: fetches non-reversed party ledger & voucher entries cleanly across both tables.
   */
  async _fetchPartyVouchers(runner, ledgerNameKeys, defaultType = 'Journal') {
    if (!ledgerNameKeys || ledgerNameKeys.length === 0) return [];
    const ph = ledgerNameKeys.map(() => '?').join(',');
    const rows = [];
    const seen = new Set();

    try {
      const leRows = (await runner.all(
        `SELECT id, date, voucher_no, voucher_type, debit, credit, particulars, counterparty_summary
         FROM ledger_entries
         WHERE COALESCE(is_reversed, 0) = 0
           AND LOWER(TRIM(ledger_name)) IN (${ph})
         ORDER BY date DESC, id DESC`,
        ledgerNameKeys
      )) || [];
      for (const r of leRows) {
        const key = `${r.date}|${r.voucher_no || ''}|${r.voucher_type || ''}|${Number(r.debit) || 0}|${Number(r.credit) || 0}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          id: r.id,
          date: r.date,
          voucher_no: r.voucher_no || `LE-${r.id}`,
          type: r.voucher_type || defaultType,
          voucher_type: r.voucher_type || defaultType,
          debit: Number(r.debit) || 0,
          credit: Number(r.credit) || 0,
          remarks: r.particulars || r.counterparty_summary || '-'
        });
      }
    } catch (_) {}

    try {
      const veRows = (await runner.all(
        `SELECT v.id, v.date, v.voucher_no, v.voucher_type, v.narration, ve.debit, ve.credit, ve.remarks as entry_remarks
         FROM voucher v
         JOIN voucher_entry ve ON ve.voucher_id = v.id
         WHERE COALESCE(v.is_reversed, 0) = 0
           AND LOWER(TRIM(ve.ledger_name)) IN (${ph})
         ORDER BY v.date DESC, v.id DESC`,
        ledgerNameKeys
      )) || [];
      for (const v of veRows) {
        const key = `${v.date}|${v.voucher_no || ''}|${v.voucher_type || ''}|${Number(v.debit) || 0}|${Number(v.credit) || 0}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          id: v.id,
          date: v.date,
          voucher_no: v.voucher_no || `VCH-${v.id}`,
          type: v.voucher_type || defaultType,
          voucher_type: v.voucher_type || defaultType,
          debit: Number(v.debit) || 0,
          credit: Number(v.credit) || 0,
          remarks: v.entry_remarks || v.narration || '-'
        });
      }
    } catch (_) {}

    return rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }
}

module.exports = new PartyIntelligenceService();
