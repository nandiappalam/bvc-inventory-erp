import { MASTER_FIELD_TYPES } from './masterFields';

/**
 * Global validator for Entry page configs
 * Ensures all master fields have masterType + type='master'
 */
export const validateEntryConfig = (fields = [], columns = []) => {
  const errors = [];
  const warnings = [];

  // Check top frame fields
  fields.forEach(f => {
    const isMaster = MASTER_FIELD_TYPES[f.name];
    if (isMaster && f.type !== 'master') {
      errors.push(`Field "${f.name}" must be type: 'master'`);
    }
    if (isMaster && !f.masterType) {
      warnings.push(`Field "${f.name}" should have masterType: '${isMaster}'`);
    }
  });

  // Check table columns
  columns.forEach(c => {
    const keyLower = c.key.toLowerCase();
    const isMaster = MASTER_FIELD_TYPES[keyLower];
    if (isMaster && c.type !== 'masterSelect' && keyLower !== 'weight') {
      errors.push(`Column "${c.key}" must be type: 'masterSelect'`);
    }
    if (isMaster && !c.masterType && keyLower !== 'weight') {
      warnings.push(`Column "${c.key}" should have masterType: '${isMaster}'`);
    }
  });


  if (errors.length) {
    console.error('❌ ENTRY VALIDATION FAILED:', errors);
    return false;
  }
  
  if (warnings.length) {
    console.warn('⚠️ ENTRY VALIDATION WARNINGS:', warnings);
  }
  
  return true;
};

