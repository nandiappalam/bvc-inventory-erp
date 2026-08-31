/**
 * Migration 002: Add company_id to all company-owned tables
 *
 * Adds company_id column to every table that stores company-specific business data.
 * Uses safe column addition (checks if column already exists).
 * Does NOT delete or modify existing data.
 */
const db = require('../config/database');

const COMPANY_OWNED_TABLES = [
  'item_master',
  'item_groups',
  'customer_master',
  'supplier_master',
  'godown_master',
  'area_master',
  'city_master',
  'transport_master',
  'consignee_group_master',
  'sender_group_master',
  'person_master',
  'ptrans_master',
  'flour_mill_master',
  'papad_company_master',
  'weightmaster',
  'ledgergroupmaster',
  'ledgermaster',
  'deduction_sales',
  'deduction_purchase',
  'purchases',
  'purchase_items',
  'purchase_returns',
  'purchase_return_items',
  'purchase_orders',
  'purchase_order_items',
  'purchase_requests',
  'purchase_request_items',
  'purchase_request_approval_history',
  'purchase_deductions',
  'sales',
  'sales_items',
  'sales_return',
  'sales_return_items',
  'stock',
  'stock_lots',
  'stock_adjustments',
  'stock_adjustment_items',
  'stock_alert_config',
  'stock_alert_contacts',
  'stock_alert_config_contacts',
  'stock_alerts',
  'stock_alert_notifications',
  'financial_years',
  'advances',
  'grains',
  'grain_input_items',
  'grain_output_items',
  'grain_wastage_items',
  'flour_out',
  'flour_out_items',
  'flour_out_returns',
  'flour_out_return_items',
  'papad_in',
  'papad_return',
  'packing',
  'packing_items',
  'open',
  'open_items',
  'quotations',
  'quotation_items',
  'sales_export_orders',
  'sales_export_order_items',
  'weight_conversion',
  'weight_conversion_items',
  'item_transfers',
  'godown_transfers',
  'vehicle_movements',
  'ledger_entries',
  'voucher',
  'voucher_entry',
  'user_activities',
  'weight_machine_setup',
  'general_setup',
  'tax_master',
  'qc_inspections',
  'qc_inspection_params',
  'incoming_quality_reports',
  'qc_approval_history',
  'grind_ccp_monitoring',
  'grind_oprp_monitoring',
  'grind_production_verification',
  'grind_operator_log',
];

async function up() {
  for (const table of COMPANY_OWNED_TABLES) {
    try {
      // Check if table exists
      const exists = await db.tableExists(table);
      if (!exists) {
        continue;
      }

      // Check if company_id column already exists
      const hasColumn = await db.columnExists(table, 'company_id');
      if (!hasColumn) {
        await db.run(`ALTER TABLE ${table} ADD COLUMN company_id INTEGER`);
        console.log(`✓ Added company_id to ${table}`);
      } else {
        console.log(`✓ company_id already exists in ${table}`);
      }
    } catch (err) {
      console.error(`✗ Error adding company_id to ${table}:`, err.message);
    }
  }

  // Add company-scoped unique constraints where applicable
  // These are added as separate indexes to avoid conflicts with existing data
  const uniqueConstraints = [
    { table: 'item_master', column: 'item_name' },
    { table: 'supplier_master', column: 'name' },
    { table: 'customer_master', column: 'name' },
    { table: 'godown_master', column: 'godown_name' },
    { table: 'area_master', column: 'name' },
    { table: 'city_master', column: 'name' },
    { table: 'transport_master', column: 'name' },
    { table: 'flour_mill_master', column: 'flourmill' },
    { table: 'papad_company_master', column: 'name' },
    { table: 'weightmaster', column: 'name' },
    { table: 'ledgergroupmaster', column: 'name' },
    { table: 'ledgermaster', column: 'name' },
    { table: 'purchase_requests', column: 'pr_no' },
  ];

  for (const { table, column } of uniqueConstraints) {
    try {
      const exists = await db.tableExists(table);
      if (!exists) continue;

      const hasCompanyId = await db.columnExists(table, 'company_id');
      if (!hasCompanyId) continue;

      // Create a unique index scoped to company_id
      // Use a safe index name
      const indexName = `idx_${table}_${column}_company_unique`;
      if (db.isSqlite) {
        await db.run(`CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${table}(company_id, ${column}) WHERE company_id IS NOT NULL`);
      } else {
        // PostgreSQL: create unique index where company_id is not null
        await db.run(`CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${table}(company_id, ${column}) WHERE company_id IS NOT NULL`);
      }
      console.log(`✓ Created company-scoped unique index on ${table}.${column}`);
    } catch (err) {
      // Index might already exist or column might not exist
      console.log(`ℹ️ Index creation note for ${table}.${column}:`, err.message);
    }
  }

  // Add company_id indexes for performance
  for (const table of COMPANY_OWNED_TABLES) {
    try {
      const exists = await db.tableExists(table);
      if (!exists) continue;

      const hasCompanyId = await db.columnExists(table, 'company_id');
      if (!hasCompanyId) continue;

      const indexName = `idx_${table}_company_id`;
      if (db.isSqlite) {
        await db.run(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(company_id)`);
      } else {
        await db.run(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(company_id)`);
      }
    } catch (err) {
      console.log(`ℹ️ Index creation note for ${table}:`, err.message);
    }
  }

  console.log('✓ Migration 002: company_id added to all company-owned tables');
}

async function down() {
  // This migration is not reversible — removing company_id would lose data
  console.log('⚠️ Migration 002 cannot be reversed (would lose company isolation)');
}

module.exports = { up, down, version: 2, name: 'add_company_id' };
