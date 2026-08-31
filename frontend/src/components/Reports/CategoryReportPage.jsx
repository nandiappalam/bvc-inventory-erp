import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Breadcrumbs,
  Link,
  CircularProgress,
  IconButton,
  Tooltip,
  Divider,
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  RestartAlt as ResetIcon,
  FileDownload as ExcelIcon,
  PictureAsPdf as PdfIcon,
  Print as PrintIcon,
  Assessment as AssessmentIcon,
  FilterList as FilterIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';

import DailyProductionReport from './DailyProductionReport';
import CcpMonitoringReport from './CcpMonitoringReport';
import OprpMonitoringReport from './OprpMonitoringReport';
import TerminalInspectionReport from './TerminalInspectionReport';
import VehicleInspectionReport from './VehicleInspectionReport';
import api from '../../services/api.js';

const CATEGORY_CONFIGS = {
  stock: {
    title: 'Stock Reports',
    badge: 'Inventory & Godown Status',
    defaultSub: 'group-wise',
    subReports: [
      { id: 'group-wise', label: 'Item Group Wise Stock Status' },
      { id: 'godown-wise', label: 'Godown Wise Stock Status' },
      { id: 'urad', label: 'Urad Stock Status' },
      { id: 'flour', label: 'Flour Stock Status' },
      { id: 'flour-out', label: 'Flour Out Stock Status' },
      { id: 'papad', label: 'Papad Stock Status' },
      { id: 'masala', label: 'Masala Stock Status' },
      { id: 'pack', label: 'Pack Stock Status' },
      { id: 'wastage', label: 'Wastage / Rejection Stock Status' },
      { id: 'others', label: 'Stock Status (Others)' }
    ]
  },
  purchase: {
    title: 'Purchase Reports',
    badge: 'Procurement & Inward Receipts',
    defaultSub: 'register',
    subReports: [
      { id: 'register', label: 'Purchase Register (In Order)' },
      { id: 'date-wise', label: 'Purchase Details - Date Wise' },
      { id: 'month-wise', label: 'Purchase Details - Month Wise' },
      { id: 'monthly-item-group', label: 'Monthly Purchase Details - Item Group Wise' },
      { id: 'monthly-item', label: 'Monthly Purchase Details - Item Wise' },
      { id: 'monthly-supplier', label: 'Monthly Purchase Details - Supplier Wise' },
      { id: 'daily-item', label: 'Daily Purchase Details - Item Wise' },
      { id: 'daily-supplier', label: 'Daily Purchase Details - Supplier Wise' }
    ]
  },
  'purchase-return': {
    title: 'Purchase Return Reports',
    badge: 'Inward Returns & Debit Notes',
    defaultSub: 'register',
    subReports: [
      { id: 'register', label: 'Purchase Return Register (In Order)' },
      { id: 'date-wise', label: 'Purchase Return Details - Date Wise' },
      { id: 'month-wise', label: 'Purchase Return Details - Month Wise' },
      { id: 'monthly-item-group', label: 'Monthly Purchase Return Details - Item Group Wise' },
      { id: 'monthly-item', label: 'Monthly Purchase Return Details - Item Wise' },
      { id: 'monthly-supplier', label: 'Monthly Purchase Return Details - Supplier Wise' },
      { id: 'daily-item-group', label: 'Daily Purchase Return Details - Item Group Wise' },
      { id: 'daily-item', label: 'Daily Purchase Return Details - Item Wise' },
      { id: 'daily-supplier', label: 'Daily Purchase Return Details - Supplier Wise' }
    ]
  },
  sales: {
    title: 'Sales Reports',
    badge: 'Outward Invoices & Revenue',
    defaultSub: 'register',
    subReports: [
      { id: 'register', label: 'Sales Register (In Order)' },
      { id: 'date-wise', label: 'Sales Details - Date Wise' },
      { id: 'month-wise', label: 'Sales Details - Month Wise' },
      { id: 'monthly-item-group', label: 'Monthly Sales Details - Item Group Wise' },
      { id: 'monthly-item', label: 'Monthly Sales Details - Item Wise' },
      { id: 'monthly-customer', label: 'Monthly Sales Details - Customer Wise' },
      { id: 'daily-item-group', label: 'Daily Sales Details - Item Group Wise' },
      { id: 'daily-item', label: 'Daily Sales Details - Item Wise' },
      { id: 'daily-customer', label: 'Daily Sales Details - Customer Wise' }
    ]
  },
  'sales-return': {
    title: 'Sales Return Reports',
    badge: 'Outward Returns & Credit Notes',
    defaultSub: 'register',
    subReports: [
      { id: 'register', label: 'Sales Return Register (In Order)' },
      { id: 'date-wise', label: 'Sales Return Details - Date Wise' },
      { id: 'month-wise', label: 'Sales Return Details - Month Wise' },
      { id: 'monthly-item-group', label: 'Monthly Sales Return Details - Item Group Wise' },
      { id: 'monthly-item', label: 'Monthly Sales Return Details - Item Wise' },
      { id: 'monthly-customer', label: 'Monthly Sales Return Details - Customer Wise' },
      { id: 'daily-item-group', label: 'Daily Sales Return Details - Item Group Wise' },
      { id: 'daily-item', label: 'Daily Sales Return Details - Item Wise' },
      { id: 'daily-customer', label: 'Daily Sales Return Details - Customer Wise' }
    ]
  },
  tax: {
    title: 'Tax Reports',
    badge: 'GST & VAT Audit Ledgers',
    defaultSub: 'sales-vat',
    subReports: [
      { id: 'sales-vat', label: 'Sales VAT / GST Register' },
      { id: 'purchase-vat', label: 'Purchase VAT / GST Register' }
    ]
  },
  production: {
    title: 'Production Reports',
    badge: 'Factory Processing, CCP & Quality Inspection Monitoring',
    defaultSub: 'daily',
    subReports: [
      { id: 'daily', label: 'Daily Production Record' },
      { id: 'iqr', label: 'Incoming Quality Report (IQR / RM Quality)' },
      { id: 'in-process', label: 'In-Process Checklist / Milling Report' },
      { id: 'coa', label: 'Certificate of Analysis (COA / FG Quality)' },
      { id: 'fumigation', label: 'Fumigation & Pest Control Report' },
      { id: 'yield', label: 'Yield & Material Balance Report' },
      { id: 'wastage', label: 'Wastage & Rejection Report' },
      { id: 'summary', label: 'Production Summary' },
      { id: 'ccp', label: 'CCP Monitoring Record' },
      { id: 'oprp', label: 'OPRP Monitoring Record' },
      { id: 'terminal-inspection', label: 'Terminal Inspection Report' },
      { id: 'vehicle-inspection', label: 'Vehicle Loading/Unloading Report' }
    ]
  },
  pending: {
    title: 'Pending Reports',
    badge: 'Incomplete Receipts & Open Requests',
    defaultSub: 'papad-in',
    subReports: [
      { id: 'papad-in', label: 'Papad In Pending Register' },
      { id: 'purchase-reqs', label: 'Pending Purchase Requisitions' }
    ]
  }
};

const getCategoryColumns = (categoryKey, subReportId) => {
  if (categoryKey === 'stock') {
    if (subReportId === 'godown-wise') {
      return [
        { id: 'godown_name', label: 'Godown' },
        { id: 'item_name', label: 'Item Name' },
        { id: 'item_group', label: 'Item Group' },
        { id: 'lot_no', label: 'Lot No' },
        { id: 'available_qty', label: 'Balance Qty', align: 'right', isNumber: true },
        { id: 'weight', label: 'Weight (kg)', align: 'right', isNumber: true }
      ];
    }
    return [
      { id: 'item_name', label: 'Item Name' },
      { id: 'item_group', label: 'Item Group' },
      { id: 'lot_no', label: 'Lot No' },
      { id: 'godown_name', label: 'Godown' },
      { id: 'opening_qty', label: 'Inward / Opening Qty', align: 'right', isNumber: true },
      { id: 'total_purchased', label: 'Input Qty', align: 'right', isNumber: true },
      { id: 'total_sold', label: 'Output / Issued Qty', align: 'right', isNumber: true },
      { id: 'wastage_qty', label: 'Wastage Qty', align: 'right', isNumber: true },
      { id: 'available_qty', label: 'Balance Qty', align: 'right', isNumber: true },
      { id: 'weight', label: 'Weight (kg)', align: 'right', isNumber: true },
      { id: 'category', label: 'Category' }
    ];
  }

  if (categoryKey === 'purchase') {
    if (subReportId === 'date-wise') {
      return [
        { id: 'date', label: 'Date' },
        { id: 'invoice_count', label: 'Invoice Count', align: 'right', isNumber: true },
        { id: 'item_count', label: 'Total Items', align: 'right', isNumber: true },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Taxable Value (₹)', align: 'right', isNumber: true },
        { id: 'tax_amount', label: 'Tax Amount (₹)', align: 'right', isNumber: true },
        { id: 'net_amount', label: 'Net Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    if (subReportId === 'month-wise') {
      return [
        { id: 'month', label: 'Month' },
        { id: 'invoice_count', label: 'Invoice Count', align: 'right', isNumber: true },
        { id: 'item_count', label: 'Total Items', align: 'right', isNumber: true },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Taxable Value (₹)', align: 'right', isNumber: true },
        { id: 'tax_amount', label: 'Tax Amount (₹)', align: 'right', isNumber: true },
        { id: 'net_amount', label: 'Net Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    if (subReportId === 'monthly-item-group') {
      return [
        { id: 'month', label: 'Month' },
        { id: 'item_group', label: 'Item Group' },
        { id: 'item_count', label: 'Item Count', align: 'right', isNumber: true },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Total Value (₹)', align: 'right', isNumber: true },
        { id: 'net_amount', label: 'Net Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    if (subReportId === 'monthly-item' || subReportId === 'daily-item') {
      return [
        { id: subReportId === 'monthly-item' ? 'month' : 'date', label: subReportId === 'monthly-item' ? 'Month' : 'Date' },
        { id: 'item_name', label: 'Item Name' },
        { id: 'item_group', label: 'Item Group' },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'avg_rate', label: 'Avg Rate (₹)', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Total Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    if (subReportId === 'monthly-supplier' || subReportId === 'daily-supplier') {
      return [
        { id: subReportId === 'monthly-supplier' ? 'month' : 'date', label: subReportId === 'monthly-supplier' ? 'Month' : 'Date' },
        { id: 'supplier_name', label: 'Supplier Name' },
        { id: 'invoice_count', label: 'Invoices', align: 'right', isNumber: true },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Taxable Value (₹)', align: 'right', isNumber: true },
        { id: 'net_amount', label: 'Net Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    return [
      { id: 'date', label: 'Date' },
      { id: 'invoice_no', label: 'Invoice No' },
      { id: 'supplier_name', label: 'Supplier' },
      { id: 'item_name', label: 'Item Name' },
      { id: 'qty', label: 'Qty', align: 'right', isNumber: true },
      { id: 'rate', label: 'Rate (₹)', align: 'right', isNumber: true },
      { id: 'amount', label: 'Amount (₹)', align: 'right', isNumber: true },
      { id: 'tax_amount', label: 'Tax (₹)', align: 'right', isNumber: true },
      { id: 'net_amount', label: 'Net Amount (₹)', align: 'right', isNumber: true }
    ];
  }

  if (categoryKey === 'purchase-return') {
    if (subReportId === 'date-wise') {
      return [
        { id: 'date', label: 'Date' },
        { id: 'return_count', label: 'Return Count', align: 'right', isNumber: true },
        { id: 'item_count', label: 'Total Items', align: 'right', isNumber: true },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Total Value (₹)', align: 'right', isNumber: true },
        { id: 'net_amount', label: 'Net Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    if (subReportId === 'month-wise') {
      return [
        { id: 'month', label: 'Month' },
        { id: 'return_count', label: 'Return Count', align: 'right', isNumber: true },
        { id: 'item_count', label: 'Total Items', align: 'right', isNumber: true },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Total Value (₹)', align: 'right', isNumber: true },
        { id: 'net_amount', label: 'Net Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    if (subReportId === 'monthly-item-group' || subReportId === 'daily-item-group') {
      return [
        { id: subReportId === 'monthly-item-group' ? 'month' : 'date', label: subReportId === 'monthly-item-group' ? 'Month' : 'Date' },
        { id: 'item_group', label: 'Item Group' },
        { id: 'item_count', label: 'Item Count', align: 'right', isNumber: true },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'net_amount', label: 'Net Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    if (subReportId === 'monthly-item' || subReportId === 'daily-item') {
      return [
        { id: subReportId === 'monthly-item' ? 'month' : 'date', label: subReportId === 'monthly-item' ? 'Month' : 'Date' },
        { id: 'item_name', label: 'Item Name' },
        { id: 'item_group', label: 'Item Group' },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'avg_rate', label: 'Avg Rate (₹)', align: 'right', isNumber: true },
        { id: 'net_amount', label: 'Net Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    if (subReportId === 'monthly-supplier' || subReportId === 'daily-supplier') {
      return [
        { id: subReportId === 'monthly-supplier' ? 'month' : 'date', label: subReportId === 'monthly-supplier' ? 'Month' : 'Date' },
        { id: 'supplier_name', label: 'Supplier Name' },
        { id: 'return_count', label: 'Return Count', align: 'right', isNumber: true },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'net_amount', label: 'Net Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    return [
      { id: 'date', label: 'Date' },
      { id: 'return_no', label: 'Return No' },
      { id: 'supplier_name', label: 'Supplier' },
      { id: 'item_name', label: 'Item Name' },
      { id: 'qty', label: 'Qty', align: 'right', isNumber: true },
      { id: 'rate', label: 'Rate (₹)', align: 'right', isNumber: true },
      { id: 'amount', label: 'Amount (₹)', align: 'right', isNumber: true },
      { id: 'tax_amount', label: 'Tax (₹)', align: 'right', isNumber: true },
      { id: 'net_amount', label: 'Net Amount (₹)', align: 'right', isNumber: true }
    ];
  }

  if (categoryKey === 'sales') {
    if (subReportId === 'date-wise') {
      return [
        { id: 'date', label: 'Date' },
        { id: 'invoice_count', label: 'Invoice Count', align: 'right', isNumber: true },
        { id: 'item_count', label: 'Total Items', align: 'right', isNumber: true },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Total Sales (₹)', align: 'right', isNumber: true }
      ];
    }
    if (subReportId === 'month-wise') {
      return [
        { id: 'month', label: 'Month' },
        { id: 'invoice_count', label: 'Invoice Count', align: 'right', isNumber: true },
        { id: 'item_count', label: 'Total Items', align: 'right', isNumber: true },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Total Sales (₹)', align: 'right', isNumber: true }
      ];
    }
    if (subReportId === 'monthly-item-group' || subReportId === 'daily-item-group') {
      return [
        { id: subReportId === 'monthly-item-group' ? 'month' : 'date', label: subReportId === 'monthly-item-group' ? 'Month' : 'Date' },
        { id: 'item_group', label: 'Item Group' },
        { id: 'item_count', label: 'Item Count', align: 'right', isNumber: true },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Total Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    if (subReportId === 'monthly-item' || subReportId === 'daily-item') {
      return [
        { id: subReportId === 'monthly-item' ? 'month' : 'date', label: subReportId === 'monthly-item' ? 'Month' : 'Date' },
        { id: 'item_name', label: 'Item Name' },
        { id: 'item_group', label: 'Item Group' },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'avg_rate', label: 'Avg Rate (₹)', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Total Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    if (subReportId === 'monthly-customer' || subReportId === 'daily-customer') {
      return [
        { id: subReportId === 'monthly-customer' ? 'month' : 'date', label: subReportId === 'monthly-customer' ? 'Month' : 'Date' },
        { id: 'customer_name', label: 'Customer Name' },
        { id: 'invoice_count', label: 'Invoices', align: 'right', isNumber: true },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Total Sales (₹)', align: 'right', isNumber: true }
      ];
    }
    return [
      { id: 'date', label: 'Date' },
      { id: 'invoice_no', label: 'Invoice No' },
      { id: 'customer_name', label: 'Customer' },
      { id: 'item_name', label: 'Item Name' },
      { id: 'qty', label: 'Qty', align: 'right', isNumber: true },
      { id: 'rate', label: 'Rate (₹)', align: 'right', isNumber: true },
      { id: 'tax_amount', label: 'Tax (₹)', align: 'right', isNumber: true },
      { id: 'total_amount', label: 'Total (₹)', align: 'right', isNumber: true }
    ];
  }

  if (categoryKey === 'sales-return') {
    if (subReportId === 'date-wise') {
      return [
        { id: 'date', label: 'Date' },
        { id: 'return_count', label: 'Return Count', align: 'right', isNumber: true },
        { id: 'item_count', label: 'Total Items', align: 'right', isNumber: true },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Total Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    if (subReportId === 'month-wise') {
      return [
        { id: 'month', label: 'Month' },
        { id: 'return_count', label: 'Return Count', align: 'right', isNumber: true },
        { id: 'item_count', label: 'Total Items', align: 'right', isNumber: true },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Total Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    if (subReportId === 'monthly-item-group' || subReportId === 'daily-item-group') {
      return [
        { id: subReportId === 'monthly-item-group' ? 'month' : 'date', label: subReportId === 'monthly-item-group' ? 'Month' : 'Date' },
        { id: 'item_group', label: 'Item Group' },
        { id: 'item_count', label: 'Item Count', align: 'right', isNumber: true },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Total Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    if (subReportId === 'monthly-item' || subReportId === 'daily-item') {
      return [
        { id: subReportId === 'monthly-item' ? 'month' : 'date', label: subReportId === 'monthly-item' ? 'Month' : 'Date' },
        { id: 'item_name', label: 'Item Name' },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'avg_rate', label: 'Avg Rate (₹)', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Total Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    if (subReportId === 'monthly-customer' || subReportId === 'daily-customer') {
      return [
        { id: subReportId === 'monthly-customer' ? 'month' : 'date', label: subReportId === 'monthly-customer' ? 'Month' : 'Date' },
        { id: 'customer_name', label: 'Customer Name' },
        { id: 'return_count', label: 'Returns', align: 'right', isNumber: true },
        { id: 'total_qty', label: 'Total Qty', align: 'right', isNumber: true },
        { id: 'total_amount', label: 'Total Amount (₹)', align: 'right', isNumber: true }
      ];
    }
    return [
      { id: 'date', label: 'Date' },
      { id: 'return_no', label: 'Return No' },
      { id: 'customer_name', label: 'Customer' },
      { id: 'item_name', label: 'Item Name' },
      { id: 'qty', label: 'Qty', align: 'right', isNumber: true },
      { id: 'rate', label: 'Rate (₹)', align: 'right', isNumber: true },
      { id: 'tax_amount', label: 'Tax (₹)', align: 'right', isNumber: true },
      { id: 'total_amount', label: 'Total (₹)', align: 'right', isNumber: true }
    ];
  }

  if (categoryKey === 'tax') {
    return [
      { id: 'date', label: 'Date' },
      { id: 'invoice_no', label: 'Invoice / Ref No' },
      { id: 'party_name', label: 'Party Name' },
      { id: 'gstin', label: 'GSTIN / VAT No' },
      { id: 'taxable_value', label: 'Taxable Value (₹)', align: 'right', isNumber: true },
      { id: 'cgst_amount', label: 'CGST (₹)', align: 'right', isNumber: true },
      { id: 'sgst_amount', label: 'SGST (₹)', align: 'right', isNumber: true },
      { id: 'igst_amount', label: 'IGST (₹)', align: 'right', isNumber: true },
      { id: 'total_tax', label: 'Total Tax (₹)', align: 'right', isNumber: true },
      { id: 'net_amount', label: 'Net Amount (₹)', align: 'right', isNumber: true }
    ];
  }

  if (categoryKey === 'production') {
    if (subReportId === 'iqr') {
      return [
        { id: 'date', label: 'Inward Date' },
        { id: 'iqr_no', label: 'IQR / S.No' },
        { id: 'lot_no', label: 'RM Lot No' },
        { id: 'supplier_name', label: 'Supplier Name' },
        { id: 'item_name', label: 'Raw Material' },
        { id: 'inward_bags', label: 'Inward Bags', align: 'right', isNumber: true },
        { id: 'total_weight', label: 'Total Wt (kg)', align: 'right', isNumber: true },
        { id: 'moisture', label: 'Moisture' },
        { id: 'foreign_matter', label: 'Foreign Matter' },
        { id: 'broken_grain', label: 'Broken Grain' },
        { id: 'status', label: 'QC Decision' },
        { id: 'checked_by', label: 'QC Officer' }
      ];
    }
    if (subReportId === 'in-process') {
      return [
        { id: 'date', label: 'Date' },
        { id: 'voucher_no', label: 'Grind No' },
        { id: 'flour_mill', label: 'Flour Mill' },
        { id: 'input_item', label: 'Input RM' },
        { id: 'input_lot', label: 'Input Lot' },
        { id: 'input_bags', label: 'Input Bags', align: 'right', isNumber: true },
        { id: 'input_weight', label: 'Input Wt (kg)', align: 'right', isNumber: true },
        { id: 'output_item', label: 'Output FG' },
        { id: 'output_lot', label: 'Output Lot' },
        { id: 'output_bags', label: 'Output Bags', align: 'right', isNumber: true },
        { id: 'output_weight', label: 'Output Wt (kg)', align: 'right', isNumber: true },
        { id: 'yield_pct', label: 'Yield %', align: 'right' },
        { id: 'sieve_check', label: 'Sieve Integrity' },
        { id: 'status', label: 'Status' }
      ];
    }
    if (subReportId === 'coa') {
      return [
        { id: 'date', label: 'Inspection Date' },
        { id: 'coa_no', label: 'COA Cert No' },
        { id: 'item_name', label: 'Finished Product' },
        { id: 'lot_no', label: 'FG Lot No' },
        { id: 'batch_bags', label: 'Batch Bags', align: 'right', isNumber: true },
        { id: 'total_weight', label: 'Batch Wt (kg)', align: 'right', isNumber: true },
        { id: 'moisture', label: 'Moisture %' },
        { id: 'protein_gluten', label: 'Protein / Gluten' },
        { id: 'ash_content', label: 'Ash %' },
        { id: 'fineness', label: 'Particle Fineness' },
        { id: 'disposition', label: 'Disposition' },
        { id: 'certified_by', label: 'Authorized By' }
      ];
    }
    if (subReportId === 'fumigation') {
      return [
        { id: 'date', label: 'Treatment Date' },
        { id: 'lot_no', label: 'Lot No' },
        { id: 'commodity', label: 'Commodity' },
        { id: 'fumigant_used', label: 'Fumigant Chemical' },
        { id: 'exposure_period', label: 'Exposure Time' },
        { id: 'aeration_time', label: 'Aeration Hours' },
        { id: 'gas_residual', label: 'Residual Gas' },
        { id: 'efficacy_status', label: 'Efficacy %' },
        { id: 'clearance_status', label: 'Status' },
        { id: 'inspector', label: 'Fumigator / Lead' }
      ];
    }
    return [
      { id: 'date', label: 'Date' },
      { id: 'batch_no', label: 'Batch/Lot No' },
      { id: 'product_name', label: 'Product Name' },
      { id: 'input_qty', label: 'Input Qty (kg)', align: 'right', isNumber: true },
      { id: 'output_qty', label: 'Output Qty (kg)', align: 'right', isNumber: true },
      { id: 'yield_pct', label: 'Yield %', align: 'right', isNumber: true },
      { id: 'status', label: 'Status' }
    ];
  }

  if (categoryKey === 'pending') {
    if (subReportId === 'papad-in') {
      return [
        { id: 'date', label: 'Date' },
        { id: 'ref_no', label: 'Lot / Ref No' },
        { id: 'artisan_name', label: 'Contractor / Artisan' },
        { id: 'item_name', label: 'Papad Item' },
        { id: 'issued_qty', label: 'Issued Qty', align: 'right', isNumber: true },
        { id: 'pending_qty', label: 'Pending Qty', align: 'right', isNumber: true },
        { id: 'pending_weight', label: 'Pending Wt (kg)', align: 'right', isNumber: true },
        { id: 'status', label: 'Status' }
      ];
    }
    return [
      { id: 'date', label: 'Requisition Date' },
      { id: 'ref_no', label: 'PR No' },
      { id: 'department', label: 'Department' },
      { id: 'item_name', label: 'Item Name' },
      { id: 'requested_qty', label: 'Requested Qty', align: 'right', isNumber: true },
      { id: 'approved_qty', label: 'Approved Qty', align: 'right', isNumber: true },
      { id: 'pending_qty', label: 'Pending Qty', align: 'right', isNumber: true },
      { id: 'status', label: 'Status' }
    ];
  }

  return [];
};

const CategoryReportPage = () => {
  const { categoryKey } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const config = CATEGORY_CONFIGS[categoryKey] || CATEGORY_CONFIGS.stock;
  const currentSubReport = searchParams.get('type') || config.defaultSub;
  const currentColumns = getCategoryColumns(categoryKey, currentSubReport);

  // Filter States
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [godownFilter, setGodownFilter] = useState('');
  const [lotNoFilter, setLotNoFilter] = useState('');
  const [itemGroupFilter, setItemGroupFilter] = useState('');

  // Dropdown options
  const [godownsList, setGodownsList] = useState([]);
  const [itemsList, setItemsList] = useState([]);

  // Report Data
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    fetchFilterMasters();
  }, []);

  useEffect(() => {
    fetchReportRows();
  }, [categoryKey, currentSubReport]);

  const fetchFilterMasters = async () => {
    try {
      const [gData, iData] = await Promise.all([
        api('/masters/all/godowns'),
        api('/masters/item')
      ]);
      if (Array.isArray(gData)) {
        setGodownsList(gData);
      }
      if (Array.isArray(iData)) {
        setItemsList(iData);
      }
    } catch (e) {
      console.log('Error fetching masters:', e);
    }
  };

  const generateSampleRows = () => {
    if (categoryKey === 'stock') {
      if (currentSubReport === 'godown-wise') {
        return [
          { godown_name: 'Main RM Warehouse', item_name: 'Urad Dal Special', item_group: 'Raw Material', lot_no: 'LOT-2026-001', available_qty: 450, weight: 22500 },
          { godown_name: 'Flour Storage', item_name: 'Wheat Flour (Atta)', item_group: 'Flour', lot_no: 'LOT-2026-004', available_qty: 820, weight: 41000 },
          { godown_name: 'Finished Goods Store', item_name: 'Moong Papad 200g', item_group: 'Finished Goods', lot_no: 'LOT-2026-009', available_qty: 1200, weight: 6000 }
        ];
      }
      return [
        { item_name: 'Urad Dal Special', item_group: 'Raw Material', lot_no: 'LOT-2026-001', godown_name: 'Main RM Warehouse', opening_qty: 500, total_purchased: 200, total_sold: 250, wastage_qty: 0, available_qty: 450, weight: 22500, category: 'RM' },
        { item_name: 'Wheat Flour (Atta)', item_group: 'Flour', lot_no: 'LOT-2026-004', godown_name: 'Flour Storage', opening_qty: 1000, total_purchased: 300, total_sold: 480, wastage_qty: 0, available_qty: 820, weight: 41000, category: 'FG' },
        { item_name: 'Moong Papad 200g', item_group: 'Finished Goods', lot_no: 'LOT-2026-009', godown_name: 'Finished Goods Store', opening_qty: 1500, total_purchased: 0, total_sold: 300, wastage_qty: 0, available_qty: 1200, weight: 6000, category: 'FG' }
      ];
    }
    if (categoryKey === 'purchase') {
      if (currentSubReport === 'date-wise') {
        return [
          { date: '2026-08-01', invoice_count: 5, item_count: 12, total_qty: 1500, total_amount: 165000, tax_amount: 8250, net_amount: 173250 },
          { date: '2026-08-02', invoice_count: 3, item_count: 8, total_qty: 900, total_amount: 98000, tax_amount: 4900, net_amount: 102900 }
        ];
      }
      if (currentSubReport === 'month-wise') {
        return [
          { month: '2026-08', invoice_count: 28, item_count: 85, total_qty: 12500, total_amount: 1375000, tax_amount: 68750, net_amount: 1443750 },
          { month: '2026-07', invoice_count: 32, item_count: 94, total_qty: 14200, total_amount: 1560000, tax_amount: 78000, net_amount: 1638000 }
        ];
      }
      if (currentSubReport === 'monthly-item-group') {
        return [
          { month: '2026-08', item_group: 'Raw Material', item_count: 15, total_qty: 8500, total_amount: 935000, net_amount: 981750 },
          { month: '2026-08', item_group: 'Packaging Material', item_count: 10, total_qty: 4000, total_amount: 440000, net_amount: 462000 }
        ];
      }
      return [
        { date: '2026-08-01', invoice_no: 'PUR-2026-010', supplier_name: 'Gujarat Agro Traders', item_name: 'Urad Dal Special', qty: 200, rate: 110, amount: 22000, tax_amount: 1100, net_amount: 23100 },
        { date: '2026-08-03', invoice_no: 'PUR-2026-015', supplier_name: 'National Spices Ltd', item_name: 'Black Pepper Powder', qty: 50, rate: 450, amount: 22500, tax_amount: 1125, net_amount: 23625 }
      ];
    }
    if (categoryKey === 'purchase-return') {
      return [
        { date: '2026-08-02', return_no: 'PR-RET-001', supplier_name: 'Gujarat Agro Traders', item_name: 'Urad Dal Special', qty: 10, rate: 110, amount: 1100, tax_amount: 55, net_amount: 1155 }
      ];
    }
    if (categoryKey === 'sales') {
      if (currentSubReport === 'date-wise') {
        return [
          { date: '2026-08-01', invoice_count: 12, item_count: 35, total_qty: 2400, total_amount: 288000 },
          { date: '2026-08-02', invoice_count: 18, item_count: 52, total_qty: 3800, total_amount: 456000 }
        ];
      }
      if (currentSubReport === 'month-wise') {
        return [
          { month: '2026-08', invoice_count: 145, item_count: 420, total_qty: 32000, total_amount: 3840000 }
        ];
      }
      return [
        { date: '2026-08-01', invoice_no: 'INV-2026-101', customer_name: 'Supermarket Wholesale Corp', item_name: 'Moong Papad 200g', qty: 500, rate: 120, tax_amount: 3000, total_amount: 63000 },
        { date: '2026-08-02', invoice_no: 'INV-2026-102', customer_name: 'City Retails Ltd', item_name: 'Urad Special Papad 500g', qty: 250, rate: 240, tax_amount: 3000, total_amount: 63000 }
      ];
    }
    if (categoryKey === 'sales-return') {
      return [
        { date: '2026-08-03', return_no: 'SR-RET-005', customer_name: 'City Retails Ltd', item_name: 'Urad Special Papad 500g', qty: 5, rate: 240, tax_amount: 60, total_amount: 1260 }
      ];
    }
    if (categoryKey === 'tax') {
      return [
        { date: '2026-08-01', invoice_no: 'INV-2026-101', party_name: 'Supermarket Wholesale Corp', gstin: '24AAAAA0000A1Z5', taxable_value: 60000, cgst_amount: 1500, sgst_amount: 1500, igst_amount: 0, total_tax: 3000, net_amount: 63000 }
      ];
    }
    if (categoryKey === 'pending') {
      if (currentSubReport === 'papad-in') {
        return [
          { date: '2026-08-04', ref_no: 'LOT-PAP-99', artisan_name: 'Shree Mahila Group', item_name: 'Special Lijjat Papad', issued_qty: 100, pending_qty: 25, pending_weight: 12.5, status: 'In Progress' }
        ];
      }
      return [
        { date: '2026-08-05', ref_no: 'PR-2026-003', department: 'Packaging', item_name: 'Poly Film Bags 500g', requested_qty: 1000, approved_qty: 500, pending_qty: 500, status: 'Pending Review' }
      ];
    }
    return [];
  };

  const fetchReportRows = async () => {
    setLoading(true);
    try {
      const qParams = new URLSearchParams({
        category: categoryKey,
        sub_type: currentSubReport,
        from_date: dateFrom,
        to_date: dateTo,
        item: itemFilter,
        godown: godownFilter,
        lot_no: lotNoFilter,
        item_group: itemGroupFilter,
        search: searchQuery
      });

      // Try category endpoint or direct categoryKey route
      let data = await api(`/reports/category/${categoryKey}?${qParams.toString()}`).catch(() => null);
      if (!data) {
        data = await api(`/reports/${categoryKey}?${qParams.toString()}`).catch(() => null);
      }

      if (data) {
<<<<<<< HEAD
        let fetched = [];
        if (Array.isArray(data)) {
          fetched = data;
        } else if (Array.isArray(data.data)) {
          fetched = data.data;
        } else if (data.data && Array.isArray(data.data.rows)) {
          fetched = data.data.rows;
        } else if (Array.isArray(data.rows)) {
          fetched = data.rows;
        } else if (data.data && typeof data.data === 'object' && Array.isArray(data.data.data)) {
          fetched = data.data.data;
        }
=======
        const fetched = Array.isArray(data) ? data : (data.rows || []);
>>>>>>> origin/main
        setRows(fetched);
      } else {
        setRows([]);
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubTabChange = (subId) => {
    setSearchParams({ type: subId });
  };

  const handleSearch = () => {
    setPage(0);
    fetchReportRows();
  };

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setSearchQuery('');
    setItemFilter('');
    setGodownFilter('');
    setLotNoFilter('');
    setItemGroupFilter('');
    setPage(0);
    setTimeout(() => {
      fetchReportRows();
    }, 50);
  };

  // Filtered rows for fast client search
  const filteredRows = rows.filter(row => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(row).some(v => String(v || '').toLowerCase().includes(q));
  });

  // Calculate Column Totals for Summary & Footer
  const calculateTotal = (colId) => {
    return filteredRows.reduce((acc, r) => acc + (parseFloat(r[colId]) || 0), 0);
  };

  const totalQty = calculateTotal('available_qty') || calculateTotal('qty') || calculateTotal('pending_qty');
  const totalWeight = calculateTotal('weight') || calculateTotal('pending_weight');
  const totalAmount = calculateTotal('net_amount') || calculateTotal('total_amount') || calculateTotal('amount');

  // Export CSV/Excel
  const handleExportExcel = () => {
    if (filteredRows.length === 0) return;
    const headers = currentColumns.map(c => c.label);
    const csvRows = filteredRows.map(row =>
      currentColumns.map(col => `"${row[col.id] !== undefined ? row[col.id] : ''}"`)
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${categoryKey}_${currentSubReport}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  const activeSubLabel = config.subReports.find(s => s.id === currentSubReport)?.label || config.title;

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header Banner */}
      <Paper
        elevation={2}
        sx={{
          p: 2.5,
          mb: 3,
          backgroundColor: '#1f4fb2',
          color: '#ffffff',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2
        }}
      >
        <Box>
          <Breadcrumbs sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', mb: 0.5 }}>
            <Link color="inherit" underline="hover" onClick={() => navigate('/')} sx={{ cursor: 'pointer' }}>
              Dashboard
            </Link>
            <Link color="inherit" underline="hover" onClick={() => navigate('/reports')} sx={{ cursor: 'pointer' }}>
              Reports
            </Link>
            <Typography color="white" fontSize="13px" fontWeight="bold">
              {config.title}
            </Typography>
          </Breadcrumbs>
          <Typography variant="h5" sx={{ fontWeight: 'bold', letterSpacing: '0.5px' }}>
            {activeSubLabel}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)' }}>
            {config.badge} • Real-time Audited Report Engine
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/reports')}
          sx={{
            color: '#fff',
            borderColor: '#fff',
            textTransform: 'none',
            fontWeight: 'bold',
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
          }}
        >
          All Reports
        </Button>
      </Paper>

      {/* Sub-Reports Category Selector Pills */}
      <Paper sx={{ p: 1.5, mb: 3, borderRadius: '8px', backgroundColor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 1, px: 1 }}>
          Select Report Division:
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {config.subReports.map(sub => {
            const isActive = currentSubReport === sub.id;
            return (
              <Chip
                key={sub.id}
                label={sub.label}
                onClick={() => handleSubTabChange(sub.id)}
                color={isActive ? 'primary' : 'default'}
                variant={isActive ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: isActive ? 'bold' : 'normal',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  borderRadius: '16px',
                  py: 0.5,
                  '&:hover': { backgroundColor: isActive ? '#1976d2' : '#f1f5f9' }
                }}
              />
            );
          })}
        </Box>
      </Paper>

      {categoryKey === 'production' && ['ccp', 'oprp', 'terminal-inspection', 'vehicle-inspection', 'daily', 'yield', 'wastage', 'summary'].includes(currentSubReport) ? (
        <Box sx={{ mt: 1 }}>
          {currentSubReport === 'ccp' && <CcpMonitoringReport hideHeader />}
          {currentSubReport === 'oprp' && <OprpMonitoringReport hideHeader />}
          {currentSubReport === 'terminal-inspection' && <TerminalInspectionReport hideHeader />}
          {currentSubReport === 'vehicle-inspection' && <VehicleInspectionReport hideHeader />}
          {['daily', 'yield', 'wastage', 'summary'].includes(currentSubReport) && (
            <DailyProductionReport hideHeader reportType={currentSubReport} />
          )}
        </Box>
      ) : (
        <>
          {/* Filter Panel */}
      <Card sx={{ mb: 3, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <FilterIcon sx={{ color: '#1f4fb2' }} />
            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 'bold', color: '#1f4fb2' }}>
              Report Filters & Search
            </Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Date From"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Date To"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                select
                size="small"
                label="Select Godown"
                value={godownFilter}
                onChange={(e) => setGodownFilter(e.target.value)}
              >
                <MenuItem value="">All Godowns</MenuItem>
                {godownsList.map(g => (
                  <MenuItem key={g.id} value={g.godown_name || g.name}>
                    {g.godown_name || g.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Search Keyword / Lot No"
                placeholder="Item name, invoice, lot..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </Grid>
          </Grid>

          {/* Action Buttons Row */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={handleSearch}
                sx={{ backgroundColor: '#1f4fb2', textTransform: 'none', fontWeight: 'bold', px: 3 }}
              >
                Search
              </Button>
              <Button
                variant="outlined"
                startIcon={<ResetIcon />}
                onClick={handleReset}
                sx={{ color: '#475569', borderColor: '#cbd5e1', textTransform: 'none', px: 2.5 }}
              >
                Reset
              </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="contained"
                color="success"
                startIcon={<ExcelIcon />}
                onClick={handleExportExcel}
                sx={{ textTransform: 'none', fontWeight: 'bold' }}
              >
                Export Excel
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<PdfIcon />}
                onClick={handlePrint}
                sx={{ textTransform: 'none', fontWeight: 'bold' }}
              >
                Export PDF
              </Button>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
                sx={{ textTransform: 'none', fontWeight: 'bold' }}
              >
                Print
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Summary KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, borderRadius: '8px', borderLeft: '4px solid #1f4fb2', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
            <Typography variant="caption" color="textSecondary" fontWeight="bold">TOTAL RECORDS</Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1f4fb2', mt: 0.5 }}>
              {filteredRows.length}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, borderRadius: '8px', borderLeft: '4px solid #16a34a', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
            <Typography variant="caption" color="textSecondary" fontWeight="bold">TOTAL QUANTITY</Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#16a34a', mt: 0.5 }}>
              {totalQty.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>

        {totalWeight > 0 && (
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, borderRadius: '8px', borderLeft: '4px solid #d97706', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
              <Typography variant="caption" color="textSecondary" fontWeight="bold">TOTAL WEIGHT (KG)</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#d97706', mt: 0.5 }}>
                {totalWeight.toLocaleString()} kg
              </Typography>
            </Paper>
          </Grid>
        )}

        {totalAmount > 0 && (
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, borderRadius: '8px', borderLeft: '4px solid #9333ea', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
              <Typography variant="caption" color="textSecondary" fontWeight="bold">TOTAL VALUE (₹)</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#9333ea', mt: 0.5 }}>
                ₹{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Main Report Table */}
      <TableContainer component={Paper} sx={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        {loading ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ mt: 1.5, color: '#64748b' }}>
              Loading report data...
            </Typography>
          </Box>
        ) : (
          <>
            <Table stickyHeader sx={{ minWidth: 700 }}>
              <TableHead>
                <TableRow>
                  {currentColumns.map(col => (
                    <TableCell
                      key={col.id}
                      align={col.align || 'left'}
                      sx={{
                        backgroundColor: '#1f4fb2',
                        color: '#ffffff',
                        fontWeight: 'bold',
                        fontSize: '13px'
                      }}
                    >
                      {col.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={currentColumns.length} align="center" sx={{ py: 4, color: '#64748b' }}>
                      No report records found matching the criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((row, idx) => (
                      <TableRow
                        key={idx}
                        hover
                        sx={{
                          '&:nth-of-type(even)': { backgroundColor: '#f8fafc' },
                          '&:last-child td, &:last-child th': { border: 0 }
                        }}
                      >
                        {currentColumns.map(col => (
                          <TableCell key={col.id} align={col.align || 'left'} sx={{ fontSize: '13px' }}>
                            {col.isNumber && row[col.id] !== undefined
                              ? Number(row[col.id]).toLocaleString()
                              : (row[col.id] || '—')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                )}
              </TableBody>

              {/* Table Footer Summary Row */}
              {filteredRows.length > 0 && (
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f1f5f9' }}>
                    {currentColumns.map((col, i) => {
                      if (i === 0) {
                        return (
                          <TableCell key="total_label" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                            Summary Totals:
                          </TableCell>
                        );
                      }
                      if (col.id === 'available_qty' || col.id === 'qty' || col.id === 'pending_qty') {
                        return (
                          <TableCell key={col.id} align="right" sx={{ fontWeight: 'bold', color: '#16a34a' }}>
                            {totalQty.toLocaleString()}
                          </TableCell>
                        );
                      }
                      if (col.id === 'weight' || col.id === 'pending_weight') {
                        return (
                          <TableCell key={col.id} align="right" sx={{ fontWeight: 'bold', color: '#d97706' }}>
                            {totalWeight.toLocaleString()} kg
                          </TableCell>
                        );
                      }
                      if (col.id === 'net_amount' || col.id === 'total_amount' || col.id === 'amount') {
                        return (
                          <TableCell key={col.id} align="right" sx={{ fontWeight: 'bold', color: '#9333ea' }}>
                            ₹{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                        );
                      }
                      return <TableCell key={col.id} />;
                    })}
                  </TableRow>
                </TableHead>
              )}
            </Table>

            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={filteredRows.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </>
        )}
      </TableContainer>
        </>
      )}
    </Container>
  );
};

export default CategoryReportPage;
