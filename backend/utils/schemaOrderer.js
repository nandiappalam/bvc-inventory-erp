/**
 * Schema Table Dependency Analyzer & Topological Sorter
 * Ensures PostgreSQL tables are created in proper dependency order
 */

const { COMPANY_TABLES } = require('../database/companySchema');

/**
 * Extracts foreign key references from a CREATE TABLE statement
 * Returns an array of referenced table names
 */
function extractForeignKeyReferences(createTableSql) {
  const references = new Set();
  
  // Match FOREIGN KEY (...) REFERENCES table_name(...)
  const fkPattern = /FOREIGN\s+KEY\s*\([^)]+\)\s+REFERENCES\s+(\w+)/gi;
  let match;
  
  while ((match = fkPattern.exec(createTableSql)) !== null) {
    references.add(match[1].toLowerCase());
  }
  
  return Array.from(references);
}

/**
 * Extracts table name from a CREATE TABLE statement
 */
function extractTableName(createTableSql) {
  const match = createTableSql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Builds a dependency graph and returns tables in topological order
 */
function orderTablesByDependencies(tableSqlArray) {
  const tableMap = new Map();
  const dependencies = new Map();
  
  // First pass: extract all tables and their dependencies
  for (const tableSql of tableSqlArray) {
    const tableName = extractTableName(tableSql);
    if (!tableName) continue;
    
    tableMap.set(tableName, tableSql);
    const refs = extractForeignKeyReferences(tableSql);
    dependencies.set(tableName, refs);
  }
  
  // Topological sort using Kahn's algorithm
  const sorted = [];
  const visited = new Set();
  const visiting = new Set();
  
  function visit(tableName, path = []) {
    if (visited.has(tableName)) {
      return true; // Already processed
    }
    
    if (visiting.has(tableName)) {
      // Circular dependency detected
      console.warn(`⚠️ Circular dependency detected: ${path.join(' -> ')} -> ${tableName}`);
      return false;
    }
    
    visiting.add(tableName);
    
    const deps = dependencies.get(tableName) || [];
    for (const dep of deps) {
      // Only visit if the dependency exists in our table map
      if (tableMap.has(dep)) {
        if (!visit(dep, [...path, tableName])) {
          return false;
        }
      }
    }
    
    visiting.delete(tableName);
    visited.add(tableName);
    sorted.push(tableMap.get(tableName));
    return true;
  }
  
  // Visit all tables
  for (const tableName of tableMap.keys()) {
    if (!visited.has(tableName)) {
      visit(tableName);
    }
  }
  
  return sorted;
}

/**
 * Separates FK constraints from CREATE TABLE statements
 * Returns { createTablesWithoutFK, fkConstraints }
 */
function separateForeignKeyConstraints(tableSql) {
  // Extract table name
  const tableMatch = tableSql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
  if (!tableMatch) return { createTableSql: tableSql, fkConstraints: [] };
  
  const tableName = tableMatch[1];
  
  // Extract all FOREIGN KEY constraints
  const fkPattern = /(,?\s*FOREIGN\s+KEY\s*\([^)]+\)\s+REFERENCES\s+\w+\s*\([^)]*\)(?:\s+ON\s+(?:DELETE|UPDATE)\s+\w+)*)/gi;
  const fkConstraints = [];
  let match;
  
  while ((match = fkPattern.exec(tableSql)) !== null) {
    fkConstraints.push(match[1]);
  }
  
  // Remove FK constraints from CREATE TABLE
  let createTableWithoutFk = tableSql;
  for (const fk of fkConstraints) {
    createTableWithoutFk = createTableWithoutFk.replace(fk, '');
  }
  
  // Clean up any double commas
  createTableWithoutFk = createTableWithoutFk.replace(/,\s*,/g, ',');
  createTableWithoutFk = createTableWithoutFk.replace(/,\s*\)/g, ')');
  
  // Build ALTER TABLE statements for FK constraints
  const alterStatements = fkConstraints
    .filter(fk => fk.trim().length > 0)
    .map(fk => {
      // Extract the constraint definition
      const fkMatch = fk.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(\w+)\s*\(([^)]+)\)(.*)/i);
      if (!fkMatch) return null;
      
      const [, columns, refTable, refColumns, options] = fkMatch;
      const constraintName = `fk_${tableName}_${refTable}_${Date.now()}`;
      
      return `ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${columns}) REFERENCES ${refTable}(${refColumns})${options}`;
    })
    .filter(Boolean);
  
  return {
    createTableSql: createTableWithoutFk,
    fkConstraints: alterStatements
  };
}

module.exports = {
  orderTablesByDependencies,
  separateForeignKeyConstraints,
  extractForeignKeyReferences,
  extractTableName
};
