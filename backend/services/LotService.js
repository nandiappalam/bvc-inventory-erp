const db = require('../config/database');

async function generateLot({ prefix = 'LOT', suffix = '' } = {}) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const token = suffix ? `${prefix}${stamp}${suffix}` : `${prefix}${stamp}`;
  return token;
}

async function getLotAvailability(lotNo) {
  return {
    lotNo,
    available: 0,
    reserved: 0,
    consumed: 0,
  };
}

async function createLotRecord(payload = {}) {
  return {
    lotNo: payload.lotNo || payload.lot_no || 'LOT0000',
    ...payload,
  };
}

module.exports = {
  generateLot,
  getLotAvailability,
  createLotRecord,
};
