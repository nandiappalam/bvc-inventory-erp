const db = require('../config/database');
const { logEvent } = require('./AuditService');

const safeFloat = (val, fallback = 0) => {
  if (val === null || val === undefined || val === '') return fallback;
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
};

const safeInt = (val, fallback = 0) => {
  if (val === null || val === undefined || val === '') return fallback;
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
};

class ColdStorageIntelligenceService {
  /**
   * Helper to ensure default facilities & chambers exist
   */
  async ensureDefaultFacilities() {
    try {
      const facRes = await db.query('SELECT COUNT(*) as cnt FROM cs_facilities');
      if (safeInt(facRes.rows?.[0]?.cnt) === 0) {
        await db.run(`
          INSERT INTO cs_facilities (name, address, facility_type, capacity_kg, unit, is_active)
          VALUES 
            ('BVC Central Cold Storage', 'Industrial Zone Phase II, Plot 42', 'OWN', 100000, 'KG', 1),
            ('AgroChill External Facility', 'National Highway 44, Bypass', 'EXTERNAL', 50000, 'KG', 1)
        `);

        const centralFac = await db.query("SELECT id FROM cs_facilities WHERE name = 'BVC Central Cold Storage' LIMIT 1");
        const facId = centralFac.rows?.[0]?.id || 1;

        await db.run(`
          INSERT INTO cs_chambers (facility_id, chamber_name, capacity_kg, min_temp, max_temp, warning_temp, critical_temp, current_temp, current_humidity, status)
          VALUES 
            (?, 'Chamber 01 (Deep Chill)', 35000, 1.0, 4.0, 6.0, 8.0, 3.2, 86.0, 'NORMAL'),
            (?, 'Chamber 02 (Grain Vault)', 40000, 3.0, 6.0, 8.0, 10.0, 4.5, 88.0, 'NORMAL'),
            (?, 'Chamber 03 (Flour & Finished Goods)', 25000, 4.0, 8.0, 9.0, 12.0, 5.1, 82.0, 'NORMAL')
        `, [facId, facId, facId]);

        const ch1 = await db.query("SELECT id FROM cs_chambers WHERE chamber_name LIKE '%Chamber 01%' LIMIT 1");
        if (ch1.rows?.[0]?.id) {
          await db.run(`
            INSERT INTO cs_racks (chamber_id, rack_name, positions_count)
            VALUES (?, 'Rack A', 10), (?, 'Rack B', 10), (?, 'Rack C', 10)
          `, [ch1.rows[0].id, ch1.rows[0].id, ch1.rows[0].id]);
        }
      }
    } catch (e) {
      console.warn('Cold storage default facility check warning:', e.message);
    }
  }

  /**
   * Cold Storage Control Center Overview Metrics & KPIs
   */
  async getControlCenterStats() {
    try {
      await this.ensureDefaultFacilities();

      // 1. Facility & Capacity stats
      const facRes = await db.query('SELECT COUNT(*) as cnt, SUM(capacity_kg) as total_cap FROM cs_facilities WHERE is_active = 1');
      const totalFacilities = safeInt(facRes.rows?.[0]?.cnt, 0);
      const totalCapacityKg = safeFloat(facRes.rows?.[0]?.total_cap, 100000);

      // 2. Chamber stats & Occupancy calculation
      const chambersRes = await db.query(`
        SELECT c.*, f.name as facility_name
        FROM cs_chambers c
        JOIN cs_facilities f ON c.facility_id = f.id
        ORDER BY c.facility_id, c.id
      `);
      const chambers = chambersRes.rows || [];

      // Calculate stock currently sitting in cold storage
      // Sum Inwards - Sum Outwards per chamber (combining cs_inward_records + cold_storage_vouchers)
      const stockByChamber = {};

      // Inwards from cs_inward_records
      try {
        const inwardSumRes = await db.query(`
          SELECT chamber_id, SUM(weight_kg) as inward_kg
          FROM cs_inward_records
          GROUP BY chamber_id
        `);
        (inwardSumRes.rows || []).forEach(r => {
          if (r.chamber_id) {
            stockByChamber[r.chamber_id] = (stockByChamber[r.chamber_id] || 0) + safeFloat(r.inward_kg);
          }
        });
      } catch (e) {}

      // Outwards from cs_outward_records
      try {
        const outwardSumRes = await db.query(`
          SELECT chamber_id, SUM(weight_kg) as outward_kg
          FROM cs_outward_records
          GROUP BY chamber_id
        `);
        (outwardSumRes.rows || []).forEach(r => {
          if (r.chamber_id) {
            stockByChamber[r.chamber_id] = (stockByChamber[r.chamber_id] || 0) - safeFloat(r.outward_kg);
          }
        });
      } catch (e) {}

      // Inwards from cold_storage_vouchers (type = 'IN')
      try {
        const csVouchersInRes = await db.query(`
          SELECT v.cold_storage_id, SUM(ci.total_wt) as inward_kg
          FROM cold_storage_vouchers v
          JOIN cold_storage_items ci ON ci.voucher_id = v.id
          WHERE v.voucher_type = 'IN'
          GROUP BY v.cold_storage_id
        `);
        const defaultChId = chambers[0]?.id || 1;
        (csVouchersInRes.rows || []).forEach(r => {
          const chId = r.cold_storage_id || defaultChId;
          stockByChamber[chId] = (stockByChamber[chId] || 0) + safeFloat(r.inward_kg);
        });
      } catch (e) {}

      // Outwards from cold_storage_vouchers (type = 'OUT')
      try {
        const csVouchersOutRes = await db.query(`
          SELECT v.cold_storage_id, SUM(ci.total_wt) as outward_kg
          FROM cold_storage_vouchers v
          JOIN cold_storage_items ci ON ci.voucher_id = v.id
          WHERE v.voucher_type = 'OUT'
          GROUP BY v.cold_storage_id
        `);
        const defaultChId = chambers[0]?.id || 1;
        (csVouchersOutRes.rows || []).forEach(r => {
          const chId = r.cold_storage_id || defaultChId;
          stockByChamber[chId] = (stockByChamber[chId] || 0) - safeFloat(r.outward_kg);
        });
      } catch (e) {}

      let totalOccupiedKg = 0;
      const chamberList = chambers.map(ch => {
        const rawOcc = stockByChamber[ch.id] || 0;
        const occ = Math.max(0, rawOcc);
        totalOccupiedKg += occ;
        const cap = safeFloat(ch.capacity_kg, 20000);
        const avail = Math.max(0, cap - occ);
        const occPct = cap > 0 ? Math.round((occ / cap) * 100) : 0;
        
        let status = 'NORMAL';
        const curTemp = safeFloat(ch.current_temp, 4.0);
        const warnTemp = safeFloat(ch.warning_temp, 8.0);
        const critTemp = safeFloat(ch.critical_temp, 10.0);

        if (curTemp > warnTemp || occPct > 90) status = 'WARNING';
        if (curTemp > critTemp || occPct > 98) status = 'CRITICAL';

        return {
          id: ch.id,
          chamberName: ch.chamber_name,
          facilityId: ch.facility_id,
          facilityName: ch.facility_name,
          capacityKg: cap,
          occupiedKg: occ,
          availableKg: avail,
          occupancyPct: occPct,
          currentTemp: curTemp,
          currentHumidity: safeFloat(ch.current_humidity, 85.0),
          minTemp: safeFloat(ch.min_temp, 1.0),
          maxTemp: safeFloat(ch.max_temp, 6.0),
          warningTemp: warnTemp,
          criticalTemp: critTemp,
          status
        };
      });

      const availableCapacityKg = Math.max(0, totalCapacityKg - totalOccupiedKg);

      // 3. Alerts count
      const temperatureAlertsCount = chamberList.filter(c => c.status === 'WARNING' || c.status === 'CRITICAL').length;

      // 4. Aging lots (> 90 days in cold storage)
      const agingCutoff = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
      let agingLotsCount = 0;
      try {
        const agingRes = await db.query(`
          SELECT COUNT(DISTINCT inward_lot_no) as cnt 
          FROM cs_inward_records 
          WHERE CAST(inward_date AS TEXT) <= ?
        `, [agingCutoff]);
        agingLotsCount += safeInt(agingRes.rows?.[0]?.cnt, 0);
      } catch (e) {}

      try {
        const agingVcsRes = await db.query(`
          SELECT COUNT(DISTINCT ci.cold_storage_lot_no) as cnt 
          FROM cold_storage_vouchers v
          JOIN cold_storage_items ci ON ci.voucher_id = v.id
          WHERE v.voucher_type = 'IN' AND CAST(v.voucher_date AS TEXT) <= ?
        `, [agingCutoff]);
        agingLotsCount += safeInt(agingVcsRes.rows?.[0]?.cnt, 0);
      } catch (e) {}

      // 5. QC Hold Lots
      let qcHoldCount = 0;
      try {
        const qcHoldRes = await db.query(`
          SELECT COUNT(DISTINCT inward_lot_no) as cnt 
          FROM cs_inward_records 
          WHERE qc_status = 'HOLD' OR qc_status = 'REJECTED'
        `);
        qcHoldCount = safeInt(qcHoldRes.rows?.[0]?.cnt, 0);
      } catch (e) {}

      return {
        totalFacilities,
        totalCapacityKg,
        totalCapacityMT: Number((totalCapacityKg / 1000).toFixed(2)),
        totalOccupiedKg,
        totalOccupiedMT: Number((totalOccupiedKg / 1000).toFixed(2)),
        availableCapacityKg,
        availableCapacityMT: Number((availableCapacityKg / 1000).toFixed(2)),
        occupancyOverallPct: totalCapacityKg > 0 ? Math.round((totalOccupiedKg / totalCapacityKg) * 100) : 0,
        temperatureAlertsCount,
        agingLotsCount,
        qcHoldCount,
        chambers: chamberList
      };
    } catch (err) {
      console.error('Error in getControlCenterStats:', err);
      throw err;
    }
  }

  /**
   * Get all Facilities with their Chambers and Racks
   */
  async getFacilitiesMaster() {
    await this.ensureDefaultFacilities();
    const facilities = (await db.query('SELECT * FROM cs_facilities ORDER BY id ASC')).rows || [];
    const chambers = (await db.query('SELECT * FROM cs_chambers ORDER BY id ASC')).rows || [];
    const racks = (await db.query('SELECT * FROM cs_racks ORDER BY id ASC')).rows || [];

    return facilities.map(fac => ({
      ...fac,
      chambers: chambers.filter(c => c.facility_id === fac.id).map(ch => ({
        ...ch,
        racks: racks.filter(r => r.chamber_id === ch.id)
      }))
    }));
  }

  /**
   * Inward Transaction (CSI) with Capacity Enforcement & Lot Lineage
   */
  async recordInwardCSI(data) {
    await this.ensureDefaultFacilities();

    const {
      csiNo,
      inwardDate,
      supplierName,
      itemName,
      inwardLotNo,
      originalPurchaseLotNo,
      qtyBags = 0,
      weightKg,
      unit = 'KG',
      facilityId,
      chamberId,
      rackName = '',
      positionName = '',
      tempRecorded,
      humidityRecorded,
      qcStatus = 'PASSED',
      remarks = '',
      createdBy = 'Admin'
    } = data;

    if (!inwardLotNo || !itemName || !weightKg || !chamberId) {
      throw new Error('Inward Lot No, Item Name, Weight, and Chamber are required.');
    }

    const weight = safeFloat(weightKg, 0);
    if (weight <= 0) {
      throw new Error('Valid inward weight is required.');
    }

    // 1. Chamber Lookup
    let chamberRes = await db.query('SELECT * FROM cs_chambers WHERE id = ?', [chamberId]);
    if (!chamberRes.rows?.length) {
      chamberRes = await db.query('SELECT * FROM cs_chambers LIMIT 1');
      if (!chamberRes.rows?.length) {
        throw new Error(`Chamber with ID ${chamberId} not found.`);
      }
    }
    const chamber = chamberRes.rows[0];
    const chamberCap = safeFloat(chamber.capacity_kg, 20000);

    // Calculate current occupancy of chamber
    const inSum = await db.query('SELECT SUM(weight_kg) as tot FROM cs_inward_records WHERE chamber_id = ?', [chamber.id]);
    const outSum = await db.query('SELECT SUM(weight_kg) as tot FROM cs_outward_records WHERE chamber_id = ?', [chamber.id]);
    const currentOcc = Math.max(0, safeFloat(inSum.rows?.[0]?.tot) - safeFloat(outSum.rows?.[0]?.tot));

    if (currentOcc + weight > chamberCap) {
      const excess = (currentOcc + weight) - chamberCap;
      throw new Error(`Capacity Exceeded! Chamber '${chamber.chamber_name}' has ${Math.max(0, chamberCap - currentOcc).toFixed(1)} KG available. Inward of ${weight} KG exceeds maximum limit by ${excess.toFixed(1)} KG.`);
    }

    // Lookup facility name
    const facRes = await db.query('SELECT name FROM cs_facilities WHERE id = ?', [chamber.facility_id]);
    const facilityName = facRes.rows?.[0]?.name || 'Cold Storage Facility';

    const generatedCsiNo = csiNo || `CSI-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    const res = await db.run(`
      INSERT INTO cs_inward_records (
        csi_no, inward_date, supplier_name, item_name, inward_lot_no, original_purchase_lot_no,
        qty_bags, weight_kg, unit, facility_id, facility_name, chamber_id, chamber_name,
        rack_name, position_name, temp_recorded, humidity_recorded, qc_status, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      generatedCsiNo,
      inwardDate || new Date().toISOString().split('T')[0],
      supplierName || 'Primary Supplier',
      itemName,
      inwardLotNo,
      originalPurchaseLotNo || inwardLotNo,
      safeFloat(qtyBags, 0),
      weight,
      unit,
      chamber.facility_id,
      facilityName,
      chamber.id,
      chamber.chamber_name,
      rackName,
      positionName,
      tempRecorded !== undefined && tempRecorded !== '' ? safeFloat(tempRecorded) : safeFloat(chamber.current_temp, 4.0),
      humidityRecorded !== undefined && humidityRecorded !== '' ? safeFloat(humidityRecorded) : safeFloat(chamber.current_humidity, 85.0),
      qcStatus,
      remarks,
      createdBy
    ]);

    // Audit log
    await logEvent({
      entityType: 'COLD_STORAGE_INWARD',
      entityId: generatedCsiNo,
      action: 'CREATE',
      details: `Inward ${weight} KG of ${itemName} (Lot: ${inwardLotNo}) into ${chamber.chamber_name}`,
      createdBy
    });

    return { id: res.lastID || res.rows?.[0]?.id, csiNo: generatedCsiNo, success: true };
  }

  /**
   * Outward Transaction (CSO) with Available Balance Validation & Destination Transfer
   */
  async recordOutwardCSO(data) {
    await this.ensureDefaultFacilities();

    const {
      csoNo,
      outwardDate,
      chamberId,
      rackName = '',
      itemName,
      lotNo,
      qtyBags = 0,
      weightKg,
      purpose = 'Production Milling',
      destinationGodownId,
      destinationGodownName = 'Main Godown',
      referenceNo = '',
      createdBy = 'Admin'
    } = data;

    if (!lotNo || !itemName || !weightKg || !chamberId) {
      throw new Error('Lot No, Item Name, Weight, and Chamber are required.');
    }

    const requestedWeight = safeFloat(weightKg, 0);
    if (requestedWeight <= 0) {
      throw new Error('Valid outward weight is required.');
    }

    // 1. Validate Requested Qty <= Available Lot Qty in this chamber
    const inSumRes = await db.query(`
      SELECT SUM(weight_kg) as tot 
      FROM cs_inward_records 
      WHERE chamber_id = ? AND (inward_lot_no = ? OR original_purchase_lot_no = ?)
    `, [chamberId, lotNo, lotNo]);
    const inTotal = safeFloat(inSumRes.rows?.[0]?.tot, 0);

    const outSumRes = await db.query(`
      SELECT SUM(weight_kg) as tot 
      FROM cs_outward_records 
      WHERE chamber_id = ? AND lot_no = ?
    `, [chamberId, lotNo]);
    const outTotal = safeFloat(outSumRes.rows?.[0]?.tot, 0);

    // Also check cold storage vouchers
    let voucherInTotal = 0;
    let voucherOutTotal = 0;
    try {
      const vIn = await db.query(`
        SELECT SUM(ci.total_wt) as tot
        FROM cold_storage_vouchers v
        JOIN cold_storage_items ci ON ci.voucher_id = v.id
        WHERE v.voucher_type = 'IN' AND (ci.cold_storage_lot_no = ? OR ci.purchase_lot_no = ?)
      `, [lotNo, lotNo]);
      voucherInTotal = safeFloat(vIn.rows?.[0]?.tot, 0);

      const vOut = await db.query(`
        SELECT SUM(ci.total_wt) as tot
        FROM cold_storage_vouchers v
        JOIN cold_storage_items ci ON ci.voucher_id = v.id
        WHERE v.voucher_type = 'OUT' AND (ci.cold_storage_lot_no = ? OR ci.purchase_lot_no = ?)
      `, [lotNo, lotNo]);
      voucherOutTotal = safeFloat(vOut.rows?.[0]?.tot, 0);
    } catch (e) {}

    const totalAvailable = Math.max(0, (inTotal + voucherInTotal) - (outTotal + voucherOutTotal));

    if (totalAvailable > 0 && requestedWeight > totalAvailable) {
      throw new Error(`Insufficient Lot Stock! Available in this chamber for lot '${lotNo}' is ${totalAvailable.toFixed(1)} KG, but requested ${requestedWeight.toFixed(1)} KG.`);
    }

    // Fetch chamber & facility details
    let chRes = await db.query('SELECT c.*, f.name as facility_name FROM cs_chambers c JOIN cs_facilities f ON c.facility_id = f.id WHERE c.id = ?', [chamberId]);
    if (!chRes.rows?.length) {
      chRes = await db.query('SELECT c.*, f.name as facility_name FROM cs_chambers c JOIN cs_facilities f ON c.facility_id = f.id LIMIT 1');
      if (!chRes.rows?.length) throw new Error('Chamber not found');
    }
    const chamber = chRes.rows[0];

    const generatedCsoNo = csoNo || `CSO-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    const res = await db.run(`
      INSERT INTO cs_outward_records (
        cso_no, outward_date, facility_id, facility_name, chamber_id, chamber_name,
        rack_name, item_name, lot_no, qty_bags, weight_kg, purpose,
        destination_godown_id, destination_godown_name, reference_no, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      generatedCsoNo,
      outwardDate || new Date().toISOString().split('T')[0],
      chamber.facility_id,
      chamber.facility_name,
      chamber.id,
      chamber.chamber_name,
      rackName,
      itemName,
      lotNo,
      safeFloat(qtyBags, 0),
      requestedWeight,
      purpose,
      destinationGodownId || null,
      destinationGodownName,
      referenceNo,
      createdBy
    ]);

    // Audit log
    await logEvent({
      entityType: 'COLD_STORAGE_OUTWARD',
      entityId: generatedCsoNo,
      action: 'CREATE',
      details: `Dispatched ${requestedWeight} KG of ${itemName} (Lot: ${lotNo}) to ${destinationGodownName}`,
      createdBy
    });

    return { id: res.lastID || res.rows?.[0]?.id, csoNo: generatedCsoNo, success: true };
  }

  /**
   * Temperature & Humidity Monitoring Logs
   */
  async getTemperatureLogs(chamberId = null) {
    await this.ensureDefaultFacilities();
    let sql = `
      SELECT t.*, c.chamber_name, f.name as facility_name, c.min_temp, c.max_temp, c.warning_temp, c.critical_temp
      FROM cs_temperature_logs t
      JOIN cs_chambers c ON t.chamber_id = c.id
      JOIN cs_facilities f ON t.facility_id = f.id
    `;
    const params = [];
    if (chamberId) {
      sql += ` WHERE t.chamber_id = ? `;
      params.push(chamberId);
    }
    sql += ` ORDER BY t.log_date DESC, t.log_time DESC, t.id DESC LIMIT 100`;

    const res = await db.query(sql, params);
    return res.rows || [];
  }

  async recordTemperatureLog(data) {
    await this.ensureDefaultFacilities();
    const { facilityId, chamberId, temperature, humidity, recordedBy = 'Shift In-Charge', remarks = '' } = data;

    let chamberRes = await db.query('SELECT * FROM cs_chambers WHERE id = ?', [chamberId]);
    if (!chamberRes.rows?.length) {
      chamberRes = await db.query('SELECT * FROM cs_chambers LIMIT 1');
      if (!chamberRes.rows?.length) throw new Error('Chamber not found');
    }
    const chamber = chamberRes.rows[0];

    const temp = safeFloat(temperature, safeFloat(chamber.current_temp, 4.0));
    const hum = safeFloat(humidity, safeFloat(chamber.current_humidity, 85.0));

    let status = 'NORMAL';
    if (temp >= safeFloat(chamber.warning_temp, 8.0) || temp < safeFloat(chamber.min_temp, 1.0)) {
      status = 'WARNING';
    }
    if (temp >= safeFloat(chamber.critical_temp, 10.0)) {
      status = 'CRITICAL';
    }

    const now = new Date();
    const logDate = now.toISOString().split('T')[0];
    const logTime = now.toTimeString().split(' ')[0].substring(0, 5);

    const res = await db.run(`
      INSERT INTO cs_temperature_logs (
        facility_id, chamber_id, log_date, log_time, temperature, humidity, recorded_by, status, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      chamber.facility_id,
      chamber.id,
      logDate,
      logTime,
      temp,
      hum,
      recordedBy,
      status,
      remarks
    ]);

    // Update chamber current temp & status
    await db.run(`
      UPDATE cs_chambers 
      SET current_temp = ?, current_humidity = ?, status = ?
      WHERE id = ?
    `, [temp, hum, status, chamber.id]);

    // If WARNING or CRITICAL, log notification alert!
    if (status !== 'NORMAL') {
      try {
        await db.run(`
          INSERT INTO system_notifications (alert_type, title, message, severity, reference_module, reference_id)
          VALUES (?, ?, ?, ?, 'COLD_STORAGE', ?)
        `, [
          'TEMP_ALERT',
          `Cold Storage Temp ${status}: ${chamber.chamber_name}`,
          `Temperature recorded at ${temp}°C (Critical Limit: ${chamber.critical_temp}°C). Recorded by ${recordedBy}.`,
          status === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
          String(chamber.id)
        ]);
      } catch (e) {}
    }

    return { id: res.lastID || res.rows?.[0]?.id, status, success: true };
  }

  /**
   * Chamber Lot Inventory Details
   */
  async getChamberInventory(chamberId) {
    await this.ensureDefaultFacilities();

    // 1. Direct CSI records
    const inwards = await db.query(`
      SELECT * FROM cs_inward_records 
      WHERE chamber_id = ? 
      ORDER BY inward_date DESC, id DESC
    `, [chamberId]);

    const outwards = await db.query(`
      SELECT * FROM cs_outward_records 
      WHERE chamber_id = ?
    `, [chamberId]);

    // Build lot-level balance
    const lotMap = {};
    (inwards.rows || []).forEach(inw => {
      const lot = inw.inward_lot_no;
      if (!lotMap[lot]) {
        lotMap[lot] = {
          lotNo: lot,
          originalPurchaseLotNo: inw.original_purchase_lot_no || lot,
          itemName: inw.item_name,
          supplierName: inw.supplier_name,
          chamberName: inw.chamber_name,
          rackName: inw.rack_name,
          positionName: inw.position_name,
          inwardDate: inw.inward_date,
          qcStatus: inw.qc_status,
          totalInwardKg: 0,
          totalOutwardKg: 0,
          currentStockKg: 0,
          unit: inw.unit
        };
      }
      lotMap[lot].totalInwardKg += safeFloat(inw.weight_kg);
    });

    (outwards.rows || []).forEach(outw => {
      const lot = outw.lot_no;
      if (lotMap[lot]) {
        lotMap[lot].totalOutwardKg += safeFloat(outw.weight_kg);
      }
    });

    // 2. Also incorporate vouchers from Cold Storage In/Out
    try {
      const vcsIn = await db.query(`
        SELECT v.voucher_date, v.cold_storage_name, ci.*
        FROM cold_storage_vouchers v
        JOIN cold_storage_items ci ON ci.voucher_id = v.id
        WHERE v.voucher_type = 'IN' AND (v.cold_storage_id = ? OR ? = 1)
      `, [chamberId, chamberId]);

      (vcsIn.rows || []).forEach(inw => {
        const lot = inw.cold_storage_lot_no || inw.purchase_lot_no;
        if (!lotMap[lot]) {
          lotMap[lot] = {
            lotNo: lot,
            originalPurchaseLotNo: inw.purchase_lot_no || lot,
            itemName: inw.item_name,
            supplierName: 'Direct Inward',
            chamberName: inw.cold_storage_name || 'Cold Storage Chamber',
            rackName: 'Rack A',
            positionName: 'P-01',
            inwardDate: inw.voucher_date,
            qcStatus: 'PASSED',
            totalInwardKg: 0,
            totalOutwardKg: 0,
            currentStockKg: 0,
            unit: inw.unit || 'KG'
          };
        }
        lotMap[lot].totalInwardKg += safeFloat(inw.total_wt);
      });

      const vcsOut = await db.query(`
        SELECT v.voucher_date, ci.*
        FROM cold_storage_vouchers v
        JOIN cold_storage_items ci ON ci.voucher_id = v.id
        WHERE v.voucher_type = 'OUT' AND (v.cold_storage_id = ? OR ? = 1)
      `, [chamberId, chamberId]);

      (vcsOut.rows || []).forEach(outw => {
        const lot = outw.cold_storage_lot_no || outw.purchase_lot_no;
        if (lotMap[lot]) {
          lotMap[lot].totalOutwardKg += safeFloat(outw.total_wt);
        }
      });
    } catch (e) {}

    return Object.values(lotMap).map(lot => {
      const bal = Math.max(0, lot.totalInwardKg - lot.totalOutwardKg);
      const daysInStorage = lot.inwardDate ? Math.floor((Date.now() - new Date(lot.inwardDate).getTime()) / 86400000) : 0;
      return {
        ...lot,
        currentStockKg: bal,
        daysInStorage: isNaN(daysInStorage) ? 0 : daysInStorage,
        isAging: daysInStorage > 90
      };
    }).filter(l => l.currentStockKg > 0);
  }
}

module.exports = new ColdStorageIntelligenceService();
