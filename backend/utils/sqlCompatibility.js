/**
 * SQL Compatibility Helper
 * Converts SQLite-specific SQL to PostgreSQL-compatible SQL
 */

const db = require('../config/database');

/**
 * Converts GROUP_CONCAT (SQLite) to STRING_AGG (PostgreSQL)
 * Handles both simple and nested subqueries
 */
function convertGroupConcatForPostgres(sql) {
  if (!sql || typeof sql !== 'string') {
    return sql;
  }
  
  if (!db.isPostgres()) {
    return sql; // Return unchanged for SQLite
  }
  
  let transformed = sql;
  
  // Pattern 1: GROUP_CONCAT(column, ', ') -> STRING_AGG(column::text, ', ')
  transformed = transformed.replace(
    /GROUP_CONCAT\s*\(\s*(\w+(?:\.\w+)?)\s*,\s*'([^']+)'\s*\)/gi,
    (match, column, separator) => {
      // Handle column aliases and table prefixes
      const parts = column.split('.');
      const col = parts[parts.length - 1];
      
      return `STRING_AGG(${column}::text, '${separator}')`;
    }
  );
  
  // Pattern 2: GROUP_CONCAT(DISTINCT column) -> STRING_AGG(DISTINCT column::text, ', ')
  transformed = transformed.replace(
    /GROUP_CONCAT\s*\(\s*DISTINCT\s+(\w+(?:\.\w+)?)\s*\)/gi,
    (match, column) => {
      return `STRING_AGG(DISTINCT ${column}::text, ', ')`;
    }
  );
  
  // Pattern 3: GROUP_CONCAT(NULLIF(..., ''), ...) -> STRING_AGG((CASE WHEN ... THEN ... END)::text, ...)
  transformed = transformed.replace(
    /GROUP_CONCAT\s*\(\s*NULLIF\s*\(\s*(\w+(?:\.\w+)?)\s*,\s*''\s*\)\s*,\s*'([^']+)'\s*\)/gi,
    (match, column, separator) => {
      return `STRING_AGG((CASE WHEN ${column} != '' THEN ${column} ELSE NULL END)::text, '${separator}')`;
    }
  );
  
  return transformed;
}

/**
 * Normalizes empty strings to NULL for numeric fields before insert/update
 * This prevents "invalid input syntax for type numeric" errors in PostgreSQL
 */
function normalizeNumericFields(data, numericFields = ['tax', 'gst_rate', 'rate', 'weight', 'qty', 'amount', 'value']) {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const normalized = { ...data };
  
  for (const field of numericFields) {
    if (field in normalized) {
      const value = normalized[field];
      
      // Convert empty string to NULL for numeric fields
      if (value === '' || value === null || value === undefined) {
        normalized[field] = null;
      }
      // Ensure numeric values are actually numbers
      else if (typeof value === 'string') {
        const numValue = parseFloat(value);
        normalized[field] = isNaN(numValue) ? null : numValue;
      }
    }
  }
  
  return normalized;
}

module.exports = {
  convertGroupConcatForPostgres,
  normalizeNumericFields
};
