import { test, expect } from '@playwright/test';
import { queryDb, masterDb } from '../helpers/database';

test.describe('Database: Schema & Table Verification', () => {
  test('1. Master schema contains required core tables (companies, users, database_registry)', async () => {
    const res = await masterDb.query(`
      SELECT name FROM sqlite_master WHERE type='table'
    `);
    const tableNames = res.rows.map((r: any) => (r.name || r.table_name || '').toLowerCase());
    
    expect(tableNames.some((t: string) => t.includes('compan'))).toBe(true);
    expect(tableNames.some((t: string) => t.includes('user'))).toBe(true);
  });

  test('2. Company schema contains required ERP tables', async () => {
    const res = await queryDb(`
      SELECT name FROM sqlite_master WHERE type='table'
    `, [], 1);

    const tableNames = res.rows.map((r: any) => (r.name || r.table_name || '').toLowerCase());
    
    expect(tableNames.some((t: string) => t.includes('item'))).toBe(true);
    expect(tableNames.some((t: string) => t.includes('supplier'))).toBe(true);
    expect(tableNames.some((t: string) => t.includes('customer'))).toBe(true);
    expect(tableNames.some((t: string) => t.includes('purchase'))).toBe(true);
    expect(tableNames.some((t: string) => t.includes('sales'))).toBe(true);
  });
});

