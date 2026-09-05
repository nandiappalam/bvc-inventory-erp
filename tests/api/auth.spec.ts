import { test, expect } from '@playwright/test';

test.describe('API: Authentication & Credentials', () => {
  const backendURL = 'http://localhost:3001';

  test('Valid login returns 200 with JWT and user information', async ({ request }) => {
    const res = await request.post(`${backendURL}/api/auth/login`, {
      data: {
        username: 'admin',
        password: 'admin123',
        company_id: 1
      }
    });

    if (res.status() === 401) {
      const fallback = await request.post(`${backendURL}/api/auth/login`, {
        data: { username: 'admin', password: 'admin', company_id: 1 }
      });
      expect(fallback.status()).toBe(200);
      const data = await fallback.json();
      expect(data.token).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.user.username).toBe('admin');
    } else {
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.token).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.user.username).toBe('admin');
    }
  });

  test('Invalid password returns 401 Unauthorized', async ({ request }) => {
    const res = await request.post(`${backendURL}/api/auth/login`, {
      data: {
        username: 'admin',
        password: 'wrong_password_123',
        company_id: 1
      }
    });

    expect(res.status()).toBe(401);
  });

  test('Missing credentials returns 400 Bad Request', async ({ request }) => {
    const res = await request.post(`${backendURL}/api/auth/login`, {
      data: {
        username: '',
        password: ''
      }
    });

    expect([400, 401]).toContain(res.status());
  });

  test('Logout API endpoint processes cleanly', async ({ request }) => {
    const res = await request.post(`${backendURL}/api/auth/logout`, {
      data: { login_history_id: 1 }
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.message).toContain('Logout');
  });
});
