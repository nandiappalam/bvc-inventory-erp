import { test, expect } from '@playwright/test';
import { createAuthenticatedApiClient } from '../fixtures/api';
import { cleanupTestData } from '../helpers/cleanup';

test.describe('API: Quality Control (QC)', () => {
  let apiClient: any;

  test.beforeAll(async () => {
    const api = await createAuthenticatedApiClient();
    apiClient = api.client;
  });

  test.afterAll(async () => {
    await cleanupTestData(1);
  });

  test('1. Get QC inspections list', async () => {
    const res = await apiClient.get('/api/qc/history');
    expect(res.status()).toBe(200);
    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.data || []);
    expect(Array.isArray(rows)).toBe(true);
  });

  test('2. Create QC inspection record', async () => {
    const inspectionPayload = {
      qcHeader: {
        lotNo: `TEST_LOT_QC_${Date.now()}`,
        item: 'TEST Item QC',
        analyst: 'Test QA Engineer',
        status: 'ACCEPTED',
        remarks: 'Automated QC inspection test',
        quantity: 100
      },
      summary: {
        overallResult: 'ACCEPTED'
      }
    };

    const res = await apiClient.post('/api/qc/submit', { data: inspectionPayload });
    expect([200, 201]).toContain(res.status());
  });
});
