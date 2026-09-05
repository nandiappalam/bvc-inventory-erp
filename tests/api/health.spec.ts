import { test, expect } from '@playwright/test';

test.describe('API: Health & Diagnostics', () => {
  const backendURL = 'http://localhost:3001';

  test('GET /api/health returns status OK with 200', async ({ request }) => {
    const res = await request.get(`${backendURL}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('OK');
    expect(body.timestamp).toBeDefined();
  });

  test('GET /api/system/health returns detailed database & runtime diagnostics', async ({ request }) => {
    const res = await request.get(`${backendURL}/api/system/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.systemStatus || body.status).toBeDefined();
    expect(body.database).toBeDefined();
    expect(body.database.status).toMatch(/(healthy|connected|ok)/i);
    expect(body.database.engine).toMatch(/(sqlite|postgres)/i);
    expect(body.environment).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });
});
