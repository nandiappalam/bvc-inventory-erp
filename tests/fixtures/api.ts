/**
 * BVC Inventory ERP - Authenticated API Request Helper
 */

import { request, APIRequestContext } from '@playwright/test';
import { getAuthToken } from './auth';

export async function createAuthenticatedApiClient(baseURL = 'http://localhost:3001', companyId = 1): Promise<{ client: APIRequestContext; token: string; companyId: number }> {
  const auth = await getAuthToken(baseURL, companyId);
  const client = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      'Authorization': `Bearer ${auth.token}`,
      'x-company-id': String(companyId),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  return { client, token: auth.token, companyId };
}
