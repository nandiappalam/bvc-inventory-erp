const { AsyncLocalStorage } = require('async_hooks')

const storage = new AsyncLocalStorage()

function run(companyId, callback) {
  return storage.run({ companyId }, callback)
}

function getCompanyId() {
  return storage.getStore()?.companyId || null
}
// Temporary compatibility function
function getDatabase() {
  return null
}

module.exports = {
  run,
  getCompanyId,
  getDatabase,
}