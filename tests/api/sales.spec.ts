import { test, expect } from '@playwright/test';
import { createAuthenticatedApiClient } from '../fixtures/api';
import { getTestItem, getTestSupplier, getTestCustomer, getTestPurchasePayload, getTestSalesPayload } from '../fixtures/test-data';
import { cleanupTestData } from '../helpers/cleanup';

test.describe('API: Sales Workflow & Stock Outward', () => {
  let apiClient: any;
  let createdSupplier: any;
  let createdCustomer: any;
  let createdItem: any;
  let lotNo: string;

  test.beforeAll(async () => {
    const api = await createAuthenticatedApiClient();
    apiClient = api.client;

    createdItem = getTestItem('_SAL');
    await apiClient.post('/api/masters/item', { data: createdItem });

    createdSupplier = getTestSupplier('_SAL');
    await apiClient.post('/api/masters/supplier', { data: createdSupplier });

    createdCustomer = getTestCustomer('_SAL');
    await apiClient.post('/api/masters/customer', { data: createdCustomer });

    // Inward stock first so lot exists with positive available balance
    lotNo = `LOT_SAL_${Date.now()}`;
    const purchase = getTestPurchasePayload(createdSupplier.name, createdItem.item_name, lotNo);
    await apiClient.post('/api/purchases', { data: purchase });
  });

  test.afterAll(async () => {
    await cleanupTestData(1);
  });

  test('1. Create Sales invoice consuming inwarded lot with IGST inter-state calculation', async () => {
    const salesPayload = getTestSalesPayload(createdCustomer.name, createdItem.item_name, lotNo);

    const res = await apiClient.post('/api/sales', { data: salesPayload });
    if (res.status() >= 400) {
      console.log('SALES_ERROR:', await res.text());
    }
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body.success || body.id || body.salesId).toBeTruthy();

    // Verify in sales list
    const listRes = await apiClient.get('/api/sales');
    expect(listRes.status()).toBe(200);
    const listData = await listRes.json();
    const records = Array.isArray(listData) ? listData : (listData.sales || listData.rows || []);
    const match = records.find((s: any) => s.inv_no === salesPayload.inv_no || s.s_no === salesPayload.formData.s_no || s.customer === createdCustomer.name || s.customer_name === createdCustomer.name);
    expect(match).toBeDefined();
  });
});
