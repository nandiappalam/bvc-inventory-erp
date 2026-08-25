const { AsyncLocalStorage } = require('async_hooks')

const storage = new AsyncLocalStorage()

function run(companyDb, callback) {
  return storage.run({ companyDb }, callback)
}

function getDatabase() {
  return storage.getStore()?.companyDb || null
}

module.exports = { run, getDatabase }