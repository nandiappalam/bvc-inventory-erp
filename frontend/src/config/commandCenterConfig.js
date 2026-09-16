/**
 * Metric Configuration for BVC Command Center
 * Maps high-level KPI keys to existing routes, permissions, and initial filters
 */

export const COMMAND_CENTER_CONFIG = {
  purchase: {
    title: 'PURCHASE',
    icon: 'ShoppingCart',
    permission: 'Purchase',
    color: '#0284c7', // Sky Blue
    bgLight: '#f0f9ff',
    border: '#bae6fd',
    metrics: [
      {
        key: 'pendingPR',
        label: 'Pending PR',
        type: 'pending',
        route: '/entry/purchase-request-display?status=Submitted',
        permission: 'Purchase Request',
        unit: '',
        actionLabel: 'Review PRs'
      },
      {
        key: 'pendingPO',
        label: 'Pending PO',
        type: 'pending',
        route: '/entry/purchase-order-display?status=Ordered',
        permission: 'Purchase Order',
        unit: '',
        actionLabel: 'Track Orders'
      },
      {
        key: 'pendingQC',
        label: 'Pending QC',
        type: 'pending',
        route: '/quality/dashboard',
        permission: 'Quality Control',
        unit: '',
        actionLabel: 'Inspect Lots'
      },
      {
        key: 'todayPurchase',
        label: "Today's Purchase",
        type: 'today',
        isCurrency: true,
        route: '/report/purchase-register',
        permission: 'Purchase',
        unit: '',
        actionLabel: 'View Register'
      }
    ]
  },

  inventory: {
    title: 'INVENTORY',
    icon: 'Inventory2',
    permission: 'Stock Report',
    color: '#059669', // Emerald Green
    bgLight: '#ecfdf5',
    border: '#a7f3d0',
    metrics: [
      {
        key: 'totalStockMT',
        label: 'Total Stock',
        type: 'current',
        route: '/report/stock-report',
        permission: 'Stock Report',
        unit: 'MT',
        actionLabel: 'Stock Breakdown'
      },
      {
        key: 'lowStock',
        label: 'Low Stock',
        type: 'alert',
        isCritical: true,
        route: '/features/stock-alert-dashboard',
        permission: 'Stock Report',
        unit: 'Items',
        actionLabel: 'Restock Action'
      },
      {
        key: 'expiringLots',
        label: 'Expiring Lots',
        type: 'alert',
        route: '/report/lot-history',
        permission: 'Stock Report',
        unit: 'Lots',
        actionLabel: 'Lot Traceability'
      },
      {
        key: 'coldStorage',
        label: 'Cold Storage',
        type: 'current',
        route: '/reports/godown-stock',
        permission: 'Stock Report',
        unit: 'MT',
        actionLabel: 'Chamber Stock'
      }
    ]
  },

  production: {
    title: 'PRODUCTION',
    icon: 'PrecisionManufacturing',
    permission: 'Grind',
    color: '#7c3aed', // Purple
    bgLight: '#f5f3ff',
    border: '#ddd6fe',
    metrics: [
      {
        key: 'todayProduction',
        label: "Today's Production",
        type: 'today',
        route: '/reports/daily-production',
        permission: 'Flour Out',
        unit: 'KG',
        actionLabel: 'Daily Output'
      },
      {
        key: 'yieldPercent',
        label: 'Yield %',
        type: 'current',
        route: '/entry/flour-out-display',
        permission: 'Flour Out',
        unit: '%',
        actionLabel: 'Milling Yield'
      },
      {
        key: 'pendingProduction',
        label: 'Production Pending',
        type: 'pending',
        route: '/entry/work-order-slip-display',
        permission: 'Grind',
        unit: 'Slips',
        actionLabel: 'Work Orders'
      }
    ]
  },

  sales: {
    title: 'SALES',
    icon: 'PointOfSale',
    permission: 'Sales',
    color: '#d97706', // Amber / Orange
    bgLight: '#fffbeb',
    border: '#fde68a',
    metrics: [
      {
        key: 'todaySales',
        label: "Today's Sales",
        type: 'today',
        isCurrency: true,
        route: '/report/sales-register',
        permission: 'Sales',
        unit: '',
        actionLabel: 'Sales Register'
      },
      {
        key: 'pendingOrders',
        label: 'Pending Orders',
        type: 'pending',
        route: '/entry/sales-order-display?status=Pending',
        permission: 'Sales Order',
        unit: 'Orders',
        actionLabel: 'Fulfill Orders'
      },
      {
        key: 'dispatchPending',
        label: 'Dispatch Pending',
        type: 'pending',
        route: '/entry/sales-display?dispatch=Pending',
        permission: 'Sales',
        unit: 'Loads',
        actionLabel: 'Gate Exit Pass'
      }
    ]
  },

  accounts: {
    title: 'ACCOUNTS',
    icon: 'AccountBalance',
    permission: 'General Ledger',
    color: '#0891b2', // Cyan / Teal
    bgLight: '#ecfeff',
    border: '#a5f3fc',
    metrics: [
      {
        key: 'receivable',
        label: 'Receivable',
        type: 'outstanding',
        isCurrency: true,
        route: '/reports/outstanding-summary?type=Receivable',
        permission: 'General Ledger',
        unit: '',
        actionLabel: 'Customer Aging'
      },
      {
        key: 'payable',
        label: 'Payable',
        type: 'outstanding',
        isCurrency: true,
        route: '/reports/outstanding-summary?type=Payable',
        permission: 'General Ledger',
        unit: '',
        actionLabel: 'Vendor Aging'
      },
      {
        key: 'cash',
        label: 'Cash in Hand',
        type: 'current',
        isCurrency: true,
        route: '/reports/day-book',
        permission: 'General Ledger',
        unit: '',
        actionLabel: 'Cash Ledger'
      },
      {
        key: 'bank',
        label: 'Bank Balance',
        type: 'current',
        isCurrency: true,
        route: '/reports/trial-balance',
        permission: 'General Ledger',
        unit: '',
        actionLabel: 'Bank Ledgers'
      }
    ]
  },

  quality: {
    title: 'QUALITY',
    icon: 'FactCheck',
    permission: 'Quality Control',
    color: '#475569', // Slate
    bgLight: '#f8fafc',
    border: '#cbd5e1',
    metrics: [
      {
        key: 'qcPending',
        label: 'QC Pending',
        type: 'pending',
        route: '/quality/dashboard',
        permission: 'Quality Control',
        unit: 'Batches',
        actionLabel: 'Lab Testing'
      },
      {
        key: 'qcFailed',
        label: 'QC Failed',
        type: 'alert',
        isCritical: true,
        route: '/quality/purchase-lab-testing',
        permission: 'Quality Control',
        unit: 'Batches',
        actionLabel: 'Rejection Log'
      },
      {
        key: 'quarantineStockMT',
        label: 'Quarantine Stock',
        type: 'current',
        route: '/report/stock-report',
        permission: 'Quality Control',
        unit: 'MT',
        actionLabel: 'Quarantine Lot'
      }
    ]
  },

  approvals: {
    title: 'APPROVALS',
    icon: 'VerifiedUser',
    permission: 'Purchase Request',
    color: '#2563eb', // Royal Blue
    bgLight: '#eff6ff',
    border: '#bfdbfe',
    metrics: [
      {
        key: 'prPending',
        label: 'PR Pending Approval',
        type: 'pending',
        route: '/entry/purchase-request-approval',
        permission: 'Purchase Request',
        unit: 'Reqs',
        actionLabel: 'Approve PR'
      },
      {
        key: 'poPending',
        label: 'PO Pending Approval',
        type: 'pending',
        route: '/entry/purchase-order-display?filter=pending-approval',
        permission: 'Purchase Order',
        unit: 'POs',
        actionLabel: 'Approve PO'
      },
      {
        key: 'paymentPending',
        label: 'Payment Pending',
        type: 'pending',
        route: '/entry/voucher-display?type=Payment',
        permission: 'Voucher',
        unit: 'Vouchers',
        actionLabel: 'Authorize Pay'
      },
      {
        key: 'qcPending',
        label: 'QC Pending Approval',
        type: 'pending',
        route: '/quality/dashboard',
        permission: 'Quality Control',
        unit: 'Lots',
        actionLabel: 'Approve QC'
      }
    ]
  },

  alerts: {
    title: 'ALERTS',
    icon: 'NotificationsActive',
    permission: 'Stock Report',
    color: '#e11d48', // Crimson Red
    bgLight: '#fff1f2',
    border: '#fecdd3',
    metrics: [
      {
        key: 'lowStock',
        label: 'Low Stock Alert',
        type: 'alert',
        isCritical: true,
        route: '/features/stock-alert-dashboard',
        permission: 'Stock Report',
        unit: 'Items',
        actionLabel: 'Stock Alarm'
      },
      {
        key: 'expiry',
        label: 'Lot Expiry Warning',
        type: 'alert',
        route: '/report/lot-history',
        permission: 'Stock Report',
        unit: 'Lots',
        actionLabel: 'Lot Aging'
      },
      {
        key: 'paymentDue',
        label: 'Payment Due Warning',
        type: 'alert',
        route: '/reports/outstanding-details',
        permission: 'General Ledger',
        unit: 'Parties',
        actionLabel: 'Overdue Dues'
      },
      {
        key: 'productionDelay',
        label: 'Production Delay',
        type: 'alert',
        route: '/entry/work-order-slip-display',
        permission: 'Grind',
        unit: 'Jobs',
        actionLabel: 'Delayed Jobs'
      }
    ]
  }
};
