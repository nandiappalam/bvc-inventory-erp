export const getRowsForGodown = (response, godownId) => {
  if (response?.success === false) {
    throw new Error(response.message || 'Unable to load godown stock.');
  }

  const reports = Array.isArray(response) ? response : response?.data;
  if (!Array.isArray(reports)) {
    throw new Error('The godown stock report returned an invalid response.');
  }

  const selectedReport = reports.find(report => String(report.godown_id) === String(godownId));
  return (selectedReport?.items || [])
    .filter(item => String(item.godown_id) === String(godownId))
    .map(item => ({
      ...item,
      stock_category: getStockCategory(item),
      available_qty: Number(item.available_qty ?? item.current_qty ?? item.qty) || 0
    }));
};

export const getStockCategory = (row) => {
  const name = String(row?.item_name || '').toLowerCase();
  const category = String(row?.category || row?.item_group || row?.type || '').toLowerCase();
  if (row?.has_waste_record) return 'Waste';
  if (name.includes('vacuum') || name.includes('vaccum') || category.includes('vacuum')) return 'Vacuum';
  if (row?.has_processed_record) return 'FG';
  if (
    category.includes('wastage') ||
    category.includes('waste') ||
    category.includes('reject') ||
    category.includes('scrap') ||
    category.includes('loss') ||
    (
      ['wastage', 'waste', 'husk', 'dust', 'bran', 'chuni', 'lilo', 'loss', 'reject', 'scrap']
        .some(keyword => name.includes(keyword))
    )
  ) return 'Waste';
  if (
    category === 'fg' ||
    category.includes('finished') ||
    category.includes('papad') ||
    ['papad', 'atta', 'flour', 'bgf', 'brf', 'pack']
      .some(keyword => name.includes(keyword))
  ) return 'FG';
  return 'RM';
};

export const getPurchaseLotNumber = (row) => {
  if (row?.purchase_lot_no) return row.purchase_lot_no;
  if (row?.stock_location_type === 'cold-storage') {
    return String(row.lot_no || '').replace(/^CS-/i, '') || null;
  }
  return null;
};

export const filterGodownStockRows = (rows, search, showZeroStock, category = 'All') => {
  const searchText = search.trim().toLowerCase();
  return rows.filter(row => {
    if (!showZeroStock && row.available_qty <= 0) return false;
    if (category !== 'All' && row.stock_category !== category) return false;
    if (!searchText) return true;
    return [row.item_name, row.item_code, row.lot_no, row.purchase_lot_no]
      .some(value => String(value || '').toLowerCase().includes(searchText));
  });
};
