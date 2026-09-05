import { test, expect } from '@playwright/test';

test.describe('Security: Authentication Controls & Protected Endpoints', () => {
  const backendURL = 'http://localhost:3001';

  test('1. Unauthenticated request to protected endpoint returns 401 Unauthorized', async ({ request }) => {
    const res = await request.get(`${backendURL}/api/purchases`);
    // Should be rejected or unauthenticated
    expect([401, 403]).toContain(res.status());
  });

  test('2. Invalid token in Authorization header returns 401 Unauthorized', async ({ request }) => {
    const res = await request.get(`${backendURL}/api/purchases`, {
      headers: {
        'Authorization': 'Bearer invalid_malformed_token_xyz',
        'x-company-id': '1'
      }
    });

    expect([401, 403]).toContain(res.status());
  });

  test('3. Missing Authorization header cannot access master data modifications', async ({ request }) => {
    const res = await request.post(`${backendURL}/api/masters/item`, {
      data: { item_name: 'HACKED_ITEM' }
    });

    expect([401, 403]).toContain(res.status());
  });
});
