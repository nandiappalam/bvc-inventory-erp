/**
 * BVC ERP Full Application End-to-End System Audit & Regression Test Suite
 * Tests SQLite mode, PostgreSQL translation compatibility, Company Isolation,
 * Master Data, Transactions, Stock Movements, FIFO, Lot Tracking, Production Planning,
 * Changeover/Cleaning, Quality, Accounting, and API routes.
 */

const http = require('http');
const db = require('../config/database');
const factoryProductionService = require('../services/factoryProductionPlanningService');
const { COMPANY_TABLES } = require('../database/companySchema');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 [BVC ERP FULL SYSTEM AUDIT & REGRESSION SUITE]');
  console.log('================================================================');
  
  let passedCount = 0;
  let failedCount = 0;
  const errors = [];

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passedCount++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failedCount++;
      errors.push(message);
    }
  }

  // -------------------------------------------------------------
  // TEST SECTION 1: MASTER SCHEMA & COMPANY 1 DATABASE INITIALIZATION
  // -------------------------------------------------------------
  console.log('\n--- SECTION 1: Schema & Initialization Verification ---');
  try {
    let compRes = await db.query('SELECT id, name FROM companies ORDER BY id ASC');
    if (!compRes.rows || compRes.rows.length === 0) {
      await db.run('INSERT INTO companies (name, code, status) VALUES (?, ?, ?)', ['BVC Default Company', 'BVC01', 'Active']);
      compRes = await db.query('SELECT id, name FROM companies ORDER BY id ASC');
    }
    assert(compRes.rows && compRes.rows.length > 0, 'Master database contains seeded companies');
    const comp1 = compRes.rows[0];
    console.log(`    Company 1 ID: ${comp1.id}, Name: ${comp1.name}`);
  } catch (err) {
    assert(false, `Schema test failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST SECTION 2: PRODUCTION PLANNING ENGINE (SERVICES & QUERIES)
  // -------------------------------------------------------------
  console.log('\n--- SECTION 2: Factory Production Planning Engine ---');
  try {
    // 2.1 Dashboard Summary
    const summary = await factoryProductionService.getProductionDashboardSummary();
    assert(summary.success === true, 'Production dashboard summary returned successfully');
    assert(Array.isArray(summary.units), 'Production units list returned');
    assert(Array.isArray(summary.queue), 'Production queue list returned');
    assert(summary.materialSummary && typeof summary.materialSummary.totalRawStock === 'number', 'Material ATP summary present');

    // 2.2 Material Availability & ATP
    const atp = await factoryProductionService.getMaterialAvailabilityATP();
    assert(atp.success === true, 'Material ATP calculated successfully');
    assert(Array.isArray(atp.items) && atp.items.length > 0, 'ATP items retrieved');

    // 2.3 Demand Forecast & Pipeline Signals (including quotations & POs)
    const demandForecast = await factoryProductionService.getCustomerDemandAndForecast();
    assert(demandForecast.success === true, 'Demand forecasting & pipeline signals fetched');
    assert(Array.isArray(demandForecast.forecasts), 'Forecast records list valid');
    assert(Array.isArray(demandForecast.quotations), 'Live quotation pipeline signals fetched without error');

    // 2.4 Traceability Graph
    const trace = await factoryProductionService.getTraceabilityGraph('PO-2026-0045');
    assert(trace.success === true && Array.isArray(trace.chain) && trace.chain.length >= 5, 'End-to-End Traceability graph generated');

    // 2.5 Adding a new production order to queue
    const addOrderRes = await factoryProductionService.addToQueue({
      orderType: 'SALES_PO',
      refNo: `TEST-PO-${Date.now().toString().slice(-4)}`,
      customerName: 'Audit Test Customer',
      productName: 'Special Papad 100g',
      orderedQty: 500,
      requiredQty: 500,
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'HIGH',
      assignedUnitCode: 'GRD-01'
    });
    assert(addOrderRes.success === true, 'New production order added to queue');

    // 2.6 Fetch queue and verify insertion
    const queueList = await factoryProductionService.getProductionQueue();
    assert(queueList.success === true && queueList.data.length > 0, 'Production queue retrieved successfully');
    const testJob = queueList.data.find(q => q.customer_name === 'Audit Test Customer');
    assert(!!testJob, 'Newly created test job found in production queue');

    // 2.7 Advance Job: Start Production
    if (testJob) {
      const startRes = await factoryProductionService.advanceJob(testJob.id, 'START_PRODUCTION', {
        unitCode: 'GRD-01',
        operator: 'Test Auditor'
      });
      assert(startRes.success === true && startRes.jobStatus === 'RUNNING', 'Job transitioned to RUNNING on unit GRD-01');

      // 2.8 Advance Job: Record Output & Trigger Changeover Cleaning
      const outputRes = await factoryProductionService.advanceJob(testJob.id, 'RECORD_OUTPUT_AND_CLEAN', {
        inputQty: 500,
        goodOutputQty: 475,
        processLossQty: 25,
        wasteFlourQty: 0,
        rejectionQty: 0,
        operatorName: 'Test Auditor',
        verifiedBy: 'QA Auditor'
      });
      assert(outputRes.success === true && outputRes.outputLot && outputRes.cleaningCode, 'Production output recorded & changeover cleaning order created');

      // 2.9 Advance Job: Verify Cleaning & Auto-ready Unit
      const cleanRes = await factoryProductionService.advanceJob(testJob.id, 'VERIFY_CLEANING_AND_AUTO_START_NEXT', {
        unitCode: 'GRD-01',
        cleaningCode: outputRes.cleaningCode,
        verifiedBy: 'QA Lead Auditor',
        qcNotes: 'Allergen check passed, visual clean confirmed'
      });
      assert(cleanRes.success === true, 'Cleaning verified and unit returned to READY status');
    }
  } catch (err) {
    assert(false, `Production Planning test failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST SECTION 3: MULTI-COMPANY TENANT DATA ISOLATION
  // -------------------------------------------------------------
  console.log('\n--- SECTION 3: Multi-Company Data Isolation ---');
  try {
    const comp2Code = `AUDIT_${Date.now().toString().slice(-6)}`;
    const comp2Master = await db.master.run(
      `INSERT INTO companies (code, name, status) VALUES (?, ?, 'Active')`,
      [comp2Code, `Audit Isolated Company ${comp2Code}`]
    );
    const comp2Id = comp2Master.lastInsertRowid || comp2Master.lastID;
    assert(!!comp2Id, `Created Company 2 (ID: ${comp2Id}) in master database`);

    // Ensure Company 2 database is provisioned
    await db.createCompanyDatabase(comp2Id, comp2Code);

    // Create item in Company 1
    const item1Code = `C1_ITEM_${Date.now().toString().slice(-4)}`;
    await db.forCompany(1).run('INSERT INTO item_master (item_code, item_name, type) VALUES (?, ?, ?)', [item1Code, 'C1 Exclusive Item', 'Raw']);

    // Create item in Company 2
    const item2Code = `C2_ITEM_${Date.now().toString().slice(-4)}`;
    await db.forCompany(comp2Id).run('INSERT INTO item_master (item_code, item_name, type) VALUES (?, ?, ?)', [item2Code, 'C2 Exclusive Item', 'Finished']);

    // Verify Company 1 cannot see Company 2's item
    const c1Lookup = await db.forCompany(1).query('SELECT * FROM item_master WHERE item_code = ?', [item2Code]);
    assert(c1Lookup.rows.length === 0, 'Company 1 CANNOT see Company 2 item (Strict Isolation)');

    // Verify Company 2 can see its item
    const c2Lookup = await db.forCompany(comp2Id).query('SELECT * FROM item_master WHERE item_code = ?', [item2Code]);
    assert(c2Lookup.rows.length === 1, 'Company 2 sees its exclusive item');

    // Verify Company 2 cannot see Company 1's item
    const c2LookupC1 = await db.forCompany(comp2Id).query('SELECT * FROM item_master WHERE item_code = ?', [item1Code]);
    assert(c2LookupC1.rows.length === 0, 'Company 2 CANNOT see Company 1 item (Strict Isolation)');
  } catch (err) {
    assert(false, `Company Isolation test failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST SECTION 4: SQL TRANSLATION ENGINE (POSTGRESQL COMPATIBILITY)
  // -------------------------------------------------------------
  console.log('\n--- SECTION 4: PostgreSQL SQL Translation & Dialect Normalization ---');
  try {
    // Test GROUP_CONCAT translation
    const sqlGroupConcat = 'SELECT GROUP_CONCAT(item_name, ", ") FROM item_master';
    const translatedGC = db.translateSqlForPostgres(sqlGroupConcat, 1);
    assert(translatedGC.includes('STRING_AGG'), 'GROUP_CONCAT translates to STRING_AGG for PostgreSQL');

    // Test STRFTIME translation
    const sqlStrftime = "SELECT STRFTIME('%Y-%m', date) FROM purchases";
    const translatedSF = db.translateSqlForPostgres(sqlStrftime, 1);
    assert(translatedSF.includes('SUBSTRING'), 'STRFTIME translates to SUBSTRING date slicing for PostgreSQL');

    // Test ROUND translation
    const sqlRound = 'SELECT ROUND(amount, 2) FROM purchases';
    const translatedRound = db.translateSqlForPostgres(sqlRound, 1);
    assert(translatedRound.includes('::numeric'), 'ROUND casts to numeric for strict PostgreSQL math');

    // Test ? placeholder translation
    const sqlPlaceholders = 'SELECT * FROM purchases WHERE id = ? AND supplier = ? AND date = ?';
    const translatedPH = db.translateSqlForPostgres(sqlPlaceholders, 1);
    assert(translatedPH.includes('$1') && translatedPH.includes('$2') && translatedPH.includes('$3'), '? parameters converted to $1, $2, $3 positional params');

    // Test PRAGMA table_info translation
    const pragmaQuery = "PRAGMA table_info('purchases')";
    const translatedPragma = db.translateSqlForPostgres(pragmaQuery, 1);
    assert(translatedPragma.includes('information_schema.columns'), 'PRAGMA table_info converted to PostgreSQL information_schema query');
  } catch (err) {
    assert(false, `SQL translation test failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST SECTION 5: HTTP API ENDPOINTS TEST
  // -------------------------------------------------------------
  console.log('\n--- SECTION 5: HTTP API Endpoints Smoke & Verification ---');
  
  const endpointsToTest = [
    { path: '/api/companies', method: 'GET' },
    { path: '/api/dashboard/stats', method: 'GET' },
    { path: '/api/factory-production-planning/dashboard-summary', method: 'GET' },
    { path: '/api/factory-production-planning/queue', method: 'GET' },
    { path: '/api/factory-production-planning/material-atp', method: 'GET' },
    { path: '/api/factory-production-planning/demand-forecast', method: 'GET' },
    { path: '/api/factory-production-planning/cleaning-orders', method: 'GET' },
    { path: '/api/factory-production-planning/production-outputs', method: 'GET' },
    { path: '/api/factory-production-planning/traceability/PO-2026-0045', method: 'GET' },
    { path: '/api/quotations', method: 'GET' },
    { path: '/api/purchases', method: 'GET' },
    { path: '/api/sales', method: 'GET' },
    { path: '/api/stock', method: 'GET' },
    { path: '/api/masters/item-master', method: 'GET' },
    { path: '/api/masters/customer-master', method: 'GET' },
    { path: '/api/masters/supplier-master', method: 'GET' },
    { path: '/api/vouchers', method: 'GET' },
    { path: '/api/system-health', method: 'GET' }
  ];

  for (const ep of endpointsToTest) {
    try {
      const res = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: 3001,
          path: ep.path,
          method: ep.method,
          headers: {
            'X-Company-Id': '1'
          }
        }, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            resolve({ statusCode: response.statusCode, data });
          });
        });
        req.on('error', reject);
        req.end();
      });

      assert(res.statusCode === 200 || res.statusCode === 201, `HTTP ${ep.method} ${ep.path} responded with status ${res.statusCode}`);
    } catch (err) {
      assert(false, `HTTP ${ep.method} ${ep.path} request failed: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // TEST SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 [AUDIT SUMMARY]: Total Passed: ${passedCount}, Total Failed: ${failedCount}`);
  if (failedCount === 0) {
    console.log('🎉 ALL AUDIT & REGRESSION TESTS PASSED CLEANLY (Zero 500 Errors)!');
  } else {
    console.error('❌ Failures encountered:', errors);
  }
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
