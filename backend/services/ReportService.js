async function buildPurchaseRegister() {
  return { type: 'Purchase Register', rows: [] };
}

async function buildLedgerRegister() {
  return { type: 'Ledger Register', rows: [] };
}

module.exports = {
  buildPurchaseRegister,
  buildLedgerRegister,
};
