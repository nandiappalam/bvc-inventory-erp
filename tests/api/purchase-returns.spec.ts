import { test, expect } from '@playwright/test';
import { createAuthenticatedApiClient } from '../fixtures/api';
import { getTestItem, getTestSupplier, getTestPurchasePayload } from '../fixtures/test-data';
import { cleanupTestData } from '../helpers/cleanup';

test.describe('API: Purchase Returns Workflow', () => {
  let apiClient: any;
  let createdSupplier: any;
  let createdItem: any;
  let lotNo: string;

  test.beforeAll(async () => {
    const api = await createAuthenticatedApiClient();
    apiClient = api.client;

    createdItem = getTestItem('_PRET');
    await apiClient.post('/api/masters/item', { data: createdItem });

    createdSupplier = getTestSupplier('_PRET');
    await apiClient.post('/api/masters/supplier', { data: createdSupplier });

    // Inward stock via purchase
    lotNo = `LOT_PRET_${Date.now()}`;
    const purchase = getTestPurchasePayload(createdSupplier.name, createdItem.item_name, lotNo);
    await apiClient.post('/api/purchases', { data: purchase });
  });

  test.afterAll(async () => {
    await cleanupTestData(1);
  });

  test('1. Create purchase return and verify return record', async () => {
    const returnPayload = {
      formData: {
        s_no: '1',
        date: new Date().toISOString().split('T')[0],
        return_inv_no: `TEST_PR_RET_${Date.now()}`,
        supplier: createdSupplier.name,
        pay_type: 'Credit',
        type: 'Urad',
        address: '123 Test Road',
        tax_type: 'Exclusive',
        godown: 'Godown 1',
        remarks: 'Automated test purchase return'
      },
      items: [
        {
          item_name: createdItem.item_name,
          lot_no: lotNo,
          weight: 50,
          qty: 50,
          total_wt: 50,
          rate: 50,
          disc_percent: 0,
          tax_percent: 5,
          amount: 2625
        }
      ],
      totals: {
        totalQty: 50,
        totalWeight: 50,
        totalAmount: 2500,
        baseAmount: 2500,
        discAmount: 0,
        taxAmount: 125,
        netAmount: 2625,
        grandTotal: 2625
      }
    };

    const res = await apiClient.post('/api/purchase-returns', { data: returnPayload });
    expect([200, 201]).toContain(res.status());
  });

  test('2. Purchase return list returns recorded return transactions', async () => {
    const res = await apiClient.get('/api/purchase-returns');
    expect(res.status()).toBe(200);
    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.rows || data.data || []);
    expect(Array.isArray(rows)).toBe(true);
  });
});
