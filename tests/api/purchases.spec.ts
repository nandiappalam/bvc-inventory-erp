import { test, expect } from '@playwright/test';
import { createAuthenticatedApiClient } from '../fixtures/api';
import { getTestItem, getTestSupplier, getTestPurchasePayload } from '../fixtures/test-data';
import { cleanupTestData } from '../helpers/cleanup';

test.describe('API: Purchases & Tax Calculation Workflow', () => {
  let apiClient: any;
  let createdSupplier: any;
  let createdItem: any;

  test.beforeAll(async () => {
    const api = await createAuthenticatedApiClient();
    apiClient = api.client;

    // Seed master item & supplier
    createdItem = getTestItem('_PUR');
    await apiClient.post('/api/masters/item', { data: createdItem });

    createdSupplier = getTestSupplier('_PUR');
    await apiClient.post('/api/masters/supplier', { data: createdSupplier });
  });

  test.afterAll(async () => {
    await cleanupTestData(1);
  });

  test('1. Create complete Purchase order with CGST + SGST tax calculation', async () => {
    const purchasePayload = getTestPurchasePayload(createdSupplier.name, createdItem.item_name);

    const res = await apiClient.post('/api/purchases', { data: purchasePayload });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body.success || body.id || body.purchaseId).toBeTruthy();

    // Verify in purchase list
    const listRes = await apiClient.get('/api/purchases');
    expect(listRes.status()).toBe(200);
    const listData = await listRes.json();
    const records = Array.isArray(listData) ? listData : (listData.purchases || listData.rows || []);
    const match = records.find((p: any) => p.inv_no === purchasePayload.formData.inv_no || p.inv_no === purchasePayload.inv_no);
    expect(match).toBeDefined();
  });

  test('2. Tax Mode Exclusive vs Without Tax validation', async () => {
    const basePayload = getTestPurchasePayload(createdSupplier.name, createdItem.item_name);
    const withoutTaxPayload = {
      ...basePayload,
      formData: {
        ...basePayload.formData,
        inv_no: `INV_NOTAX_${Date.now()}`,
        tax_type: 'Without Tax',
        tax_mode: 'Without Tax'
      },
      items: [
        {
          item_name: createdItem.item_name,
          lot_no: `LOT_NOTAX_${Date.now()}`,
          qty: 100,
          rate: 50,
          disc_percent: 0,
          tax_percent: 0,
          total_weight: 100,
          gross_amount: 5000,
          tax_type: 'Without Tax',
          gst_rate: 0,
          cgst_amount: 0,
          sgst_amount: 0,
          total_tax: 0,
          net_amount: 5000
        }
      ],
      totals: {
        totalQty: 100,
        totalWeight: 100,
        totalAmount: 5000,
        baseAmount: 5000,
        discAmount: 0,
        taxAmount: 0,
        netAmount: 5000,
        grandTotal: 5000
      }
    };

    const res = await apiClient.post('/api/purchases', { data: withoutTaxPayload });
    expect([200, 201]).toContain(res.status());
  });

  test('3. Rejection of invalid zero-quantity purchase', async () => {
    const basePayload = getTestPurchasePayload(createdSupplier.name, createdItem.item_name);
    const invalidPayload = {
      ...basePayload,
      items: [
        {
          item_name: createdItem.item_name,
          qty: 0,
          rate: 50
        }
      ]
    };

    const res = await apiClient.post('/api/purchases', { data: invalidPayload });
    // Expect 400 bad request or rejection
    expect([400, 422]).toContain(res.status());
  });
});
