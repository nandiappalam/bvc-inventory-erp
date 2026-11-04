const test = require('node:test');
const assert = require('node:assert/strict');

const databasePath = require.resolve('../config/database');
const previousDatabaseModule = require.cache[databasePath];
const queries = [];
const fakeDatabase = {
  async query(sql, params) {
    queries.push({ sql, params });
    return {
      rows: [{
        id: 44,
        company_id: Number(params[0]),
        financial_year: '2026-2027',
        status: 'Active',
        is_current: 1,
        is_active: 1,
      }],
    };
  },
  async run() {
    throw new Error('Unexpected financial-year insert');
  },
};

require.cache[databasePath] = {
  id: databasePath,
  filename: databasePath,
  loaded: true,
  exports: fakeDatabase,
};
const router = require('../routes/financialYears');
if (previousDatabaseModule) {
  require.cache[databasePath] = previousDatabaseModule;
} else {
  delete require.cache[databasePath];
}

function makeResponse() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test('current financial year uses the authorized company, not a query override', async () => {
  queries.length = 0;
  const route = router.stack.find(layer => layer.route && layer.route.path === '/current');
  assert.ok(route, 'current financial-year route should be registered');

  const req = {
    companyId: 4,
    query: { company_id: '1' },
  };
  const res = makeResponse();
  await route.route.stack[0].handle(req, res);

  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].params, [4]);
  assert.match(queries[0].sql, /WHERE company_id = \?/);
  assert.doesNotMatch(queries[0].sql, /OR\s+1\s*=\s*1/i);
  assert.equal(res.payload.company_id, 4);
});
