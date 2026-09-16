const db = require('../config/database');
const { logEvent } = require('./AuditService');

class ColdStorageIntelligenceService {
  /**
   * Cold Storage Control Center Overview Metrics & KPIs
   */
  async getControlCenterStats() {
    try {
      // 1. Facility & Capacity stats
      const facRes = await db.query('SELECT COUNT(*) as cnt, SUM(capacity_kg) as total_cap FROM cs_facilities WHERE is_active = 1');
      const totalFacilities = parseInt(facRes.rows[0]?.cnt || 0, 10);
      const totalCapacityKg = parseFloat(facRes.rows[0]?.total_cap || 0);

      // 2. Chamber stats & Occupancy calculation
      const chambersRes = await db.query(`
        SELECT c.*, f.name as facility_name
        FROM cs_chambers c
        JOIN cs_facilities f ON c.facility_id = f.id
        ORDER BY c.facility_id, c.id
      `);
      const chambers = chambersRes.rows || [];

      // Calculate stock currently sitting in cold storage
      // Sum Inwards - Sum Outwards per chamber
      const stockByChamber = {};
      const inwardSumRes = await db.query(`
        SELECT chamber_id, SUM(weight_kg) as inward_kg
        FROM cs_inward_records
        GROUP BY chamber_id
      `);
      (inwardSumRes.rows || []).forEach(r => {
        stockByChamber[r.chamber_id] = parseFloat(r.inward_kg || 0);
      });

      const outwardSumRes = await db.query(`
        SELECT chamber_id, SUM(weight_kg) as outward_kg
        FROM cs_outward_records
        GROUP BY chamber_id
      `);
      (outwardSumRes.rows || []).forEach(r => {
        stockByChamber[r.chamber_id] = (stockByChamber[r.chamber_id] || 0) - parseFloat(r.outward_kg || 0);
        if (stockByChamber[r.chamber_id] < 0) stockByChamber[r.chamber_id] = 0;
      });

      let totalOccupiedKg = 0;
      const chamberList = chambers.map(ch => {
        const occ = stockByChamber[ch.id] || 0;
        totalOccupiedKg += occ;
        const cap = parseFloat(ch.capacity_kg || 20000);
        const avail = Math.max(0, cap - occ);
        const occPct = cap > 0 ? Math.round((occ / cap) * 100) : 0;
        
        let status = 'NORMAL';
        if (ch.current_temp > ch.warning_temp || occPct > 90) status = 'WARNING';
        if (ch.current_temp > ch.critical_temp || occPct > 98) status = 'CRITICAL';

        return {
          id: ch.id,
          chamberName: ch.chamber_name,
          facilityId: ch.facility_id,
          facilityName: ch.facility_name,
          capacityKg: cap,
          occupiedKg: occ,
          availableKg: avail,
          occupancyPct: occPct,
          currentTemp: ch.current_temp,
          currentHumidity: ch.current_humidity,
          minTemp: ch.min_temp,
          maxTemp: ch.max_temp,
          warningTemp: ch.warning_temp,
          criticalTemp: ch.critical_temp,
          status
        };
      });

      const availableCapacityKg = Math.max(0, totalCapacityKg - totalOccupiedKg);

      // 3. Alerts count
      const temperatureAlertsCount = chamberList.filter(c => c.status === 'WARNING' || c.status === 'CRITICAL').length;

      // 4. Aging lots (> 90 days in cold storage)
      const agingCutoff = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
      const agingRes = await db.query(`
        SELECT COUNT(DISTINCT inward_lot_no) as cnt 
        FROM cs_inward_records 
        WHERE inward_date <= ?
      `, [agingCutoff]);
      const agingLotsCount = parseInt(agingRes.rows[0]?.cnt || 0, 10);

      // 5. QC Hold Lots
      const qcHoldRes = await db.query(`
        SELECT COUNT(DISTINCT inward_lot_no) as cnt 
        FROM cs_inward_records 
        WHERE qc_status = 'HOLD' OR qc_status = 'REJECTED'
      `);
      const qcHoldCount = parseInt(qcHoldRes.rows[0]?.cnt || 0, 10);

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

    const weight = parseFloat(weightKg);

    // 1. Capacity Check: Prevent inward when configured chamber capacity is exceeded!
    const chamberRes = await db.query('SELECT * FROM cs_chambers WHERE id = ?', [chamberId]);
    if (!chamberRes.rows.length) {
      throw new Error(`Chamber with ID ${chamberId} not found.`);
    }
    const chamber = chamberRes.rows[0];
    const chamberCap = parseFloat(chamber.capacity_kg || 20000);

    // Calculate current occupancy of chamber
    const inSum = await db.query('SELECT SUM(weight_kg) as tot FROM cs_inward_records WHERE chamber_id = ?', [chamberId]);
    const outSum = await db.query('SELECT SUM(weight_kg) as tot FROM cs_outward_records WHERE chamber_id = ?', [chamberId]);
    const currentOcc = Math.max(0, parseFloat(inSum.rows[0]?.tot || 0) - parseFloat(outSum.rows[0]?.tot || 0));

    if (currentOcc + weight > chamberCap) {
      const excess = (currentOcc + weight) - chamberCap;
      throw new Error(`Capacity Exceeded! Chamber '${chamber.chamber_name}' has ${Math.max(0, chamberCap - currentOcc).toFixed(1)} KG available. Inward of ${weight} KG exceeds maximum limit by ${excess.toFixed(1)} KG.`);
    }

    // Lookup facility name
    const facRes = await db.query('SELECT name FROM cs_facilities WHERE id = ?', [chamber.facility_id]);
    const facilityName = facRes.rows[0]?.name || 'Cold Storage Facility';

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
      parseFloat(qtyBags || 0),
      weight,
      unit,
      chamber.facility_id,
      facilityName,
      chamberId,
      chamber.chamber_name,
      rackName,
      positionName,
      tempRecorded !== undefined ? parseFloat(tempRecorded) : chamber.current_temp,
      humidityRecorded !== undefined ? parseFloat(humidityRecorded) : chamber.current_humidity,
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

    return { id: res.lastID, csiNo: generatedCsiNo, success: true };
  }

  /**
   * Outward Transaction (CSO) with Available Balance Validation & Destination Transfer
   */
  async recordOutwardCSO(data) {
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

    const requestedWeight = parseFloat(weightKg);

    // 1. Validate Requested Qty <= Available Lot Qty in this chamber
    const inSumRes = await db.query(`
      SELECT SUM(weight_kg) as tot 
      FROM cs_inward_records 
      WHERE chamber_id = ? AND (inward_lot_no = ? OR original_purchase_lot_no = ?)
    `, [chamberId, lotNo, lotNo]);
    const inTotal = parseFloat(inSumRes.rows[0]?.tot || 0);

    const outSumRes = await db.query(`
      SELECT SUM(weight_kg) as tot 
      FROM cs_outward_records 
      WHERE chamber_id = ? AND lot_no = ?
    `, [chamberId, lotNo]);
    const outTotal = parseFloat(outSumRes.rows[0]?.tot || 0);

    const availableLotQty = Math.max(0, inTotal - outTotal);

    if (requestedWeight > availableLotQty) {
      throw new Error(`Insufficient Lot Stock! Available in this chamber for lot '${lotNo}' is ${availableLotQty.toFixed(1)} KG, but requested ${requestedWeight.toFixed(1)} KG.`);
    }

    // Fetch chamber & facility details
    const chRes = await db.query('SELECT c.*, f.name as facility_name FROM cs_chambers c JOIN cs_facilities f ON c.facility_id = f.id WHERE c.id = ?', [chamberId]);
    const chamber = chRes.rows[0];
    if (!chamber) throw new Error('Chamber not found');

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
      chamberId,
      chamber.chamber_name,
      rackName,
      itemName,
      lotNo,
      parseFloat(qtyBags || 0),
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

    return { id: res.lastID, csoNo: generatedCsoNo, success: true };
  }

  /**
   * Temperature & Humidity Monitoring Logs
   */
  async getTemperatureLogs(chamberId = null) {
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
    const { facilityId, chamberId, temperature, humidity, recordedBy = 'Shift In-Charge', remarks = '' } = data;

    const chamberRes = await db.query('SELECT * FROM cs_chambers WHERE id = ?', [chamberId]);
    if (!chamberRes.rows.length) throw new Error('Chamber not found');
    const chamber = chamberRes.rows[0];

    const temp = parseFloat(temperature);
    const hum = parseFloat(humidity);

    let status = 'NORMAL';
    if (temp >= chamber.warning_temp || temp < chamber.min_temp) {
      status = 'WARNING';
    }
    if (temp >= chamber.critical_temp) {
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
      chamberId,
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
    `, [temp, hum, status, chamberId]);

    // If WARNING or CRITICAL, log notification alert!
    if (status !== 'NORMAL') {
      await db.run(`
        INSERT INTO system_notifications (alert_type, title, message, severity, reference_module, reference_id)
        VALUES (?, ?, ?, ?, 'COLD_STORAGE', ?)
      `, [
        'TEMP_ALERT',
        `Cold Storage Temp ${status}: ${chamber.chamber_name}`,
        `Temperature recorded at ${temp}°C (Critical Limit: ${chamber.critical_temp}°C). Recorded by ${recordedBy}.`,
        status === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        String(chamberId)
      ]);
    }

    return { id: res.lastID, status, success: true };
  }

  /**
   * Chamber Lot Inventory Details
   */
  async getChamberInventory(chamberId) {
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
      lotMap[lot].totalInwardKg += parseFloat(inw.weight_kg || 0);
    });

    (outwards.rows || []).forEach(outw => {
      const lot = outw.lot_no;
      if (lotMap[lot]) {
        lotMap[lot].totalOutwardKg += parseFloat(outw.weight_kg || 0);
      }
    });

    return Object.values(lotMap).map(lot => {
      const bal = Math.max(0, lot.totalInwardKg - lot.totalOutwardKg);
      const daysInStorage = Math.floor((Date.now() - new Date(lot.inwardDate).getTime()) / 86400000);
      return {
        ...lot,
        currentStockKg: bal,
        daysInStorage,
        isAging: daysInStorage > 90
      };
    }).filter(l => l.currentStockKg > 0);
  }
}

module.exports = new ColdStorageIntelligenceService();
