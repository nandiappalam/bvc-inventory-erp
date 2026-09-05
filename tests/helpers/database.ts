/**
 * BVC Inventory ERP - Test Database Helper
 * Unified database runner for PostgreSQL and SQLite test environments
 */

import path from 'path';

// Import backend database module directly
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../../backend/config/database');

export interface QueryResult {
  rows: any[];
  rowCount?: number;
  changes?: number;
  lastID?: any;
  lastInsertRowid?: any;
}

export const getDb = () => db;

export const queryDb = async (sql: string, params: any[] = [], companyId = 1): Promise<QueryResult> => {
  return db.query(sql, params, companyId);
};

export const runDb = async (sql: string, params: any[] = [], companyId = 1): Promise<QueryResult> => {
  return db.run(sql, params, companyId);
};

export const forCompany = (companyId: number) => {
  return db.forCompany(companyId);
};

export const masterDb = db.master;
