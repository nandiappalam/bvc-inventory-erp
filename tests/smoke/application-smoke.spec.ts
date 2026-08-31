import { test, expect } from '@playwright/test';

test.describe('💨 Smoke Level 1: Application Health & Core Connectivity', () => {
  const backendURL = 'http://localhost:3001';

  test('1. Backend /api/health endpoint is alive and returns 200 OK', async ({ request }) => {
    const res = await request.get(`${backendURL}/api/health`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('OK');
  });

  test('2. /api/system/health returns database engine status and readiness', async ({ request }) => {
    const res = await request.get(`${backendURL}/api/system/health`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status === 'ok' || data.status === 'healthy' || data.success === true || data.database).toBeTruthy();
    if (data.database) {
      expect(data.database.connected !== false).toBe(true);
    }
  });

  test('3. Frontend loads with active React DOM and no crash screen', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Ensure root element is rendered
    await expect(page.locator('#root')).toBeVisible();
    expect(errors.length).toBe(0);
  });

  test('4. Authentication API validates credentials successfully', async ({ request }) => {
    const res = await request.post(`${backendURL}/api/auth/login`, {
      data: {
        username: 'admin',
        password: 'admin123',
        company_id: 1
      }
    });

    // Accept either admin123 or admin
    if (res.status() === 401) {
      const fallback = await request.post(`${backendURL}/api/auth/login`, {
        data: { username: 'admin', password: 'admin', company_id: 1 }
      });
      expect(fallback.status()).toBe(200);
      const data = await fallback.json();
      expect(data.token).toBeDefined();
    } else {
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.token).toBeDefined();
      expect(data.user.role).toBe('Admin');
    }
  });

  test('5. Companies list API responds with valid company records', async ({ request }) => {
    const res = await request.get(`${backendURL}/api/companies`);
    expect(res.status()).toBe(200);
    const companies = await res.json();
    expect(Array.isArray(companies)).toBe(true);
    expect(companies.length).toBeGreaterThan(0);
  });
});
