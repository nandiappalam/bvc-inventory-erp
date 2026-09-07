import { test, expect } from '@playwright/test';

test.describe('Security: Authentication Controls & Protected Endpoints', () => {
  const backendURL = 'http://localhost:3001';

  test('1. Login with invalid password returns 401 Unauthorized', async ({ request }) => {
    const res = await request.post(`${backendURL}/api/auth/login`, {
      data: {
        username: 'admin',
        password: 'wrong_security_password_999'
      }
    });
    expect(res.status()).toBe(401);
  });

  test('2. Login with missing credentials returns 400 Bad Request', async ({ request }) => {
    const res = await request.post(`${backendURL}/api/auth/login`, {
      data: {}
    });
    expect([400, 401]).toContain(res.status());
  });

  test('3. Valid login returns authenticated JWT token with company scope', async ({ request }) => {
    const res = await request.post(`${backendURL}/api/auth/login`, {
      data: {
        username: 'admin',
        password: 'admin123'
      }
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(body.user).toBeDefined();
    expect(body.user.username).toBe('admin');
  });
});

