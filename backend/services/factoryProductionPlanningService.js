const db = require('../config/database');
const { loadPartyDirectory, resolveSupplierFromDirectory, resolveCustomerFromDirectory } = require('./PartyNameResolver');

/**
 * Factory Production Planning + Queue + Material Availability + Customer Demand Service
 * High-performance deterministic planning engine for BVC ERP
 */

class FactoryProductionPlanningService {
  getRunner(companyId) {
    const cid = parseInt(companyId, 10);
    return db.forCompany(Number.isSafeInteger(cid) && cid > 0 ? cid : 1);
  }
  /**
   * Helper to format dates safely for cross-platform SQLite / PostgreSQL
   */
  formatDateTime(date = new Date()) {
    return date.toISOString();
  }

  /**
   * Calculate Production Time dynamically from capacity rules
   */
  calculateProductionTimeMins(inputKg, capacityKgPerHr = 250, setupMins = 15, cleaningMins = 20, qcMins = 10) {
    const rawHours = (parseFloat(inputKg) || 0) / (parseFloat(capacityKgPerHr) || 250);
    const prodMins = Math.round(rawHours * 60);
    const totalMins = prodMins + setupMins + cleaningMins + qcMins;
    return {
      prodMins,
      setupMins,
      cleaningMins,
      qcMins,
      totalMins,
      hoursFormatted: `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`
    };
  }

  async ensureTables(companyId = 1) {
    const runner = this.getRunner(companyId);
    try {
      await runner.run(`
        CREATE TABLE IF NOT EXISTS production_units (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          unit_code TEXT UNIQUE NOT NULL,
          unit_name TEXT NOT NULL,
          process_stage TEXT NOT NULL,
          capacity_kg_per_hr REAL DEFAULT 250,
          setup_time_mins INTEGER DEFAULT 15,
          cleaning_time_mins INTEGER DEFAULT 20,
          qc_time_mins INTEGER DEFAULT 10,
          status TEXT DEFAULT 'READY',
          current_job_id INTEGER,
          current_job_code TEXT,
          current_product TEXT,
          current_input_qty REAL DEFAULT 0,
          started_at DATETIME,
          expected_finish_at DATETIME,
          operator TEXT,
          efficiency_pct REAL DEFAULT 95,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await runner.run(`
        CREATE TABLE IF NOT EXISTS production_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          queue_no INTEGER DEFAULT 1,
          order_type TEXT DEFAULT 'SALES_PO',
          source_ref_no TEXT,
          customer_id INTEGER,
          customer_name TEXT,
          product_id INTEGER,
          product_name TEXT NOT NULL,
          ordered_qty REAL DEFAULT 0,
          required_qty REAL DEFAULT 0,
          due_date DATE,
          priority TEXT DEFAULT 'NORMAL',
          priority_score REAL DEFAULT 50,
          priority_reason TEXT,
          material_status TEXT DEFAULT 'AVAILABLE',
          material_shortage_details TEXT,
          assigned_unit_id INTEGER,
          assigned_unit_code TEXT,
          current_stage TEXT DEFAULT 'Cleaning',
          status TEXT DEFAULT 'QUEUED',
          estimated_duration_mins INTEGER DEFAULT 60,
          started_at DATETIME,
          completed_at DATETIME,
          bom_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await runner.run(`
        CREATE TABLE IF NOT EXISTS cleaning_changeover_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cleaning_code TEXT UNIQUE,
          unit_id INTEGER,
          unit_code TEXT,
          previous_product TEXT,
          next_product TEXT,
          allergen_risk TEXT DEFAULT 'Low',
          cleaning_type TEXT DEFAULT 'Standard Wet/Dry Cleaning',
          duration_mins INTEGER DEFAULT 20,
          started_at DATETIME,
          completed_at DATETIME,
          status TEXT DEFAULT 'PENDING',
          operator_name TEXT,
          verified_by TEXT,
          qc_status TEXT DEFAULT 'PASSED',
          remarks TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await runner.run(`
        CREATE TABLE IF NOT EXISTS demand_forecast_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER,
          customer_name TEXT,
          product_id INTEGER,
          product_name TEXT,
          historical_avg_qty REAL DEFAULT 0,
          last_month_qty REAL DEFAULT 0,
          predicted_qty REAL DEFAULT 0,
          confidence_pct REAL DEFAULT 85,
          confidence_score REAL DEFAULT 85,
          recommendation TEXT,
          recommendation_status TEXT DEFAULT 'RECOMMENDED',
          target_due_date DATE,
          forecast_period TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      try { await runner.run(`ALTER TABLE demand_forecast_records ADD COLUMN recommendation_status TEXT DEFAULT 'RECOMMENDED'`); } catch (_) {}
      try { await runner.run(`ALTER TABLE demand_forecast_records ADD COLUMN confidence_score REAL DEFAULT 85`); } catch (_) {}
      try { await runner.run(`ALTER TABLE demand_forecast_records ADD COLUMN target_due_date DATE`); } catch (_) {}
      await runner.run(`
        CREATE TABLE IF NOT EXISTS production_output_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          output_code TEXT UNIQUE,
          work_order_no TEXT,
          queue_id INTEGER,
          product_name TEXT,
          fg_lot_no TEXT,
          lot_no TEXT,
          unit_code TEXT,
          process_stage TEXT,
          order_id INTEGER,
          input_qty REAL DEFAULT 0,
          output_qty REAL DEFAULT 0,
          good_output_qty REAL DEFAULT 0,
          process_loss_qty REAL DEFAULT 0,
          waste_flour_qty REAL DEFAULT 0,
          rejection_qty REAL DEFAULT 0,
          actual_yield_pct REAL DEFAULT 100,
          expected_yield_pct REAL DEFAULT 95,
          yield_pct REAL DEFAULT 100,
          waste_qty REAL DEFAULT 0,
          qc_status TEXT DEFAULT 'PASSED',
          qc_verified_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      try { await runner.run(`ALTER TABLE production_output_records ADD COLUMN output_code TEXT`); } catch (_) {}
      try { await runner.run(`ALTER TABLE production_output_records ADD COLUMN work_order_no TEXT`); } catch (_) {}
      try { await runner.run(`ALTER TABLE production_output_records ADD COLUMN queue_id INTEGER`); } catch (_) {}
      try { await runner.run(`ALTER TABLE production_output_records ADD COLUMN fg_lot_no TEXT`); } catch (_) {}
      try { await runner.run(`ALTER TABLE production_output_records ADD COLUMN unit_code TEXT`); } catch (_) {}
      try { await runner.run(`ALTER TABLE production_output_records ADD COLUMN process_stage TEXT`); } catch (_) {}
      try { await runner.run(`ALTER TABLE production_output_records ADD COLUMN lot_no TEXT`); } catch (_) {}
      try { await runner.run(`ALTER TABLE production_output_records ADD COLUMN good_output_qty REAL DEFAULT 0`); } catch (_) {}
      try { await runner.run(`ALTER TABLE production_output_records ADD COLUMN process_loss_qty REAL DEFAULT 0`); } catch (_) {}
      try { await runner.run(`ALTER TABLE production_output_records ADD COLUMN waste_flour_qty REAL DEFAULT 0`); } catch (_) {}
      try { await runner.run(`ALTER TABLE production_output_records ADD COLUMN rejection_qty REAL DEFAULT 0`); } catch (_) {}
      try { await runner.run(`ALTER TABLE production_output_records ADD COLUMN actual_yield_pct REAL DEFAULT 100`); } catch (_) {}
      try { await runner.run(`ALTER TABLE production_output_records ADD COLUMN expected_yield_pct REAL DEFAULT 95`); } catch (_) {}
      try { await runner.run(`ALTER TABLE production_output_records ADD COLUMN qc_status TEXT DEFAULT 'PASSED'`); } catch (_) {}
      try { await runner.run(`ALTER TABLE production_output_records ADD COLUMN qc_verified_by TEXT`); } catch (_) {}

      const checkUnits = await runner.query('SELECT COUNT(*) as cnt FROM production_units');
      if (parseInt(checkUnits.rows[0]?.cnt || 0, 10) === 0) {
        await runner.run(`
          INSERT INTO production_units (unit_code, unit_name, process_stage, capacity_kg_per_hr, status)
          VALUES 
            ('CLN-01', 'Primary Grain Cleaning & De-stoning Unit 1', 'Cleaning', 500, 'READY'),
            ('GRD-01', 'High-Speed Pulverizer & Grinding Mill 1', 'Grinding', 250, 'READY'),
            ('SVE-01', 'Vibratory Sifter & Sieve Station 1', 'Sieving', 350, 'READY'),
            ('PCK-01', 'Automatic Pouch & Bag Packaging Line 1', 'Packaging', 400, 'READY')
        `);
      }
    } catch (_) {}
  }

  /**
   * 1. PRODUCTION DASHBOARD SUMMARY
   * Answers: "What should the factory work on now?"
   */
  async getProductionDashboardSummary(companyId = 1) {
    try {
      const runner = this.getRunner(companyId);
      await this.ensureTables(companyId);
      // 1. Fetch Units / Work Centers
      const unitsRes = await runner.query('SELECT * FROM production_units ORDER BY id ASC');
      const units = unitsRes.rows || [];

      // Calculate live remaining time for running units
      const now = new Date();
      const enrichedUnits = units.map(u => {
        let remainingMinutes = 0;
        let progressPct = 0;
        let remainingFormatted = 'Ready';

        if (u.status === 'RUNNING' && u.started_at && u.expected_finish_at) {
          const start = new Date(u.started_at).getTime();
          const end = new Date(u.expected_finish_at).getTime();
          const current = now.getTime();
          const totalDuration = Math.max(1, end - start);
          const elapsed = Math.max(0, current - start);

          progressPct = Math.min(100, Math.round((elapsed / totalDuration) * 100));
          const remainingMs = Math.max(0, end - current);
          remainingMinutes = Math.round(remainingMs / (60 * 1000));

          if (remainingMinutes > 0) {
            const hrs = Math.floor(remainingMinutes / 60);
            const mins = remainingMinutes % 60;
            remainingFormatted = hrs > 0 ? `${hrs}h ${mins}m remaining` : `${mins}m remaining`;
          } else {
            remainingFormatted = 'Wrapping up / QC check';
            progressPct = 99;
          }
        } else if (u.status === 'CLEANING') {
          remainingFormatted = `Cleaning in progress (${u.cleaning_time_mins || 20}m standard)`;
          progressPct = 50;
        }

        return {
          ...u,
          remainingMinutes,
          remainingFormatted,
          progressPct
        };
      });

      // 2. Fetch Active Production Queue
      const queueRes = await runner.query(`
        SELECT * FROM production_queue 
        WHERE status NOT IN ('COMPLETED', 'CANCELLED')
        ORDER BY priority_score DESC, due_date ASC
      `);
      const queue = queueRes.rows || [];

      // 3. High Priority Spotlight (Top 1 urgent / running job)
      let spotlight = queue.find(q => q.status === 'RUNNING') || queue[0] || null;
      if (spotlight) {
        let availableStock = 0;
        try {
          const mvRes = await runner.query(`
            SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN COALESCE(weight, qty, 0) ELSE -COALESCE(weight, qty, 0) END), 0) as available_kg
            FROM stock_movements
            WHERE is_reversed = 0 AND is_reversal = 0 AND is_physical_stock = 1
              AND LOWER(item_name) LIKE LOWER(?)
          `, [`%${spotlight.product_name}%`]);
          availableStock = Math.max(0, parseFloat(mvRes.rows?.[0]?.available_kg) || 0);
        } catch (_) {
          const stockRes = await runner.query(`
            SELECT COALESCE(SUM(remaining_quantity), 0) as available_qty
            FROM stock_lots
            WHERE LOWER(item_name) LIKE LOWER(?) AND usable_for_production = 1
          `, [`%${spotlight.product_name}%`]);
          availableStock = parseFloat(stockRes.rows?.[0]?.available_qty) || 0;
        }
        const requiredStock = Math.max(0, (parseFloat(spotlight.ordered_qty) || 0) - availableStock);

        spotlight = {
          ...spotlight,
          availableStock,
          remainingToProduce: requiredStock,
          recommendedStart: spotlight.status === 'RUNNING' ? 'IN PROGRESS' : 'NOW',
          leadTimeEstimate: `${Math.floor((spotlight.estimated_duration_mins || 180) / 60)}h ${(spotlight.estimated_duration_mins || 180) % 60}m`
        };
      }

      // 4. ATP Inventory Snapshot from live stock_movements (fallback to stock_lots)
      let totalRawStock = 0;
      let finishedGoodsATP = 0;
      let wipKg = 0;
      try {
        const mvSnapRes = await runner.query(`
          SELECT stock_category,
                 COALESCE(SUM(CASE WHEN direction = 'IN' THEN COALESCE(weight, qty, 0) ELSE -COALESCE(weight, qty, 0) END), 0) as net_kg
          FROM stock_movements
          WHERE is_reversed = 0 AND is_reversal = 0 AND is_physical_stock = 1
          GROUP BY stock_category
        `);
        for (const r of (mvSnapRes.rows || [])) {
          const cat = String(r.stock_category || '').toUpperCase();
          const val = Math.max(0, parseFloat(r.net_kg) || 0);
          if (cat === 'RM' || cat === 'COLD_STORAGE') totalRawStock += val;
          else if (cat === 'FG') finishedGoodsATP += val;
          else if (cat === 'WIP') wipKg += val;
        }
      } catch (_) {}

      if (totalRawStock === 0) {
        const rawStockRes = await runner.query(`
          SELECT COALESCE(SUM(remaining_quantity), 0) as total_raw_kg
          FROM stock_lots
          WHERE usable_for_production = 1
        `);
        totalRawStock = parseFloat(rawStockRes.rows?.[0]?.total_raw_kg) || 0;
      }

      const reservedRawStock = queue
        .filter(q => q.status === 'QUEUED' || q.status === 'RUNNING')
        .reduce((sum, q) => sum + (parseFloat(q.required_qty) || 0), 0);
      const netAvailableRawATP = Math.max(0, totalRawStock - reservedRawStock);

      // 5. Demand Forecast Snapshot (Pending recommendations)
      const pendingMTSRes = await runner.query(`
        SELECT * FROM demand_forecast_records 
        WHERE recommendation_status = 'RECOMMENDED' 
        ORDER BY confidence_score DESC LIMIT 5
      `);
      const pendingRecommendations = pendingMTSRes.rows || [];

      // 6. Recent Cleaning / Changeover logs
      const cleaningsRes = await runner.query(`
        SELECT * FROM cleaning_changeover_orders 
        ORDER BY id DESC LIMIT 5
      `);
      const recentCleanings = cleaningsRes.rows || [];

      return {
        success: true,
        spotlight,
        units: enrichedUnits,
        queue: queue.slice(0, 8),
        totalQueueCount: queue.length,
        urgentCount: queue.filter(q => q.priority === 'URGENT').length,
        highCount: queue.filter(q => q.priority === 'HIGH').length,
        waitingMaterialCount: queue.filter(q => q.material_status === 'SHORTAGE').length,
        materialSummary: {
          totalRawStock,
          reservedRawStock,
          netAvailableRawATP,
          wipKg,
          finishedGoodsATP
        },
        pendingRecommendations,
        recentCleanings
      };
    } catch (err) {
      console.error('Error in getProductionDashboardSummary:', err);
      throw err;
    }
  }

  /**
   * 2. PRODUCTION QUEUE & DYNAMIC PRIORITY SCORING
   */
  async getProductionQueue(filters = {}, companyId = 1) {
    try {
      const runner = this.getRunner(companyId);
      await this.ensureTables(companyId);
      const { status, priority, search } = filters;
      let sql = `SELECT * FROM production_queue WHERE 1=1`;
      const params = [];

      if (status && status !== 'ALL') {
        sql += ` AND status = ?`;
        params.push(status);
      }

      if (priority && priority !== 'ALL') {
        sql += ` AND priority = ?`;
        params.push(priority);
      }

      if (search) {
        sql += ` AND (LOWER(product_name) LIKE ? OR LOWER(customer_name) LIKE ? OR LOWER(source_ref_no) LIKE ?)`;
        params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
      }

      sql += ` ORDER BY priority_score DESC, due_date ASC, id ASC`;
      const res = await runner.query(sql, params);
      const rows = res.rows || [];

      const enriched = rows.map((item, idx) => {
        const score = item.priority_score || 50;
        const prio = item.priority || 'NORMAL';
        const reason = item.priority_reason || 'Standard queued job';
        const durationMins = item.estimated_duration_mins || 120;
        const durFormatted = `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`;

        return {
          ...item,
          queuePosition: idx + 1,
          durationFormatted: durFormatted,
          priority: prio,
          priorityScore: score,
          reason
        };
      });

      return { success: true, count: enriched.length, data: enriched };
    } catch (err) {
      console.error('Error in getProductionQueue:', err);
      throw err;
    }
  }

  /**
   * Add new item to Production Queue
   */
  async addToQueue(data, companyId = 1) {
    const runner = this.getRunner(companyId);
    await this.ensureTables(companyId);
    const {
      orderType = 'SALES_PO',
      sourceRefNo,
      customerName = 'General Stock',
      customerId,
      productId,
      productName,
      orderedQty = 1000,
      requiredQty = 1000,
      dueDate,
      priority = 'HIGH',
      priorityScore = 80,
      priorityReason,
      materialStatus = 'AVAILABLE',
      assignedUnitCode = 'GRD-01',
      currentStage = 'Cleaning',
      status = 'QUEUED'
    } = data;

    if (!productName) {
      throw new Error('Product Name is required to enqueue production');
    }

    const durationCalc = this.calculateProductionTimeMins(requiredQty || orderedQty);
    const refNo = sourceRefNo || `PRD-ORD-${Date.now().toString().slice(-6)}`;
    const reason = priorityReason || `Queued for ${customerName} due on ${dueDate || 'immediate schedule'}`;

    await runner.run(`
      INSERT INTO production_queue (
        order_type, source_ref_no, customer_id, customer_name, product_id,
        product_name, ordered_qty, required_qty, due_date, priority,
        priority_score, priority_reason, material_status, assigned_unit_code,
        current_stage, status, estimated_duration_mins
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderType, refNo, customerId || null, customerName, productId || null,
      productName, parseFloat(orderedQty) || 0, parseFloat(requiredQty) || 0,
      dueDate || new Date().toISOString().split('T')[0], priority,
      parseFloat(priorityScore) || 75, reason, materialStatus, assignedUnitCode,
      currentStage, status, durationCalc.totalMins
    ]);

    return { success: true, message: `Production order ${refNo} added to factory queue.` };
  }

  /**
   * 3. CUSTOMER DEMAND & PREDICTIVE FORECASTING
   * Connects Quotations, Confirmed POs, Historical Trends, and Stock ATP
   */
  async getCustomerDemandAndForecast(companyId = 1) {
    try {
      const runner = this.getRunner(companyId);
      await this.ensureTables(companyId);
      const partyDir = await loadPartyDirectory(companyId, runner);

      const forecastRes = await runner.query(`
        SELECT * FROM demand_forecast_records 
        ORDER BY id DESC
      `);
      const forecasts = (forecastRes.rows || []).map(f => ({
        ...f,
        customer_name: resolveCustomerFromDirectory(partyDir, f.customer_name, f.customer_id).name || f.customer_name
      }));

      let quotations = [];
      try {
        const quoteRes = await runner.query(`
          SELECT q.id, COALESCE(q.bill_no, q.s_no, 'QT-' || CAST(q.id AS TEXT)) as quote_no,
                 q.customer as raw_customer,
                 q.date,
                 COALESCE(q.total_amt, q.bill_amt, q.amount, 0) as total_amount,
                 COALESCE(qi.item_name, q.item_name) as item_name,
                 COALESCE(qi.qty, q.qty, 0) as quote_qty,
                 COALESCE(qi.total_wt, q.qty * COALESCE(qi.weight, q.weight, 0), 0) as quote_wt
          FROM quotations q
          LEFT JOIN quotation_items qi ON qi.quotation_id = q.id
          ORDER BY q.id DESC LIMIT 20
        `);
        quotations = (quoteRes.rows || []).map(q => ({
          ...q,
          customer_name: resolveCustomerFromDirectory(partyDir, q.raw_customer, null).name || q.raw_customer || 'Customer'
        }));
      } catch (e) {
        console.warn('Quotations query notice:', e.message);
      }

      let customerOrders = [];
      try {
        const soRes = await runner.query(`
          SELECT pq.* 
          FROM production_queue pq
          WHERE pq.order_type = 'SALES_PO'
          ORDER BY pq.due_date ASC
        `);
        customerOrders = soRes.rows || [];
      } catch (e) {
        console.warn('Customer orders query notice:', e.message);
      }

      const totalConfirmedDemandKg = customerOrders.reduce((acc, o) => acc + (parseFloat(o.ordered_qty) || 0), 0)
        || forecasts.reduce((acc, f) => acc + (parseFloat(f.confirmed_po_qty) || 0), 0);
      const totalQuotationPipelineKg = quotations.reduce((acc, q) => acc + (parseFloat(q.quote_wt) || parseFloat(q.quote_qty) || 0), 0)
        || forecasts.reduce((acc, f) => acc + (parseFloat(f.quotation_pipeline_qty) || 0), 0);
      const totalForecastDemandKg = forecasts.reduce((acc, f) => acc + (parseFloat(f.forecast_demand_qty || f.predicted_qty) || 0), 0);
      const totalRecommendedMtsKg = forecasts.reduce((acc, f) => acc + (parseFloat(f.recommended_production_qty) || 0), 0);

      let salesCount = 0;
      try {
        const sCntRes = await runner.query('SELECT COUNT(*) as cnt FROM sales WHERE COALESCE(is_order, 0) = 0');
        salesCount = parseInt(sCntRes.rows?.[0]?.cnt || 0, 10);
      } catch (_) {}
      const conversionPct = quotations.length > 0 && salesCount > 0
        ? `${Math.min(100, Math.round((salesCount / quotations.length) * 100))}%`
        : 'N/A';

      return {
        success: true,
        summary: {
          totalConfirmedDemandKg,
          totalQuotationPipelineKg,
          totalForecastDemandKg,
          totalRecommendedMtsKg,
          pipelineConversionRate: conversionPct
        },
        forecasts,
        quotations,
        customerOrders
      };
    } catch (err) {
      console.error('Error in getCustomerDemandAndForecast:', err);
      throw err;
    }
  }

  /**
   * 4. MAKE-TO-STOCK (MTS) RECOMMENDATION APPROVAL
   * Converts a forecast prediction into a real production queue entry with planner sign-off
   */
  async approveForecastRecommendation(forecastId, plannerName = 'Plant Manager', companyId = 1) {
    try {
      const runner = this.getRunner(companyId);
      const recRes = await runner.query('SELECT * FROM demand_forecast_records WHERE id = ?', [forecastId]);
      if (!recRes.rows?.length) {
        throw new Error('Forecast record not found');
      }
      const rec = recRes.rows[0];

      await runner.run(`
        UPDATE demand_forecast_records 
        SET recommendation_status = 'APPROVED', approved_by = ?, approved_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [plannerName, forecastId]);

      const refNo = `MTS-${rec.product_name.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      const durationCalc = this.calculateProductionTimeMins(rec.recommended_production_qty || 500);

      await runner.run(`
        INSERT INTO production_queue (
          order_type, source_ref_no, customer_name, product_name,
          ordered_qty, required_qty, due_date, priority, priority_score,
          priority_reason, material_status, assigned_unit_code, current_stage,
          status, estimated_duration_mins
        ) VALUES ('MTS_RECOMMENDED', ?, ?, ?, ?, ?, ?, 'NORMAL', 70, ?, 'AVAILABLE', 'GRD-01', 'Scheduled', 'QUEUED', ?)
      `, [
        refNo,
        `Advance Stock (${rec.customer_name})`,
        rec.product_name,
        rec.recommended_production_qty,
        rec.recommended_production_qty,
        new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
        `Planner Approved MTS: Buffer for ${rec.customer_name} historical demand (${rec.historical_avg_qty} KG/mo)`,
        durationCalc.totalMins
      ]);

      return {
        success: true,
        message: `Make-to-Stock advance recommendation approved! Production Order ${refNo} generated.`,
        orderNo: refNo
      };
    } catch (err) {
      console.error('Error approving forecast recommendation:', err);
      throw err;
    }
  }

  /**
   * 5. MATERIAL AVAILABILITY & AVAILABLE-TO-PROMISE (ATP)
   */
  async getMaterialAvailabilityATP(productName = '', companyId = 1) {
    try {
      const runner = this.getRunner(companyId);
      await this.ensureTables(companyId);

      // Compute real ATP from live stock_movements + stock_lots QC status + production_queue reservations
      const mvLotsRes = await runner.query(`
        SELECT
          item_name,
          MAX(stock_category) as stock_category,
          SUM(CASE WHEN direction = 'IN' THEN COALESCE(weight, qty, 0) ELSE -COALESCE(weight, qty, 0) END) as net_kg,
          SUM(CASE WHEN direction = 'IN' THEN COALESCE(qty, 0) ELSE -COALESCE(qty, 0) END) as net_qty,
          COUNT(DISTINCT lot_no) as lot_count
        FROM stock_movements
        WHERE is_reversed = 0 AND is_reversal = 0 AND is_physical_stock = 1
          AND item_name IS NOT NULL AND TRIM(item_name) != ''
          ${productName ? 'AND LOWER(item_name) LIKE LOWER(?)' : ''}
        GROUP BY item_name
        ORDER BY net_kg DESC
      `, productName ? [`%${productName}%`] : []);

      const queueRes = await runner.query(`
        SELECT product_name, COALESCE(SUM(required_qty), 0) as reserved_kg
        FROM production_queue
        WHERE status IN ('QUEUED', 'RUNNING')
        GROUP BY product_name
      `);
      const reservedByProduct = new Map();
      for (const q of (queueRes.rows || [])) {
        reservedByProduct.set(String(q.product_name || '').trim().toLowerCase(), parseFloat(q.reserved_kg) || 0);
      }

      const qcHoldRes = await runner.query(`
        SELECT item_name, COALESCE(SUM(remaining_quantity), 0) as hold_qty, qc_status, COUNT(id) as lot_count
        FROM stock_lots
        GROUP BY item_name, qc_status
      `);
      const holdByItem = new Map();
      for (const r of (qcHoldRes.rows || [])) {
        const st = String(r.qc_status || '').toUpperCase();
        if (st === 'HOLD' || st === 'QUARANTINE' || st === 'REJECTED') {
          const k = String(r.item_name || '').trim().toLowerCase();
          holdByItem.set(k, (holdByItem.get(k) || 0) + (parseFloat(r.hold_qty) || 0));
        }
      }

      const catLabel = (c) => {
        const up = String(c || '').toUpperCase();
        if (up === 'FG') return 'Finished Goods';
        if (up === 'COLD_STORAGE') return 'Cold Storage';
        if (up === 'BAG' || up === 'VACUUM') return 'Packaging Material';
        if (up === 'WASTAGE') return 'By-Product / Wastage';
        return 'Raw Material';
      };

      const atpItems = (mvLotsRes.rows || []).map(r => {
        const name = String(r.item_name || '').trim();
        const k = name.toLowerCase();
        const onHandKg = Math.max(0, Math.round(parseFloat(r.net_kg) || 0));
        const reserved = Math.round(reservedByProduct.get(k) || 0);
        const hold = Math.round(holdByItem.get(k) || 0);
        const netAtp = Math.max(0, onHandKg - reserved - hold);
        return {
          item_name: name,
          category: catLabel(r.stock_category),
          total_on_hand: onHandKg,
          allocated_reserved: reserved,
          quality_hold: hold,
          net_available_atp: netAtp,
          uom: 'KG',
          status: netAtp > 0 ? 'AVAILABLE' : 'SHORTAGE',
          lead_time_days: netAtp > 0 ? 0 : 2
        };
      });

      const totalOnHand = atpItems.reduce((s, x) => s + x.total_on_hand, 0);
      const totalRes = atpItems.reduce((s, x) => s + x.allocated_reserved, 0);
      const totalHold = atpItems.reduce((s, x) => s + x.quality_hold, 0);
      const totalAtp = atpItems.reduce((s, x) => s + x.net_available_atp, 0);

      return {
        success: true,
        summary: {
          totalRawMaterialsOnHandKg: totalOnHand,
          totalReservedKg: totalRes,
          totalQualityHoldKg: totalHold,
          totalNetAvailableATPKg: totalAtp,
          shortageItemsCount: atpItems.filter(x => x.status === 'SHORTAGE').length
        },
        items: atpItems,
        rawLots: qcHoldRes.rows || []
      };
    } catch (err) {
      console.error('Error in getMaterialAvailabilityATP:', err);
      throw err;
    }
  }

  /**
   * 6. UNIT / WORK CENTER OPERATIONS
   */
  async getUnitOperations(companyId = 1) {
    try {
      const runner = this.getRunner(companyId);
      const res = await runner.query('SELECT * FROM production_units ORDER BY id ASC');
      return { success: true, units: res.rows || [] };
    } catch (err) {
      console.error('Error fetching unit operations:', err);
      throw err;
    }
  }

  /**
   * 7. ADVANCE QUEUE JOB & AUTOMATIC UNIT STATE MACHINE
   * Transitions:
   * START_PRODUCTION -> RUNNING
   * COMPLETE_PRODUCTION -> Trigger CLEANING -> Generate Cleaning Order
   * VERIFY_CLEANING -> READY -> Auto-Start Next Job in Queue
   */
  async advanceJob(queueId, action, payload = {}, companyId = 1) {
    try {
      const runner = this.getRunner(companyId);
      const qRes = await runner.query('SELECT * FROM production_queue WHERE id = ?', [queueId]);
      if (!qRes.rows?.length) {
        throw new Error(`Queue item ${queueId} not found`);
      }
      const job = qRes.rows[0];
      const unitCode = payload.unitCode || job.assigned_unit_code || 'GRD-01';

      if (action === 'START_PRODUCTION') {
        const duration = this.calculateProductionTimeMins(job.required_qty || job.ordered_qty || 500);
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + duration.totalMins * 60 * 1000);

        await runner.run(`
          UPDATE production_queue 
          SET status = 'RUNNING', started_at = ?, assigned_unit_code = ?
          WHERE id = ?
        `, [this.formatDateTime(startTime), unitCode, queueId]);

        await runner.run(`
          UPDATE production_units
          SET status = 'RUNNING', current_job_id = ?, current_job_code = ?,
              current_product = ?, current_input_qty = ?, started_at = ?,
              expected_finish_at = ?, operator = ?
          WHERE unit_code = ?
        `, [
          queueId, job.source_ref_no, job.product_name, job.required_qty,
          this.formatDateTime(startTime), this.formatDateTime(finishTime),
          payload.operator || 'Operator', unitCode
        ]);

        return {
          success: true,
          message: `Job ${job.source_ref_no} started on unit ${unitCode}. Expected finish: ${finishTime.toLocaleTimeString()}`,
          jobStatus: 'RUNNING',
          expectedFinish: finishTime
        };
      }

      if (action === 'RECORD_OUTPUT_AND_CLEAN') {
        const {
          inputQty = job.required_qty || 700,
          goodOutputQty = 660,
          processLossQty = 40,
          wasteFlourQty = 0,
          rejectionQty = 0,
          operatorName = 'Operator',
          verifiedBy = 'QA Lead'
        } = payload;

        const actualYieldPct = ((parseFloat(goodOutputQty) / Math.max(1, parseFloat(inputQty))) * 100).toFixed(2);
        const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const fgLotNo = `LOT-${todayStr}-${Date.now().toString().slice(-3)}`;
        const outputCode = `OUT-${Date.now().toString().slice(-6)}`;

        await runner.run(`
          INSERT INTO production_output_records (
            output_code, work_order_no, queue_id, product_name, fg_lot_no,
            input_qty, good_output_qty, process_loss_qty, waste_flour_qty,
            rejection_qty, actual_yield_pct, expected_yield_pct, qc_status, qc_verified_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 95, 'PASSED', ?)
        `, [
          outputCode, job.source_ref_no, queueId, job.product_name, fgLotNo,
          inputQty, goodOutputQty, processLossQty, wasteFlourQty,
          rejectionQty, actualYieldPct, verifiedBy
        ]);

        await runner.run(`
          UPDATE production_queue
          SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [queueId]);

        const nextJobRes = await runner.query(`
          SELECT product_name FROM production_queue 
          WHERE assigned_unit_code = ? AND status = 'QUEUED'
          ORDER BY priority_score DESC LIMIT 1
        `, [unitCode]);
        const nextProduct = nextJobRes.rows?.[0]?.product_name || 'Next Scheduled Product';
        const cleanCode = `CLN-${Date.now().toString().slice(-5)}`;

        await runner.run(`
          INSERT INTO cleaning_changeover_orders (
            cleaning_code, unit_code, previous_product, next_product,
            allergen_risk, cleaning_type, duration_mins, status, operator_name,
            remarks
          ) VALUES (?, ?, ?, ?, 'Low', 'Standard Food Safety Wet & Dry Clean', 20, 'IN_PROGRESS', ?, ?)
        `, [
          cleanCode, unitCode, job.product_name, nextProduct, operatorName,
          `Mandatory changeover cleaning after ${job.product_name} lot ${fgLotNo}`
        ]);

        await runner.run(`
          UPDATE production_units
          SET status = 'CLEANING', current_job_id = NULL, current_job_code = NULL,
              current_product = 'CLEANING / CHANGEOVER', current_input_qty = 0,
              started_at = CURRENT_TIMESTAMP, expected_finish_at = NULL
          WHERE unit_code = ?
        `, [unitCode]);

        return {
          success: true,
          message: `Production recorded! Output Lot: ${fgLotNo} (${actualYieldPct}% yield). Unit ${unitCode} switched to CLEANING mode.`,
          outputLot: fgLotNo,
          actualYieldPct,
          cleaningCode: cleanCode
        };
      }

      if (action === 'VERIFY_CLEANING_AND_AUTO_START_NEXT') {
        const { cleaningCode, verifiedBy = 'QA Technologist', qcNotes } = payload;

        if (cleaningCode) {
          await runner.run(`
            UPDATE cleaning_changeover_orders
            SET status = 'VERIFIED', qc_status = 'PASSED', verified_by = ?,
                completed_at = CURRENT_TIMESTAMP, remarks = COALESCE(remarks, '') || ' | ' || ?
            WHERE cleaning_code = ?
          `, [verifiedBy, qcNotes || 'Swab test passed, visual inspection clear', cleaningCode]);
        }

        await runner.run(`
          UPDATE production_units
          SET status = 'READY', current_product = NULL, started_at = NULL, expected_finish_at = NULL
          WHERE unit_code = ?
        `, [unitCode]);

        const nextJobRes = await runner.query(`
          SELECT * FROM production_queue 
          WHERE (assigned_unit_code = ? OR assigned_unit_code IS NULL) AND status = 'QUEUED'
          ORDER BY priority_score DESC LIMIT 1
        `, [unitCode]);

        let nextJobStarted = null;
        if (nextJobRes.rows?.length) {
          const nextJob = nextJobRes.rows[0];
          await this.advanceJob(nextJob.id, 'START_PRODUCTION', { unitCode, operator: verifiedBy }, companyId);
          nextJobStarted = nextJob;
        }

        return {
          success: true,
          message: `Cleaning verified for unit ${unitCode}. Unit status set to READY.` + 
                   (nextJobStarted ? ` Next job ${nextJobStarted.source_ref_no} (${nextJobStarted.product_name}) automatically started!` : ' Unit awaiting next scheduled job.')
        };
      }

      throw new Error(`Unknown action: ${action}`);
    } catch (err) {
      console.error('Error advancing job in factoryProductionPlanningService:', err);
      throw err;
    }
  }

  /**
   * 8. CLEANING / CHANGEOVER ORDERS LIST
   */
  async getCleaningOrders(companyId = 1) {
    try {
      const runner = this.getRunner(companyId);
      await this.ensureTables(companyId);
      const res = await runner.query('SELECT * FROM cleaning_changeover_orders ORDER BY id DESC');
      return { success: true, data: res.rows || [] };
    } catch (err) {
      console.error('Error fetching cleaning orders:', err);
      throw err;
    }
  }

  /**
   * 9. PRODUCTION OUTPUT & YIELD RECORDS
   */
  async getProductionOutputs(companyId = 1) {
    try {
      const runner = this.getRunner(companyId);
      await this.ensureTables(companyId);
      const res = await runner.query('SELECT * FROM production_output_records ORDER BY id DESC');
      return { success: true, data: res.rows || [] };
    } catch (err) {
      console.error('Error fetching production output records:', err);
      throw err;
    }
  }

  /**
   * 10. END-TO-END REAL TRACEABILITY GRAPH (PO -> Purchase -> Storage -> Production -> Sales)
   */
  async getTraceabilityGraph(searchKey = '', companyId = 1) {
    try {
      const runner = this.getRunner(companyId);
      await this.ensureTables(companyId);
      const partyDir = await loadPartyDirectory(companyId, runner);

      // Build clickable available keys from real factory transactions
      const availableKeys = [];
      const seenKeys = new Set();
      const pushKey = (key, label, type) => {
        const k = String(key || '').trim();
        if (!k || seenKeys.has(k.toUpperCase())) return;
        seenKeys.add(k.toUpperCase());
        availableKeys.push({ key: k, label: label || k, type });
      };

      try {
        const goKeys = await runner.query(`
          SELECT go.lot_no, go.item_name, g.work_order_no, g.s_no
          FROM grain_output_items go
          JOIN grains g ON g.id = go.grain_id
          WHERE go.lot_no IS NOT NULL AND TRIM(go.lot_no) != ''
          ORDER BY g.id DESC LIMIT 8
        `);
        for (const r of (goKeys.rows || [])) {
          pushKey(r.lot_no, `${r.lot_no} (${r.item_name})`, 'FG_LOT');
          if (r.work_order_no) pushKey(r.work_order_no, `${r.work_order_no} (${r.item_name})`, 'WORK_ORDER');
        }
      } catch (_) {}

      try {
        const purKeys = await runner.query(`
          SELECT pi.lot_no, pi.item_name
          FROM purchase_items pi
          JOIN purchases p ON p.id = pi.purchase_id
          WHERE pi.lot_no IS NOT NULL AND TRIM(pi.lot_no) != ''
          ORDER BY p.id DESC LIMIT 10
        `);
        for (const r of (purKeys.rows || [])) {
          pushKey(r.lot_no, `${r.lot_no} (${r.item_name})`, 'RM_LOT');
        }
      } catch (_) {}

      try {
        const salesKeys = await runner.query(`
          SELECT COALESCE(NULLIF(voucher_no, ''), CAST(s_no AS TEXT), 'SAL-' || CAST(id AS TEXT)) as inv_no
          FROM sales
          WHERE COALESCE(is_order, 0) = 0
          ORDER BY id DESC LIMIT 5
        `);
        for (const r of (salesKeys.rows || [])) {
          pushKey(r.inv_no, r.inv_no, 'SALES_INVOICE');
        }
      } catch (_) {}

      try {
        const csKeys = await runner.query(`
          SELECT DISTINCT cold_storage_lot_no, item_name
          FROM cold_storage_items
          WHERE cold_storage_lot_no IS NOT NULL AND TRIM(cold_storage_lot_no) != ''
          ORDER BY id DESC LIMIT 6
        `);
        for (const r of (csKeys.rows || [])) {
          pushKey(r.cold_storage_lot_no, `${r.cold_storage_lot_no} (${r.item_name})`, 'CS_LOT');
        }
      } catch (_) {}

      let queryKey = String(searchKey || '').trim();
      if (!queryKey || queryKey.toLowerCase() === 'latest' || queryKey === 'PO-2026-0045') {
        if (queryKey === 'PO-2026-0045') {
          const checkExact = await runner.query(`SELECT source_ref_no FROM production_queue WHERE UPPER(source_ref_no) = 'PO-2026-0045' LIMIT 1`);
          if (!checkExact.rows?.length && availableKeys.length > 0) {
            queryKey = availableKeys[0].key;
          }
        } else if (availableKeys.length > 0) {
          queryKey = availableKeys[0].key;
        }
      }

      if (!queryKey) {
        return { success: true, traceKey: '', availableKeys: [], chain: [] };
      }

      const qUp = queryKey.toUpperCase();
      const targetLots = new Set();
      let matchedGrains = [];
      let matchedSalesRows = [];

      // 1. Check Sales Invoice match
      try {
        const sRes = await runner.query(`
          SELECT s.*, si.lot_no, si.item_name, si.qty as sold_qty, si.total_wt as sold_wt, si.rate as sold_rate, si.total_amt as sold_amt
          FROM sales s
          LEFT JOIN sales_items si ON si.sales_id = s.id
          WHERE UPPER(COALESCE(s.voucher_no, '')) = ?
             OR UPPER(CAST(s.s_no AS TEXT)) = ?
             OR UPPER(COALESCE(s.p_o_no, '')) = ?
             OR UPPER(COALESCE(si.lot_no, '')) = ?
        `, [qUp, qUp, qUp, qUp]);
        if (sRes.rows?.length) {
          matchedSalesRows = sRes.rows;
          sRes.rows.forEach(r => r.lot_no && targetLots.add(String(r.lot_no).trim()));
        }
      } catch (_) {}

      // 2. Check Work Order / Grind match
      try {
        const gRes = await runner.query(`
          SELECT g.*, COALESCE(fmm.flourmill, g.flour_mill, 'Production Floor') as mill_name
          FROM grains g
          LEFT JOIN flour_mill_master fmm ON (CAST(fmm.id AS TEXT) = CAST(g.flour_mill AS TEXT) OR fmm.flourmill = g.flour_mill)
          WHERE UPPER(COALESCE(g.work_order_no, '')) = ?
             OR UPPER('GRD-' || CAST(g.s_no AS TEXT)) = ?
             OR g.id IN (SELECT grain_id FROM grain_input_items WHERE UPPER(lot_no) = ?)
             OR g.id IN (SELECT grain_id FROM grain_output_items WHERE UPPER(lot_no) = ?)
        `, [qUp, qUp, qUp, qUp]);
        matchedGrains = gRes.rows || [];
        for (const g of matchedGrains) {
          const ins = await runner.query(`SELECT * FROM grain_input_items WHERE grain_id = ?`, [g.id]);
          const outs = await runner.query(`SELECT * FROM grain_output_items WHERE grain_id = ?`, [g.id]);
          g._inputs = ins.rows || [];
          g._outputs = outs.rows || [];
          g._inputs.forEach(i => i.lot_no && targetLots.add(String(i.lot_no).trim()));
          g._outputs.forEach(o => o.lot_no && targetLots.add(String(o.lot_no).trim()));
        }
      } catch (_) {}

      // 3. Check Cold Storage Lot alias (CS-LOT* <-> LOT*)
      let csRows = [];
      try {
        targetLots.add(queryKey);
        const seedUpper = Array.from(targetLots).map(l => l.toUpperCase());
        const ph = seedUpper.map(() => 'UPPER(?)').join(',');
        const csRes = await runner.query(`
          SELECT csv.voucher_no, csv.voucher_type, csv.voucher_date, csv.cold_storage_name,
                 csv.source_godown_name, csv.destination_godown_name, csv.remarks as voucher_remarks,
                 csi.item_name, csi.purchase_lot_no, csi.cold_storage_lot_no, csi.quantity, csi.total_wt
          FROM cold_storage_items csi
          JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
          WHERE UPPER(csi.purchase_lot_no) IN (${ph}) OR UPPER(csi.cold_storage_lot_no) IN (${ph})
          ORDER BY csv.voucher_date ASC, csv.id ASC
        `, [...seedUpper, ...seedUpper]);
        csRows = csRes.rows || [];
        csRows.forEach(c => {
          if (c.purchase_lot_no) targetLots.add(String(c.purchase_lot_no).trim());
          if (c.cold_storage_lot_no) targetLots.add(String(c.cold_storage_lot_no).trim());
        });
      } catch (_) {}

      // Re-resolve any grains connected to discovered parent/purchase lots
      if (matchedGrains.length === 0 && targetLots.size > 0) {
        try {
          const lotsArr = Array.from(targetLots).map(l => l.toUpperCase());
          const ph = lotsArr.map(() => 'UPPER(?)').join(',');
          const gRes2 = await runner.query(`
            SELECT g.*, COALESCE(fmm.flourmill, g.flour_mill, 'Production Floor') as mill_name
            FROM grains g
            LEFT JOIN flour_mill_master fmm ON (CAST(fmm.id AS TEXT) = CAST(g.flour_mill AS TEXT) OR fmm.flourmill = g.flour_mill)
            WHERE g.id IN (SELECT grain_id FROM grain_input_items WHERE UPPER(lot_no) IN (${ph}))
               OR g.id IN (SELECT grain_id FROM grain_output_items WHERE UPPER(lot_no) IN (${ph}))
          `, [...lotsArr, ...lotsArr]);
          matchedGrains = gRes2.rows || [];
          for (const g of matchedGrains) {
            const ins = await runner.query(`SELECT * FROM grain_input_items WHERE grain_id = ?`, [g.id]);
            const outs = await runner.query(`SELECT * FROM grain_output_items WHERE grain_id = ?`, [g.id]);
            g._inputs = ins.rows || [];
            g._outputs = outs.rows || [];
            g._inputs.forEach(i => i.lot_no && targetLots.add(String(i.lot_no).trim()));
            g._outputs.forEach(o => o.lot_no && targetLots.add(String(o.lot_no).trim()));
          }
        } catch (_) {}
      }

      const allLotsArr = Array.from(targetLots);
      const allLotsUp = allLotsArr.map(l => l.toUpperCase());
      const lotPh = allLotsUp.length > 0 ? allLotsUp.map(() => 'UPPER(?)').join(',') : "''";

      const chain = [];

      // Stage A: Quotations matching lots/key
      try {
        const qRes = await runner.query(`
          SELECT q.*, COALESCE(q.bill_no, CAST(q.s_no AS TEXT), 'QT-' || CAST(q.id AS TEXT)) as quote_ref
          FROM quotations q
          WHERE UPPER(COALESCE(q.lot_no, '')) IN (${lotPh}) OR UPPER(COALESCE(q.bill_no, '')) = ?
          ORDER BY q.id DESC
        `, [...allLotsUp, qUp]);
        for (const q of (qRes.rows || [])) {
          const cName = resolveCustomerFromDirectory(partyDir, q.customer, null).name || q.customer || 'Customer';
          chain.push({
            stage: 'Quotation Signal',
            code: `QT-${q.quote_ref}`,
            party: cName,
            date: q.date || '-',
            status: 'QUOTED',
            details: `${q.item_name || 'Item'} — ${q.qty || 0} Bags (Lot: ${q.lot_no || '-'}) • ₹${(parseFloat(q.total_amt || q.amount || 0)).toLocaleString('en-IN')}`
          });
        }
      } catch (_) {}

      // Stage B: Purchase / Supplier Origin for all involved lots
      let purchases = [];
      try {
        const pRes = await runner.query(`
          SELECT p.*, pi.item_name, pi.lot_no, pi.qty as pi_qty, pi.weight as pi_wt, pi.total_weight as pi_total_wt,
                 COALESCE(NULLIF(p.voucher_no, ''), NULLIF(p.inv_no, ''), 'PUR-' || CAST(p.s_no AS TEXT)) as pur_ref,
                 COALESCE(gm.godown_name, p.godown, 'Main Godown') as godown_name
          FROM purchase_items pi
          JOIN purchases p ON p.id = pi.purchase_id
          LEFT JOIN godown_master gm ON (CAST(gm.id AS TEXT) = CAST(p.godown AS TEXT) OR gm.godown_name = p.godown)
          WHERE UPPER(pi.lot_no) IN (${lotPh}) OR UPPER(COALESCE(p.inv_no, '')) = ? OR UPPER(COALESCE(p.po_no, '')) = ?
          ORDER BY p.date ASC, p.id ASC
        `, [...allLotsUp, qUp, qUp]);
        purchases = pRes.rows || [];
        for (const p of purchases) {
          const sName = resolveSupplierFromDirectory(partyDir, p.supplier, null).name || p.supplier || 'Supplier';
          if (p.po_no) {
            chain.push({
              stage: 'Purchase Order (Supplier)',
              code: p.po_no,
              party: sName,
              date: p.po_date || p.date || '-',
              status: 'CONFIRMED',
              details: `PO linked to Purchase ${p.pur_ref} for ${p.item_name}`
            });
          }
          const wt = parseFloat(p.pi_total_wt) || ((parseFloat(p.pi_qty) || 0) * (parseFloat(p.pi_wt) || 50));
          chain.push({
            stage: 'Raw Material Purchase Inward',
            code: `${p.pur_ref} (${p.lot_no})`,
            party: sName,
            date: p.date || p.inv_date || '-',
            status: 'RECEIVED',
            details: `${p.item_name}: ${p.pi_qty || 0} Bags (${wt.toLocaleString('en-IN')} KG) into ${p.godown_name}` + (p.lorry_no || p.vehicle_no ? ` • Vehicle: ${p.lorry_no || p.vehicle_no}` : '')
          });
        }
      } catch (_) {}

      // Stage C: Quality Inspections
      try {
        const purIds = Array.from(new Set(purchases.map(p => p.id).filter(Boolean)));
        const qcRes = await runner.query(`
          SELECT * FROM qc_inspections
          WHERE UPPER(COALESCE(rm_lot_no, '')) IN (${lotPh})
             ${purIds.length ? `OR purchase_id IN (${purIds.map(() => '?').join(',')})` : ''}
          ORDER BY id ASC
        `, [...allLotsUp, ...purIds]);
        for (const qc of (qcRes.rows || [])) {
          chain.push({
            stage: 'Quality Control Inspection',
            code: qc.qc_no || `QC-${qc.id}`,
            party: qc.inspector || 'QA Lab',
            date: qc.inspection_date || '-',
            status: String(qc.overall_result || 'ACCEPTED').toUpperCase(),
            details: `Lot ${qc.rm_lot_no || '-'} — Result: ${qc.overall_result || 'ACCEPTED'}${qc.remarks ? ` (${qc.remarks})` : ''}`
          });
        }
      } catch (_) {}

      // Stage D: Cold Storage & Godown Transfers (from clean physical movements)
      try {
        const movRes = await runner.query(`
          SELECT movement_date, source_module, movement_type, godown_name, lot_no, qty, weight, source_ref_no, party_name
          FROM stock_movements
          WHERE is_reversed = 0 AND is_reversal = 0
            AND source_module IN ('COLD_STORAGE', 'GODOWN_TRANSFER')
            AND (UPPER(lot_no) IN (${lotPh}) OR UPPER(rm_lot_no) IN (${lotPh}) OR UPPER(fg_lot_no) IN (${lotPh}))
          ORDER BY movement_date ASC, id ASC
        `, [...allLotsUp, ...allLotsUp, ...allLotsUp]);
        for (const m of (movRes.rows || [])) {
          chain.push({
            stage: m.source_module === 'COLD_STORAGE' ? 'Cold Storage Movement' : 'Godown Stock Transfer',
            code: `${m.source_ref_no || m.movement_type} (${m.lot_no})`,
            party: m.godown_name || 'Warehouse',
            date: m.movement_date || '-',
            status: m.movement_type,
            details: `${m.movement_type}: ${m.qty || 0} Bags (${m.weight || 0} KG) at ${m.godown_name}`
          });
        }
      } catch (_) {}

      // Stage E: Production / Milling Batches
      for (const g of matchedGrains) {
        const insDesc = (g._inputs || []).map(i => `${i.lot_no} (${i.item_name}: ${i.qty} Bags / ${i.total_wt} KG)`).join(' + ');
        const outsDesc = (g._outputs || []).map(o => `${o.lot_no} (${o.item_name}: ${o.qty} Bags / ${o.total_wt} KG)`).join(', ');
        chain.push({
          stage: 'Production & Milling Batch',
          code: g.work_order_no || `GRD-${g.s_no || g.id}`,
          party: g.mill_name || 'Factory Milling Floor',
          date: g.date || '-',
          status: g.status || 'COMPLETED',
          details: `Inputs: ${insDesc || 'N/A'} → Outputs: ${outsDesc || 'WIP'}`
        });
      }

      // Stage F: Current Live Godown Stock Balances
      try {
        const balRes = await runner.query(`
          SELECT lot_no, item_name, godown_name,
                 SUM(CASE WHEN direction = 'IN' THEN qty ELSE -qty END) as bal_qty,
                 SUM(CASE WHEN direction = 'IN' THEN COALESCE(weight, 0) ELSE -COALESCE(weight, 0) END) as bal_wt
          FROM stock_movements
          WHERE is_reversed = 0 AND is_reversal = 0 AND is_physical_stock = 1
            AND (UPPER(lot_no) IN (${lotPh}) OR UPPER(fg_lot_no) IN (${lotPh}))
          GROUP BY lot_no, item_name, godown_name
          HAVING ABS(SUM(CASE WHEN direction = 'IN' THEN qty ELSE -qty END)) > 0.001
        `, [...allLotsUp, ...allLotsUp]);
        for (const b of (balRes.rows || [])) {
          chain.push({
            stage: 'Current Godown Stock',
            code: `${b.lot_no} @ ${b.godown_name}`,
            party: b.godown_name,
            date: new Date().toISOString().slice(0, 10),
            status: 'IN_STOCK',
            details: `${b.item_name}: ${b.bal_qty} Bags (${b.bal_wt} KG) currently available`
          });
        }
      } catch (_) {}

      // Stage G: Sales Dispatches
      try {
        const salRes = await runner.query(`
          SELECT s.*, si.item_name, si.lot_no, si.qty as sold_qty, si.total_wt as sold_wt, si.rate as sold_rate, si.total_amt as sold_amt,
                 COALESCE(NULLIF(s.voucher_no, ''), CAST(s.s_no AS TEXT), 'SAL-' || CAST(s.id AS TEXT)) as inv_no
          FROM sales s
          JOIN sales_items si ON si.sales_id = s.id
          WHERE UPPER(COALESCE(si.lot_no, '')) IN (${lotPh})
             OR UPPER(COALESCE(s.voucher_no, '')) = ?
             OR UPPER(CAST(s.s_no AS TEXT)) = ?
          ORDER BY s.date ASC, s.id ASC
        `, [...allLotsUp, qUp, qUp]);
        for (const sd of (salRes.rows || [])) {
          const cName = resolveCustomerFromDirectory(partyDir, sd.customer, sd.customer_id).name || sd.customer || 'Customer';
          chain.push({
            stage: 'Customer Sales Dispatch',
            code: `${sd.inv_no} (${sd.lot_no})`,
            party: cName,
            date: sd.date || '-',
            status: 'DISPATCHED',
            details: `Sold ${sd.sold_qty || 0} Bags (${sd.sold_wt || 0} KG) of ${sd.item_name} @ ₹${sd.sold_rate || 0}` + (sd.lorry_no ? ` • Vehicle: ${sd.lorry_no}` : '')
          });
        }
      } catch (_) {}

      return {
        success: true,
        traceKey: queryKey,
        availableKeys,
        chain
      };
    } catch (err) {
      console.error('Error fetching traceability graph:', err);
      throw err;
    }
  }
}

module.exports = new FactoryProductionPlanningService();
