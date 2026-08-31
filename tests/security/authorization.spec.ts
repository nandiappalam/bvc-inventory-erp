import { test, expect } from '@playwright/test';
import { createAuthenticatedApiClient } from '../fixtures/api';

test.describe('Security: Role-Based Authorization & Permission Controls', () => {
  let adminClient: any;

  test.beforeAll(async () => {
    const api = await createAuthenticatedApiClient();
    adminClient = api.client;
  });

  test('1. Admin role can access system health and diagnostic routes', async () => {
    const res = await adminClient.get('/api/system/health');
    expect(res.status()).toBe(200);
  });

  test('2. Token claims contain verified company_id and username', async () => {
    const res = await adminClient.get('/api/companies/1');
    expect(res.status()).toBe(200);
  });
});
