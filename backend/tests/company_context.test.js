const test = require('node:test');
const assert = require('node:assert/strict');

const users = new Map([
  [10, { id: 10, username: 'admin-a', role: 'Admin', company_id: 1, status: 'Active' }],
  [20, { id: 20, username: 'platform', role: 'SuperAdmin', company_id: 1, status: 'Active' }],
  [30, { id: 30, username: 'manager-a', role: 'Manager', company_id: 1, status: 'Active' }],
]);
const companyAccess = new Set(['20:2']);
const fakeDb = {
  asyncLocalStorage: { run: (_context, callback) => callback() },
  forCompany: (companyId) => ({ companyId }),
  master: {
    query: async (_sql, [companyId, userId, assignedCompanyId, membershipCompanyId]) => {
      const user = users.get(Number(userId));
      const hasAccess = user && user.status !== 'Inactive'
        && (Number(user.company_id) === Number(assignedCompanyId)
          || companyAccess.has(`${userId}:${membershipCompanyId}`))
        && Number(companyId) > 0;
      return {
        rows: hasAccess
          ? [{ id: user.id, username: user.username, role: user.role, company_id: user.company_id }]
          : [],
      };
    },
  },
};

const databasePath = require.resolve('../config/database');
require.cache[databasePath] = {
  id: databasePath,
  filename: databasePath,
  loaded: true,
  exports: fakeDb,
};
process.env.JWT_SECRET = 'company-context-test-secret-0123456789';

const {
  authenticateToken,
  companyContextMiddleware,
  generateToken,
} = require('../middleware/authMiddleware');

function makeRequest({ token, headerCompanyId, path = '/api/masters/items' } = {}) {
  return {
    path,
    originalUrl: path,
    method: 'GET',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(headerCompanyId ? { 'x-company-id': String(headerCompanyId) } : {}),
    },
    query: {},
    body: {},
  };
}

function makeResponse() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

async function runMiddleware(req, middleware = companyContextMiddleware) {
  const response = makeResponse();
  let nextCalled = false;
  await middleware(req, response, () => { nextCalled = true; });
  return { req, response, nextCalled };
}

async function runAuthenticatedMiddleware(req) {
  const response = makeResponse();
  let nextCalled = false;
  await companyContextMiddleware(req, response, () => {
    authenticateToken(req, response, () => { nextCalled = true; });
  });
  return { req, response, nextCalled };
}

function tokenFor(id, role, companyId) {
  return generateToken({ id, username: `user-${id}`, role, companyId });
}

test('requires authentication for protected API requests', async () => {
  const result = await runMiddleware(makeRequest({ headerCompanyId: 2 }));
  assert.equal(result.response.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('public login and company-list requests ignore stale bearer tokens', async () => {
  for (const [method, path] of [
    ['POST', '/api/auth/login'],
    ['GET', '/api/companies'],
  ]) {
    const request = makeRequest({ token: 'expired-or-invalid-token', path });
    request.method = method;
    const result = await runMiddleware(request);
    assert.equal(result.response.statusCode, 200);
    assert.equal(result.nextCalled, true);
    assert.equal(result.req.companyId, 1);
  }
});

test('company-scoped Admin and Manager cannot cross tenants by header', async () => {
  for (const [id, role] of [[10, 'Admin'], [30, 'Manager']]) {
    const ownCompany = await runMiddleware(makeRequest({ token: tokenFor(id, role, 1) }));
    assert.equal(ownCompany.response.statusCode, 200);
    assert.equal(ownCompany.req.companyId, 1);
    assert.equal(ownCompany.nextCalled, true);

    const crossCompany = await runMiddleware(makeRequest({
      token: tokenFor(id, role, 1),
      headerCompanyId: 2,
    }));
    assert.equal(crossCompany.response.statusCode, 403);
    assert.equal(crossCompany.nextCalled, false);
  }
});

test('SuperAdmin role needs an explicit server-side company membership', async () => {
  const authorized = await runMiddleware(makeRequest({
    token: tokenFor(20, 'SuperAdmin', 1),
    headerCompanyId: 2,
  }));
  assert.equal(authorized.response.statusCode, 200);
  assert.equal(authorized.req.companyId, 2);

  companyAccess.delete('20:2');
  const revoked = await runMiddleware(makeRequest({
    token: tokenFor(20, 'SuperAdmin', 1),
    headerCompanyId: 2,
  }));
  assert.equal(revoked.response.statusCode, 403);
  assert.equal(revoked.nextCalled, false);
});

test('role changes are reflected immediately even when an old JWT is presented', async () => {
  const staleToken = tokenFor(20, 'SuperAdmin', 1);
  companyAccess.add('20:2');
  users.get(20).role = 'Staff';

  const result = await runAuthenticatedMiddleware(makeRequest({
    token: staleToken,
    headerCompanyId: 2,
  }));
  assert.equal(result.response.statusCode, 200);
  assert.equal(result.req.user.role, 'Staff');
});

test('invalid tokens and direct authenticateToken calls fail closed', async () => {
  const invalid = await runMiddleware(makeRequest({ token: 'not-a-valid-token' }));
  assert.equal(invalid.response.statusCode, 401);
  assert.equal(invalid.nextCalled, false);

  const unauthenticated = await runMiddleware(makeRequest(), authenticateToken);
  assert.equal(unauthenticated.response.statusCode, 401);
  assert.equal(unauthenticated.nextCalled, false);
});
