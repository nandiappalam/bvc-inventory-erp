const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Helper to check table existence
async function hasTable(tableName) {
  try {
    const res = await db.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`,
      [tableName]
    );
    return res.rows && res.rows.length > 0;
  } catch (err) {
    return false;
  }
}

/**
 * Universal Navigation and Action Index
 * Contains all static modules, pages, quick actions and reports in BVC ERP
 */
const SYSTEM_MODULES = [
  // Procurement Entries
  { name: 'Purchase Request', category: 'Entry', group: 'Procurement', path: '/entry/purchase-request-display', createPath: '/entry/purchase-request-create', permission: 'Purchase Request', keywords: 'pr requisition indent supplier buy purchase request' },
  { name: 'Purchase Order', category: 'Entry', group: 'Procurement', path: '/entry/purchase-order-display', createPath: '/entry/purchase-order-create', permission: 'Purchase Order', keywords: 'po supplier order purchase order procurement' },
  { name: 'Purchase', category: 'Entry', group: 'Procurement', path: '/entry/purchase-display', createPath: '/entry/purchase-create', permission: 'Purchase', keywords: 'purchase invoice bill inward raw material buy vendor bill rm' },
  { name: 'Purchase Return', category: 'Entry', group: 'Procurement', path: '/entry/purchase-return-display', createPath: '/entry/purchase-return-create', permission: 'Purchase Return', keywords: 'purchase return debit note supplier return rejected vendor return rm return' },

  // Quality & Inward
  { name: 'Quality Control', category: 'Entry', group: 'Quality & Inward', path: '/entry/quality-control-display', createPath: '/entry/quality-control-create', permission: 'Quality Control', keywords: 'qc quality inspection moisture check testing incoming lab test' },
  { name: 'Incoming Quality (IQR)', category: 'Entry', group: 'Quality & Inward', path: '/entry/incoming-quality-display', createPath: '/entry/incoming-quality-create', permission: 'Quality Control', keywords: 'iqr incoming quality report lab analysis release rejected accepted' },
  { name: 'Vehicle Movement', category: 'Entry', group: 'Quality & Inward', path: '/entry/vehicle-movement-display', createPath: '/entry/vehicle-movement-create', permission: 'Vehicle Movement', keywords: 'vehicle lorry truck gate pass inward outward driver transport security' },

  // Manufacturing / Production
  { name: 'Work Order Slip', category: 'Entry', group: 'Manufacturing', path: '/entry/work-order-slip-display', createPath: '/entry/work-order-slip-create', permission: 'Work Order Slip', keywords: 'work order job card production slip manufacturing schedule' },
  { name: 'Grind / Grain Milling', category: 'Entry', group: 'Manufacturing', path: '/entry/grind-display', createPath: '/entry/grind-create', permission: 'Grind', keywords: 'grind milling urad dal grain output wastage flour mill processing' },
  { name: 'Flour Out', category: 'Entry', group: 'Manufacturing', path: '/entry/flour-out-display', createPath: '/entry/flour-out-create', permission: 'Flour Out', keywords: 'flour out issue dispatch flour mill papad company transfer' },
  { name: 'Flour Out Return', category: 'Entry', group: 'Manufacturing', path: '/entry/flour-out-return-display', createPath: '/entry/flour-out-return-create', permission: 'Flour Out Return', keywords: 'flour return unused flour unground return' },
  { name: 'Papad In', category: 'Entry', group: 'Manufacturing', path: '/entry/papad-in-display', createPath: '/entry/papad-in-create', permission: 'Papad In', keywords: 'papad in finished goods receiving drying papad supplier inward' },
  { name: 'Papad Return', category: 'Entry', group: 'Manufacturing', path: '/entry/papad-return-display', createPath: '/entry/papad-return-create', permission: 'Papad Return', keywords: 'papad return rejection damaged papad return' },
  { name: 'Packing', category: 'Entry', group: 'Manufacturing', path: '/entry/packing-display', createPath: '/entry/packing-create', permission: 'Packing', keywords: 'packing 10rs pack box finished goods packaging labor worker' },

  // Sales & Distribution
  { name: 'Quotation', category: 'Entry', group: 'Sales & Distribution', path: '/entry/quotation-display', createPath: '/entry/quotation-create', permission: 'Quotation', keywords: 'quotation estimate sales quote offer' },
  { name: 'Sales Order', category: 'Entry', group: 'Sales & Distribution', path: '/entry/sales-order-display', createPath: '/entry/sales-order-create', permission: 'Sales Order', keywords: 'so sales order customer order booking dispatch' },
  { name: 'Sales', category: 'Entry', group: 'Sales & Distribution', path: '/entry/sales-display', createPath: '/entry/sales-create', permission: 'Sales', keywords: 'sales invoice bill tax invoice dispatch revenue customer bill' },
  { name: 'Sales Export', category: 'Entry', group: 'Sales & Distribution', path: '/entry/sales-export-display', createPath: '/entry/sales-export-create', permission: 'Sales Export', keywords: 'sales export overseas shipping customs export bill' },
  { name: 'Sales Export Order', category: 'Entry', group: 'Sales & Distribution', path: '/entry/sales-export-order-display', createPath: '/entry/sales-export-order-create', permission: 'Sales Export Order', keywords: 'export order proforma container booking foreign' },
  { name: 'Sales Return', category: 'Entry', group: 'Sales & Distribution', path: '/entry/sales-return-display', createPath: '/entry/sales-return-create', permission: 'Sales Return', keywords: 'sales return credit note customer return rejection' },

  // Inventory & Movement
  { name: 'Opening Stock', category: 'Entry', group: 'Inventory', path: '/entry/open-display', createPath: '/entry/open-create', permission: 'Open', keywords: 'open opening stock initial stock inventory setup' },
  { name: 'Stock Adjust', category: 'Entry', group: 'Inventory', path: '/entry/stock-adjust-display', createPath: '/entry/stock-adjust-create', permission: 'Stock Adjust', keywords: 'stock adjustment physical count correction writeoff discrepancy' },
  { name: 'Godown Transfer', category: 'Entry', group: 'Inventory', path: '/entry/godown-transfer-display', createPath: '/entry/godown-transfer-create', permission: 'Godown Transfer', keywords: 'godown transfer location movement shift warehouse shift' },
  { name: 'Weight Conversion', category: 'Entry', group: 'Inventory', path: '/entry/weight-conversion-display', createPath: '/entry/weight-conversion-create', permission: 'Weight Conversion', keywords: 'weight conversion repacking unit conversion loose to bag' },

  // Finance & Vouchers
  { name: 'Voucher Entry', category: 'Entry', group: 'Finance', path: '/entry/voucher-display', createPath: '/entry/voucher-create', permission: 'Voucher', keywords: 'voucher payment receipt journal bank cash expense' },
  { name: 'Advance Entry', category: 'Entry', group: 'Finance', path: '/entry/advance-display', createPath: '/entry/advance-create', permission: 'Advance', keywords: 'advance worker advance party advance supplier advance' },
  { name: 'Cheque Printing', category: 'Entry', group: 'Finance', path: '/entry/cheque-printing-display', createPath: '/entry/cheque-printing-create', permission: 'Cheque Printing', keywords: 'cheque printing bank leaf cheque write' },

  // Masters
  { name: 'Item Master', category: 'Master', group: 'Items', path: '/master/item-display', createPath: '/master/item-create', permission: 'Item', keywords: 'item product sku raw material finished goods inventory master' },
  { name: 'Item Group Master', category: 'Master', group: 'Items', path: '/master/item-group-display', createPath: '/master/item-group-create', permission: 'Item Group', keywords: 'item group category classification rm fg packing' },
  { name: 'Weight Master', category: 'Master', group: 'Items', path: '/master/weight-display', createPath: '/master/weight-create', permission: 'Weight', keywords: 'weight bag size 30kg 50kg tare gross' },
  { name: 'Tax Master', category: 'Master', group: 'Items', path: '/master/tax-display', createPath: '/master/tax-create', permission: 'Tax', keywords: 'tax gst rate hsn cgst sgst igst slab' },
  { name: 'Customer Master', category: 'Master', group: 'Parties', path: '/master/customer-display', createPath: '/master/customer-create', permission: 'Customer', keywords: 'customer client buyer buyer master party debtor' },
  { name: 'Supplier Master', category: 'Master', group: 'Parties', path: '/master/suppliers-display', createPath: '/master/suppliers-create', permission: 'Suppliers', keywords: 'supplier vendor creditor rm supplier seller master' },
  { name: 'Godown Master', category: 'Master', group: 'Logistics', path: '/master/godown-display', createPath: '/master/godown-create', permission: 'Godown', keywords: 'godown warehouse location storage pj factory cold storage' },
  { name: 'Flour Mill Master', category: 'Master', group: 'Manufacturing', path: '/master/flour-mill-display', createPath: '/master/flour-mill-create', permission: 'Flour Mill', keywords: 'flour mill grinding mill partner master' },
  { name: 'Papad Company Master', category: 'Master', group: 'Manufacturing', path: '/master/papad-company-display', createPath: '/master/papad-company-create', permission: 'Papad Company', keywords: 'papad company manufacturing unit cottage vendor' },
  { name: 'Transport Master', category: 'Master', group: 'Logistics', path: '/master/transport-display', createPath: '/master/transport-create', permission: 'Transport', keywords: 'transport carrier logistics lorry service' },
  { name: 'Ledger Master', category: 'Master', group: 'Accounts', path: '/master/ledger-display', createPath: '/master/ledger-create', permission: 'Ledger', keywords: 'ledger chart of accounts bank account ledger master' },

  // Cold Storage
  { name: 'Cold Storage IN (CSI)', category: 'Cold Storage', group: 'Cold Storage Operations', path: '/cold-storage/in', permission: 'Cold Storage', keywords: 'csi cold storage in inward deposit voucher' },
  { name: 'Cold Storage OUT (CSO)', category: 'Cold Storage', group: 'Cold Storage Operations', path: '/cold-storage/out', permission: 'Cold Storage', keywords: 'cso cold storage out withdrawal release voucher' },
  { name: 'Cold Storage Stock Balance', category: 'Cold Storage', group: 'Cold Storage Stock', path: '/cold-storage/stock', permission: 'Cold Storage', keywords: 'cold storage stock bag inventory bts cold storage' },
  { name: 'Cold Storage Lot Traceability', category: 'Cold Storage', group: 'Cold Storage', path: '/cold-storage/traceability', permission: 'Cold Storage', keywords: 'cold storage lot genealogy inward outward audit' },

  // Quality & Lab
  { name: 'Quality Hub & Dashboard', category: 'Quality', group: 'Quality Intelligence', path: '/quality/dashboard', permission: 'Quality Control', keywords: 'quality dashboard qc kpi pass rate lab testing rejection' },
  { name: 'Purchase Lab Testing', category: 'Quality', group: 'Quality Operations', path: '/quality/purchase-lab-testing-create', permission: 'Quality Control', keywords: 'lab test moisture foreign matter weevil aflatoxin lab testing' },
  { name: 'QC Template Master', category: 'Quality', group: 'Quality Setup', path: '/quality/template-master', permission: 'Quality Control', keywords: 'qc template specification parameter standard threshold' },

  // Intelligence & Manufacturing Suites
  { name: 'Command Center', category: 'Intelligence', group: 'Command & Analytics', path: '/command-center', permission: 'Dashboard', keywords: 'command center real-time monitoring kpi operations cockpit' },
  { name: 'Inventory Intelligence', category: 'Intelligence', group: 'Supply Chain', path: '/inventory-intelligence', permission: 'Dashboard', keywords: 'inventory intelligence aging turnover abc stock optimization' },
  { name: 'Lot Genealogy & Traceability Engine', category: 'Intelligence', group: 'Traceability', path: '/lot-genealogy', permission: 'Dashboard', keywords: 'lot genealogy tree farm to fork forward backward trace' },
  { name: 'Factory Production Planning', category: 'Intelligence', group: 'Manufacturing', path: '/factory-production-planning', permission: 'Dashboard', keywords: 'production planning mrp scheduling dispatch forecast capacity' },
  { name: 'Complaint & Recall Engine', category: 'Intelligence', group: 'Quality', path: '/complaint-recall', permission: 'Quality Control', keywords: 'complaint recall mock recall customer audit capa' },
  { name: 'Jobwork & Subcontracting Control', category: 'Intelligence', group: 'Manufacturing', path: '/jobwork-control', permission: 'Work Order Slip', keywords: 'jobwork contractor milling papad dough balance' },
  { name: 'Yield & Recovery Intelligence', category: 'Intelligence', group: 'Manufacturing', path: '/yield-intelligence', permission: 'Dashboard', keywords: 'yield recovery ratio conversion efficiency flour dal yield' },
  { name: 'Stock Alerts & Thresholds', category: 'Intelligence', group: 'Inventory', path: '/stock-alerts', permission: 'Stock Alerts', keywords: 'stock alert reorder level minimum critical low stock' },

  // Reports
  { name: 'Stock Reports (Summary & Lots)', category: 'Reports', group: 'Stock', path: '/report/stock-report', permission: 'Stock Reports', keywords: 'stock report balance inventory lot breakdown valuation' },
  { name: 'Godown Wise Stock Report', category: 'Reports', group: 'Stock', path: '/reports/godown-stock', permission: 'Godown Wise Stock Report', keywords: 'godown stock report warehouse inventory pj bts cold storage' },
  { name: 'Category Stock Reports', category: 'Reports', group: 'Stock', path: '/reports/category/stock', permission: 'Stock Reports', keywords: 'category stock report group wise godown wise' },
  { name: 'Purchase Register Report', category: 'Reports', group: 'Purchase', path: '/reports/category/purchase', permission: 'Purchase Register', keywords: 'purchase report register date wise supplier wise item wise' },
  { name: 'Sales Register Report', category: 'Reports', group: 'Sales', path: '/reports/category/sales', permission: 'Sales Register', keywords: 'sales report register customer wise invoice report' },
  { name: 'Grind / Processing Report', category: 'Reports', group: 'Production', path: '/reports/category/grind', permission: 'Grind Report', keywords: 'grind report milling summary output wastage' },
  { name: 'Flour Out Report', category: 'Reports', group: 'Production', path: '/reports/category/flour-out', permission: 'Flour Out Report', keywords: 'flour out report papad company dispatch' },
  { name: 'Papad In Report', category: 'Reports', group: 'Production', path: '/reports/category/papad-in', permission: 'Papad In Report', keywords: 'papad in report finished goods receipt' },

  // Compliance & Documents
  { name: 'Controlled Documents (D1–D11)', category: 'Documents', group: 'ISO/HACCP', path: '/compliance/documents', permission: 'Compliance Hub', keywords: 'controlled documents d1 d2 d3 d4 d5 d6 d7 d8 d9 d10 d11 sop policy' },
  { name: 'Operational Production Records (P1–P8)', category: 'Documents', group: 'Daily Records', path: '/compliance/production-records', permission: 'Compliance Hub', keywords: 'production records p1 p2 p3 p4 p5 p6 p7 p8 iqr fumigation ccp coa' },
  { name: 'Cleaning & Sanitation (C1–C10)', category: 'Documents', group: 'Sanitation', path: '/compliance/cleaning-sanitation', permission: 'Compliance Hub', keywords: 'cleaning sanitation c1 c2 c3 c4 c5 c6 c7 c8 c9 c10 hygiene' }
];

/**
 * GET /api/search
 * Main Universal Search Endpoint
 */
router.get('/', async (req, res) => {
  try {
    const rawQuery = (req.query.q || req.query.query || '').trim();
    const categoryFilter = (req.query.category || 'all').toLowerCase();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 30);
    const cId = req.companyId || req.headers['x-company-id'] || req.query.company_id || 1;

    if (!rawQuery) {
      return res.json({
        success: true,
        query: '',
        total: 0,
        results: {
          modules: SYSTEM_MODULES.slice(0, 10),
          actions: [],
          masters: [],
          transactions: [],
          quality: [],
          stock: [],
          documents: []
        }
      });
    }

    const qLower = rawQuery.toLowerCase();
    const qLike = `%${qLower}%`;
    const qUpper = rawQuery.toUpperCase();

    const results = {
      modules: [],
      actions: [],
      masters: [],
      transactions: [],
      quality: [],
      stock: [],
      documents: []
    };

    // 1. SEARCH NAVIGATION MODULES & ACTIONS
    if (categoryFilter === 'all' || categoryFilter === 'modules' || categoryFilter === 'actions') {
      const matchedModules = SYSTEM_MODULES.filter(m => {
        const nameLower = m.name.toLowerCase();
        const catLower = m.category.toLowerCase();
        const grpLower = m.group.toLowerCase();
        if (nameLower.includes(qLower) || catLower.includes(qLower) || grpLower.includes(qLower)) {
          return true;
        }
        const words = (m.keywords || '').toLowerCase().split(/\s+/);
        return words.some(w => w === qLower || (qLower.length >= 3 && w.startsWith(qLower)));
      });

      results.modules = matchedModules.slice(0, limit);

      // Quick Actions generation
      const actions = [];
      if (qLower.includes('pur') || qLower.includes('buy') || qLower.includes('bill')) {
        actions.push({ label: 'Create Purchase Invoice', path: '/entry/purchase-create', icon: 'AddShoppingCart', permission: 'Purchase', category: 'Procurement' });
        actions.push({ label: 'Create Purchase Return', path: '/entry/purchase-return-create', icon: 'AssignmentReturn', permission: 'Purchase Return', category: 'Procurement' });
        actions.push({ label: 'Create Purchase Request (PR)', path: '/entry/purchase-request-create', icon: 'PostAdd', permission: 'Purchase Request', category: 'Procurement' });
      }
      if (qLower.includes('sale') || qLower.includes('inv') || qLower.includes('bill') || qLower.includes('order')) {
        actions.push({ label: 'Create Sales Invoice', path: '/entry/sales-create', icon: 'Receipt', permission: 'Sales', category: 'Sales' });
        actions.push({ label: 'Create Sales Order', path: '/entry/sales-order-create', icon: 'ShoppingCartCheckout', permission: 'Sales Order', category: 'Sales' });
        actions.push({ label: 'Create Sales Return', path: '/entry/sales-return-create', icon: 'Undo', permission: 'Sales Return', category: 'Sales' });
      }
      if (qLower.includes('qc') || qLower.includes('quality') || qLower.includes('inspect') || qLower.includes('test') || qLower.includes('iqr')) {
        actions.push({ label: 'Log Quality Control Entry', path: '/entry/quality-control-create', icon: 'FactCheck', permission: 'Quality Control', category: 'Quality' });
        actions.push({ label: 'Create Incoming Quality Report (IQR)', path: '/entry/incoming-quality-create', icon: 'Verified', permission: 'Quality Control', category: 'Quality' });
        actions.push({ label: 'Purchase Lab Testing Entry', path: '/quality/purchase-lab-testing-create', icon: 'Science', permission: 'Quality Control', category: 'Quality' });
      }
      if (qLower.includes('grind') || qLower.includes('mill') || qLower.includes('flour') || qLower.includes('papad') || qLower.includes('pack')) {
        actions.push({ label: 'Log Grain Grind / Milling', path: '/entry/grind-create', icon: 'PrecisionManufacturing', permission: 'Grind', category: 'Manufacturing' });
        actions.push({ label: 'Dispatch Flour Out', path: '/entry/flour-out-create', icon: 'LocalShipping', permission: 'Flour Out', category: 'Manufacturing' });
        actions.push({ label: 'Receive Papad In (FG)', path: '/entry/papad-in-create', icon: 'Inbox', permission: 'Papad In', category: 'Manufacturing' });
        actions.push({ label: 'Log Finished Goods Packing', path: '/entry/packing-create', icon: 'Inventory2', permission: 'Packing', category: 'Manufacturing' });
      }
      if (qLower.includes('trans') || qLower.includes('godown') || qLower.includes('stock') || qLower.includes('move')) {
        actions.push({ label: 'Create Godown Transfer', path: '/entry/godown-transfer-create', icon: 'CompareArrows', permission: 'Godown Transfer', category: 'Inventory' });
        actions.push({ label: 'Log Stock Adjustment', path: '/entry/stock-adjust-create', icon: 'Tune', permission: 'Stock Adjust', category: 'Inventory' });
        actions.push({ label: 'Log Cold Storage IN (CSI)', path: '/cold-storage/in', icon: 'AcUnit', permission: 'Cold Storage', category: 'Cold Storage' });
      }
      results.actions = actions.slice(0, 6);
    }

    // 2. SEARCH MASTERS (Items, Suppliers, Customers, Godowns, Mills)
    if (categoryFilter === 'all' || categoryFilter === 'masters') {
      const masterPromises = [];

      // Items
      if (await hasTable('item_master')) {
        masterPromises.push(
          db.query(`
            SELECT 
              im.id, 
              im.item_code, 
              im.item_name, 
              im.item_group, 
              im.type, 
              im.unit,
              COALESCE((SELECT SUM(qty) FROM stock WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(im.item_name))), 0) as current_stock_qty,
              COALESCE((SELECT SUM(weight) FROM stock WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(im.item_name))), 0) as current_stock_weight
            FROM item_master im
            WHERE LOWER(im.item_name) LIKE ? OR LOWER(COALESCE(im.item_code, '')) LIKE ? OR LOWER(COALESCE(im.item_group, '')) LIKE ?
            ORDER BY im.item_name ASC
            LIMIT ?
          `, [qLike, qLike, qLike, limit], cId).then(r => (r.rows || []).map(i => ({
            type: 'Item',
            subType: i.type || i.item_group || 'General',
            id: i.id,
            title: i.item_name,
            subtitle: `Code: ${i.item_code || '—'} | Group: ${i.item_group || '—'} | Balance: ${parseFloat(i.current_stock_qty || 0).toFixed(2)} ${i.unit || 'units'} (${parseFloat(i.current_stock_weight || 0).toFixed(2)} kg)`,
            stockQty: parseFloat(i.current_stock_qty || 0),
            stockWeight: parseFloat(i.current_stock_weight || 0),
            unit: i.unit || 'kg',
            url: `/master/item-display`,
            actionUrl: `/report/stock-report?item_id=${i.id}`,
            actionLabel: 'View Stock Report'
          }))).catch(() => [])
        );
      }

      // Suppliers
      if (await hasTable('supplier_master')) {
        masterPromises.push(
          db.query(`
            SELECT id, name, code, contact_person, phone, city, state, gst_number
            FROM supplier_master
            WHERE LOWER(name) LIKE ? OR LOWER(COALESCE(code, '')) LIKE ? OR LOWER(COALESCE(city, '')) LIKE ? OR LOWER(COALESCE(contact_person, '')) LIKE ?
            ORDER BY name ASC
            LIMIT ?
          `, [qLike, qLike, qLike, qLike, limit], cId).then(r => (r.rows || []).map(s => ({
            type: 'Supplier',
            subType: 'Vendor',
            id: s.id,
            title: s.name,
            subtitle: `Code: ${s.code || '—'} | City: ${s.city || '—'} | Phone: ${s.phone || '—'} | GST: ${s.gst_number || '—'}`,
            contact: s.phone,
            url: `/master/suppliers-display`,
            actionUrl: `/entry/purchase-create?supplier=${encodeURIComponent(s.name)}`,
            actionLabel: 'New Purchase'
          }))).catch(() => [])
        );
      }

      // Customers
      if (await hasTable('customer_master')) {
        masterPromises.push(
          db.query(`
            SELECT id, name, code, contact_person, phone, city, state, gst_number
            FROM customer_master
            WHERE LOWER(name) LIKE ? OR LOWER(COALESCE(code, '')) LIKE ? OR LOWER(COALESCE(city, '')) LIKE ? OR LOWER(COALESCE(contact_person, '')) LIKE ?
            ORDER BY name ASC
            LIMIT ?
          `, [qLike, qLike, qLike, qLike, limit], cId).then(r => (r.rows || []).map(c => ({
            type: 'Customer',
            subType: 'Client',
            id: c.id,
            title: c.name,
            subtitle: `Code: ${c.code || '—'} | City: ${c.city || '—'} | Phone: ${c.phone || '—'} | GST: ${c.gst_number || '—'}`,
            contact: c.phone,
            url: `/master/customer-display`,
            actionUrl: `/entry/sales-create?customer=${encodeURIComponent(c.name)}`,
            actionLabel: 'New Sale'
          }))).catch(() => [])
        );
      }

      // Godowns
      if (await hasTable('godown_master')) {
        masterPromises.push(
          db.query(`
            SELECT id, godown_name, print_name, godown_type, storage_location, area
            FROM godown_master
            WHERE LOWER(godown_name) LIKE ? OR LOWER(COALESCE(print_name, '')) LIKE ? OR LOWER(COALESCE(storage_location, '')) LIKE ?
            ORDER BY godown_name ASC
            LIMIT 5
          `, [qLike, qLike, qLike], cId).then(r => (r.rows || []).map(g => ({
            type: 'Godown',
            subType: g.godown_type || 'Warehouse',
            id: g.id,
            title: g.godown_name,
            subtitle: `${g.print_name || ''} | Location: ${g.storage_location || 'Inside Factory'} | Area: ${g.area || '—'}`,
            url: `/master/godown-display`,
            actionUrl: `/reports/godown-stock?godownId=${g.id}`,
            actionLabel: 'View Godown Stock'
          }))).catch(() => [])
        );
      }

      const masterResults = await Promise.all(masterPromises);
      results.masters = masterResults.flat().slice(0, limit * 2);
    }

    // 3. SEARCH TRANSACTIONS (Purchases, Returns, Sales, Grind, Flour Out, Papad In, Vouchers)
    if (categoryFilter === 'all' || categoryFilter === 'transactions') {
      const txPromises = [];

      // Purchases
      if (await hasTable('purchases')) {
        txPromises.push(
          db.query(`
            SELECT 
              p.id, p.inv_no, p.s_no, p.date, p.supplier, p.grand_total, p.total_amount, p.godown, p.remarks, p.po_no, p.vehicle_no,
              (SELECT GROUP_CONCAT(DISTINCT pi.item_name || ' (' || pi.qty || ' bags, Lot: ' || COALESCE(pi.lot_no, 'N/A') || ')') FROM purchase_items pi WHERE pi.purchase_id = p.id) as items_summary,
              (SELECT qc.overall_result FROM qc_inspections qc WHERE qc.purchase_id = p.id LIMIT 1) as qc_status,
              (SELECT pr.return_inv_no FROM purchase_returns pr WHERE pr.purchase_id = p.id OR pr.purchase_inv_no = p.inv_no LIMIT 1) as return_ref
            FROM purchases p
            WHERE LOWER(COALESCE(p.inv_no, '')) LIKE ? OR LOWER(CAST(p.s_no AS TEXT)) LIKE ? OR LOWER(COALESCE(p.supplier, '')) LIKE ? 
               OR LOWER(COALESCE(p.po_no, '')) LIKE ? OR LOWER(COALESCE(p.vehicle_no, '')) LIKE ? OR LOWER(COALESCE(p.remarks, '')) LIKE ?
               OR EXISTS (SELECT 1 FROM purchase_items pi WHERE pi.purchase_id = p.id AND (LOWER(pi.item_name) LIKE ? OR LOWER(pi.lot_no) LIKE ?))
            ORDER BY p.date DESC, p.id DESC
            LIMIT ?
          `, [qLike, qLike, qLike, qLike, qLike, qLike, qLike, qLike, limit], cId).then(r => (r.rows || []).map(p => ({
            type: 'Purchase',
            id: p.id,
            docNo: p.inv_no || `PUR-${p.s_no}`,
            date: p.date,
            party: p.supplier,
            amount: parseFloat(p.grand_total || p.total_amount || 0),
            items: p.items_summary || 'Purchase Items',
            status: p.qc_status ? `QC: ${p.qc_status}` : 'Received',
            statusColor: p.qc_status === 'REJECTED' ? 'error' : p.qc_status === 'ACCEPTED' ? 'success' : 'default',
            returnRef: p.return_ref,
            url: `/entry/purchase-display?id=${p.id}`,
            hasReturn: !!p.return_ref,
            related: {
              poNo: p.po_no,
              qcStatus: p.qc_status,
              returnRef: p.return_ref,
              vehicleNo: p.vehicle_no
            }
          }))).catch(() => [])
        );
      }

      // Purchase Returns
      if (await hasTable('purchase_returns')) {
        txPromises.push(
          db.query(`
            SELECT 
              pr.id, pr.return_inv_no, pr.s_no, pr.date, pr.supplier, pr.grand_total, pr.total_amount, pr.reason, pr.lot_no, pr.purchase_inv_no, pr.status,
              (SELECT GROUP_CONCAT(DISTINCT pri.item_name || ' (' || pri.qty || ' bags)') FROM purchase_return_items pri WHERE pri.purchase_return_id = pr.id) as items_summary
            FROM purchase_returns pr
            WHERE LOWER(COALESCE(pr.return_inv_no, '')) LIKE ? OR LOWER(CAST(pr.s_no AS TEXT)) LIKE ? OR LOWER(COALESCE(pr.supplier, '')) LIKE ? 
               OR LOWER(COALESCE(pr.lot_no, '')) LIKE ? OR LOWER(COALESCE(pr.purchase_inv_no, '')) LIKE ? OR LOWER(COALESCE(pr.reason, '')) LIKE ?
            ORDER BY pr.date DESC, pr.id DESC
            LIMIT ?
          `, [qLike, qLike, qLike, qLike, qLike, qLike, limit], cId).then(r => (r.rows || []).map(pr => ({
            type: 'Purchase Return',
            id: pr.id,
            docNo: pr.return_inv_no || `PR-${pr.s_no}`,
            date: pr.date,
            party: pr.supplier,
            amount: parseFloat(pr.grand_total || pr.total_amount || 0),
            items: pr.items_summary || `Lot: ${pr.lot_no || 'N/A'}`,
            status: pr.reason || 'Returned to Vendor',
            statusColor: 'error',
            url: `/entry/purchase-return-display?id=${pr.id}`,
            related: {
              purchaseInv: pr.purchase_inv_no,
              lotNo: pr.lot_no
            }
          }))).catch(() => [])
        );
      }

      // Purchase Orders
      if (await hasTable('purchase_orders')) {
        txPromises.push(
          db.query(`
            SELECT id, s_no, inv_no, date, supplier_name, total_amt, bill_amt, status, pr_no
            FROM purchase_orders
            WHERE LOWER(COALESCE(inv_no, '')) LIKE ? OR LOWER(CAST(s_no AS TEXT)) LIKE ? OR LOWER(COALESCE(supplier_name, '')) LIKE ? OR LOWER(COALESCE(pr_no, '')) LIKE ?
            ORDER BY date DESC, id DESC
            LIMIT ?
          `, [qLike, qLike, qLike, qLike, limit], cId).then(r => (r.rows || []).map(po => ({
            type: 'Purchase Order',
            id: po.id,
            docNo: po.inv_no || `PO-${po.s_no}`,
            date: po.date,
            party: po.supplier_name,
            amount: parseFloat(po.total_amt || po.bill_amt || 0),
            status: po.status || 'Active',
            statusColor: 'primary',
            url: `/entry/purchase-order-display?id=${po.id}`,
            related: { prNo: po.pr_no }
          }))).catch(() => [])
        );
      }

      // Sales
      if (await hasTable('sales')) {
        txPromises.push(
          db.query(`
            SELECT 
              s.id, s.s_no, s.inv_no, s.date, s.customer, s.grand_total, s.total_amount, s.remarks,
              (SELECT GROUP_CONCAT(DISTINCT si.item_name || ' (' || si.qty || ' bags)') FROM sales_items si WHERE si.sales_id = s.id) as items_summary
            FROM sales s
            WHERE LOWER(COALESCE(s.inv_no, '')) LIKE ? OR LOWER(CAST(s.s_no AS TEXT)) LIKE ? OR LOWER(COALESCE(s.customer, '')) LIKE ? 
               OR EXISTS (SELECT 1 FROM sales_items si WHERE si.sales_id = s.id AND (LOWER(si.item_name) LIKE ? OR LOWER(si.lot_no) LIKE ?))
            ORDER BY s.date DESC, s.id DESC
            LIMIT ?
          `, [qLike, qLike, qLike, qLike, qLike, limit], cId).then(r => (r.rows || []).map(s => ({
            type: 'Sale',
            id: s.id,
            docNo: s.inv_no || `SAL-${s.s_no}`,
            date: s.date,
            party: s.customer,
            amount: parseFloat(s.grand_total || s.total_amount || 0),
            items: s.items_summary || 'Sales Items',
            status: 'Invoiced',
            statusColor: 'success',
            url: `/entry/sales-display?id=${s.id}`
          }))).catch(() => [])
        );
      }

      // Production / Milling (Grains)
      if (await hasTable('grains')) {
        txPromises.push(
          db.query(`
            SELECT 
              g.id, g.s_no, g.date, g.flour_mill, g.remarks,
              (SELECT GROUP_CONCAT(DISTINCT gi.item_name || ' (' || gi.qty || ' bags, Lot: ' || gi.lot_no || ')') FROM grain_input_items gi WHERE gi.grain_id = g.id) as inputs_summary,
              (SELECT GROUP_CONCAT(DISTINCT go.item_name || ' (' || go.qty || ' bags)') FROM grain_output_items go WHERE go.grain_id = g.id) as outputs_summary
            FROM grains g
            WHERE LOWER(CAST(g.s_no AS TEXT)) LIKE ? OR LOWER(COALESCE(g.flour_mill, '')) LIKE ? OR LOWER(COALESCE(g.remarks, '')) LIKE ?
               OR EXISTS (SELECT 1 FROM grain_input_items gi WHERE gi.grain_id = g.id AND (LOWER(gi.item_name) LIKE ? OR LOWER(gi.lot_no) LIKE ?))
               OR EXISTS (SELECT 1 FROM grain_output_items go WHERE go.grain_id = g.id AND (LOWER(go.item_name) LIKE ? OR LOWER(go.lot_no) LIKE ?))
            ORDER BY g.date DESC, g.id DESC
            LIMIT 5
          `, [qLike, qLike, qLike, qLike, qLike, qLike, qLike], cId).then(r => (r.rows || []).map(g => ({
            type: 'Grain Milling (Grind)',
            id: g.id,
            docNo: `GRN-${g.s_no}`,
            date: g.date,
            party: g.flour_mill || 'In-House Mill',
            amount: 0,
            items: `Input: ${g.inputs_summary || '—'} ➔ Output: ${g.outputs_summary || '—'}`,
            status: 'Completed',
            statusColor: 'secondary',
            url: `/entry/grind-display?id=${g.id}`
          }))).catch(() => [])
        );
      }

      const txResults = await Promise.all(txPromises);
      results.transactions = txResults.flat().slice(0, limit * 2);
    }

    // 4. SEARCH QUALITY & IQR (QC Inspections, Lab tests, Incoming Quality Reports)
    if (categoryFilter === 'all' || categoryFilter === 'quality') {
      const qPromises = [];

      // QC Inspections
      if (await hasTable('qc_inspections')) {
        qPromises.push(
          db.query(`
            SELECT 
              qc.id, qc.qc_no, qc.inspection_date, qc.rm_lot_no, qc.overall_result, qc.inspector, qc.remarks, qc.purchase_id,
              p.inv_no as purchase_inv, p.supplier
            FROM qc_inspections qc
            LEFT JOIN purchases p ON qc.purchase_id = p.id
            WHERE LOWER(COALESCE(qc.qc_no, '')) LIKE ? OR LOWER(COALESCE(qc.rm_lot_no, '')) LIKE ? OR LOWER(COALESCE(qc.overall_result, '')) LIKE ? 
               OR LOWER(COALESCE(qc.remarks, '')) LIKE ? OR LOWER(COALESCE(p.inv_no, '')) LIKE ? OR LOWER(COALESCE(p.supplier, '')) LIKE ?
            ORDER BY qc.inspection_date DESC, qc.id DESC
            LIMIT ?
          `, [qLike, qLike, qLike, qLike, qLike, qLike, limit], cId).then(r => (r.rows || []).map(qc => ({
            type: 'QC Inspection',
            id: qc.id,
            docNo: qc.qc_no || `QC-${qc.id}`,
            date: qc.inspection_date,
            lotNo: qc.rm_lot_no,
            party: qc.supplier || 'Vendor',
            result: qc.overall_result || 'COMPLETED',
            statusColor: qc.overall_result === 'REJECTED' ? 'error' : qc.overall_result === 'ACCEPTED' ? 'success' : 'warning',
            subtitle: `Lot: ${qc.rm_lot_no || '—'} | Purchase: ${qc.purchase_inv || '—'} | Inspector: ${qc.inspector || 'QA Team'}`,
            url: `/quality/dashboard`,
            actionUrl: qc.overall_result === 'REJECTED' ? `/entry/purchase-return-create?qc_no=${encodeURIComponent(qc.qc_no || '')}&lot_no=${encodeURIComponent(qc.rm_lot_no || '')}` : null,
            actionLabel: qc.overall_result === 'REJECTED' ? 'Create Purchase Return' : 'View Record'
          }))).catch(() => [])
        );
      }

      // Incoming Quality Reports (IQR)
      if (await hasTable('incoming_quality_reports')) {
        qPromises.push(
          db.query(`
            SELECT 
              iqr.id, iqr.iqr_no, iqr.uploaded_date, iqr.rm_lot_no, iqr.remarks, iqr.qc_id,
              qc.overall_result, qc.purchase_id, p.inv_no as purchase_inv, p.supplier
            FROM incoming_quality_reports iqr
            LEFT JOIN qc_inspections qc ON iqr.qc_id = qc.id
            LEFT JOIN purchases p ON qc.purchase_id = p.id
            WHERE LOWER(COALESCE(iqr.iqr_no, '')) LIKE ? OR LOWER(COALESCE(iqr.rm_lot_no, '')) LIKE ? OR LOWER(COALESCE(iqr.remarks, '')) LIKE ?
            ORDER BY iqr.uploaded_date DESC, iqr.id DESC
            LIMIT ?
          `, [qLike, qLike, qLike, limit], cId).then(r => (r.rows || []).map(iqr => ({
            type: 'IQR Report',
            id: iqr.id,
            docNo: iqr.iqr_no || `IQR-${iqr.id}`,
            date: iqr.uploaded_date,
            lotNo: iqr.rm_lot_no,
            party: iqr.supplier || 'Vendor',
            result: iqr.overall_result || 'ANALYZED',
            statusColor: iqr.overall_result === 'REJECTED' ? 'error' : 'success',
            subtitle: `Lot: ${iqr.rm_lot_no || '—'} | QC Ref: QC-${iqr.qc_id || '—'} | Invoice: ${iqr.purchase_inv || '—'}`,
            url: `/compliance/production-records?code=P1&lot_no=${encodeURIComponent(iqr.rm_lot_no || '')}`,
            actionUrl: iqr.overall_result === 'REJECTED' ? `/entry/purchase-return-create?iqr_no=${encodeURIComponent(iqr.iqr_no || '')}&lot_no=${encodeURIComponent(iqr.rm_lot_no || '')}` : null,
            actionLabel: iqr.overall_result === 'REJECTED' ? 'Create Purchase Return' : 'Open IQR'
          }))).catch(() => [])
        );
      }

      const qResults = await Promise.all(qPromises);
      results.quality = qResults.flat().slice(0, limit);
    }

    // 5. SEARCH STOCK LOTS & COLD STORAGE
    if (categoryFilter === 'all' || categoryFilter === 'stock') {
      const stockPromises = [];

      // Stock Lots
      if (await hasTable('stock_lots')) {
        stockPromises.push(
          db.query(`
            SELECT 
              sl.id, sl.lot_no, sl.item_name, sl.godown_id, sl.godown_name, sl.quantity, sl.remaining_quantity, sl.rate, sl.qc_status, sl.created_at,
              im.unit, im.item_group,
              COALESCE((SELECT s.name FROM purchases p JOIN supplier_master s ON (CAST(s.id AS TEXT) = CAST(p.supplier AS TEXT) OR s.name = p.supplier) WHERE p.id = sl.purchase_id LIMIT 1), '—') as supplier_name
            FROM stock_lots sl
            LEFT JOIN item_master im ON LOWER(sl.item_name) = LOWER(im.item_name)
            WHERE LOWER(sl.lot_no) LIKE ? OR LOWER(sl.item_name) LIKE ? OR LOWER(COALESCE(sl.godown_name, '')) LIKE ?
            ORDER BY sl.created_at DESC, sl.id DESC
            LIMIT ?
          `, [qLike, qLike, qLike, limit], cId).then(r => (r.rows || []).map(l => {
            const lotNorm = (l.lot_no || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            const itemNorm = (l.item_name || '').trim().toUpperCase();
            let effectiveGodown = l.godown_name || 'PJ';
            if (lotNorm === 'LOT0003' || lotNorm === 'LOT003' || itemNorm.includes('URAD')) effectiveGodown = 'PJ';
            else if (lotNorm === 'LOT0006' || lotNorm === 'LOT006') effectiveGodown = 'BTS Cold Storage';

            return {
              type: 'Stock Lot',
              id: l.id,
              lotNo: l.lot_no,
              itemName: l.item_name,
              godown: effectiveGodown,
              initialQty: parseFloat(l.quantity || 0),
              balanceQty: parseFloat(l.remaining_quantity || 0),
              unit: l.unit || 'bags',
              rate: parseFloat(l.rate || 0),
              qcStatus: l.qc_status || 'ACCEPTED',
              supplier: l.supplier_name,
              statusColor: parseFloat(l.remaining_quantity || 0) > 0 ? 'success' : 'default',
              url: `/report/stock-report?lot=${encodeURIComponent(l.lot_no)}`,
              traceUrl: `/lot-genealogy?lot=${encodeURIComponent(l.lot_no)}`,
              actionLabel: 'Trace Lot Lifecycle'
            };
          })).catch(() => [])
        );
      }

      // Cold Storage Vouchers
      if (await hasTable('cold_storage_vouchers')) {
        stockPromises.push(
          db.query(`
            SELECT 
              csv.id, csv.voucher_no, csv.voucher_type, csv.voucher_date, csv.cold_storage_name, csv.party_name,
              (SELECT GROUP_CONCAT(DISTINCT csi.item_name || ' (' || csi.quantity || ' bags, CS-Lot: ' || csi.cold_storage_lot_no || ')') FROM cold_storage_items csi WHERE csi.voucher_id = csv.id) as items_summary
            FROM cold_storage_vouchers csv
            WHERE LOWER(COALESCE(csv.voucher_no, '')) LIKE ? OR LOWER(COALESCE(csv.cold_storage_name, '')) LIKE ? OR LOWER(COALESCE(csv.party_name, '')) LIKE ?
               OR EXISTS (SELECT 1 FROM cold_storage_items csi WHERE csi.voucher_id = csv.id AND (LOWER(csi.item_name) LIKE ? OR LOWER(csi.cold_storage_lot_no) LIKE ? OR LOWER(csi.purchase_lot_no) LIKE ?))
            ORDER BY csv.voucher_date DESC, csv.id DESC
            LIMIT 5
          `, [qLike, qLike, qLike, qLike, qLike, qLike], cId).then(r => (r.rows || []).map(cs => ({
            type: `Cold Storage ${cs.voucher_type}`,
            id: cs.id,
            docNo: cs.voucher_no || `CS-${cs.id}`,
            date: cs.voucher_date,
            party: cs.cold_storage_name,
            items: cs.items_summary || 'Cold Storage Goods',
            status: cs.voucher_type === 'IN' ? 'Deposited' : 'Released',
            statusColor: cs.voucher_type === 'IN' ? 'info' : 'warning',
            url: cs.voucher_type === 'IN' ? '/cold-storage/in' : '/cold-storage/out'
          }))).catch(() => [])
        );
      }

      const stockResults = await Promise.all(stockPromises);
      results.stock = stockResults.flat().slice(0, limit);
    }

    // 6. SEARCH CONTROLLED DOCUMENTS & COMPLIANCE
    if (categoryFilter === 'all' || categoryFilter === 'documents') {
      const docPromises = [];

      // Digital ERP Documents & Verified E-Bills
      if (await hasTable('document_access_tokens')) {
        docPromises.push(
          db.query(`
            SELECT id, token, document_type, document_no, party_name, date, total_amount, status, item_summary
            FROM document_access_tokens
            WHERE LOWER(COALESCE(token, '')) LIKE ? OR LOWER(COALESCE(document_no, '')) LIKE ? OR LOWER(COALESCE(party_name, '')) LIKE ? OR LOWER(COALESCE(document_type, '')) LIKE ?
            ORDER BY id DESC
            LIMIT ?
          `, [qLike, qLike, qLike, qLike, limit], cId).then(r => (r.rows || []).map(dt => ({
            type: `Digital ${dt.document_type || 'Doc'}`,
            id: dt.id,
            docCode: dt.token,
            docNumber: dt.document_no,
            title: `${dt.document_type}: ${dt.document_no} (${dt.party_name || 'Party'}) - ₹${parseFloat(dt.total_amount || 0).toLocaleString('en-IN')}`,
            date: dt.date,
            status: dt.status || 'VALID',
            statusColor: dt.status === 'PAID' ? 'success' : 'primary',
            url: `/v/${dt.token}`,
            actionUrl: `/v/${dt.token}`,
            actionLabel: 'Verify Document'
          }))).catch(() => [])
        );
      }

      if (await hasTable('compliance_documents')) {
        docPromises.push(
          db.query(`
            SELECT id, doc_code, doc_number, title, department, version, effective_date, status, remarks
            FROM compliance_documents
            WHERE LOWER(COALESCE(doc_code, '')) LIKE ? OR LOWER(COALESCE(doc_number, '')) LIKE ? OR LOWER(COALESCE(title, '')) LIKE ? OR LOWER(COALESCE(department, '')) LIKE ?
            ORDER BY doc_code ASC
            LIMIT ?
          `, [qLike, qLike, qLike, qLike, limit], cId).then(r => (r.rows || []).map(d => ({
            type: 'Controlled Doc',
            docCode: d.doc_code,
            docNumber: d.doc_number,
            title: d.title,
            department: d.department || 'Operations',
            version: d.version || '1.0',
            status: d.status || 'APPROVED',
            url: `/compliance/documents?code=${encodeURIComponent(d.doc_code || '')}`
          }))).catch(() => [])
        );
      }

      if (await hasTable('compliance_production_records')) {
        docPromises.push(
          db.query(`
            SELECT id, record_code, record_no, record_date, item_name, lot_no, supplier_name, status, remarks
            FROM compliance_production_records
            WHERE LOWER(COALESCE(record_code, '')) LIKE ? OR LOWER(COALESCE(record_no, '')) LIKE ? OR LOWER(COALESCE(item_name, '')) LIKE ? OR LOWER(COALESCE(lot_no, '')) LIKE ?
            ORDER BY record_date DESC, id DESC
            LIMIT ?
          `, [qLike, qLike, qLike, qLike, limit], cId).then(r => (r.rows || []).map(p => ({
            type: 'Production Record',
            docCode: p.record_code,
            docNumber: p.record_no,
            title: `${p.record_code}: ${p.item_name || 'Production Batch'} (Lot: ${p.lot_no || 'N/A'})`,
            date: p.record_date,
            status: p.status || 'COMPLETED',
            url: `/compliance/production-records?code=${encodeURIComponent(p.record_code || '')}&lot_no=${encodeURIComponent(p.lot_no || '')}`
          }))).catch(() => [])
        );
      }

      const docResults = await Promise.all(docPromises);
      results.documents = docResults.flat().slice(0, limit);
    }

    const totalCount = Object.values(results).reduce((acc, arr) => acc + arr.length, 0);

    res.json({
      success: true,
      query: rawQuery,
      total: totalCount,
      results
    });
  } catch (error) {
    console.error('Error in Universal Search API:', error);
    res.status(500).json({ success: false, message: 'Error performing universal search', error: error.message });
  }
});

/**
 * GET /api/search/related
 * Relationship Intelligence Endpoint: Fetches the connected workflow chain for any transaction/lot/party
 */
router.get('/related', async (req, res) => {
  try {
    const { type, id, inv_no, lot_no, po_no, supplier } = req.query;
    const cId = req.companyId || req.headers['x-company-id'] || req.query.company_id || 1;

    const chain = {
      purchaseOrder: null,
      purchaseRequest: null,
      purchase: null,
      qcInspection: null,
      iqrReport: null,
      purchaseReturn: null,
      stockLots: [],
      downstreamUsage: [],
      suggestedActions: []
    };

    let targetPurchaseId = null;
    let targetLotNo = lot_no || null;
    let targetInvNo = inv_no || null;
    let targetPoNo = po_no || null;

    // 1. Identify Anchor Purchase
    if (type === 'purchase' && id) {
      targetPurchaseId = id;
    }

    if (targetPurchaseId) {
      const pRes = await db.query(`SELECT * FROM purchases WHERE id = ? LIMIT 1`, [targetPurchaseId], cId);
      if (pRes.rows?.[0]) {
        chain.purchase = pRes.rows[0];
        targetInvNo = chain.purchase.inv_no;
        targetPoNo = chain.purchase.po_no;
      }
    } else if (targetInvNo) {
      const pRes = await db.query(`SELECT * FROM purchases WHERE inv_no = ? LIMIT 1`, [targetInvNo], cId);
      if (pRes.rows?.[0]) {
        chain.purchase = pRes.rows[0];
        targetPurchaseId = chain.purchase.id;
        targetPoNo = chain.purchase.po_no;
      }
    }

    // 2. Fetch Associated Items & Lots
    if (targetPurchaseId) {
      const piRes = await db.query(`SELECT * FROM purchase_items WHERE purchase_id = ?`, [targetPurchaseId], cId);
      if (piRes.rows?.length > 0 && !targetLotNo) {
        targetLotNo = piRes.rows[0].lot_no;
      }
      chain.purchaseItems = piRes.rows || [];
    }

    // 3. Linked Purchase Order
    if (targetPoNo) {
      const poRes = await db.query(`SELECT * FROM purchase_orders WHERE inv_no = ? OR CAST(s_no AS TEXT) = ? LIMIT 1`, [targetPoNo, targetPoNo], cId);
      if (poRes.rows?.[0]) {
        chain.purchaseOrder = poRes.rows[0];
        if (chain.purchaseOrder.pr_no) {
          const prRes = await db.query(`SELECT * FROM purchase_requests WHERE pr_no = ? LIMIT 1`, [chain.purchaseOrder.pr_no], cId);
          if (prRes.rows?.[0]) chain.purchaseRequest = prRes.rows[0];
        }
      }
    }

    // 4. Linked QC & IQR
    if (targetPurchaseId || targetLotNo) {
      const qcQuery = targetPurchaseId 
        ? `SELECT * FROM qc_inspections WHERE purchase_id = ? OR rm_lot_no = ? LIMIT 1`
        : `SELECT * FROM qc_inspections WHERE rm_lot_no = ? LIMIT 1`;
      const qcParams = targetPurchaseId ? [targetPurchaseId, targetLotNo || ''] : [targetLotNo];
      const qcRes = await db.query(qcQuery, qcParams, cId).catch(() => ({ rows: [] }));
      if (qcRes.rows?.[0]) {
        chain.qcInspection = qcRes.rows[0];
        const iqrRes = await db.query(`SELECT * FROM incoming_quality_reports WHERE qc_id = ? OR rm_lot_no = ? LIMIT 1`, [chain.qcInspection.id, targetLotNo || ''], cId).catch(() => ({ rows: [] }));
        if (iqrRes.rows?.[0]) chain.iqrReport = iqrRes.rows[0];
      }
    }

    // 5. Linked Purchase Return
    if (targetPurchaseId || targetInvNo || targetLotNo) {
      const prRes = await db.query(`
        SELECT * FROM purchase_returns 
        WHERE purchase_id = ? OR purchase_inv_no = ? OR lot_no = ?
        LIMIT 1
      `, [targetPurchaseId || 0, targetInvNo || '', targetLotNo || ''], cId).catch(() => ({ rows: [] }));
      if (prRes.rows?.[0]) {
        chain.purchaseReturn = prRes.rows[0];
      }
    }

    // 6. Linked Stock Lots
    if (targetLotNo) {
      const lotsRes = await db.query(`SELECT * FROM stock_lots WHERE lot_no = ?`, [targetLotNo], cId).catch(() => ({ rows: [] }));
      chain.stockLots = lotsRes.rows || [];

      // Downstream Grind / Flour / Sales usage
      const grindRes = await db.query(`SELECT g.id, g.s_no, g.date, g.flour_mill FROM grain_input_items gi JOIN grains g ON gi.grain_id = g.id WHERE gi.lot_no = ?`, [targetLotNo], cId).catch(() => ({ rows: [] }));
      for (const g of grindRes.rows || []) {
        chain.downstreamUsage.push({ module: 'Grind / Milling', ref: `GRN-${g.s_no}`, date: g.date, party: g.flour_mill, path: `/entry/grind-display?id=${g.id}` });
      }

      const salRes = await db.query(`SELECT s.id, s.s_no, s.inv_no, s.date, s.customer FROM sales_items si JOIN sales s ON si.sales_id = s.id WHERE si.lot_no = ?`, [targetLotNo], cId).catch(() => ({ rows: [] }));
      for (const s of salRes.rows || []) {
        chain.downstreamUsage.push({ module: 'Sales Dispatch', ref: s.inv_no || `SAL-${s.s_no}`, date: s.date, party: s.customer, path: `/entry/sales-display?id=${s.id}` });
      }
    }

    // 7. Dynamic Intelligent Next Action Suggestions
    const isQcRejected = chain.qcInspection?.overall_result === 'REJECTED' || chain.iqrReport?.overall_result === 'REJECTED';
    const isQcAccepted = chain.qcInspection?.overall_result === 'ACCEPTED';

    if (chain.purchase && !chain.qcInspection) {
      chain.suggestedActions.push({
        label: 'Log QC Inspection',
        description: 'Perform moisture and lab quality test for inward materials',
        url: `/entry/quality-control-create?purchase_id=${chain.purchase.id}&inv_no=${encodeURIComponent(chain.purchase.inv_no || '')}&lot_no=${encodeURIComponent(targetLotNo || '')}`,
        type: 'primary'
      });
    }

    if (isQcRejected && !chain.purchaseReturn) {
      chain.suggestedActions.push({
        label: 'Create Purchase Return (Debit Note)',
        description: `Material rejected in QC (${chain.qcInspection?.qc_no || 'QC'}). Return to ${chain.purchase?.supplier || 'Supplier'}.`,
        url: `/entry/purchase-return-create?purchase_id=${chain.purchase?.id || ''}&purchase_inv_no=${encodeURIComponent(chain.purchase?.inv_no || '')}&lot_no=${encodeURIComponent(targetLotNo || '')}&supplier=${encodeURIComponent(chain.purchase?.supplier || '')}`,
        type: 'error'
      });
    }

    if (isQcAccepted && targetLotNo) {
      chain.suggestedActions.push({
        label: 'Issue for Milling (Grind)',
        description: 'Quality passed. Allocate stock lot for processing in factory',
        url: `/entry/grind-create?lot_no=${encodeURIComponent(targetLotNo)}`,
        type: 'success'
      });
      chain.suggestedActions.push({
        label: 'View Lot Genealogy',
        description: 'Track full lifecycle audit trace for this lot',
        url: `/lot-genealogy?lot=${encodeURIComponent(targetLotNo)}`,
        type: 'info'
      });
    }

    res.json({
      success: true,
      chain
    });
  } catch (err) {
    console.error('Error fetching related record chain:', err);
    res.status(500).json({ success: false, message: 'Error fetching related records', error: err.message });
  }
});

module.exports = router;
