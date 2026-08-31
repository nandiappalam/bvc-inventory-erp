const db = require('../config/database');

async function testCompanyIsolation() {
  console.log('🧪 ==================================================');
  console.log('🧪 RUNNING MULTI-COMPANY DATA ISOLATION TEST');
  console.log('🧪 ==================================================\n');

  try {
<<<<<<< HEAD
=======
    // A fresh disposable database has no default tenant. Create it first so
    // the test tenant is distinct from company 1 and the isolation assertion
    // is meaningful.
    const defaultCompany = await db.master.query('SELECT id FROM companies WHERE id = ?', [1]);
    if (defaultCompany.rows.length === 0) {
      await db.master.run(
        `INSERT INTO companies (id, code, name, status) VALUES (?, ?, ?, 'Active')`,
        [1, 'COMP_TEST_DEFAULT', 'Default Test Company']
      );
      await db.createCompanyDatabase(1, 'COMP_TEST_DEFAULT');
    }

>>>>>>> origin/main
    // 1. Create a test company (Company 999)
    const testCompanyCode = `TEST_${Date.now().toString(36).toUpperCase()}`;
    const testCompanyName = `Test Isolation Company ${Date.now()}`;
    
    console.log(`Step 1: Creating new company '${testCompanyName}'...`);
    const compResult = await db.master.run(
      `INSERT INTO companies (code, name, status) VALUES (?, ?, 'Active')`,
      [testCompanyCode, testCompanyName]
    );

    const testCompanyId = compResult.lastInsertRowid || compResult.lastID;
    console.log(`✓ Master record created with ID: ${testCompanyId}`);

    // 2. Initialize isolated database / schema for the new company
    console.log(`Step 2: Auto-provisioning isolated schema for Company ${testCompanyId}...`);
    await db.createCompanyDatabase(testCompanyId, testCompanyCode);
    console.log(`✓ Isolated database/schema provisioned successfully.`);

    // 3. Insert unique items into Company 999
    const compDb = db.forCompany(testCompanyId);
    const uniqueItemCode = `ISO_ITEM_${Date.now()}`;
    
    console.log(`Step 3: Creating item '${uniqueItemCode}' in Company ${testCompanyId}...`);
    await compDb.run(
      `INSERT INTO item_master (item_code, item_name, print_name, type, status) VALUES (?, ?, ?, ?, 'Active')`,
      [uniqueItemCode, 'Isolated Raw Material', 'Isolated RM', 'Raw Material']
    );

    // 4. Verify the item exists in Company 999
    const comp999Items = await compDb.query(`SELECT * FROM item_master WHERE item_code = ?`, [uniqueItemCode]);
    if (comp999Items.rows.length === 1) {
      console.log(`✓ Item successfully created and verified in Company ${testCompanyId}`);
    } else {
      throw new Error(`Item was not found in Company ${testCompanyId}`);
    }

    // 5. Verify the item DOES NOT exist in Company 1 (Tenant Isolation Check)
    console.log(`Step 4: Verifying Company 1 CANNOT see Company ${testCompanyId}'s item...`);
    const comp1Db = db.forCompany(1);
    const comp1Items = await comp1Db.query(`SELECT * FROM item_master WHERE item_code = ?`, [uniqueItemCode]);
    
    if (comp1Items.rows.length === 0) {
      console.log(`🔒 [PASS] Strict Multi-Company Isolation Verified: Company 1 has 0 rows for '${uniqueItemCode}'!`);
    } else {
      throw new Error(`❌ [FAIL] Data Leak Detected! Company 1 saw Company ${testCompanyId}'s data.`);
    }

    // 6. Test CRUD Operations in Company 999
    console.log(`Step 5: Testing Update and Delete operations in Company ${testCompanyId}...`);
    await compDb.run(
      `UPDATE item_master SET print_name = 'Updated RM' WHERE item_code = ?`,
      [uniqueItemCode]
    );
    const updated = await compDb.query(`SELECT print_name FROM item_master WHERE item_code = ?`, [uniqueItemCode]);
    if (updated.rows[0]?.print_name === 'Updated RM') {
      console.log(`✓ Update operation succeeded.`);
    }

    await compDb.run(`DELETE FROM item_master WHERE item_code = ?`, [uniqueItemCode]);
    const deleted = await compDb.query(`SELECT * FROM item_master WHERE item_code = ?`, [uniqueItemCode]);
    if (deleted.rows.length === 0) {
      console.log(`✓ Delete operation succeeded.`);
    }

    console.log('\n🎉 ALL MULTI-COMPANY ISOLATION AND CRUD TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
}

if (require.main === module) {
  testCompanyIsolation();
}

module.exports = testCompanyIsolation;
