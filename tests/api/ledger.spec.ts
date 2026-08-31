import { test, expect } from '@playwright/test';
import { createAuthenticatedApiClient } from '../fixtures/api';
import { cleanupTestData } from '../helpers/cleanup';

test.describe('API: Accounting Ledgers', () => {
  let apiClient: any;

  test.beforeAll(async () => {
    const api = await createAuthenticatedApiClient();
    apiClient = api.client;
  });

  test.afterAll(async () => {
    await cleanupTestData(1);
  });

  test('1. Get all ledgers returns standard chart of accounts', async () => {
    const res = await apiClient.get('/api/masters/ledger');
    expect(res.status()).toBe(200);
    const data = await res.json();
    const ledgers = Array.isArray(data) ? data : (data.data || []);
    expect(Array.isArray(ledgers)).toBe(true);
    expect(ledgers.length).toBeGreaterThan(0);
  });

  test('2. Create custom ledger account and verify', async () => {
    const customLedger = {
      name: `TEST_LEDGER_${Date.now()}`,
      printname: 'Test Ledger Account',
      under: 'Direct Expenses',
      ledger_type: 'Expense',
      openingbalance: 0,
      status: 'Active'
    };

    const res = await apiClient.post('/api/masters/ledger', { data: customLedger });
    expect([200, 201]).toContain(res.status());
  });
});
