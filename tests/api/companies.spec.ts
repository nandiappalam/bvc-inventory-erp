import { test, expect } from '@playwright/test';
import { createAuthenticatedApiClient } from '../fixtures/api';

test.describe('API: Companies Management', () => {
  let apiClient: any;

  test.beforeAll(async () => {
    const api = await createAuthenticatedApiClient();
    apiClient = api.client;
  });

  test('GET /api/companies returns array of registered companies', async () => {
    const res = await apiClient.get('/api/companies');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('id');
    expect(body[0]).toHaveProperty('name');
  });

  test('GET /api/companies/:id returns specific company details', async () => {
    const res = await apiClient.get('/api/companies/1');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.name).toBeDefined();
  });
});
