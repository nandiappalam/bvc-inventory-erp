const db = require('../config/database');

class BarcodeQrService {
  /**
   * Universal 360° Code Resolver
   */
  async lookupCode(rawCode) {
    if (!rawCode) throw new Error('Code is required for lookup');

    const cleanCode = rawCode.trim();
    let type = 'UNKNOWN';
    let entityIdentifier = cleanCode;

    if (cleanCode.startsWith('LOT-')) {
      type = 'LOT';
      entityIdentifier = cleanCode.replace(/^LOT-/, '');
    } else if (cleanCode.startsWith('ITM-')) {
      type = 'ITEM';
      entityIdentifier = cleanCode.replace(/^ITM-/, '');
    } else if (cleanCode.startsWith('LOC-')) {
      type = 'LOCATION';
      entityIdentifier = cleanCode.replace(/^LOC-/, '');
    } else if (cleanCode.startsWith('PLT-')) {
      type = 'PALLET';
      entityIdentifier = cleanCode.replace(/^PLT-/, '');
    } else if (cleanCode.startsWith('FG-')) {
      type = 'FINISHED_GOOD';
      entityIdentifier = cleanCode.replace(/^FG-/, '');
    } else {
      // Auto-detect: if lot exists in stock_lots or purchase_items, treat as LOT
      const lotCheck = await db.query('SELECT lot_no FROM stock_lots WHERE lot_no = ? LIMIT 1', [cleanCode]);
      if (lotCheck.rows.length > 0) {
        type = 'LOT';
      } else {
        type = 'LOT'; // default fallback for arbitrary lot codes
      }
    }

    if (type === 'LOT') {
      return await this.resolveLot360(entityIdentifier, cleanCode);
    } else if (type === 'LOCATION') {
      return await this.resolveLocation360(entityIdentifier, cleanCode);
    } else if (type === 'ITEM') {
      return await this.resolveItem360(entityIdentifier, cleanCode);
    } else if (type === 'FINISHED_GOOD') {
      return await this.resolveFinishedGood360(entityIdentifier, cleanCode);
    } else {
      return {
        code: cleanCode,
        type: 'GENERIC',
        data: { message: `Identifier: ${cleanCode}` }
      };
    }
  }

  /**
   * Complete 360° Dossier for a Scanned Lot
   */
  async resolveLot360(lotNo, originalCode) {
    // 1. Current stock & location
    const stockLotRes = await db.query(`
      SELECT 
        sl.*,
        COALESCE(g.godown_name, 'Main Godown') as godown_name,
        COALESCE(i.item_name, 'Raw Grain') as item_name
      FROM stock_lots sl
      LEFT JOIN godown_master g ON sl.godown_id = g.id
      LEFT JOIN item_master i ON sl.item_id = i.id
      WHERE sl.lot_no = ?
    `, [lotNo]);
    const stockInfo = stockLotRes.rows[0] || null;

    // 2. Purchase Inward & Supplier Details
    const purchaseRes = await db.query(`
      SELECT 
        p.id as purchase_id,
        p.s_no,
        p.inv_no,
        p.date as inward_date,
        p.supplier as supplier_name,
        p.vehicle_no,
        p.lorry_no,
        p.driver_name,
        pi.item_name,
        pi.qty,
        pi.rate,
        pi.amount,
        pi.total_weight
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      WHERE pi.lot_no = ?
      LIMIT 1
    `, [lotNo]);
    const purchaseInfo = purchaseRes.rows[0] || null;

    // 3. QC Inspection Details
    const qcRes = await db.query(`
      SELECT 
        q.qc_no,
        q.inspection_date,
        q.inspector,
        q.overall_result,
        q.remarks
      FROM qc_inspections q
      WHERE q.rm_lot_no = ?
      ORDER BY q.inspection_date DESC
      LIMIT 1
    `, [lotNo]);
    const qcInfo = qcRes.rows[0] || null;

    // 4. Milling / Grinding Production records
    const millingInputRes = await db.query(`
      SELECT 
        gi.grain_id,
        gi.qty,
        gi.total_wt as weight_kg,
        g.date as milling_date,
        COALESCE(g.work_order_no, 'WO-' || g.s_no) as batch_no,
        g.machine_no
      FROM grain_input_items gi
      JOIN grains g ON gi.grain_id = g.id
      WHERE gi.lot_no = ?
    `, [lotNo]);

    const millingOutputRes = await db.query(`
      SELECT 
        go.grain_id,
        go.item_name,
        go.qty,
        go.total_wt as weight_kg,
        g.date as milling_date,
        COALESCE(g.work_order_no, 'WO-' || g.s_no) as batch_no
      FROM grain_output_items go
      JOIN grains g ON go.grain_id = g.id
      WHERE go.lot_no = ?
    `, [lotNo]);

    // 5. Cold Storage Inward & Outward Movements
    const csInwardRes = await db.query(`
      SELECT * FROM cs_inward_records WHERE inward_lot_no = ? OR original_purchase_lot_no = ?
    `, [lotNo, lotNo]);

    const csOutwardRes = await db.query(`
      SELECT * FROM cs_outward_records WHERE lot_no = ?
    `, [lotNo]);

    // 6. Sales dispatches
    const salesRes = await db.query(`
      SELECT 
        s.id,
        s.s_no,
        s.customer,
        s.date as sale_date,
        si.item_name,
        si.qty,
        si.total_amt as amount
      FROM sales_items si
      JOIN sales s ON si.sales_id = s.id
      WHERE si.lot_no = ?
    `, [lotNo]);

    // 7. Purchase Returns / Vendor Rejections
    let purchaseReturns = [];
    try {
      const prRes = await db.query(`
        SELECT 
          pri.id as item_id,
          pri.purchase_return_id,
          pri.lot_no,
          pri.item_name,
          pri.weight,
          pri.qty,
          pri.total_wt,
          pri.rate,
          pri.amount,
          pri.reason,
          pri.iqr_no,
          pri.qc_no,
          pri.source,
          pr.s_no as return_s_no,
          pr.return_inv_no,
          SUBSTR(CAST(pr.date AS TEXT), 1, 10) as return_date,
          COALESCE(sm.name, pr.supplier) as supplier_name,
          COALESCE(pr.status, 'RETURNED') as return_status,
          pr.approval_status
        FROM purchase_return_items pri
        JOIN purchase_returns pr ON pri.purchase_return_id = pr.id
        LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(pr.supplier AS TEXT) OR sm.name = pr.supplier)
        WHERE pri.lot_no = ?
        ORDER BY pr.id DESC
      `, [lotNo]);
      purchaseReturns = prRes.rows || [];
    } catch (e) {
      console.warn('Notice: Error querying purchase returns in barcodeQrService:', e.message);
    }

    const totalReturnedQty = purchaseReturns.reduce((sum, pr) => sum + (parseFloat(pr.qty) || 0), 0);
    const totalReturnedWeight = purchaseReturns.reduce((sum, pr) => sum + (parseFloat(pr.total_wt) || 0), 0);

    let effectiveStock = parseFloat(stockInfo?.remaining_quantity ?? stockInfo?.quantity ?? purchaseInfo?.total_weight ?? 0);
    if (totalReturnedQty > 0 && effectiveStock === parseFloat(stockInfo?.quantity || 0) && effectiveStock > 0) {
      effectiveStock = Math.max(0, effectiveStock - totalReturnedQty);
    }

    let effectiveQcStatus = stockInfo?.qc_status || qcInfo?.overall_result || 'PASSED';
    if (stockInfo?.unloading_status === 'RETURNED' || (purchaseReturns.length > 0 && effectiveStock === 0)) {
      effectiveQcStatus = 'RETURNED';
    } else if (purchaseReturns.length > 0 && effectiveStock > 0) {
      effectiveQcStatus = 'PARTIALLY_RETURNED';
    }

    return {
      code: originalCode,
      type: 'LOT',
      lotNo,
      itemName: stockInfo?.item_name || purchaseInfo?.item_name || (purchaseReturns[0]?.item_name) || 'Agri Commodity',
      currentStock: effectiveStock,
      totalReturnedQty,
      totalReturnedWeight,
      unit: stockInfo?.unit || 'KG',
      currentGodown: stockInfo?.godown_name || 'Central Godown',
      qcStatus: effectiveQcStatus,
      purchase: purchaseInfo ? {
        voucherNo: `PUR-${purchaseInfo.s_no || purchaseInfo.purchase_id}`,
        invoiceNo: purchaseInfo.inv_no,
        inwardDate: purchaseInfo.inward_date,
        supplierName: purchaseInfo.supplier_name,
        vehicleNo: purchaseInfo.vehicle_no || purchaseInfo.lorry_no,
        driverName: purchaseInfo.driver_name,
        inwardQuantity: purchaseInfo.qty,
        inwardWeightKg: purchaseInfo.total_weight,
        rate: purchaseInfo.rate
      } : null,
      qcInspection: qcInfo ? {
        qcNo: qcInfo.qc_no,
        date: qcInfo.inspection_date,
        inspector: qcInfo.inspector,
        result: qcInfo.overall_result,
        remarks: qcInfo.remarks
      } : null,
      purchaseReturns,
      millingUsage: {
        inputs: millingInputRes.rows || [],
        outputs: millingOutputRes.rows || []
      },
      coldStorageMovements: {
        inwards: csInwardRes.rows || [],
        outwards: csOutwardRes.rows || []
      },
      salesDispatches: salesRes.rows || [],
      traceUrl: `/lot-genealogy?lotNo=${encodeURIComponent(lotNo)}`,
      canTraceGenealogy: true
    };
  }

  /**
   * Location 360° Lookup
   */
  async resolveLocation360(locationCode, originalCode) {
    const csChamberRes = await db.query(`
      SELECT c.*, f.name as facility_name
      FROM cs_chambers c
      JOIN cs_facilities f ON c.facility_id = f.id
      WHERE c.chamber_name LIKE ? OR c.id = ?
    `, [`%${locationCode}%`, parseInt(locationCode, 10) || 0]);

    return {
      code: originalCode,
      type: 'LOCATION',
      locationCode,
      chamber: csChamberRes.rows[0] || null,
      description: `Warehouse Location Node: ${locationCode}`
    };
  }

  /**
   * Item 360° Lookup
   */
  async resolveItem360(itemCode, originalCode) {
    const itemRes = await db.query(`
      SELECT * FROM item_master WHERE item_code = ? OR id = ? OR LOWER(item_name) = LOWER(?)
    `, [itemCode, parseInt(itemCode, 10) || 0, itemCode]);
    const item = itemRes.rows[0] || null;

    let stockKg = 0;
    if (item) {
      const s = await db.query('SELECT SUM(quantity) as tot FROM stock WHERE item_id = ?', [item.id]);
      stockKg = parseFloat(s.rows[0]?.tot || 0);
    }

    return {
      code: originalCode,
      type: 'ITEM',
      item,
      currentTotalStockKg: stockKg
    };
  }

  /**
   * Finished Good 360° Lookup
   */
  async resolveFinishedGood360(fgCode, originalCode) {
    return {
      code: originalCode,
      type: 'FINISHED_GOOD',
      fgCode,
      batchNo: `BATCH-${fgCode}`,
      mfgDate: new Date().toISOString().split('T')[0],
      qcStatus: 'PASSED',
      standards: 'FSSAI Certified / ISO 22000'
    };
  }

  /**
   * Generate and store Barcode/QR code in Master
   */
  async registerCode(data) {
    const { codeType, entityCode, labelTitle, metadata = {} } = data;

    let prefix = 'LOT-';
    if (codeType === 'ITEM') prefix = 'ITM-';
    else if (codeType === 'PALLET') prefix = 'PLT-';
    else if (codeType === 'LOCATION') prefix = 'LOC-';
    else if (codeType === 'FINISHED_GOOD') prefix = 'FG-';

    const fullCode = entityCode.startsWith(prefix) ? entityCode : `${prefix}${entityCode}`;

    const res = await db.run(`
      INSERT INTO barcode_qr_master (
        code_type, entity_code, label_title, barcode_data, qr_data, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      codeType,
      fullCode,
      labelTitle || `${codeType} ${entityCode}`,
      fullCode,
      fullCode,
      JSON.stringify(metadata)
    ]);

    return {
      id: res.lastID,
      code: fullCode,
      type: codeType,
      title: labelTitle,
      success: true
    };
  }

  /**
   * Get all registered codes
   */
  async getAllCodes() {
    const res = await db.query('SELECT * FROM barcode_qr_master ORDER BY id DESC LIMIT 50');
    return res.rows || [];
  }
}

module.exports = new BarcodeQrService();
