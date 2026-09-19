const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { AsyncLocalStorage } = require('async_hooks');
const { MASTER_TABLES, MASTER_TABLE_NAMES } = require('../database/masterSchema');
const { COMPANY_TABLES, DEFAULT_LEDGER_CHART, DEFAULT_TAX_RATES } = require('../database/companySchema');
const { orderTablesByDependencies } = require('../utils/schemaOrderer');

// Context storage for multi-tenant requests
const asyncLocalStorage = new AsyncLocalStorage();

// Check if PostgreSQL (Neon / Supabase / RDS / Render Postgres) is configured
const rawConnectionString = (
  process.env.DATABASE_URL || 
  process.env.POSTGRES_URL || 
  process.env.NEON_DATABASE_URL || 
  process.env.DATABASE_URI || 
  process.env.PGURI || 
  ''
).trim();

const isPostgres = process.env.DB_ENGINE === 'postgres' || (!!rawConnectionString && process.env.DB_ENGINE !== 'sqlite');

// ============================================================================
// MODE 1 vs MODE 2 ARCHITECTURAL ISOLATION
// Mode 1: Tauri / Desktop Local Development -> SQLite ONLY
// Mode 2: Render Production / Cloud -> Neon PostgreSQL ONLY (NON-SYNCED, NON-LINKED)
// ============================================================================
let dbDir = null;
let masterDbPath = null;
const companyDbPool = new Map();
let masterDb = null;
let pgPool = null;

if (isPostgres) {
  // MODE 2: Render / Cloud - Neon PostgreSQL ONLY
  console.log('================================================================');
  console.log('🚀 [BVC ERP MODE 2: RENDER / CLOUD]');
  console.log('🔹 Database Engine: Neon PostgreSQL ONLY');
  console.log('🔹 SQLite Files: DISABLED');
  console.log('🔹 Local SQLite Fallback: DISABLED');
  console.log('🔹 Cloud-Desktop Sync: STRICTLY NON-SYNCED & NON-LINKED');
  console.log('================================================================');

  const connectionString = rawConnectionString;
  if (!connectionString) {
    console.error('⚠️ [PostgreSQL Pool] DB_ENGINE is postgres, but no DATABASE_URL or POSTGRES_URL was found!');
  } else {
    const isSslNeeded = process.env.NODE_ENV === 'production' || 
                        connectionString.includes('neon.tech') || 
                        connectionString.includes('supabase.co') || 
                        connectionString.includes('sslmode=require') ||
                        !connectionString.includes('localhost');

    pgPool = new Pool({
      connectionString,
      ssl: isSslNeeded ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
    });

    pgPool.on('error', (err) => {
      console.error('⚠️ [PostgreSQL Pool] Error on idle client:', err.message);
    });
  }
} else {
  // MODE 1: Tauri / Desktop Local - SQLite ONLY
  console.log('================================================================');
  console.log('📦 [BVC ERP MODE 1: TAURI / LOCAL DEVELOPMENT]');
  console.log('🔹 Database Engine: SQLite ONLY (Local Multi-Tenant)');
  console.log('🔹 Storage: Local Filesystem (/database/*.db)');
  console.log('🔹 Neon PostgreSQL: DISABLED');
  console.log('🔹 Cloud Sync: STRICTLY NON-SYNCED & NON-LINKED');
  console.log('================================================================');

  dbDir = path.join(__dirname, '../../database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  masterDbPath = path.join(dbDir, 'master.db');
}

// ============================================================================
// TENANT BUSINESS TABLES SET
// ============================================================================
const TENANT_BUSINESS_TABLES = new Set([
  'purchases', 'purchase_items', 'purchase_orders', 'purchase_order_items', 'purchase_requests', 'purchase_request_items',
  'purchase_returns', 'purchase_return_items', 'purchase_deductions', 'purchase_order_deductions', 'purchase_return_deductions',
  'sales', 'sales_items', 'sales_export_orders', 'sales_export_order_items', 'sales_return', 'sales_return_items',
  'voucher', 'voucher_entry', 'ledger_entries', 'ledgermaster', 'ledgergroupmaster',
  'stock', 'stock_lots', 'stock_adjustments', 'stock_adjustment_items', 'stock_alerts', 'stock_alert_config',
  'grains', 'grain_input_items', 'grain_output_items', 'grain_wastage_items',
  'flour_out', 'flour_out_items', 'flour_out_returns', 'flour_out_return_items',
  'papad_in', 'papad_return', 'papad_company_master', 'papad_company_entry', 'papad_companies',
  'godown_master', 'godown_transfers', 'item_transfers', 'item_master', 'item_groups', 'cold_storage_vouchers', 'cold_storage_items', 'cold_storage_stock',
  'customer_master', 'supplier_master', 'employee_master', 'flour_mill_master', 'city_master', 'area_master',
  'transport_master', 'tax_master', 'qc_inspections', 'qc_inspection_params', 'qc_approval_history',
  'incoming_quality_reports', 'compliance_documents', 'compliance_production_records', 'compliance_cleaning_records',
  'vehicle_movements', 'advances', 'open', 'open_items', 'packing', 'packing_items', 'financial_years',
  'general_setup', 'weight_machine_setup', 'weight_conversion', 'weight_conversion_items', 'work_orders',
  'production_units', 'production_queue', 'cleaning_changeover_orders', 'demand_forecast_records',
  'production_output_records', 'make_to_stock_recommendations', 'production_plans', 'production_plan_items',
  'bom_headers', 'bom_items', 'yield_standards', 'production_batches', 'contractor_master',
  'jobwork_orders', 'jobwork_order_items', 'jobwork_receipts', 'quotations', 'quotation_items',
  'deduction_purchase', 'deduction_sales', 'sender_group_master', 'consignee_group_master',
  'person_master', 'ptrans_master', 'cheque_printing', 'grind_ccp_monitoring',
  'grind_operator_log', 'grind_oprp_monitoring', 'grind_production_verification',
  'work_order_items', 'work_order_outputs', 'work_order_wastages', 'weightmaster', 'lot_sequence'
]);

// Master tables MUST NEVER be included in TENANT_BUSINESS_TABLES
const MASTER_TABLE_NAMES_SET = new Set([
  'companies', 'database_registry', 'users', 'roles', 'permissions', 'user_permissions', 'login_history', '_master_migrations'
]);

// Dynamically add any additional tables declared in COMPANY_TABLES (strictly excluding master tables)
if (Array.isArray(COMPANY_TABLES)) {
  COMPANY_TABLES.forEach(sql => {
    if (typeof sql === 'string') {
      const match = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      if (match && match[1]) {
        const tblName = match[1].toLowerCase();
        if (!MASTER_TABLE_NAMES_SET.has(tblName)) {
          TENANT_BUSINESS_TABLES.add(tblName);
        }
      }
    }
  });
}

// ============================================================================
// HELPER: IS MASTER TABLE QUERY
// ============================================================================
function isMasterTableQuery(sql) {
  if (!sql || typeof sql !== 'string') return false;
  const normalized = sql.toLowerCase();

  // If query explicitly references public schema, it is always a master query
  if (/\bpublic\./i.test(normalized)) {
    return true;
  }

  // Check if query targets any master table (companies, users, database_registry, etc.)
  let targetsMaster = false;
  for (const tableName of MASTER_TABLE_NAMES) {
    const mRegex = new RegExp(`\\b(from|into|update|join|table)\\s+(public\\.)?${tableName}\\b`, 'i');
    if (mRegex.test(normalized)) {
      targetsMaster = true;
      break;
    }
  }

  if (targetsMaster) {
    // If it targets a master table, verify it does not join with a tenant business table
    for (const bTable of TENANT_BUSINESS_TABLES) {
      const bRegex = new RegExp(`\\b${bTable}\\b`, 'i');
      if (bRegex.test(normalized)) {
        return false; // Joined with tenant operational table, so route to tenant schema
      }
    }
    return true; // Pure master query targeting public schema!
  }

  return false;
}

// ============================================================================
// PAREN-AWARE SQL EXPRESSION REPLACERS
// ============================================================================
function replaceGroupConcat(sql) {
  const marker = 'GROUP_CONCAT';
  let result = '';
  let i = 0;
  while (i < sql.length) {
    const idx = sql.toUpperCase().indexOf(marker, i);
    if (idx === -1) {
      result += sql.slice(i);
      break;
    }
    if (idx > 0 && /[a-zA-Z0-9_]/.test(sql[idx - 1])) {
      result += sql.slice(i, idx + marker.length);
      i = idx + marker.length;
      continue;
    }
    result += sql.slice(i, idx);
    let cur = idx + marker.length;
    while (cur < sql.length && /\s/.test(sql[cur])) cur++;
    if (sql[cur] !== '(') {
      result += marker;
      i = idx + marker.length;
      continue;
    }
    cur++;
    let depth = 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let args = [];
    let curArg = '';

    while (cur < sql.length && depth > 0) {
      const char = sql[cur];
      if (char === "'" && !inDoubleQuote) {
        if (inSingleQuote && sql[cur + 1] === "'") {
          curArg += "''";
          cur += 2;
          continue;
        }
        inSingleQuote = !inSingleQuote;
        curArg += char;
        cur++;
        continue;
      }
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        curArg += char;
        cur++;
        continue;
      }
      if (!inSingleQuote && !inDoubleQuote) {
        if (char === '(') {
          depth++;
          curArg += char;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            args.push(curArg.trim());
            curArg = '';
          } else {
            curArg += char;
          }
        } else if (char === ',' && depth === 1) {
          args.push(curArg.trim());
          curArg = '';
        } else {
          curArg += char;
        }
      } else {
        curArg += char;
      }
      cur++;
    }

    if (depth !== 0 || args.length === 0) {
      result += marker;
      i = idx + marker.length;
      continue;
    }

    let expr = args[0] || '';
    let delimiter = args[1] || "', '";
    let isDistinct = false;
    if (/^DISTINCT\s+/i.test(expr)) {
      isDistinct = true;
      expr = expr.replace(/^DISTINCT\s+/i, '').trim();
    }

    result += `STRING_AGG(${isDistinct ? 'DISTINCT ' : ''}(${expr})::text, ${delimiter})`;
    i = cur;
  }
  return result;
}

function replaceStrftime(sql) {
  const marker = 'STRFTIME';
  let result = '';
  let i = 0;
  while (i < sql.length) {
    const idx = sql.toUpperCase().indexOf(marker, i);
    if (idx === -1) {
      result += sql.slice(i);
      break;
    }
    if (idx > 0 && /[a-zA-Z0-9_]/.test(sql[idx - 1])) {
      result += sql.slice(i, idx + marker.length);
      i = idx + marker.length;
      continue;
    }
    result += sql.slice(i, idx);
    let cur = idx + marker.length;
    while (cur < sql.length && /\s/.test(sql[cur])) cur++;
    if (sql[cur] !== '(') {
      result += marker;
      i = idx + marker.length;
      continue;
    }
    cur++;
    let depth = 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let args = [];
    let curArg = '';

    while (cur < sql.length && depth > 0) {
      const char = sql[cur];
      if (char === "'" && !inDoubleQuote) {
        if (inSingleQuote && sql[cur + 1] === "'") {
          curArg += "''";
          cur += 2;
          continue;
        }
        inSingleQuote = !inSingleQuote;
        curArg += char;
        cur++;
        continue;
      }
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        curArg += char;
        cur++;
        continue;
      }
      if (!inSingleQuote && !inDoubleQuote) {
        if (char === '(') {
          depth++;
          curArg += char;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            args.push(curArg.trim());
            curArg = '';
          } else {
            curArg += char;
          }
        } else if (char === ',' && depth === 1) {
          args.push(curArg.trim());
          curArg = '';
        } else {
          curArg += char;
        }
      } else {
        curArg += char;
      }
      cur++;
    }

    if (depth !== 0 || args.length < 2) {
      result += marker;
      i = idx + marker.length;
      continue;
    }

    const fmt = args[0].replace(/['"]/g, '').trim();
    const colExpr = args[1].trim();

    if (fmt === '%Y-%m') {
      result += `SUBSTRING((${colExpr})::text FROM 1 FOR 7)`;
    } else if (fmt === '%Y') {
      result += `SUBSTRING((${colExpr})::text FROM 1 FOR 4)`;
    } else if (fmt === '%m') {
      result += `SUBSTRING((${colExpr})::text FROM 6 FOR 2)`;
    } else if (fmt === '%d') {
      result += `SUBSTRING((${colExpr})::text FROM 9 FOR 2)`;
    } else if (fmt === '%Y-%m-%d') {
      result += `SUBSTRING((${colExpr})::text FROM 1 FOR 10)`;
    } else {
      result += `SUBSTRING((${colExpr})::text FROM 1 FOR 10)`;
    }
    i = cur;
  }
  return result;
}

function replaceRound(sql) {
  const marker = 'ROUND';
  let result = '';
  let i = 0;
  while (i < sql.length) {
    const idx = sql.toUpperCase().indexOf(marker, i);
    if (idx === -1) {
      result += sql.slice(i);
      break;
    }
    if (idx > 0 && /[a-zA-Z0-9_]/.test(sql[idx - 1])) {
      result += sql.slice(i, idx + marker.length);
      i = idx + marker.length;
      continue;
    }
    result += sql.slice(i, idx);
    let cur = idx + marker.length;
    while (cur < sql.length && /\s/.test(sql[cur])) cur++;
    if (sql[cur] !== '(') {
      result += marker;
      i = idx + marker.length;
      continue;
    }
    cur++;
    let depth = 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let args = [];
    let curArg = '';

    while (cur < sql.length && depth > 0) {
      const char = sql[cur];
      if (char === "'" && !inDoubleQuote) {
        if (inSingleQuote && sql[cur + 1] === "'") {
          curArg += "''";
          cur += 2;
          continue;
        }
        inSingleQuote = !inSingleQuote;
        curArg += char;
        cur++;
        continue;
      }
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        curArg += char;
        cur++;
        continue;
      }
      if (!inSingleQuote && !inDoubleQuote) {
        if (char === '(') {
          depth++;
          curArg += char;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            args.push(curArg.trim());
            curArg = '';
          } else {
            curArg += char;
          }
        } else if (char === ',' && depth === 1) {
          args.push(curArg.trim());
          curArg = '';
        } else {
          curArg += char;
        }
      } else {
        curArg += char;
      }
      cur++;
    }

    if (depth !== 0 || args.length === 0) {
      result += marker;
      i = idx + marker.length;
      continue;
    }

    const innerArg0 = replaceRound(args[0]);
    if (args.length >= 2) {
      const decimals = args[1].trim();
      result += `ROUND((${innerArg0})::numeric, ${decimals})`;
    } else {
      result += `ROUND((${innerArg0})::numeric)`;
    }
    i = cur;
  }
  return result;
}

function replacePrintf(sql) {
  const marker = 'PRINTF';
  let result = '';
  let i = 0;
  while (i < sql.length) {
    const idx = sql.toUpperCase().indexOf(marker, i);
    if (idx === -1) {
      result += sql.slice(i);
      break;
    }
    if (idx > 0 && /[a-zA-Z0-9_]/.test(sql[idx - 1])) {
      result += sql.slice(i, idx + marker.length);
      i = idx + marker.length;
      continue;
    }
    result += sql.slice(i, idx);
    let cur = idx + marker.length;
    while (cur < sql.length && /\s/.test(sql[cur])) cur++;
    if (sql[cur] !== '(') {
      result += marker;
      i = idx + marker.length;
      continue;
    }
    cur++;
    let depth = 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let args = [];
    let curArg = '';

    while (cur < sql.length && depth > 0) {
      const char = sql[cur];
      if (char === "'" && !inDoubleQuote) {
        if (inSingleQuote && sql[cur + 1] === "'") {
          curArg += "''";
          cur += 2;
          continue;
        }
        inSingleQuote = !inSingleQuote;
        curArg += char;
        cur++;
        continue;
      }
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        curArg += char;
        cur++;
        continue;
      }
      if (!inSingleQuote && !inDoubleQuote) {
        if (char === '(') {
          depth++;
          curArg += char;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            args.push(curArg.trim());
            curArg = '';
          } else {
            curArg += char;
          }
        } else if (char === ',' && depth === 1) {
          args.push(curArg.trim());
          curArg = '';
        } else {
          curArg += char;
        }
      } else {
        curArg += char;
      }
      cur++;
    }

    if (depth !== 0 || args.length === 0) {
      result += marker;
      i = idx + marker.length;
      continue;
    }

    const fmt = args[0].replace(/['"]/g, '').trim();
    const padMatch = fmt.match(/^%0?(\d+)d$/);
    if (padMatch && args[1]) {
      const width = padMatch[1];
      result += `LPAD(CAST(COALESCE(${args[1]}, 0) AS TEXT), ${width}, '0')`;
    } else if (args[1]) {
      result += `CAST(${args[1]} AS TEXT)`;
    } else {
      result += `''`;
    }
    i = cur;
  }
  return result;
}

function replaceJsonExtract(sql) {
  const marker = 'JSON_EXTRACT';
  let result = '';
  let i = 0;
  while (i < sql.length) {
    const idx = sql.toUpperCase().indexOf(marker, i);
    if (idx === -1) {
      result += sql.slice(i);
      break;
    }
    if (idx > 0 && /[a-zA-Z0-9_]/.test(sql[idx - 1])) {
      result += sql.slice(i, idx + marker.length);
      i = idx + marker.length;
      continue;
    }
    result += sql.slice(i, idx);
    let cur = idx + marker.length;
    while (cur < sql.length && /\s/.test(sql[cur])) cur++;
    if (sql[cur] !== '(') {
      result += marker;
      i = idx + marker.length;
      continue;
    }
    cur++;
    let depth = 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let args = [];
    let curArg = '';

    while (cur < sql.length && depth > 0) {
      const char = sql[cur];
      if (char === "'" && !inDoubleQuote) {
        if (inSingleQuote && sql[cur + 1] === "'") {
          curArg += "''";
          cur += 2;
          continue;
        }
        inSingleQuote = !inSingleQuote;
        curArg += char;
        cur++;
        continue;
      }
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        curArg += char;
        cur++;
        continue;
      }
      if (!inSingleQuote && !inDoubleQuote) {
        if (char === '(') {
          depth++;
          curArg += char;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            args.push(curArg.trim());
            curArg = '';
          } else {
            curArg += char;
          }
        } else if (char === ',' && depth === 1) {
          args.push(curArg.trim());
          curArg = '';
        } else {
          curArg += char;
        }
      } else {
        curArg += char;
      }
      cur++;
    }

    if (depth !== 0 || args.length < 2) {
      result += marker;
      i = idx + marker.length;
      continue;
    }

    const col = args[0].trim();
    const path = args[1].replace(/['"]/g, '').replace(/^\$\.?/, '').trim();
    result += `((${col})::jsonb->>'${path}')`;
    i = cur;
  }
  return result;
}

// ============================================================================
// SQL NORMALIZER & TRANSLATOR (SQLite <-> PostgreSQL)
// ============================================================================
function translateSqlForPostgres(sql, companyId = 1) {
  if (!sql || typeof sql !== 'string') return sql;

  let transformed = sql.trim();

  // 0. Handle PRAGMA commands for PostgreSQL
  const pragmaMatch = transformed.match(/^PRAGMA\s+table_info\s*\(\s*([^\)]+)\s*\)/i);
  if (pragmaMatch) {
    const rawTableName = pragmaMatch[1].trim().replace(/['"`]/g, '');
    return `SELECT column_name AS name, data_type AS type, (CASE WHEN is_nullable = 'NO' THEN 1 ELSE 0 END) AS notnull, column_default AS dflt_value 
            FROM information_schema.columns 
            WHERE lower(table_name) = lower('${rawTableName}') 
              AND (table_schema = 'company_${companyId}' OR table_schema = 'public')`;
  }

  const pragmaIndexMatch = transformed.match(/^PRAGMA\s+index_list\s*\(\s*([^\)]+)\s*\)/i);
  if (pragmaIndexMatch) {
    const rawTableName = pragmaIndexMatch[1].trim().replace(/['"`]/g, '');
    return `SELECT indexname AS name FROM pg_indexes WHERE lower(tablename) = lower('${rawTableName}')`;
  }

  if (/^PRAGMA\s+/i.test(transformed)) {
    // Non-applicable SQLite pragmas become safe no-ops
    return 'SELECT 1 AS pragma_result';
  }

  // 1. Convert sqlite_master queries safely with virtual table subquery
  if (/\bsqlite_master\b/i.test(transformed)) {
    const virtualMaster = `(
      SELECT tablename AS name, tablename AS table_name, 'table' AS type, tablename AS tbl_name, '' AS sql 
      FROM pg_tables 
      WHERE schemaname IN ('public', 'company_${companyId}')
      UNION ALL
      SELECT indexname AS name, indexname AS table_name, 'index' AS type, tablename AS tbl_name, '' AS sql
      FROM pg_indexes
      WHERE schemaname IN ('public', 'company_${companyId}')
    ) AS sqlite_master`;
    transformed = transformed.replace(/\bsqlite_master\b/gi, virtualMaster);
  }

  // 2. Convert INSERT OR IGNORE to INSERT ... ON CONFLICT DO NOTHING
  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(transformed)) {
    transformed = transformed.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(transformed)) {
      transformed = `${transformed.trim()} ON CONFLICT DO NOTHING`;
    }
  }

  // 3. Convert INSERT OR REPLACE to standard INSERT ON CONFLICT DO NOTHING or UPDATE
  if (/INSERT\s+OR\s+REPLACE\s+INTO/i.test(transformed)) {
    transformed = transformed.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(transformed)) {
      transformed = `${transformed.trim()} ON CONFLICT DO NOTHING`;
    }
  }

  // 4. Translate SQLite type keywords in CREATE TABLE statements
  transformed = transformed.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
  transformed = transformed.replace(/DATETIME\s+DEFAULT\s+CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  transformed = transformed.replace(/DATETIME/gi, 'TIMESTAMP');

  // 4b. Translate SQLite SQL functions for PostgreSQL using paren-matching parsers
  transformed = replaceGroupConcat(transformed);
  transformed = replaceStrftime(transformed);
  transformed = replaceRound(transformed);
  transformed = replacePrintf(transformed);
  transformed = replaceJsonExtract(transformed);

  transformed = transformed.replace(/DATE\s*\(\s*['"]now['"]\s*\)/gi, 'CURRENT_DATE');
  transformed = transformed.replace(/DATETIME\s*\(\s*['"]now['"]\s*(?:,\s*['"][^'"]*['"])?\s*\)/gi, 'CURRENT_TIMESTAMP');
  transformed = transformed.replace(/IFNULL\s*\(/gi, 'COALESCE(');

  // 4b2. Safe integer casting for PostgreSQL to prevent "invalid input syntax for integer" on text columns
  transformed = transformed.replace(/CAST\s*\(\s*([a-zA-Z0-9_."]+)\s+AS\s+INTEGER\s*\)/gi, "CAST(NULLIF(regexp_replace(CAST($1 AS TEXT), '\\D', '', 'g'), '') AS INTEGER)");

  // 4c. Prevent empty IN () / NOT IN () syntax errors
  transformed = transformed.replace(/\bIN\s*\(\s*\)/gi, 'IN (NULL)');
  transformed = transformed.replace(/\bNOT\s+IN\s*\(\s*\)/gi, 'NOT IN (NULL)');

  // 4d. Ensure ADD COLUMN uses IF NOT EXISTS for PostgreSQL
  transformed = transformed.replace(/ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS\b)(\w+)/gi, 'ADD COLUMN IF NOT EXISTS $1');

  // 4e. Translate SQLite GLOB operator to PostgreSQL regex / LIKE
  transformed = transformed.replace(/\bGLOB\s+'\[0-9\]\*'/gi, "~ '^[0-9]'");
  transformed = transformed.replace(/\bGLOB\s+'([^']+)'/gi, (match, pattern) => {
    if (pattern.includes('[') || pattern.includes('?')) {
      const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
      return `~ '^${regexPattern}'`;
    }
    const likePattern = pattern.replace(/\*/g, '%').replace(/\?/g, '_');
    return `LIKE '${likePattern}'`;
  });

  // 4f. Fix double-quoted default string literals: DEFAULT "value" -> DEFAULT 'value'
  transformed = transformed.replace(/DEFAULT\s+"([^"]+)"/gi, "DEFAULT '$1'");

  // 4g. Handle reserved keyword current_date when used as column definition or assignment
  transformed = transformed.replace(/\bcurrent_date\s+TEXT\b/gi, '"current_date" TEXT');
  transformed = transformed.replace(/,\s*current_date\s*,/gi, ', "current_date",');
  transformed = transformed.replace(/\bcurrent_date\s*=\s*excluded\.current_date\b/gi, '"current_date" = excluded."current_date"');
  transformed = transformed.replace(/\bcurrent_date\s*=\s*\?/gi, '"current_date" = ?');

  // 4h. Strip FOREIGN KEY constraints from CREATE TABLE to prevent broken cross-schema references in PostgreSQL
  if (/CREATE\s+TABLE/i.test(transformed)) {
    transformed = transformed.replace(/,\s*FOREIGN\s+KEY\s*\([^)]+\)\s*REFERENCES\s+[a-zA-Z0-9_\".]+(?:\s*\([^)]+\))?(?:\s+ON\s+(?:DELETE|UPDATE)\s+[A-Za-z\s]+)*/gi, '');
    transformed = transformed.replace(/FOREIGN\s+KEY\s*\([^)]+\)\s*REFERENCES\s+[a-zA-Z0-9_\".]+(?:\s*\([^)]+\))?(?:\s+ON\s+(?:DELETE|UPDATE)\s+[A-Za-z\s]+)*\s*,?/gi, '');
  }

  // 5. If INSERT statement without RETURNING clause, append RETURNING id
  const trimmed = transformed.trim();
  if (/^INSERT\s+INTO/i.test(trimmed) && !/RETURNING/i.test(trimmed)) {
    // Check if table likely has an id column
    if (!trimmed.endsWith(';')) {
      transformed = `${transformed} RETURNING id`;
    } else {
      transformed = `${transformed.slice(0, -1)} RETURNING id;`;
    }
  }

  // 6. Convert ? parameter placeholders to $1, $2, $3...
  let paramIndex = 1;
  transformed = transformed.replace(/\?/g, () => `$${paramIndex++}`);

  return transformed;
}

// ============================================================================
// SQLITE IMPLEMENTATION DETAILS
// ============================================================================
function openMasterDatabase() {
  if (masterDb) return masterDb;

  masterDb = new sqlite3.Database(masterDbPath, (err) => {
    if (err) {
      console.error('❌ Error opening master SQLite database:', err.message);
    } else {
      console.log('✅ Connected to Master SQLite database at:', masterDbPath);
    }
  });

  masterDb.serialize(() => {
    masterDb.run('PRAGMA foreign_keys = ON');
    masterDb.run('PRAGMA journal_mode = WAL');
    masterDb.run('PRAGMA synchronous = NORMAL');
    masterDb.run('PRAGMA busy_timeout = 30000');

    for (const tbl of MASTER_TABLES) {
      masterDb.run(tbl.sql);
    }

    // Auto-migrate master tables columns if missing from earlier schema versions
    const masterColsToAdd = [
      { table: 'companies', col: 'code', type: 'TEXT' },
      { table: 'companies', col: 'address', type: 'TEXT' },
      { table: 'companies', col: 'gst_number', type: 'TEXT' },
      { table: 'companies', col: 'contact', type: 'TEXT' },
      { table: 'companies', col: 'email', type: 'TEXT' },
      { table: 'companies', col: 'database_name', type: 'TEXT' },
      { table: 'companies', col: 'database_schema', type: 'TEXT' },
      { table: 'companies', col: 'status', type: "TEXT DEFAULT 'Active'" },
      { table: 'users', col: 'status', type: "TEXT DEFAULT 'Active'" },
      { table: 'users', col: 'email', type: 'TEXT' },
      { table: 'users', col: 'phone', type: 'TEXT' },
      { table: 'users', col: 'password_expiry_days', type: 'INTEGER DEFAULT 90' },
      { table: 'users', col: 'password_last_changed', type: 'TEXT' }
    ];
    for (const mCol of masterColsToAdd) {
      masterDb.run(`ALTER TABLE ${mCol.table} ADD COLUMN ${mCol.col} ${mCol.type}`, () => {});
    }
  });

  return masterDb;
}

if (!isPostgres) {
  openMasterDatabase();
}

function getCompanyDbPath(companyId = 1) {
  if (isPostgres || !dbDir) return null;
  const cId = parseInt(companyId, 10) || 1;
  return path.join(dbDir, `company_${cId}.db`);
}

function getCompanyDatabaseInstance(companyId = 1) {
  const cId = parseInt(companyId, 10) || 1;
  if (companyDbPool.has(cId)) {
    return companyDbPool.get(cId);
  }

  const filePath = getCompanyDbPath(cId);
  const instance = new sqlite3.Database(filePath, (err) => {
    if (err) {
      console.error(`❌ Error opening Company ${cId} database at ${filePath}:`, err.message);
    }
  });

  instance.serialize(() => {
    instance.run('PRAGMA foreign_keys = ON');
    instance.run('PRAGMA journal_mode = WAL');
    instance.run('PRAGMA synchronous = NORMAL');
    instance.run('PRAGMA busy_timeout = 30000');

    // Ensure company tables exist
    for (const tableSql of COMPANY_TABLES) {
      instance.run(tableSql, () => {});
    }

    // Ensure crucial purchase columns exist on this company database
    const extraCols = [
      'ALTER TABLE purchases ADD COLUMN transporter TEXT',
      'ALTER TABLE purchases ADD COLUMN transport TEXT',
      'ALTER TABLE purchases ADD COLUMN vehicle_no TEXT',
      'ALTER TABLE purchases ADD COLUMN lorry_no TEXT',
      'ALTER TABLE purchases ADD COLUMN driver_name TEXT',
      'ALTER TABLE purchases ADD COLUMN driver TEXT',
      'ALTER TABLE purchases ADD COLUMN purchase_order_id INTEGER',
      'ALTER TABLE purchases ADD COLUMN po_no TEXT',
      'ALTER TABLE purchases ADD COLUMN source_order_id INTEGER',
      'ALTER TABLE purchases ADD COLUMN source_order_no TEXT',
      'ALTER TABLE purchases ADD COLUMN tax_percent REAL DEFAULT 0',
      'ALTER TABLE purchases ADD COLUMN deduction_amount REAL DEFAULT 0',
      'ALTER TABLE purchase_items ADD COLUMN item_id INTEGER',
      'ALTER TABLE purchase_items ADD COLUMN per_unit_weight REAL DEFAULT 0',
      'ALTER TABLE purchase_items ADD COLUMN total_weight REAL DEFAULT 0',
      'ALTER TABLE purchase_items ADD COLUMN disc_amount REAL DEFAULT 0',
      'ALTER TABLE purchase_items ADD COLUMN tax_amount REAL DEFAULT 0'
    ];
    for (const sql of extraCols) {
      instance.run(sql, () => {});
    }
  });

  companyDbPool.set(cId, instance);
  return instance;
}

function resolveTargetDatabase(sql, explicitCompanyId = null) {
  if (isMasterTableQuery(sql)) {
    return openMasterDatabase();
  }
  if (explicitCompanyId) {
    return getCompanyDatabaseInstance(explicitCompanyId);
  }
  const store = asyncLocalStorage.getStore();
  const contextCompanyId = store ? store.companyId : 1;
  return getCompanyDatabaseInstance(contextCompanyId);
}

// ============================================================================
// POSTGRESQL SEQUENCE RESYNCHRONIZATION
// ============================================================================
async function resyncPostgresSequences(clientOrPool, schemaName = null) {
  try {
    const q = clientOrPool.query ? clientOrPool : pgPool;
    if (!q) return;

    const sql = `
      SELECT 
        n.nspname AS schema_name,
        c.relname AS table_name,
        a.attname AS column_name,
        s.relname AS sequence_name
      FROM pg_class s
      JOIN pg_depend d ON d.objid = s.oid
      JOIN pg_class c ON d.refobjid = c.oid
      JOIN pg_attribute a ON (d.refobjid = a.attrelid AND d.refobjsubid = a.attnum)
      JOIN pg_namespace n ON n.oid = s.relnamespace
      WHERE s.relkind = 'S' AND c.relkind = 'r'
        ${schemaName ? 'AND n.nspname = $1' : "AND (n.nspname = 'public' OR n.nspname LIKE 'company_%')"}
    `;
    const params = schemaName ? [schemaName] : [];
    const res = await q.query(sql, params);
    for (const row of (res.rows || [])) {
      try {
        await q.query(`
          SELECT setval(
            '"' || $1 || '"."' || $2 || '"', 
            COALESCE((SELECT MAX("${row.column_name}") FROM "${row.schema_name}"."${row.table_name}"), 0) + 1, 
            false
          )
        `, [row.schema_name, row.sequence_name]);
      } catch (e) {}
    }
  } catch (err) {
    console.warn('⚠️ [PostgreSQL] Sequence resync warning:', err.message);
  }
}

async function ensurePostgresCompanySequences(companyId = 1) {
  if (!isPostgres || !pgPool) return;
  const client = await pgPool.connect();
  try {
    const schemaName = `company_${parseInt(companyId, 10) || 1}`;
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    await client.query(`SET search_path TO ${schemaName}, public`);
    await resyncPostgresSequences(client, schemaName);
  } finally {
    try {
      await client.query('RESET search_path;');
    } catch (_) {}
    client.release();
  }
}

// ============================================================================
// POSTGRESQL MULTI-TENANT QUERY RUNNER
// ============================================================================
async function executePgQuery(sql, params = [], companyId = 1, isMaster = false) {
  if (!pgPool) {
    throw new Error('PostgreSQL pool not initialized. Please verify DATABASE_URL.');
  }

  const client = await pgPool.connect();
  try {
    const cId = parseInt(companyId, 10) || 1;
    const schemaName = isMaster ? 'public' : `company_${cId}`;

    // Ensure schema exists and set search_path for isolation
    if (!isMaster) {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName};`);
      await client.query(`SET search_path TO ${schemaName}, public;`);
    } else {
      await client.query(`SET search_path TO public;`);
    }

    let transformedSql = translateSqlForPostgres(sql, cId);
    let result;
    try {
      result = await client.query(transformedSql, params);
    } catch (queryErr) {
      if (queryErr.code === '42703' && /RETURNING id/i.test(transformedSql)) {
        const withoutReturning = transformedSql.replace(/\s+RETURNING\s+id\b/gi, '');
        result = await client.query(withoutReturning, params);
      } else if (queryErr.code === '23505' && /duplicate key value violates unique constraint/i.test(queryErr.message)) {
        await resyncPostgresSequences(client, schemaName);
        result = await client.query(transformedSql, params);
      } else if (queryErr.code === '23503' && /violates foreign key constraint/i.test(queryErr.message)) {
        const constraintMatch = queryErr.message.match(/violates foreign key constraint "([^"]+)"/i) || [null, queryErr.constraint];
        const referencingTableMatch = queryErr.message.match(/on table "([^"]+)"/i) || queryErr.message.match(/table "([^"]+)"/i) || [null, queryErr.table];
        const constraintName = constraintMatch[1];
        const tableName = referencingTableMatch[1];
        if (constraintName && tableName) {
          try {
            await client.query(`ALTER TABLE IF EXISTS "${schemaName}"."${tableName}" DROP CONSTRAINT IF EXISTS "${constraintName}" CASCADE`);
            await client.query(`ALTER TABLE IF EXISTS "public"."${tableName}" DROP CONSTRAINT IF EXISTS "${constraintName}" CASCADE`);
            result = await client.query(transformedSql, params);
          } catch (retryErr) {
            throw queryErr;
          }
        } else {
          throw queryErr;
        }
      } else {
        throw queryErr;
      }
    }

    // Normalize result object for compatibility
    let lastID = null;
    if (result.rows && result.rows.length > 0 && result.rows[0].id !== undefined) {
      lastID = result.rows[0].id;
    }

    return {
      rows: result.rows || [],
      rowCount: result.rowCount || 0,
      changes: result.rowCount || 0,
      lastID: lastID,
      lastInsertRowid: lastID,
    };
  } catch (err) {
    // If table doesn't exist, log cleanly and handle gracefully
    if (err.code === '42P01') { // undefined_table
      console.warn(`[PostgreSQL] Table not yet created: ${err.message}. Returning empty result.`);
      return { rows: [], rowCount: 0, changes: 0, lastID: null, lastInsertRowid: null };
    }
    throw err;
  } finally {
    try {
      await client.query('RESET search_path;');
    } catch (_) {}
    client.release();
  }
}

// ============================================================================
// SQLITE EXECUTION HELPERS
// ============================================================================
function cleanSqlForSqlite(sql) {
  if (!sql || typeof sql !== 'string') return sql;
  return sql.replace(/\bpublic\.([a-zA-Z0-9_]+)\b/gi, '$1');
}

function queryOnSqlite(dbInst, text, params = []) {
  const cleanedText = cleanSqlForSqlite(text);
  return new Promise((resolve, reject) => {
    dbInst.all(cleanedText, params, (err, rows) => {
      if (err) reject(err);
      else resolve({ rows: rows || [] });
    });
  });
}

function runOnSqlite(dbInst, text, params = []) {
  const cleanedText = cleanSqlForSqlite(text);
  return new Promise((resolve, reject) => {
    dbInst.run(cleanedText, params, function (err) {
      if (err) reject(err);
      else {
        resolve({
          lastID: this.lastID,
          lastInsertRowid: this.lastID,
          changes: this.changes,
        });
      }
    });
  });
}

// ============================================================================
// CREATE NEW COMPANY DATABASE / SCHEMA (Zero-Error Automatic Provisioning)
// ============================================================================
async function createCompanyDatabase(companyId, companyCode) {
  const cId = parseInt(companyId, 10);
  if (!cId) throw new Error('Invalid companyId for database creation');

  console.log(`🏗️ [Database] Creating isolated tenant environment for Company ${cId} (${companyCode})...`);

  if (isPostgres) {
    // PostgreSQL Multi-Tenant Provisioning
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const schemaName = `company_${cId}`;
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
      await client.query(`SET search_path TO ${schemaName}, public`);

      // 1. Create all ERP tables
      for (const tableSql of orderTablesByDependencies(COMPANY_TABLES)) {
        const pgSql = translateSqlForPostgres(tableSql, cId);
        await client.query(pgSql);
      }

      // 2. Seed Default Ledgers
      for (const led of DEFAULT_LEDGER_CHART) {
        await client.query(
          `INSERT INTO ledgermaster (name, printname, under, ledger_type, openingbalance, status) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           ON CONFLICT DO NOTHING`,
          [led.name, led.printname, led.under, led.ledger_type, led.openingbalance, 'Active']
        );
      }

      // 3. Seed Default Tax Rates
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_master_tax_name ON tax_master(tax_name)`);
      for (const tax of DEFAULT_TAX_RATES) {
        await client.query(
          `INSERT INTO tax_master (tax_name, hsn_code, gst_rate, cgst_rate, sgst_rate, igst_rate, status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           ON CONFLICT (tax_name) DO NOTHING`,
          [
            tax.tax_name, 
            tax.hsn_code || '0000', 
            tax.gst_rate !== undefined ? tax.gst_rate : (tax.tax_percent || 0), 
            tax.cgst_rate !== undefined ? tax.cgst_rate : (tax.cgst || 0), 
            tax.sgst_rate !== undefined ? tax.sgst_rate : (tax.sgst || 0), 
            tax.igst_rate !== undefined ? tax.igst_rate : (tax.igst || 0), 
            'Active'
          ]
        );
      }

      // 4. Seed Current Financial Year
      const now = new Date();
      const currentYear = now.getFullYear();
      const nextYear = currentYear + 1;
      const fyString = `${currentYear}-${nextYear}`;
      await client.query(
        `INSERT INTO financial_years (company_id, financial_year, start_date, end_date, is_active, is_current, is_locked) 
         VALUES ($1, $2, $3, $4, 1, 1, 0) 
         ON CONFLICT DO NOTHING`,
        [cId, fyString, `${currentYear}-04-01`, `${nextYear}-03-31`]
      );

      // 5. Register in Master Database Registry
      await client.query(`SET search_path TO public`);
      await client.query(
        `INSERT INTO database_registry (company_id, db_type, db_name, db_schema, status) 
         VALUES ($1, 'postgres', $2, $3, 'Active') 
         ON CONFLICT (company_id) DO UPDATE SET last_migrated_at = CURRENT_TIMESTAMP`,
        [cId, `company_${cId}`, schemaName]
      );

      await client.query('COMMIT');
      console.log(`🎉 [PostgreSQL] Company ${cId} schema '${schemaName}' fully provisioned with clean ERP tables!`);
      return { success: true, companyId: cId, schema: schemaName };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ [PostgreSQL] Error creating company ${cId} schema:`, err.message);
      throw err;
    } finally {
      client.release();
    }
  } else {
    // SQLite Multi-Tenant Provisioning
    const compDb = getCompanyDatabaseInstance(cId);
    return new Promise((resolve, reject) => {
      compDb.serialize(async () => {
        try {
          for (const tableSql of COMPANY_TABLES) {
            await new Promise((res, rej) => compDb.run(tableSql, (err) => err ? rej(err) : res()));
          }

          for (const led of DEFAULT_LEDGER_CHART) {
            await new Promise((res) => {
              compDb.run(
                `INSERT OR IGNORE INTO ledgermaster (name, printname, under, ledger_type, openingbalance, status) VALUES (?, ?, ?, ?, ?, ?)`,
                [led.name, led.printname, led.under, led.ledger_type, led.openingbalance, 'Active'],
                () => res()
              );
            });
          }

          await new Promise((res) => compDb.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_master_tax_name ON tax_master(tax_name)`, () => res()));

          for (const tax of DEFAULT_TAX_RATES) {
            await new Promise((res) => {
              compDb.get(`SELECT id FROM tax_master WHERE tax_name = ?`, [tax.tax_name], (err, row) => {
                if (row) return res();
                compDb.run(
                  `INSERT INTO tax_master (tax_name, hsn_code, gst_rate, cgst_rate, sgst_rate, igst_rate, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [
                    tax.tax_name, 
                    tax.hsn_code || '0000', 
                    tax.gst_rate !== undefined ? tax.gst_rate : (tax.tax_percent || 0), 
                    tax.cgst_rate !== undefined ? tax.cgst_rate : (tax.cgst || 0), 
                    tax.sgst_rate !== undefined ? tax.sgst_rate : (tax.sgst || 0), 
                    tax.igst_rate !== undefined ? tax.igst_rate : (tax.igst || 0), 
                    'Active'
                  ],
                  () => res()
                );
              });
            });
          }

          const now = new Date();
          const currentYear = now.getFullYear();
          const nextYear = currentYear + 1;
          const fyString = `${currentYear}-${nextYear}`;
          await new Promise((res) => {
            compDb.run(
              `INSERT OR IGNORE INTO financial_years (company_id, financial_year, start_date, end_date, is_active, is_locked) VALUES (?, ?, ?, ?, ?, ?)`,
              [cId, fyString, `${currentYear}-04-01`, `${nextYear}-03-31`, 1, 0],
              () => res()
            );
          });

          const master = openMasterDatabase();
          await new Promise((res) => {
            master.run(
              `INSERT OR REPLACE INTO database_registry (company_id, db_type, db_name, status) VALUES (?, ?, ?, ?)`,
              [cId, 'sqlite', `company_${cId}.db`, 'Active'],
              () => res()
            );
          });

          console.log(`🎉 [SQLite] Company ${cId} database created and initialized!`);
          resolve({ success: true, companyId: cId, dbName: `company_${cId}.db` });
        } catch (err) {
          console.error(`❌ [SQLite] Error creating Company ${cId} database:`, err.message);
          reject(err);
        }
      });
    });
  }
}

// ============================================================================
// RESTORE DATABASE FUNCTIONALITY (SQLite & PostgreSQL)
// ============================================================================
function isSQLiteDatabaseFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stat = fs.statSync(filePath);
    if (stat.size < 100) return false;
    const buf = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    return buf.toString('utf8', 0, 15) === 'SQLite format 3';
  } catch (e) {
    return false;
  }
}

function parseBackupJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (e) {}
  return null;
}

async function restoreDatabase(tempFilePath, companyId = 1) {
  const cId = parseInt(companyId, 10) || 1;
  if (!fs.existsSync(tempFilePath)) {
    throw new Error('Uploaded backup file does not exist.');
  }

  const backupDir = path.join(dbDir, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const isSQLite = isSQLiteDatabaseFile(tempFilePath);
  const jsonData = !isSQLite ? parseBackupJson(tempFilePath) : null;

  if (!isSQLite && !jsonData) {
    throw new Error('Integrity check failed: uploaded file is neither a valid SQLite database nor a valid JSON backup export.');
  }

  if (isPostgres) {
    // In PostgreSQL mode: Restore tables from either SQLite backup or JSON backup
    const client = await pgPool.connect();
    try {
      const schemaName = `company_${cId}`;
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName};`);
      await client.query(`SET search_path TO ${schemaName}, public;`);

      if (isSQLite) {
        const tempDb = new sqlite3.Database(tempFilePath, sqlite3.OPEN_READONLY);
        const tables = await new Promise((resolve) => {
          tempDb.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, rows) => {
            if (err) resolve([]);
            else resolve((rows || []).map((r) => r.name));
          });
        });

        for (const table of tables) {
          if (table === 'users' || table === 'companies') continue;
          const rows = await new Promise((resolve) => {
            tempDb.all(`SELECT * FROM ${table}`, (err, rows) => {
              if (err) resolve([]);
              else resolve(rows || []);
            });
          });

          if (rows && rows.length > 0) {
            try {
              await client.query(`TRUNCATE TABLE ${schemaName}.${table} CASCADE;`);
            } catch (e) {}

            for (const row of rows) {
              const keys = Object.keys(row);
              const values = Object.values(row);
              const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
              const colList = keys.map((k) => `"${k}"`).join(', ');
              try {
                await client.query(
                  `INSERT INTO ${schemaName}.${table} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                  values
                );
              } catch (err) {}
            }
          }
        }
        tempDb.close();
      } else if (jsonData) {
        const tablesObj = jsonData.tables || (typeof jsonData === 'object' && !Array.isArray(jsonData) ? jsonData : {});
        for (const [table, rows] of Object.entries(tablesObj)) {
          if (!Array.isArray(rows) || rows.length === 0 || table.startsWith('sqlite_') || table === 'users' || table === 'companies') continue;

          const tblCheck = await client.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
            [schemaName, table]
          );
          if (!tblCheck.rows || tblCheck.rows.length === 0) continue;
          const colSet = new Set(tblCheck.rows.map((r) => r.column_name.toLowerCase()));

          try {
            await client.query(`TRUNCATE TABLE ${schemaName}.${table} CASCADE;`);
          } catch (e) {}

          for (const row of rows) {
            if (!row || typeof row !== 'object') continue;
            const validKeys = Object.keys(row).filter((k) => colSet.has(k.toLowerCase()));
            if (validKeys.length === 0) continue;
            const placeholders = validKeys.map((_, idx) => `$${idx + 1}`).join(', ');
            const colList = validKeys.map((k) => `"${k}"`).join(', ');
            const values = validKeys.map((k) => {
              const v = row[k];
              return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
            });
            try {
              await client.query(
                `INSERT INTO ${schemaName}.${table} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                values
              );
            } catch (err) {}
          }
        }
      }

      console.log(`✅ [PostgreSQL] Restored company_${cId} schema from backup file successfully!`);
      return { success: true, message: 'Database restored successfully into PostgreSQL schema.' };
    } finally {
      client.release();
    }
  } else {
    // In SQLite mode:
    // 1. If an active connection exists in companyDbPool, close it and evict from cache
    if (companyDbPool.has(cId)) {
      const oldInstance = companyDbPool.get(cId);
      try {
        await new Promise((res) => oldInstance.close(() => res()));
      } catch (e) {
        console.warn(`Warning closing company ${cId} db connection before restore:`, e.message);
      }
      companyDbPool.delete(cId);
    }

    const targetDbPath = getCompanyDbPath(cId);
    let backupPath = null;

    // 2. Backup current target db if it exists and is a valid SQLite file
    if (fs.existsSync(targetDbPath) && isSQLiteDatabaseFile(targetDbPath)) {
      backupPath = path.join(backupDir, `backup_before_restore_${cId}_${Date.now()}.db`);
      try {
        fs.copyFileSync(targetDbPath, backupPath);
        console.log(`📦 Created backup before restore at: ${backupPath}`);
      } catch (e) {
        console.warn('Warning creating pre-restore backup:', e.message);
      }
      try {
        if (fs.existsSync(`${targetDbPath}-wal`)) fs.unlinkSync(`${targetDbPath}-wal`);
        if (fs.existsSync(`${targetDbPath}-shm`)) fs.unlinkSync(`${targetDbPath}-shm`);
      } catch (e) {}
    }

    if (isSQLite) {
      // Direct SQLite Database Restore
      // Verify integrity on uploaded file first BEFORE overwriting targetDbPath
      await new Promise((resolve, reject) => {
        const testDb = new sqlite3.Database(tempFilePath, sqlite3.OPEN_READONLY, (err) => {
          if (err) return reject(new Error(`Failed to open uploaded database: ${err.message}`));
        });
        testDb.get('PRAGMA integrity_check', (err, row) => {
          testDb.close(() => {
            if (err) return reject(new Error(`Integrity check failed: ${err.message}`));
            if (row && row.integrity_check && row.integrity_check !== 'ok') {
              console.warn('Restored DB integrity warning:', row.integrity_check);
            }
            resolve();
          });
        });
      });

      // Clear any leftover WAL / SHM files
      try {
        if (fs.existsSync(`${targetDbPath}-wal`)) fs.unlinkSync(`${targetDbPath}-wal`);
        if (fs.existsSync(`${targetDbPath}-shm`)) fs.unlinkSync(`${targetDbPath}-shm`);
      } catch (e) {}

      // Copy uploaded file over targetDbPath
      try {
        fs.copyFileSync(tempFilePath, targetDbPath);
      } catch (copyErr) {
        if (backupPath && fs.existsSync(backupPath)) {
          try { fs.copyFileSync(backupPath, targetDbPath); } catch (e) {}
        }
        throw copyErr;
      }

      // Open, configure WAL and store in pool
      const restoredDb = new sqlite3.Database(targetDbPath, (err) => {
        if (err) throw new Error(`Failed to open restored database: ${err.message}`);
      });

      await new Promise((resolve) => {
        restoredDb.serialize(() => {
          restoredDb.run('PRAGMA foreign_keys = ON');
          restoredDb.run('PRAGMA journal_mode = WAL');
          restoredDb.run('PRAGMA synchronous = NORMAL');
          restoredDb.run('PRAGMA busy_timeout = 10000', () => resolve());
        });
      });

      companyDbPool.set(cId, restoredDb);
      console.log(`✅ Company ${cId} database restored successfully from SQLite backup!`);
      return { success: true, message: 'Database restored successfully!' };
    } else {
      // JSON Backup Restore into SQLite
      // Ensure target database exists with clean valid schema
      if (!fs.existsSync(targetDbPath) || !isSQLiteDatabaseFile(targetDbPath)) {
        if (backupPath && fs.existsSync(backupPath) && isSQLiteDatabaseFile(backupPath)) {
          fs.copyFileSync(backupPath, targetDbPath);
        } else {
          await createCompanyDatabase(cId);
        }
      }

      const targetDb = new sqlite3.Database(targetDbPath, (err) => {
        if (err) throw new Error(`Failed to open target database: ${err.message}`);
      });

      const tablesObj = jsonData.tables || (typeof jsonData === 'object' && !Array.isArray(jsonData) ? jsonData : {});

      try {
        await new Promise((resolve, reject) => {
          targetDb.serialize(async () => {
            try {
              await new Promise((res, rej) => targetDb.run('PRAGMA foreign_keys = OFF', (err) => err ? rej(err) : res()));
              await new Promise((res, rej) => targetDb.run('BEGIN TRANSACTION', (err) => err ? rej(err) : res()));

              // Discover existing tables
              const existingTables = await new Promise((res, rej) => {
                targetDb.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
                  if (err) rej(err);
                  else res(new Set((rows || []).map((r) => r.name)));
                });
              });

              for (const [tableName, rows] of Object.entries(tablesObj)) {
                if (!Array.isArray(rows) || tableName.startsWith('sqlite_')) continue;

                // Ensure table exists in SQLite
                if (!existingTables.has(tableName)) {
                  const matchingDdl = COMPANY_TABLES.find((sql) => {
                    const match = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-zA-Z0-9_]+)["`]?/i);
                    return match && match[1].toLowerCase() === tableName.toLowerCase();
                  });
                  if (matchingDdl) {
                    await new Promise((res) => targetDb.run(matchingDdl, () => res()));
                    existingTables.add(tableName);
                  } else if (rows.length > 0 && rows[0] && typeof rows[0] === 'object') {
                    const sample = rows[0];
                    const cols = Object.keys(sample).map((k) => `"${k}" TEXT`).join(', ');
                    await new Promise((res) => targetDb.run(`CREATE TABLE IF NOT EXISTS "${tableName}" (${cols})`, () => res()));
                    existingTables.add(tableName);
                  }
                }

                if (!existingTables.has(tableName)) continue;

                // Get table column names
                const colInfo = await new Promise((res, rej) => {
                  targetDb.all(`PRAGMA table_info("${tableName}")`, (err, cols) => {
                    if (err) rej(err);
                    else res(cols || []);
                  });
                });
                const tableCols = new Set(colInfo.map((c) => c.name));

                // Clear current table data
                await new Promise((res, rej) => {
                  targetDb.run(`DELETE FROM "${tableName}"`, (err) => err ? rej(err) : res());
                });

                // Insert all rows
                for (const row of rows) {
                  if (!row || typeof row !== 'object') continue;
                  const validKeys = Object.keys(row).filter((k) => tableCols.has(k));
                  if (validKeys.length === 0) continue;

                  const colList = validKeys.map((k) => `"${k}"`).join(', ');
                  const placeholders = validKeys.map(() => '?').join(', ');
                  const values = validKeys.map((k) => {
                    const v = row[k];
                    if (v !== null && typeof v === 'object') {
                      return JSON.stringify(v);
                    }
                    return v;
                  });

                  await new Promise((res, rej) => {
                    targetDb.run(
                      `INSERT OR REPLACE INTO "${tableName}" (${colList}) VALUES (${placeholders})`,
                      values,
                      (err) => err ? rej(err) : res()
                    );
                  });
                }
              }

              await new Promise((res, rej) => targetDb.run('COMMIT', (err) => err ? rej(err) : res()));
              await new Promise((res) => targetDb.run('PRAGMA foreign_keys = ON', () => res()));
              await new Promise((res) => targetDb.run('PRAGMA journal_mode = WAL', () => res()));
              await new Promise((res) => targetDb.run('PRAGMA synchronous = NORMAL', () => res()));
              await new Promise((res) => targetDb.run('PRAGMA busy_timeout = 10000', () => res()));
              resolve();
            } catch (txErr) {
              targetDb.run('ROLLBACK', () => {});
              reject(txErr);
            }
          });
        });

        // Run integrity check
        await new Promise((resolve, reject) => {
          targetDb.get('PRAGMA integrity_check', (err, row) => {
            if (err) {
              reject(new Error(`Integrity check failed: ${err.message}`));
            } else if (row && row.integrity_check && row.integrity_check !== 'ok') {
              console.warn('Restored DB integrity warning:', row.integrity_check);
              resolve();
            } else {
              resolve();
            }
          });
        });

        companyDbPool.set(cId, targetDb);
        console.log(`✅ Company ${cId} database restored successfully from JSON backup!`);
        return { success: true, message: 'Database restored successfully from JSON backup!' };
      } catch (jsonRestoreErr) {
        try {
          await new Promise((res) => targetDb.close(() => res()));
        } catch (e) {}

        // Roll back to previous backup if restore failed
        if (backupPath && fs.existsSync(backupPath) && isSQLiteDatabaseFile(backupPath)) {
          try {
            fs.copyFileSync(backupPath, targetDbPath);
            console.log(`🔄 Rolled back company ${cId} database to pre-restore backup.`);
            const restoredFallback = new sqlite3.Database(targetDbPath);
            companyDbPool.set(cId, restoredFallback);
          } catch (rbErr) {
            console.error('Error during rollback:', rbErr.message);
          }
        }
        throw jsonRestoreErr;
      }
    }
  }
}

// ============================================================================
// ENSURE POSTGRESQL MASTER SCHEMA
// ============================================================================
async function ensurePostgresMasterSchema() {
  if (!isPostgres || !pgPool) {
    return;
  }

  console.log('🔧 [PostgreSQL] Ensuring public master schema is up to date...');
  const client = await pgPool.connect();

  try {
    await client.query('SET search_path TO public');

    // Create master tables from authoritative schema
    for (const tbl of MASTER_TABLES) {
      const pgSql = translateSqlForPostgres(tbl.sql);
      await client.query(pgSql);
      console.log(`✓ Master table ready: ${tbl.name}`);
    }

    // Defensive column migrations for master tables
    await client.query(`
      ALTER TABLE public.companies
        ADD COLUMN IF NOT EXISTS code TEXT,
        ADD COLUMN IF NOT EXISTS database_name TEXT,
        ADD COLUMN IF NOT EXISTS database_schema TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active',
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS companies_code_unique_idx
      ON public.companies (code)
      WHERE code IS NOT NULL
    `);

    await client.query(`
      ALTER TABLE public.database_registry
        ADD COLUMN IF NOT EXISTS db_schema TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active',
        ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS last_migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    await client.query(`
      ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active',
        ADD COLUMN IF NOT EXISTS email TEXT,
        ADD COLUMN IF NOT EXISTS phone TEXT,
        ADD COLUMN IF NOT EXISTS password_expiry_days INTEGER DEFAULT 90,
        ADD COLUMN IF NOT EXISTS password_last_changed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    await resyncPostgresSequences(client);
    await migrateNeonPublicDataToTenants(client);
    await discoverAndSyncAllPostgresTenants(client);
    await ensurePostgresDefaultCompany(client);
    await dropPostgresForeignKeyConstraints(client);
    console.log('✓ PostgreSQL public master schema, sequences, and multi-tenant constraints verified successfully');
  } catch (err) {
    console.error('⚠️ [PostgreSQL] Master schema check notice:', err.message);
  } finally {
    client.release();
  }
}

/**
 * Dynamically discovers all existing PostgreSQL tenant schemas (company_1, company_2, company_5, etc.),
 * pulls custom company metadata from them, and ensures they are properly registered in public.companies
 * and public.database_registry. NEVER hardcodes or overwrites existing user company details.
 */
async function discoverAndSyncAllPostgresTenants(client) {
  try {
    console.log('🔍 [PostgreSQL] Scanning and synchronizing all tenant companies and schemas...');

    // 1. Detect all tenant schemas matching company_%
    const schemaRes = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'company_%' 
      ORDER BY schema_name ASC
    `);

    const detectedSchemas = schemaRes.rows.map(r => r.schema_name);
    console.log(`🔍 [PostgreSQL] Found ${detectedSchemas.length} tenant schema(s):`, detectedSchemas);

    // 2. Fetch all existing companies registered in public.companies
    const pubCompRes = await client.query(`SELECT * FROM public.companies ORDER BY id ASC`);
    const registeredCompIds = new Set(pubCompRes.rows.map(r => parseInt(r.id, 10)));
    const registeredCompMap = new Map(pubCompRes.rows.map(r => [parseInt(r.id, 10), r]));

    // 3. For each detected schema, ensure registered in public.companies
    for (const schemaName of detectedSchemas) {
      const match = schemaName.match(/^company_(\d+)$/);
      if (!match) continue;
      const compId = parseInt(match[1], 10);

      // Check if this tenant schema has a "companies" or related table with custom company details
      let tenantDetails = null;
      try {
        const candidateTables = [
          'papad_company_master', 'papad_companies', 'company_master', 'companies', 'company', 
          'company_details', 'comp_master', 'company_profile', 'profile', 'firm_details', 'organization'
        ];
        for (const tbl of candidateTables) {
          const tblCheck = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = $1 AND lower(table_name) = $2
          `, [schemaName, tbl]);
          if (tblCheck.rows.length > 0) {
            const detailRes = await client.query(`SELECT * FROM "${schemaName}"."${tblCheck.rows[0].table_name}" LIMIT 1`);
            if (detailRes.rows.length > 0) {
              tenantDetails = detailRes.rows[0];
              break;
            }
          }
        }
      } catch (_) {}

      let compName = tenantDetails?.name || tenantDetails?.company_name || tenantDetails?.comp_name || tenantDetails?.print_name || null;
      let compCode = tenantDetails?.code || tenantDetails?.company_code || tenantDetails?.comp_code || `COMP_${compId}`;
      let compAddress = tenantDetails?.address || tenantDetails?.address1 || tenantDetails?.address_line1 || tenantDetails?.location || tenantDetails?.city || null;
      let compGst = tenantDetails?.gst_number || tenantDetails?.gst_no || tenantDetails?.gstin || tenantDetails?.gst || null;
      let compContact = tenantDetails?.contact || tenantDetails?.phone || tenantDetails?.phone_off || tenantDetails?.mobile || tenantDetails?.mobile1 || tenantDetails?.phone_number || null;
      let compEmail = tenantDetails?.email || tenantDetails?.email_id || tenantDetails?.mail || null;
      let compState = tenantDetails?.state || 'Tamil Nadu';
      let compStateCode = tenantDetails?.state_code || '33';

      const upperName = String(compName || '').toUpperCase();
      const isKiya = upperName.includes('KIYA') || compCode.toUpperCase().includes('KIYA');
      const isBvc = upperName.includes('BVC') || compCode.toUpperCase().includes('BVC');

      if (isKiya) {
        compName = compName || 'KIYA';
        compCode = compCode || 'COMP_KIYA';
        compAddress = compAddress || 'Plot No. 45, SIPCOT Industrial Complex, Madurai, Tamil Nadu - 625020';
        compGst = compGst || '33AAACK4567M1Z2';
        compContact = compContact || '9842156789';
        compEmail = compEmail || 'info@kiyagroup.com';
      } else if (isBvc) {
        compAddress = compAddress || '123 Main Industrial Area, City';
        compGst = compGst || '33AABCB1234A1Z5';
        compContact = compContact || '9876543210';
        compEmail = compEmail || 'info@bvcexports.com';
      } else if (compId === 2 || upperName === 'COMPANY 2') {
        compAddress = compAddress || 'Unit 2, Industrial Estate, Salem, Tamil Nadu - 636004';
        compGst = compGst || '33AABCB2345B1Z4';
        compContact = compContact || '9842123456';
        compEmail = compEmail || 'unit2@bvcexports.com';
      } else if (compId === 3 || upperName === 'COMPANY 3') {
        compAddress = compAddress || 'Unit 3, SIDCO Phase II, Coimbatore, Tamil Nadu - 641021';
        compGst = compGst || '33AABCB3456C1Z3';
        compContact = compContact || '9842134567';
        compEmail = compEmail || 'unit3@bvcexports.com';
      } else if (compId === 4 || upperName === 'COMPANY 4') {
        compAddress = compAddress || 'Unit 4, SIPCOT Growth Center, Perundurai, Erode - 638052';
        compGst = compGst || '33AABCB4567D1Z2';
        compContact = compContact || '9842145678';
        compEmail = compEmail || 'unit4@bvcexports.com';
      } else if (compId === 6 || upperName === 'COMPANY 6') {
        compAddress = compAddress || 'Unit 6, Food Processing SEZ, Virudhunagar - 626001';
        compGst = compGst || '33AABCB6789F1Z0';
        compContact = compContact || '9842167890';
        compEmail = compEmail || 'unit6@bvcexports.com';
      } else {
        compAddress = compAddress || 'Industrial Estate, Tamil Nadu';
        compGst = compGst || `33AABC${String(compId).padStart(4, '0')}A1Z${compId % 9}`;
        compContact = compContact || '9876543210';
        compEmail = compEmail || `company${compId}@bvcexports.com`;
      }

      if (!registeredCompIds.has(compId)) {
        // Auto-register detected company into public.companies!
        const finalName = compName || `Company ${compId}`;
        await client.query(`
          INSERT INTO public.companies (id, code, name, address, gst_number, contact, email, state, state_code, database_name, database_schema, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, 'Active')
          ON CONFLICT (id) DO UPDATE SET 
            status = 'Active', 
            database_schema = EXCLUDED.database_schema,
            name = COALESCE(NULLIF(public.companies.name, ''), EXCLUDED.name),
            address = COALESCE(NULLIF(public.companies.address, ''), EXCLUDED.address),
            gst_number = COALESCE(NULLIF(public.companies.gst_number, ''), EXCLUDED.gst_number),
            contact = COALESCE(NULLIF(public.companies.contact, ''), EXCLUDED.contact),
            email = COALESCE(NULLIF(public.companies.email, ''), EXCLUDED.email)
        `, [compId, compCode, finalName, compAddress, compGst, compContact, compEmail, compState, compStateCode, schemaName]);
        console.log(`✅ [PostgreSQL] Auto-registered tenant schema "${schemaName}" as Company ID ${compId} ("${finalName}")`);
      } else {
        // If already registered, update any missing/empty fields from tenant details or computed defaults
        await client.query(`
          UPDATE public.companies 
          SET 
            name = CASE 
              WHEN (name = 'BVC Exports Pvt Ltd' OR name LIKE 'Company %') AND $1 IS NOT NULL AND $1 != '' THEN $1 
              ELSE COALESCE(NULLIF(name, ''), $1) 
            END,
            address = COALESCE(NULLIF(address, ''), $2),
            gst_number = COALESCE(NULLIF(gst_number, ''), $3),
            contact = COALESCE(NULLIF(contact, ''), $4),
            email = COALESCE(NULLIF(email, ''), $5),
            state = COALESCE(NULLIF(state, ''), $6),
            state_code = COALESCE(NULLIF(state_code, ''), $7)
          WHERE id = $8
        `, [compName, compAddress, compGst, compContact, compEmail, compState, compStateCode, compId]);
        console.log(`✓ [PostgreSQL] Synchronized company details for Company ID ${compId} from schema "${schemaName}"`);
      }

      // Ensure database_registry entry exists
      await client.query(`
        INSERT INTO public.database_registry (company_id, db_type, db_name, db_schema, status)
        VALUES ($1, 'postgres', $2, $2, 'Active')
        ON CONFLICT (company_id) DO UPDATE SET db_schema = EXCLUDED.db_schema, status = 'Active'
      `, [compId, schemaName]);

      // Ensure tenant schema has all standard ERP tables
      for (const tableSql of COMPANY_TABLES) {
        try {
          const pgTableSql = translateSqlForPostgres(tableSql, compId);
          await client.query(pgTableSql);
        } catch (_) {}
      }

      await resyncPostgresSequences(client, schemaName);
    }

    // 4. For any companies registered in public.companies that don't have schema yet:
    const updatedCompRes = await client.query(`SELECT id, code, name FROM public.companies WHERE status != 'Inactive' OR status IS NULL`);
    for (const c of updatedCompRes.rows) {
      const compId = parseInt(c.id, 10);
      const sName = `company_${compId}`;
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${sName}";`);
      await client.query(`
        INSERT INTO public.database_registry (company_id, db_type, db_name, db_schema, status)
        VALUES ($1, 'postgres', $2, $2, 'Active')
        ON CONFLICT (company_id) DO UPDATE SET db_schema = EXCLUDED.db_schema, status = 'Active'
      `, [compId, sName]);

      for (const tableSql of COMPANY_TABLES) {
        try {
          const pgTableSql = translateSqlForPostgres(tableSql, compId);
          await client.query(pgTableSql);
        } catch (_) {}
      }
      await resyncPostgresSequences(client, sName);
    }
  } catch (err) {
    console.error('⚠️ [PostgreSQL] Tenant discovery notice:', err.message);
  }
}

/**
 * Safely preserves and migrates any existing user records in public schema into their corresponding company schemas.
 * NEVER drops user tables or data.
 */
async function migrateNeonPublicDataToTenants(client) {
  try {
    console.log('🔍 [PostgreSQL] Checking and preserving existing public business data across tenants...');

    const tableCheckRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    `);
    const publicTableNames = new Set(tableCheckRes.rows.map(r => r.table_name.toLowerCase()));

    for (const bTable of TENANT_BUSINESS_TABLES) {
      if (!publicTableNames.has(bTable.toLowerCase())) {
        continue;
      }

      try {
        const pubCountRes = await client.query(`SELECT COUNT(*) AS cnt FROM "public"."${bTable}"`);
        const pubCount = parseInt(pubCountRes.rows[0]?.cnt || 0, 10);

        if (pubCount > 0) {
          // Check if public table has company_id column
          const colCheck = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'public' AND lower(table_name) = lower($1) AND lower(column_name) = 'company_id'
          `, [bTable]);
          const hasCompanyId = colCheck.rows.length > 0;

          if (hasCompanyId) {
            const compIdsRes = await client.query(`
              SELECT DISTINCT company_id FROM "public"."${bTable}" WHERE company_id IS NOT NULL
            `);
            for (const row of compIdsRes.rows) {
              const cId = parseInt(row.company_id, 10);
              if (!cId || isNaN(cId)) continue;
              const targetSchema = `company_${cId}`;
              await client.query(`CREATE SCHEMA IF NOT EXISTS "${targetSchema}";`);
              await client.query(`CREATE TABLE IF NOT EXISTS "${targetSchema}"."${bTable}" (LIKE "public"."${bTable}" INCLUDING ALL)`);

              await client.query(`
                INSERT INTO "${targetSchema}"."${bTable}" 
                SELECT * FROM "public"."${bTable}" 
                WHERE company_id = $1
                ON CONFLICT DO NOTHING
              `, [cId]);
            }
          }

          // Also ensure company_1 has any legacy non-company_id rows
          await client.query(`CREATE SCHEMA IF NOT EXISTS "company_1";`);
          await client.query(`CREATE TABLE IF NOT EXISTS "company_1"."${bTable}" (LIKE "public"."${bTable}" INCLUDING ALL)`);
          await client.query(`
            INSERT INTO "company_1"."${bTable}" 
            SELECT * FROM "public"."${bTable}" 
            ${hasCompanyId ? 'WHERE company_id = 1 OR company_id IS NULL' : ''}
            ON CONFLICT DO NOTHING
          `);
        }
      } catch (tableErr) {
        console.warn(`⚠️ Notice preserving public."${bTable}":`, tableErr.message);
      }
    }
  } catch (err) {
    console.warn('⚠️ [PostgreSQL] Data preservation notice:', err.message);
  }
}

/**
 * Ensures at least one active Company exists in PostgreSQL if the database is brand new.
 * NEVER overwrites existing company names or records.
 */
async function ensurePostgresDefaultCompany(client) {
  try {
    const compRes = await client.query("SELECT id, name FROM public.companies WHERE status != 'Inactive' OR status IS NULL LIMIT 1");
    const schemasRes = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'company_%' LIMIT 1");
    
    // Only insert default if NO companies and NO company_% schemas exist anywhere in PostgreSQL!
    if ((!compRes.rows || compRes.rows.length === 0) && (!schemasRes.rows || schemasRes.rows.length === 0)) {
      console.log('🌱 [PostgreSQL] No company or tenant schemas found in database. Initializing default Company 1...');
      await client.query(`
        INSERT INTO public.companies (id, code, name, address, gst_number, contact, email, database_name, database_schema, status)
        VALUES (1, 'COMP_BVC', 'BVC Exports Pvt Ltd', '123 Main Industrial Area, City', '33AABCB1234A1Z5', '9876543210', 'info@bvcexports.com', 'company_1', 'company_1', 'Active')
        ON CONFLICT (id) DO NOTHING
      `);
      
      await client.query(`CREATE SCHEMA IF NOT EXISTS company_1;`);
      await client.query(`
        INSERT INTO public.database_registry (company_id, db_type, db_name, db_schema, status)
        VALUES (1, 'postgres', 'company_1', 'company_1', 'Active')
        ON CONFLICT (company_id) DO NOTHING
      `);
      console.log('✓ Default Company 1 established in PostgreSQL master schema');
    }

    // Ensure sequences are updated so serial IDs don't collide
    await resyncPostgresSequences(client, 'public');
    await resyncPostgresSequences(client, 'company_1');
  } catch (compErr) {
    console.warn('⚠️ [PostgreSQL] Notice ensuring default company:', compErr.message);
  }
}

async function dropPostgresForeignKeyConstraints(client) {
  try {
    await client.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (
          SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname AS constraint_name
          FROM pg_constraint con
          JOIN pg_class c ON con.conrelid = c.oid
          JOIN pg_namespace n ON c.relnamespace = n.oid
          WHERE con.contype = 'f'
            AND (n.nspname = 'public' OR n.nspname LIKE 'company_%')
        ) LOOP
          BEGIN
            EXECUTE 'ALTER TABLE "' || r.schema_name || '"."' || r.table_name || '" DROP CONSTRAINT IF EXISTS "' || r.constraint_name || '" CASCADE';
          EXCEPTION WHEN OTHERS THEN
            -- Continue smoothly if individual drop is skipped
          END;
        END LOOP;
      END $$;
    `);
    console.log('✓ Cleaned up PostgreSQL foreign key constraints across all schemas');
  } catch (err) {
    console.warn('⚠️ [PostgreSQL] Foreign key constraint cleanup notice:', err.message);
  }
}

// ============================================================================
// TRANSACTION AWARE CONNECTION WRAPPERS
// ============================================================================
class PgDbConnection {
  constructor(client, companyId = 1, isMaster = false) {
    this.client = client;
    this.companyId = companyId;
    this.isMaster = isMaster;
  }

  async beginTransaction() {
    this.inTransaction = true;
    const schemaName = this.isMaster ? 'public' : `company_${this.companyId}`;
    await this.client.query('BEGIN');
    if (!this.isMaster) {
      await this.client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);
      await this.client.query(`SET LOCAL search_path TO "${schemaName}", public;`);
    } else {
      await this.client.query(`SET LOCAL search_path TO public;`);
    }
  }

  async commit() {
    this.inTransaction = false;
    await this.client.query('COMMIT');
  }

  async rollback() {
    this.inTransaction = false;
    await this.client.query('ROLLBACK');
  }

  async query(text, params = []) {
    let transformed = translateSqlForPostgres(text, this.companyId);
    const schemaName = this.isMaster ? 'public' : `company_${this.companyId}`;
    if (!this.inTransaction) {
      if (!this.isMaster) {
        await this.client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);
        await this.client.query(`SET search_path TO "${schemaName}", public;`);
      } else {
        await this.client.query(`SET search_path TO public;`);
      }
    }
    let result;
    try {
      result = await this.client.query(transformed, params);
    } catch (queryErr) {
      if (queryErr.code === '42703' && /RETURNING id/i.test(transformed)) {
        const withoutReturning = transformed.replace(/\s+RETURNING\s+id\b/gi, '');
        result = await this.client.query(withoutReturning, params);
      } else if (queryErr.code === '23505' && /duplicate key value violates unique constraint/i.test(queryErr.message)) {
        await resyncPostgresSequences(this.client, schemaName);
        result = await this.client.query(transformed, params);
      } else if (queryErr.code === '23503' && /violates foreign key constraint/i.test(queryErr.message)) {
        const constraintMatch = queryErr.message.match(/violates foreign key constraint "([^"]+)"/i) || [null, queryErr.constraint];
        const tableMatch = queryErr.message.match(/table "([^"]+)"/i) || [null, queryErr.table];
        const constraintName = constraintMatch[1];
        const tableName = tableMatch[1];
        if (constraintName && tableName) {
          try {
            await this.client.query(`ALTER TABLE IF EXISTS "${schemaName}"."${tableName}" DROP CONSTRAINT IF EXISTS "${constraintName}" CASCADE`);
            await this.client.query(`ALTER TABLE IF EXISTS "public"."${tableName}" DROP CONSTRAINT IF EXISTS "${constraintName}" CASCADE`);
            result = await this.client.query(transformed, params);
          } catch (retryErr) {
            throw queryErr;
          }
        } else {
          throw queryErr;
        }
      } else {
        throw queryErr;
      }
    }

    let lastID = null;
    if (result.rows && result.rows.length > 0 && result.rows[0].id !== undefined) {
      lastID = result.rows[0].id;
    }
    return {
      rows: result.rows || [],
      rowCount: result.rowCount || 0,
      changes: result.rowCount || 0,
      lastID: lastID,
      lastInsertRowid: lastID,
    };
  }

  async run(text, params = []) {
    return this.query(text, params);
  }

  release() {
    if (this.client) {
      this.client.query('RESET search_path;').catch(() => {}).finally(() => {
        this.client.release();
      });
    }
  }
}

class SqliteDbConnection {
  constructor(dbInstance, companyId = null) {
    this.db = dbInstance;
    this.companyId = companyId;
  }

  beginTransaction() {
    return new Promise((resolve, reject) => {
      this.db.run('BEGIN TRANSACTION', (err) => (err ? reject(err) : resolve()));
    });
  }

  commit() {
    return new Promise((resolve, reject) => {
      this.db.run('COMMIT', (err) => (err ? reject(err) : resolve()));
    });
  }

  rollback() {
    return new Promise((resolve, reject) => {
      this.db.run('ROLLBACK', (err) => (err ? reject(err) : resolve()));
    });
  }

  query(text, params = []) {
    return queryOnSqlite(this.db, text, params);
  }

  run(text, params = []) {
    return runOnSqlite(this.db, text, params);
  }

  release() {
    // No-op for SQLite
  }
}

// ============================================================================
// MODULE EXPORTS (Unified Dual-Engine API)
// ============================================================================
module.exports = {
  isPostgres,
  asyncLocalStorage,
  companyStorage: asyncLocalStorage,
  getDbPath: (companyId = 1) => getCompanyDbPath(companyId),
  getMasterDbPath: () => masterDbPath,
  createCompanyDatabase,
  restoreDatabase,
  ensurePostgresMasterSchema,
  ensurePostgresCompanySequences,
  syncPostgresTenantSchemas: async () => {
    if (!isPostgres || !pgPool) return;
    const client = await pgPool.connect();
    try {
      await discoverAndSyncAllPostgresTenants(client);
    } finally {
      client.release();
    }
  },

  // Primary Query function (routes automatically based on context & SQL)
  query: async (text, params = [], explicitCompanyId = null) => {
    const store = asyncLocalStorage.getStore();
    const activeCompanyId = explicitCompanyId || (store ? store.companyId : 1);
    const isMaster = isMasterTableQuery(text);

    if (isPostgres) {
      return executePgQuery(text, params, activeCompanyId, isMaster);
    } else {
      const targetDb = resolveTargetDatabase(text, explicitCompanyId);
      return queryOnSqlite(targetDb, text, params);
    }
  },

  // Primary Run function
  run: async (text, params = [], explicitCompanyId = null) => {
    const store = asyncLocalStorage.getStore();
    const activeCompanyId = explicitCompanyId || (store ? store.companyId : 1);
    const isMaster = isMasterTableQuery(text);

    if (isPostgres) {
      return executePgQuery(text, params, activeCompanyId, isMaster);
    } else {
      const targetDb = resolveTargetDatabase(text, explicitCompanyId);
      return runOnSqlite(targetDb, text, params);
    }
  },

  // Explicit Company DB accessor
  forCompany: (companyId) => {
    const cId = parseInt(companyId, 10) || 1;
    return {
      query: (text, params = []) => {
        if (isPostgres) return executePgQuery(text, params, cId, false);
        return queryOnSqlite(getCompanyDatabaseInstance(cId), text, params);
      },
      run: (text, params = []) => {
        if (isPostgres) return executePgQuery(text, params, cId, false);
        return runOnSqlite(getCompanyDatabaseInstance(cId), text, params);
      },
      getConnection: async () => {
        if (isPostgres) {
          const client = await pgPool.connect();
          return new PgDbConnection(client, cId, false);
        }
        return new SqliteDbConnection(getCompanyDatabaseInstance(cId), cId);
      },
    };
  },

  // Explicit Master DB accessor
  master: {
    query: (text, params = []) => {
      if (isPostgres) return executePgQuery(text, params, 1, true);
      return queryOnSqlite(openMasterDatabase(), text, params);
    },
    run: (text, params = []) => {
      if (isPostgres) return executePgQuery(text, params, 1, true);
      return runOnSqlite(openMasterDatabase(), text, params);
    },
    getConnection: async () => {
      if (isPostgres) {
        const client = await pgPool.connect();
        return new PgDbConnection(client, 1, true);
      }
      return new SqliteDbConnection(openMasterDatabase(), null);
    },
  },

  // Connection getters for transaction operations
  getConnection: async (explicitCompanyId = null) => {
    const store = asyncLocalStorage.getStore();
    const activeCompanyId = explicitCompanyId || (store ? store.companyId : 1);
    if (isPostgres) {
      const client = await pgPool.connect();
      return new PgDbConnection(client, activeCompanyId, false);
    }
    const targetDb = explicitCompanyId ? getCompanyDatabaseInstance(explicitCompanyId) : resolveTargetDatabase('', null);
    return new SqliteDbConnection(targetDb, activeCompanyId);
  },

  translateSqlForPostgres,

  pool: {
    connect: async (explicitCompanyId = null) => {
      const store = asyncLocalStorage.getStore();
      const activeCompanyId = explicitCompanyId || (store ? store.companyId : 1);
      if (isPostgres) {
        const client = await pgPool.connect();
        return new PgDbConnection(client, activeCompanyId, false);
      }
      const targetDb = explicitCompanyId ? getCompanyDatabaseInstance(explicitCompanyId) : resolveTargetDatabase('', null);
      return new SqliteDbConnection(targetDb, activeCompanyId);
    },
  },
};
