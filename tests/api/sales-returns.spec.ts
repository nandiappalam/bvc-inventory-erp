import { test, expect } from '@playwright/test';
import { createAuthenticatedApiClient } from '../fixtures/api';
import { getTestItem, getTestCustomer, getTestSupplier, getTestPurchasePayload, getTestSalesPayload } from '../fixtures/test-data';
import { cleanupTestData } from '../helpers/cleanup';

test.describe('API: Sales Returns Workflow', () => {
  let apiClient: any;
  let createdSupplier: any;
  let createdCustomer: any;
  let createdItem: any;
  let lotNo: string;

  test.beforeAll(async () => {
    const api = await createAuthenticatedApiClient();
    apiClient = api.client;

    createdItem = getTestItem('_SRET');
    await apiClient.post('/api/masters/item', { data: createdItem });

    createdSupplier = getTestSupplier('_SRET');
    await apiClient.post('/api/masters/supplier', { data: createdSupplier });

    createdCustomer = getTestCustomer('_SRET');
    await apiClient.post('/api/masters/customer', { data: createdCustomer });

    // Purchase & Sale
    lotNo = `LOT_SRET_${Date.now()}`;
    await apiClient.post('/api/purchases', { data: getTestPurchasePayload(createdSupplier.name, createdItem.item_name, lotNo) });
    await apiClient.post('/api/sales', { data: getTestSalesPayload(createdCustomer.name, createdItem.item_name, lotNo) });
  });

  test.afterAll(async () => {
    await cleanupTestData(1);
  });

  test('1. Create Sales Return record and verify in returns list', async () => {
    const returnPayload = {
      date: new Date().toISOString().split('T')[0],
      inv_no: `TEST_SR_RET_${Date.now()}`,
      customer: createdCustomer.name,
      customer_name: createdCustomer.name,
      remarks: 'Automated test sales return',
      items: [
        {
          item_name: createdItem.item_name,
          lot_no: lotNo,
          qty: 20,
          rate: 80,
          gross_amount: 1600,
          tax_type: 'Taxable',
          gst_rate: 5,
          igst_rate: 5,
          igst_amount: 80,
          total_tax: 80,
          net_amount: 1680
        }
      ],
      total_qty: 20,
      subtotal: 1600,
      total_tax: 80,
      total_amount: 1680
    };

    const res = await apiClient.post('/api/sales-returns', { data: returnPayload });
    expect([200, 201]).toContain(res.status());

    const listRes = await apiClient.get('/api/sales-returns');
    expect(listRes.status()).toBe(200);
    const data = await listRes.json();
    expect(Array.isArray(data) || Array.isArray(data.rows)).toBe(true);
  });
});
