import { test, expect } from '@playwright/test';
import { createAuthenticatedApiClient } from '../fixtures/api';

test.describe('API: Reporting Engine', () => {
  let apiClient: any;

  test.beforeAll(async () => {
    const api = await createAuthenticatedApiClient();
    apiClient = api.client;
  });

  test('1. Stock report returns 200 without server crash', async () => {
    const res = await apiClient.get('/api/reports/stock');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  test('2. Purchase report returns 200 without server crash', async () => {
    const res = await apiClient.get('/api/reports/purchases');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  test('3. Sales report returns 200 without server crash', async () => {
    const res = await apiClient.get('/api/reports/sales');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  test('4. Ledger statement report returns 200 without server crash', async () => {
    const res = await apiClient.get('/api/reports/ledger?ledger_id=1');
    expect(res.status()).toBe(200);
  });
});
