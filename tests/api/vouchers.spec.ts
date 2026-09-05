import { test, expect } from '@playwright/test';
import { createAuthenticatedApiClient } from '../fixtures/api';
import { cleanupTestData } from '../helpers/cleanup';

test.describe('API: Accounting Vouchers', () => {
  let apiClient: any;

  test.beforeAll(async () => {
    const api = await createAuthenticatedApiClient();
    apiClient = api.client;
  });

  test.afterAll(async () => {
    await cleanupTestData(1);
  });

  test('1. Get vouchers list returns array of vouchers', async () => {
    const res = await apiClient.get('/api/vouchers');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data) || Array.isArray(data.rows) || Array.isArray(data.vouchers)).toBe(true);
  });

  test('2. Create journal/payment voucher', async () => {
    const voucherPayload = {
      voucher_type: 'Journal',
      date: new Date().toISOString().split('T')[0],
      reference_no: `TEST_VOUCH_${Date.now()}`,
      narration: 'Automated test voucher entry',
      entries: [
        {
          type: 'Dr',
          ledger_id: 1,
          ledger_name: 'Cash',
          debit: 1000,
          credit: 0,
          remarks: 'Debit entry'
        },
        {
          type: 'Cr',
          ledger_id: 2,
          ledger_name: 'Purchase Account',
          debit: 0,
          credit: 1000,
          remarks: 'Credit entry'
        }
      ]
    };

    const res = await apiClient.post('/api/vouchers', { data: voucherPayload });
    if (res.status() >= 400) {
      console.log('VOUCHERS_ERROR:', await res.text());
    }
    expect([200, 201]).toContain(res.status());
  });
});
