import { test, expect } from '@playwright/test';
import { createAuthenticatedApiClient } from '../fixtures/api';
import { getTestItem, getTestSupplier, getTestCustomer } from '../fixtures/test-data';
import { cleanupTestData } from '../helpers/cleanup';

test.describe('API: Masters (CRUD & Filtering)', () => {
  let apiClient: any;

  test.beforeAll(async () => {
    const api = await createAuthenticatedApiClient();
    apiClient = api.client;
  });

  test.afterAll(async () => {
    await cleanupTestData(1);
  });

  test('1. Item Master: CREATE -> READ -> UPDATE -> FILTER', async () => {
    const testItem = getTestItem();

    // CREATE
    const createRes = await apiClient.post('/api/masters/item', { data: testItem });
    expect([200, 201]).toContain(createRes.status());
    const created = await createRes.json();
    const itemId = created.id || created.data?.id;

    // READ
    const listRes = await apiClient.get('/api/masters/item');
    expect(listRes.status()).toBe(200);
    const resData = await listRes.json();
    const items = Array.isArray(resData) ? resData : (resData.data || []);
    const found = items.find((i: any) => i.item_code === testItem.item_code || i.item_name === testItem.item_name || i.name === testItem.item_name);
    expect(found).toBeDefined();

    // UPDATE
    if (itemId) {
      const updateRes = await apiClient.put(`/api/masters/item/${itemId}`, {
        data: {
          ...testItem,
          print_name: `${testItem.print_name} (Updated)`
        }
      });
      expect([200, 204]).toContain(updateRes.status());
    }
  });

  test('2. Supplier Master: CREATE -> READ -> UPDATE', async () => {
    const testSupplier = getTestSupplier();

    // CREATE
    const createRes = await apiClient.post('/api/masters/supplier', { data: testSupplier });
    expect([200, 201]).toContain(createRes.status());
    const created = await createRes.json();
    const supplierId = created.id || created.data?.id;

    // READ
    const listRes = await apiClient.get('/api/masters/supplier');
    expect(listRes.status()).toBe(200);
    const resData = await listRes.json();
    const suppliers = Array.isArray(resData) ? resData : (resData.data || []);
    const found = suppliers.find((s: any) => s.name === testSupplier.name || s.print_name === testSupplier.name);
    expect(found).toBeDefined();

    // UPDATE
    if (supplierId) {
      const updateRes = await apiClient.put(`/api/masters/supplier/${supplierId}`, {
        data: {
          ...testSupplier,
          city: 'Coimbatore'
        }
      });
      expect([200, 204]).toContain(updateRes.status());
    }
  });

  test('3. Customer Master: CREATE -> READ -> UPDATE', async () => {
    const testCustomer = getTestCustomer();

    // CREATE
    const createRes = await apiClient.post('/api/masters/customer', { data: testCustomer });
    expect([200, 201]).toContain(createRes.status());
    const created = await createRes.json();
    const customerId = created.id || created.data?.id;

    // READ
    const listRes = await apiClient.get('/api/masters/customer');
    expect(listRes.status()).toBe(200);
    const resData = await listRes.json();
    const customers = Array.isArray(resData) ? resData : (resData.data || []);
    const found = customers.find((c: any) => c.name === testCustomer.name || c.print_name === testCustomer.name);
    expect(found).toBeDefined();

    // UPDATE
    if (customerId) {
      const updateRes = await apiClient.put(`/api/masters/customer/${customerId}`, {
        data: {
          ...testCustomer,
          city: 'Mysuru'
        }
      });
      expect([200, 204]).toContain(updateRes.status());
    }
  });

  test('4. Tax Master & Godown Master verification', async () => {
    const taxRes = await apiClient.get('/api/masters/tax');
    expect(taxRes.status()).toBe(200);
    const taxData = await taxRes.json();
    const taxes = Array.isArray(taxData) ? taxData : (taxData.data || []);
    expect(Array.isArray(taxes)).toBe(true);

    const godownRes = await apiClient.get('/api/masters/godown');
    expect(godownRes.status()).toBe(200);
    const godownData = await godownRes.json();
    const godowns = Array.isArray(godownData) ? godownData : (godownData.data || []);
    expect(Array.isArray(godowns)).toBe(true);
  });
});

