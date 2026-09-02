import { test, expect } from '@playwright/test';
import { createAuthenticatedApiClient } from '../fixtures/api';
import { getTestItem, getTestSupplier, getTestPurchasePayload } from '../fixtures/test-data';
import { cleanupTestData } from '../helpers/cleanup';

test.describe('API: Godown Stock Transfers', () => {
  let apiClient: any;
  let createdSupplier: any;
  let createdItem: any;
  let lotNo: string;

  test.beforeAll(async () => {
    const api = await createAuthenticatedApiClient();
    apiClient = api.client;

    createdItem = getTestItem('_TRANS');
    await apiClient.post('/api/masters/item', { data: createdItem });

    createdSupplier = getTestSupplier('_TRANS');
    await apiClient.post('/api/masters/supplier', { data: createdSupplier });

    lotNo = `LOT_TR_${Date.now()}`;
    await apiClient.post('/api/purchases', { data: getTestPurchasePayload(createdSupplier.name, createdItem.item_name, lotNo) });
  });

  test.afterAll(async () => {
    await cleanupTestData(1);
  });

  test('1. Transfer stock from Godown 1 to Godown 2', async () => {
    const transferPayload = {
      transfer_date: new Date().toISOString().split('T')[0],
      from_godown_id: 1,
      from_godown_name: 'Godown 1',
      to_godown_id: 2,
      to_godown_name: 'Godown 2',
      item_name: createdItem.item_name,
      lot_no: lotNo,
      qty: 100,
      weight: 100,
      remarks: 'Automated godown transfer test'
    };

    const res = await apiClient.post('/api/godown-transfers', { data: transferPayload });
    expect([200, 201]).toContain(res.status());
  });

  test('2. Retrieve godown transfers list', async () => {
    const res = await apiClient.get('/api/godown-transfers');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data) || Array.isArray(data.rows)).toBe(true);
  });
});
