import { test, expect } from '@playwright/test';
import { queryDb, masterDb } from '../helpers/database';

test.describe('Database: Connection & Heartbeat', () => {
  test('1. Core database connection executes heartbeat query successfully', async () => {
    const res = await queryDb('SELECT 1 as alive', []);
    expect(res.rows).toBeDefined();
    expect(res.rows.length).toBe(1);
    expect(Number(res.rows[0].alive)).toBe(1);
  });

  test('2. Master database executes queries reliably', async () => {
    const res = await masterDb.query('SELECT 1 as alive', []);
    expect(res.rows).toBeDefined();
    expect(res.rows.length).toBe(1);
    expect(Number(res.rows[0].alive)).toBe(1);
  });
});
