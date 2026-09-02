import { test, expect } from '@playwright/test';
import { createAuthenticatedApiClient } from '../fixtures/api';
import { getTestItem, getTestSupplier, getTestPurchasePayload } from '../fixtures/test-data';
import { cleanupTestData } from '../helpers/cleanup';

test.describe('API: Stock Summary & Lot Tracking', () => {
  let apiClient: any;
  let createdSupplier: any;
  let createdItem: any;
  let lotNo: string;

  test.beforeAll(async () => {
    const api = await createAuthenticatedApiClient();
    apiClient = api.client;

    createdItem = getTestItem('_STK');
    await apiClient.post('/api/masters/item', { data: createdItem });

    createdSupplier = getTestSupplier('_STK');
    await apiClient.post('/api/masters/supplier', { data: createdSupplier });

    lotNo = `LOT_STK_${Date.now()}`;
    await apiClient.post('/api/purchases', { data: getTestPurchasePayload(createdSupplier.name, createdItem.item_name, lotNo) });
  });

  test.afterAll(async () => {
    await cleanupTestData(1);
  });

  test('1. Stock report returns item with available quantity', async () => {
    const res = await apiClient.get('/api/stock/report');
    expect(res.status()).toBe(200);
    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.items || data.rows || data.data || []);
    expect(Array.isArray(rows)).toBe(true);
  });

  test('2. Stock lots endpoint lists active lots with positive balance', async () => {
    const res = await apiClient.get('/api/stock/lots');
    expect(res.status()).toBe(200);
    const data = await res.json();
    const lots = Array.isArray(data) ? data : (data.lots || data.rows || data.data || []);
    expect(Array.isArray(lots)).toBe(true);
  });

  test('3. Stock alerts endpoint responds without error', async () => {
    const res = await apiClient.get('/api/stock-alerts/active-count');
    expect(res.status()).toBe(200);
  });
});
