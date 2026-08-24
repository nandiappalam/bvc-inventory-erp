import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  TextField,
  InputAdornment,
  Divider,
  Button
} from '@mui/material';
import {
  Search as SearchIcon,
  Inventory as StockIcon,
  ShoppingCart as PurchaseIcon,
  AssignmentReturn as ReturnIcon,
  PointOfSale as SalesIcon,
  ReceiptLong as TaxIcon,
  PrecisionManufacturing as ProductionIcon,
  PendingActions as PendingIcon,
  AccountBalance as AccountsIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';

const REPORT_CATEGORIES = [
  {
    id: 'stock',
    title: 'Stock Reports',
    badge: 'Inventory Position & Godown Stock',
    icon: <StockIcon sx={{ fontSize: 32, color: '#0284c7' }} />,
    color: '#0284c7',
    path: '/reports/category/stock',
    subReports: [
      { label: 'Item Group Wise Stock Status', type: 'group-wise' },
      { label: 'Godown Wise Stock Status', directPath: '/reports/godown-stock' },
      { label: 'Urad Stock Status', type: 'urad' },
      { label: 'Flour Stock Status', type: 'flour' },
      { label: 'Flour Out Stock Status', type: 'flour-out' },
      { label: 'Papad Stock Status', type: 'papad' },
      { label: 'Masala Stock Status', type: 'masala' },
      { label: 'Pack Stock Status', type: 'pack' },
      { label: 'Wastage / Rejection Stock Status', type: 'wastage' },
      { label: 'Stock Status (Others)', type: 'others' }
    ]
  },
  {
    id: 'purchase',
    title: 'Purchase Reports',
    badge: 'Procurement & Inward Details',
    icon: <PurchaseIcon sx={{ fontSize: 32, color: '#16a34a' }} />,
    color: '#16a34a',
    path: '/reports/category/purchase',
    subReports: [
      { label: 'Purchase Register (In Order)', type: 'register' },
      { label: 'Purchase Details - Date Wise', type: 'date-wise' },
      { label: 'Purchase Details - Month Wise', type: 'month-wise' },
      { label: 'Monthly Purchase Details - Item Group Wise', type: 'monthly-item-group' },
      { label: 'Monthly Purchase Details - Item Wise', type: 'monthly-item' },
      { label: 'Monthly Purchase Details - Supplier Wise', type: 'monthly-supplier' },
      { label: 'Daily Purchase Details - Item Wise', type: 'daily-item' },
      { label: 'Daily Purchase Details - Supplier Wise', type: 'daily-supplier' }
    ]
  },
  {
    id: 'purchase-return',
    title: 'Purchase Return Reports',
    badge: 'Inward Returns & Debit Notes',
    icon: <ReturnIcon sx={{ fontSize: 32, color: '#ea580c' }} />,
    color: '#ea580c',
    path: '/reports/category/purchase-return',
    subReports: [
      { label: 'Purchase Return Register (In Order)', type: 'register' },
      { label: 'Purchase Return Details - Date Wise', type: 'date-wise' },
      { label: 'Purchase Return Details - Month Wise', type: 'month-wise' },
      { label: 'Monthly Purchase Return Details - Item Group Wise', type: 'monthly-item-group' },
      { label: 'Monthly Purchase Return Details - Item Wise', type: 'monthly-item' },
      { label: 'Monthly Purchase Return Details - Supplier Wise', type: 'monthly-supplier' },
      { label: 'Daily Purchase Return Details - Item Group Wise', type: 'daily-item-group' },
      { label: 'Daily Purchase Return Details - Item Wise', type: 'daily-item' },
      { label: 'Daily Purchase Return Details - Supplier Wise', type: 'daily-supplier' }
    ]
  },
  {
    id: 'sales',
    title: 'Sales Reports',
    badge: 'Outward Revenue & Invoicing',
    icon: <SalesIcon sx={{ fontSize: 32, color: '#2563eb' }} />,
    color: '#2563eb',
    path: '/reports/category/sales',
    subReports: [
      { label: 'Sales Register (In Order)', type: 'register' },
      { label: 'Sales Details - Date Wise', type: 'date-wise' },
      { label: 'Sales Details - Month Wise', type: 'month-wise' },
      { label: 'Monthly Sales Details - Item Group Wise', type: 'monthly-item-group' },
      { label: 'Monthly Sales Details - Item Wise', type: 'monthly-item' },
      { label: 'Monthly Sales Details - Customer Wise', type: 'monthly-customer' },
      { label: 'Daily Sales Details - Item Group Wise', type: 'daily-item-group' },
      { label: 'Daily Sales Details - Item Wise', type: 'daily-item' },
      { label: 'Daily Sales Details - Customer Wise', type: 'daily-customer' }
    ]
  },
  {
    id: 'sales-return',
    title: 'Sales Return Reports',
    badge: 'Outward Returns & Credit Notes',
    icon: <ReturnIcon sx={{ fontSize: 32, color: '#dc2626' }} />,
    color: '#dc2626',
    path: '/reports/category/sales-return',
    subReports: [
      { label: 'Sales Return Register (In Order)', type: 'register' },
      { label: 'Sales Return Details - Date Wise', type: 'date-wise' },
      { label: 'Sales Return Details - Month Wise', type: 'month-wise' },
      { label: 'Monthly Sales Return Details - Item Group Wise', type: 'monthly-item-group' },
      { label: 'Monthly Sales Return Details - Item Wise', type: 'monthly-item' },
      { label: 'Monthly Sales Return Details - Customer Wise', type: 'monthly-customer' },
      { label: 'Daily Sales Return Details - Item Group Wise', type: 'daily-item-group' },
      { label: 'Daily Sales Return Details - Item Wise', type: 'daily-item' },
      { label: 'Daily Sales Return Details - Customer Wise', type: 'daily-customer' }
    ]
  },
  {
    id: 'tax',
    title: 'Tax Reports',
    badge: 'GST & VAT Audit Register',
    icon: <TaxIcon sx={{ fontSize: 32, color: '#7c3aed' }} />,
    color: '#7c3aed',
    path: '/reports/category/tax',
    subReports: [
      { label: 'Sales VAT Register', type: 'sales-vat' },
      { label: 'Purchase VAT Register', type: 'purchase-vat' }
    ]
  },
  {
    id: 'production',
    title: 'Production Reports',
    badge: 'Factory Processing & CCP Monitoring',
    icon: <ProductionIcon sx={{ fontSize: 32, color: '#ca8a04' }} />,
    color: '#ca8a04',
    path: '/reports/category/production',
    subReports: [
      { label: 'Daily Production Report', type: 'daily' },
      { label: 'Incoming Quality Report (IQR / RM Quality)', type: 'iqr' },
      { label: 'In-Process Checklist / Milling Report', type: 'in-process' },
      { label: 'Certificate of Analysis (COA / FG Quality)', type: 'coa' },
      { label: 'Fumigation & Pest Control Report', type: 'fumigation' },
      { label: 'CCP Monitoring Report', type: 'ccp' },
      { label: 'OPRP Monitoring Report', type: 'oprp' },
      { label: 'Terminal Inspection Report', type: 'terminal-inspection' },
      { label: 'Vehicle Loading/Unloading Report', type: 'vehicle-inspection' },
      { label: 'Yield & Material Balance Report', type: 'yield' },
      { label: 'Wastage & Rejection Report', type: 'wastage' },
      { label: 'Production Summary', type: 'summary' }
    ]
  },
  {
    id: 'pending',
    title: 'Pending Reports',
    badge: 'Open Purchase Requests & Receipts',
    icon: <PendingIcon sx={{ fontSize: 32, color: '#d97706' }} />,
    color: '#d97706',
    path: '/reports/category/pending',
    subReports: [
      { label: 'Papad In Pending Register', type: 'papad-in' },
      { label: 'Pending Purchase Requisitions', type: 'purchase-reqs' }
    ]
  }
];

const ReportsIndex = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCategories = REPORT_CATEGORIES.map(cat => {
    if (!searchTerm) return cat;
    const term = searchTerm.toLowerCase();
    const titleMatch = cat.title.toLowerCase().includes(term);
    const matchingSubs = cat.subReports.filter(sub => sub.label.toLowerCase().includes(term));
    if (titleMatch || matchingSubs.length > 0) {
      return {
        ...cat,
        subReports: titleMatch ? cat.subReports : matchingSubs
      };
    }
    return null;
  }).filter(Boolean);

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Title Banner */}
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
          <Typography variant="h5" sx={{ fontWeight: 'bold', letterSpacing: '0.5px' }}>
            Reports Hub & Analytics
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)' }}>
            Categorized ERP Statements: Stock, Purchase, Sales, Tax, Production & Pending Requisitions
          </Typography>
        </Box>

        <TextField
          size="small"
          placeholder="Filter report categories or names..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{
            backgroundColor: '#ffffff',
            borderRadius: '6px',
            width: { xs: '100%', sm: 320 },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: 'transparent' }
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#64748b' }} />
              </InputAdornment>
            )
          }}
        />
      </Paper>

      {/* Category Grid */}
      <Grid container spacing={3}>
        {filteredCategories.map(cat => (
          <Grid item xs={12} sm={6} md={4} key={cat.id}>
            <Card
              elevation={2}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '8px',
                borderTop: `4px solid ${cat.color}`,
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.1)'
                }
              }}
            >
              <CardContent sx={{ p: 2.5, flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {cat.icon}
                    <Box>
                      <Typography variant="h6" sx={{ fontSize: '17px', fontWeight: 'bold', color: '#1e293b' }}>
                        {cat.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        {cat.badge}
                      </Typography>
                    </Box>
                  </Box>
                  <Chip
                    label={`${cat.subReports.length} Reports`}
                    size="small"
                    sx={{ backgroundColor: `${cat.color}15`, color: cat.color, fontWeight: 'bold' }}
                  />
                </Box>

                <Divider sx={{ my: 1.5 }} />

                {/* Sub-Reports Links */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {cat.subReports.map((sub, idx) => (
                    <Box
                      key={`${cat.id}-${sub.type || sub.label}-${idx}`}
                      onClick={() => navigate(sub.directPath ? sub.directPath : `${cat.path}?type=${sub.type}`)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: '#334155',
                        '&:hover': {
                          backgroundColor: `${cat.color}10`,
                          color: cat.color,
                          fontWeight: 'bold'
                        }
                      }}
                    >
                      <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 'inherit' }}>
                        • {sub.label}
                      </Typography>
                      <ArrowForwardIcon sx={{ fontSize: 16, opacity: 0.6 }} />
                    </Box>
                  ))}
                </Box>
              </CardContent>

              <Box sx={{ p: 2, pt: 0, backgroundColor: '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => navigate(cat.path)}
                  sx={{
                    backgroundColor: cat.color,
                    textTransform: 'none',
                    fontWeight: 'bold',
                    borderRadius: '6px',
                    '&:hover': { backgroundColor: cat.color, filter: 'brightness(0.9)' }
                  }}
                >
                  Open {cat.title} Division
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default ReportsIndex;
