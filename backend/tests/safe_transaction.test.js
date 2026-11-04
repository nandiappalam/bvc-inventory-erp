const test = require('node:test');
const assert = require('node:assert/strict');

const databasePath = require.resolve('../config/database');
const previousDatabaseModule = require.cache[databasePath];
const events = [];
const fakeDatabase = {
  async getConnection() {
    return {
      async beginTransaction() {
        events.push('begin');
      },
      async commit() {
        events.push('commit');
      },
      async rollback() {
        events.push('rollback');
      },
      async release() {
        events.push('release-start');
        await new Promise(resolve => setImmediate(resolve));
        events.push('release-finish');
      },
    };
  },
};

require.cache[databasePath] = {
  id: databasePath,
  filename: databasePath,
  loaded: true,
  exports: fakeDatabase,
};
const { executeSafeTransaction } = require('../utils/safeTransaction');
if (previousDatabaseModule) {
  require.cache[databasePath] = previousDatabaseModule;
} else {
  delete require.cache[databasePath];
}

test('waits for connection cleanup after committing a transaction', async () => {
  events.length = 0;
  const result = await executeSafeTransaction(async () => {
    events.push('work');
    return 'committed';
  });

  assert.equal(result, 'committed');
  assert.deepEqual(events, ['begin', 'work', 'commit', 'release-start', 'release-finish']);
});

test('rolls back and waits for connection cleanup after a failed transaction', async () => {
  events.length = 0;

  await assert.rejects(
    executeSafeTransaction(async () => {
      events.push('work');
      throw new Error('transaction failed');
    }),
    /transaction failed/
  );

  assert.deepEqual(events, ['begin', 'work', 'rollback', 'release-start', 'release-finish']);
});
