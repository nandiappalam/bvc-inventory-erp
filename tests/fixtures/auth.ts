/**
 * BVC Inventory ERP - Test Auth Fixture
 */

import { request } from '@playwright/test';

export interface AuthContext {
  token: string;
  user: {
    id: number;
    username: string;
    role: string;
    company_id: number;
    company_name: string;
  };
  company: {
    id: number;
    name: string;
  };
}

let cachedAuth: Record<number, AuthContext> = {};

export async function getAuthToken(baseURL = 'http://localhost:3001', companyId = 1): Promise<AuthContext> {
  if (cachedAuth[companyId]) {
    return cachedAuth[companyId];
  }

  const reqContext = await request.newContext({ baseURL });
  const response = await reqContext.post('/api/auth/login', {
    data: {
      username: 'admin',
      password: 'admin123',
      company_id: companyId
    }
  });

  if (!response.ok()) {
    // Try fallback password
    const fallbackResponse = await reqContext.post('/api/auth/login', {
      data: {
        username: 'admin',
        password: 'admin',
        company_id: companyId
      }
    });
    if (!fallbackResponse.ok()) {
      throw new Error(`Failed to login for company ${companyId}: ${await response.text()}`);
    }
    const data = await fallbackResponse.json();
    cachedAuth[companyId] = data;
    return data;
  }

  const data = await response.json();
  cachedAuth[companyId] = data;
  return data;
}

export function clearAuthCache() {
  cachedAuth = {};
}
