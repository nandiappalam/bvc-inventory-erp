import { test, expect } from '@playwright/test';
import { createAuthenticatedApiClient } from '../fixtures/api';

test.describe('💨 Smoke Level 2: Core ERP Module Endpoint Availability', () => {
  let apiClient: any;

  test.beforeAll(async () => {
    const api = await createAuthenticatedApiClient();
    apiClient = api.client;
  });

  test('1. Item Master API returns valid response', async () => {
    const res = await apiClient.get('/api/masters/item');
    expect(res.status()).toBe(200);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.data || []);
    expect(Array.isArray(list)).toBe(true);
  });

  test('2. Supplier Master API returns valid response', async () => {
    const res = await apiClient.get('/api/masters/supplier');
    expect(res.status()).toBe(200);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.data || []);
    expect(Array.isArray(list)).toBe(true);
  });

  test('3. Customer Master API returns valid response', async () => {
    const res = await apiClient.get('/api/masters/customer');
    expect(res.status()).toBe(200);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.data || []);
    expect(Array.isArray(list)).toBe(true);
  });

  test('4. Purchases list API returns valid response', async () => {
    const res = await apiClient.get('/api/purchases');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data) || Array.isArray(data.purchases) || Array.isArray(data.rows) || Array.isArray(data.data)).toBe(true);
  });

  test('5. Sales list API returns valid response', async () => {
    const res = await apiClient.get('/api/sales');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data) || Array.isArray(data.sales) || Array.isArray(data.rows) || Array.isArray(data.data)).toBe(true);
  });

  test('6. Stock report API returns valid response', async () => {
    const res = await apiClient.get('/api/stock/report');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  test('7. Ledger Master API returns valid response', async () => {
    const res = await apiClient.get('/api/masters/ledger');
    expect(res.status()).toBe(200);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.data || []);
    expect(Array.isArray(list)).toBe(true);
  });

  test('8. QC Register & History API returns valid response', async () => {
    const res = await apiClient.get('/api/qc/history');
    expect(res.status()).toBe(200);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.data || []);
    expect(Array.isArray(list)).toBe(true);
  });

  test('9. Reports stock API returns valid response', async () => {
    const res = await apiClient.get('/api/reports/stock');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toBeDefined();
  });
});

