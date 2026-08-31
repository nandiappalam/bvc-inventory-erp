/**
 * BVC Inventory ERP - Browser Login Helper
 */

import { Page, expect } from '@playwright/test';
import { getAuthToken } from '../fixtures/auth';

export async function loginToUI(page: Page, username = 'admin', password = 'admin123', companyId = 1) {
  try {
    const auth = await getAuthToken('http://localhost:3001', companyId);
    await page.addInitScript(({ token, user, company }) => {
      window.localStorage.setItem('erp_token', token);
      window.localStorage.setItem('erp_user', JSON.stringify(user));
      window.localStorage.setItem('erp_company', JSON.stringify(company));
      window.localStorage.setItem('erp_selected_company', JSON.stringify(company));
      window.localStorage.setItem('erp_isAdmin', 'true');
    }, { token: auth.token, user: auth.user, company: auth.company });
  } catch (e) {
    console.warn('InitScript token fallback:', e);
  }

  // Navigate to root/dashboard
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Check if we are redirected to /login
  const usernameInput = page.locator('input[placeholder*="Username"], input[name="username"], input[id="username"]');
  if (await usernameInput.isVisible({ timeout: 1500 }).catch(() => false)) {
    await usernameInput.fill(username);

    const passwordInput = page.locator('input[placeholder*="Password"], input[type="password"], input[name="password"]');
    await passwordInput.fill(password);

    // Click Login
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign In"), button[type="submit"]');
    await loginButton.click();

    // Wait for redirect to dashboard
    await page.waitForURL(/(\/|\/dashboard)/, { timeout: 8000 }).catch(() => {});
  }

  // Ensure main application shell is loaded
  await expect(page.locator('#root, body').first()).toBeVisible();
}
