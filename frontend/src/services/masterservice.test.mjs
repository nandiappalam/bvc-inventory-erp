import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllMasters, getMasters, invalidateMasterCache } from './masterservice.js';

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;

const mockMastersFetch = (responses) => {
  let call = 0;
  globalThis.fetch = async () => {
    const data = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ success: true, data })
    };
  };
  return () => call;
};

test('empty master responses are retried and are not cached over stored options', async () => {
  globalThis.localStorage = { getItem: () => null };
  invalidateMasterCache();
  const countCalls = mockMastersFetch([[], [], [], [{ id: 1, name: 'Stored item' }]]);

  try {
    const emptyResult = await getMasters('items');
    assert.equal(emptyResult.length, 0);
    assert.equal(countCalls(), 3);

    const loadedResult = await getMasters('items');
    assert.equal(loadedResult.length, 1);
    assert.equal(loadedResult[0].name, 'Stored item');
    assert.equal(countCalls(), 4);
  } finally {
    invalidateMasterCache();
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  }
});

test('empty master display responses are not cached over stored options', async () => {
  globalThis.localStorage = { getItem: () => null };
  invalidateMasterCache();
  const countCalls = mockMastersFetch([[], [{ id: 2, name: 'Stored loadman' }]]);

  try {
    const emptyResult = await getAllMasters('loadman');
    assert.equal(emptyResult.length, 0);
    assert.equal(countCalls(), 1);

    const loadedResult = await getAllMasters('loadman');
    assert.equal(loadedResult.length, 1);
    assert.equal(loadedResult[0].name, 'Stored loadman');
    assert.equal(countCalls(), 2);
  } finally {
    invalidateMasterCache();
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  }
});
