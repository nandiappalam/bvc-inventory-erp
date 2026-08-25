const sqlite3 = require('sqlite3').verbose()
const fs = require('fs')
const path = require('path')

const databaseDir = path.join(__dirname, '../../database')
const templatePath = path.join(databaseDir, 'bvc.db')
const connections = new Map()

const all = (connection, sql, params = []) => new Promise((resolve, reject) => {
  connection.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []))
})

const run = (connection, sql) => new Promise((resolve, reject) => {
  connection.run(sql, err => err ? reject(err) : resolve())
})

async function synchronizeSchema(databasePath) {
  if (path.resolve(databasePath) === path.resolve(templatePath) || !fs.existsSync(templatePath)) return

  const template = new sqlite3.Database(templatePath)
  const target = new sqlite3.Database(databasePath)
  try {
    await run(target, 'PRAGMA foreign_keys = OFF')
    const objects = await all(template, `SELECT type, name, sql FROM sqlite_master
      WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
      ORDER BY CASE type WHEN 'table' THEN 1 WHEN 'index' THEN 2 ELSE 3 END`)

    const existingObjects = new Set((await all(target, `SELECT type, name FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'`)).map(object => `${object.type}:${object.name}`))
    for (const object of objects) {
      if (!existingObjects.has(`${object.type}:${object.name}`)) await run(target, object.sql)
    }

    const tables = objects.filter(object => object.type === 'table')
    for (const table of tables) {
      const sourceColumns = await all(template, `PRAGMA table_info("${table.name.replace(/"/g, '""')}")`)
      const targetColumns = await all(target, `PRAGMA table_info("${table.name.replace(/"/g, '""')}")`)
      const existingColumns = new Set(targetColumns.map(column => column.name))
      for (const column of sourceColumns) {
        if (!existingColumns.has(column.name)) {
          const definition = `${column.type || 'TEXT'}${column.notnull ? ' NOT NULL' : ''}${column.dflt_value !== null ? ` DEFAULT ${column.dflt_value}` : ''}`
          await run(target, `ALTER TABLE "${table.name.replace(/"/g, '""')}" ADD COLUMN "${column.name.replace(/"/g, '""')}" ${definition}`)
        }
      }
    }
    await run(target, 'PRAGMA foreign_keys = ON')
  } finally {
    template.close()
    target.close()
  }
}

async function createFreshCompanyDatabase(databasePath) {
  const resolvedPath = path.resolve(databasePath)
  const existingConnection = connections.get(resolvedPath)
  if (existingConnection) {
    await new Promise(resolve => existingConnection.close(() => resolve()))
    connections.delete(resolvedPath)
  }
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const filePath = resolvedPath + suffix
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  }
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true })
  fs.closeSync(fs.openSync(resolvedPath, 'w'))
  await synchronizeSchema(resolvedPath)
}

async function getCompanyDatabase(company) {
  if (!company || !company.database_path) throw new Error('Company database mapping is missing')
  const databasePath = path.resolve(company.database_path)
  if (!connections.has(databasePath)) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true })
    if (!fs.existsSync(databasePath)) fs.closeSync(fs.openSync(databasePath, 'w'))
    await synchronizeSchema(databasePath)
    const connection = new sqlite3.Database(databasePath)
    connection.run('PRAGMA foreign_keys = ON')
    connections.set(databasePath, connection)
  }
  return connections.get(databasePath)
}

module.exports = { getCompanyDatabase, createFreshCompanyDatabase }