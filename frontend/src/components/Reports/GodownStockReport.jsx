import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Paper,
  Grid,
  Typography,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  Warehouse as WarehouseIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  FileDownload as ExportIcon,
  Search as SearchIcon,
  RestartAlt as ResetIcon,
  Inventory as InventoryIcon,
  Scale as ScaleIcon,
  CurrencyRupee as CurrencyRupeeIcon,
  Layers as LayersIcon,
  Assignment as LotIcon,
  NotificationsActive as AlertIcon,
  Tune as TuneIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { printHtml } from '../../utils/printHelper';

const GodownStockReport = () => {
  const [data, setData] = useState([]);
  const [godowns, setGodowns] = useState([]);
  const [godownLots, setGodownLots] = useState([]);
  const [selectedGodown, setSelectedGodown] = useState('all');
  const [searchItem, setSearchItem] = useState('');
  const [searchLotNo, setSearchLotNo] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');
  const [searchStockStatus, setSearchStockStatus] = useState('all');
  const [categories, setCategories] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Fetch Godowns list
  useEffect(() => {
    fetch('/api/godowns')
      .then((res) => res.json())
      .then((list) => {
        if (Array.isArray(list)) {
          setGodowns(list);
        }
      })
      .catch((err) => console.error('Error loading godowns:', err));
  }, []);

  // Fetch Lots for Selected Godown
  useEffect(() => {
    if (!selectedGodown || selectedGodown === 'all') {
      setGodownLots([]);
      return;
    }
    fetch(`/api/item-transfers/godown-items/${selectedGodown}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData && Array.isArray(resData.items)) {
          const lots = Array.from(new Set(resData.items.map((i) => i.lot_no).filter(Boolean)));
          setGodownLots(lots);
        } else {
          setGodownLots([]);
        }
      })
      .catch((err) => console.error('Error fetching godown lots:', err));
  }, [selectedGodown]);

  // Fetch Stock Report Data
  const fetchGodownStock = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedGodown && selectedGodown !== 'all') {
        params.append('godownId', selectedGodown);
      }
      if (searchItem) {
        params.append('item', searchItem);
      }
      if (searchLotNo) {
        params.append('lotNo', searchLotNo);
      }
      const res = await fetch(`/api/reports/godown-stock?${params.toString()}`);
      const result = await res.json();

      let list = [];
      if (Array.isArray(result)) {
        result.forEach((g) => {
          if (g && Array.isArray(g.items)) {
            g.items.forEach((item) => {
              list.push({
                ...item,
                godown_id: item.godown_id || g.godown_id,
                godown_name: item.godown_name || g.godown_name
              });
            });
          } else if (g && g.item_name) {
            list.push(g);
          }
        });
      } else if (result && Array.isArray(result.items)) {
        list = result.items;
      } else if (result && Array.isArray(result.data)) {
        list = result.data;
      } else if (result && Array.isArray(result.stock)) {
        list = result.stock;
      }

      // Fetch Stock Alert configs for threshold comparison
      let configMap = {};
      try {
        const confRes = await fetch('/api/stock-alerts/config');
        const confJson = await confRes.json();
        if (confJson.success && Array.isArray(confJson.configs)) {
          setConfigs(confJson.configs);
          confJson.configs.forEach((cfg) => {
            const key = `${cfg.item_name || ''}_${cfg.godown_id || 'all'}`;
            configMap[key] = cfg;
            // Also store general item fallback
            if (!configMap[cfg.item_name]) {
              configMap[cfg.item_name] = cfg;
            }
          });
        }
      } catch (e) {
        console.warn('Could not fetch stock alert config:', e);
      }

      // Format & calculate stock fields cleanly
      const formatted = list.map((item, idx) => {
        const openQty = parseFloat(item.opening_qty || 0);
        const inQty = parseFloat(item.in_qty || 0);
        const outQty = parseFloat(item.out_qty || 0);
        // Correct available qty calculation: Opening + In - Out
        const availQty = openQty + inQty - outQty;
        const unitWt = parseFloat(item.weight || item.unit_weight || 50);
        const stockWt = availQty * unitWt;
        const rate = parseFloat(item.rate || item.purchase_rate || item.cost || 0);
        const stockValue = availQty * rate;

        const nameLower = (item.item_name || '').toLowerCase();
        const catLower = (item.category || item.type || '').toLowerCase();
        let cat = 'RM';
        if (nameLower.includes('wastage') || nameLower.includes('rejection') || nameLower.includes('scrap') || nameLower.includes('loss') || catLower.includes('wastage')) {
          cat = 'Wastage';
        } else if (
          nameLower.includes('papad') || nameLower.includes('atta') || nameLower.includes('bgf') || nameLower.includes('brf') || nameLower.includes('10 rs pack') || nameLower.includes('pack') ||
          catLower === 'fg' || catLower.includes('finished') || catLower.includes('flour') || catLower.includes('papad')
        ) {
          cat = 'FG';
        } else {
          cat = 'RM';
        }

        // Find alert configuration
        const specificKey = `${item.item_name}_${item.godown_id}`;
        const matchedCfg = configMap[specificKey] || configMap[item.item_name] || {};
        const minQty = parseFloat(matchedCfg.minimum_qty ?? item.minimum_qty ?? 0);
        const reorderLvl = parseFloat(matchedCfg.reorder_level ?? item.reorder_level ?? 0);
        const critLvl = parseFloat(matchedCfg.critical_level ?? item.critical_level ?? 0);

        let stockStatus = 'NORMAL';
        if (critLvl > 0 && availQty <= critLvl) {
          stockStatus = 'CRITICAL';
        } else if (minQty > 0 && availQty <= minQty) {
          stockStatus = 'LOW';
        } else if (reorderLvl > 0 && availQty <= reorderLvl) {
          stockStatus = 'REORDER';
        }

        return {
          id: item.id || idx + 1,
          s_no: idx + 1,
          godown_id: item.godown_id,
          godown_name: item.godown_name || item.godown || 'Main Godown',
          item_code: item.item_code || `ITM-${100 + idx}`,
          item_name: item.item_name || 'N/A',
          category: cat,
          lot_no: item.lot_no || 'N/A',
          unit_weight: unitWt,
          unit: item.unit || 'kg',
          opening_qty: openQty,
          in_qty: inQty,
          out_qty: outQty,
          available_qty: availQty,
          stock_weight: parseFloat(stockWt.toFixed(2)),
          rate: rate,
          stock_value: parseFloat(stockValue.toFixed(2)),
          minimum_qty: minQty,
          reorder_level: reorderLvl,
          critical_level: critLvl,
          stock_status: stockStatus,
          last_transaction_date: item.last_transaction_date ? String(item.last_transaction_date).substring(0, 10) : new Date().toISOString().substring(0, 10)
        };
      });

      setData(formatted);

      // Extract categories
      const cats = Array.from(new Set(formatted.map((i) => i.category).filter(Boolean)));
      setCategories(cats);
    } catch (err) {
      console.error('Error fetching stock report:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGodownStock();
  }, [selectedGodown]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    fetchGodownStock();
  };

  const handleReset = () => {
    setSelectedGodown('all');
    setSearchItem('');
    setSearchLotNo('');
    setSearchCategory('all');
    setSearchStockStatus('all');
    fetchGodownStock();
  };

  const [selectedBlock, setSelectedBlock] = useState('all'); // 'all', 'RM', 'FG', 'Wastage'

  // Filtered dataset for Category, Block, and Stock Status selection
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchCat = searchCategory === 'all' || item.category === searchCategory;
      const matchBlock = selectedBlock === 'all' || item.category === selectedBlock;
      const matchItem = !searchItem || item.item_name.toLowerCase().includes(searchItem.toLowerCase()) || item.item_code.toLowerCase().includes(searchItem.toLowerCase());
      const matchLot = !searchLotNo || item.lot_no.toLowerCase().includes(searchLotNo.toLowerCase());
      const matchStatus = searchStockStatus === 'all' || item.stock_status === searchStockStatus;
      return matchCat && matchBlock && matchItem && matchLot && matchStatus;
    });
  }, [data, searchCategory, selectedBlock, searchItem, searchLotNo, searchStockStatus]);

  // Block Division Datasets
  const rmData = useMemo(() => filteredData.filter((d) => d.category === 'RM'), [filteredData]);
  const fgData = useMemo(() => filteredData.filter((d) => d.category === 'FG'), [filteredData]);
  const wastageData = useMemo(() => filteredData.filter((d) => d.category === 'Wastage'), [filteredData]);

  // KPI Calculations
  const totalGodownsCount = useMemo(() => {
    const uniqueG = new Set(filteredData.map((d) => d.godown_name));
    return uniqueG.size;
  }, [filteredData]);

  const totalItemsCount = useMemo(() => {
    const uniqueI = new Set(filteredData.map((d) => d.item_name));
    return uniqueI.size;
  }, [filteredData]);

  const totalLotsCount = useMemo(() => {
    const uniqueL = new Set(filteredData.map((d) => d.lot_no).filter((l) => l !== 'N/A'));
    return uniqueL.size;
  }, [filteredData]);

  const totalAvailQty = useMemo(() => {
    return filteredData.reduce((acc, curr) => acc + curr.available_qty, 0);
  }, [filteredData]);

  const totalStockWeight = useMemo(() => {
    return filteredData.reduce((acc, curr) => acc + curr.stock_weight, 0);
  }, [filteredData]);

  const totalStockValue = useMemo(() => {
    return filteredData.reduce((acc, curr) => acc + curr.stock_value, 0);
  }, [filteredData]);

  // Export to Excel
  const handleExportExcel = () => {
    const exportRows = filteredData.map((row, idx) => ({
      'S.No': idx + 1,
      'Godown Name': row.godown_name,
      'Item Code': row.item_code,
      'Item Name': row.item_name,
      'Block / Category': row.category === 'RM' ? 'Raw Material (RM)' : row.category === 'FG' ? 'Finished Goods (FG)' : 'Wastage Details',
      'Lot Number': row.lot_no,
      'Unit Weight': `${row.unit_weight} ${row.unit}`,
      'Opening Qty': row.opening_qty,
      'In Qty': row.in_qty,
      'Out Qty': row.out_qty,
      'Available Qty': row.available_qty,
      'Min Qty': row.minimum_qty,
      'Reorder Level': row.reorder_level,
      'Stock Status': row.stock_status,
      'Stock Weight (Kg)': row.stock_weight,
      'Rate (₹)': row.rate,
      'Stock Value (₹)': row.stock_value,
      'Last Trans. Date': row.last_transaction_date
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Godown Stock');
    XLSX.writeFile(workbook, `Godown_Wise_Stock_Report_${new Date().toISOString().substring(0, 10)}.xlsx`);
  };

  // Print Handler (Block-Wise Divided)
  const handlePrintReport = () => {
    const renderBlockHtml = (title, items, headerBg) => {
      if (items.length === 0) return '';
      const bOpen = items.reduce((a, b) => a + b.opening_qty, 0);
      const bIn = items.reduce((a, b) => a + b.in_qty, 0);
      const bOut = items.reduce((a, b) => a + b.out_qty, 0);
      const bAvail = items.reduce((a, b) => a + b.available_qty, 0);
      const bWt = items.reduce((a, b) => a + b.stock_weight, 0);
      const bVal = items.reduce((a, b) => a + b.stock_value, 0);

      const rows = items.map((row, idx) => {
        const isCrit = row.stock_status === 'CRITICAL';
        const isLow = row.stock_status === 'LOW';
        const isReorder = row.stock_status === 'REORDER';
        const statusBadge = isCrit
          ? '<span style="background-color: #fee2e2; color: #dc2626; padding: 2px 6px; border-radius: 4px; font-weight: bold;">CRITICAL</span>'
          : isLow
          ? '<span style="background-color: #ffedd5; color: #ea580c; padding: 2px 6px; border-radius: 4px; font-weight: bold;">LOW</span>'
          : isReorder
          ? '<span style="background-color: #fef3c7; color: #d97706; padding: 2px 6px; border-radius: 4px; font-weight: bold;">REORDER</span>'
          : '<span style="background-color: #dcfce7; color: #16a34a; padding: 2px 6px; border-radius: 4px; font-weight: bold;">NORMAL</span>';

        return `
        <tr style="${isCrit ? 'background-color: #fff1f2;' : isLow ? 'background-color: #fff7ed;' : ''}">
          <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
          <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: bold;">${row.godown_name}</td>
          <td style="padding: 5px; border: 1px solid #cbd5e1;">${row.item_code}</td>
          <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: bold;">${row.item_name}</td>
          <td style="padding: 5px; border: 1px solid #cbd5e1;">${row.category}</td>
          <td style="padding: 5px; border: 1px solid #cbd5e1; font-family: monospace;">${row.lot_no}</td>
          <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: right;">${row.unit_weight} ${row.unit}</td>
          <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: right;">${row.opening_qty}</td>
          <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: right; color: #16a34a;">${row.in_qty}</td>
          <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: right; color: #dc2626;">${row.out_qty}</td>
          <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #0369a1; background-color: #f0f9ff;">${row.available_qty}</td>
          <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${statusBadge}</td>
          <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: right;">${row.stock_weight.toFixed(2)} Kg</td>
          <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: right;">₹${row.rate}</td>
          <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #15803d; background-color: #f0fdf4;">₹${row.stock_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
      }).join('');

      return `
        <div style="margin-bottom: 25px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
          <div style="background-color: ${headerBg}; padding: 8px 12px; font-weight: bold; font-size: 14px; color: #0f172a; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; display: flex; justify-content: space-between;">
            <span>${title} (${items.length} Items)</span>
            <span>Subtotal Valuation: ₹${bVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background-color: #f8fafc; color: #334155; text-transform: uppercase;">
                <th style="padding: 6px; border: 1px solid #cbd5e1;">S.No</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1;">Godown</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1;">Code</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1;">Item Name</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1;">Category</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1;">Lot No</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Unit Wt</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Opening</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">In Qty</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Out Qty</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Avail Qty</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">Stock Status</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Stock Wt</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Rate</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Stock Value</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
            <tfoot>
              <tr style="background-color: #e2e8f0; font-weight: bold;">
                <td colspan="7" style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; text-transform: uppercase;">Subtotal (${title}):</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${bOpen}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${bIn}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${bOut}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: #0369a1;">${bAvail}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${bWt.toFixed(2)} Kg</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1;">-</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: #15803d;">₹${bVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    };

    const rmBlockHtml = (selectedBlock === 'all' || selectedBlock === 'RM') ? renderBlockHtml('🌾 RAW MATERIAL (RM) DETAILS BLOCK', rmData, '#fef3c7') : '';
    const fgBlockHtml = (selectedBlock === 'all' || selectedBlock === 'FG') ? renderBlockHtml('📦 FINISHED GOODS (FG) DETAILS BLOCK', fgData, '#dcfce7') : '';
    const wastageBlockHtml = (selectedBlock === 'all' || selectedBlock === 'Wastage') ? renderBlockHtml('🗑️ WASTAGE & REJECTION DETAILS BLOCK', wastageData, '#fee2e2') : '';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
        <div style="text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #1e3a8a; font-size: 22px; text-transform: uppercase;">BVC ERP - Godown Wise Stock Report</h2>
          <p style="margin: 5px 0 0 0; color: #64748b; font-size: 13px;">Block Wise Inventory & Valuation | Generated on: ${new Date().toLocaleString('en-IN')}</p>
        </div>

        ${rmBlockHtml}
        ${fgBlockHtml}
        ${wastageBlockHtml}

        <div style="background-color: #0f172a; color: #ffffff; padding: 12px 16px; border-radius: 6px; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; margin-top: 15px;">
          <span>TOTAL GRAND STOCK INVENTORY:</span>
          <span>Available Qty: ${totalAvailQty} | Weight: ${totalStockWeight.toFixed(2)} Kg | Valuation: ₹${totalStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    `;

    printHtml(htmlContent, 'Godown_Stock_Report');
  };

  return (
    <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, sm: 3 } }}>
      {/* ================= HEADER TOOLBAR ================= */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box sx={{ bgcolor: '#eff6ff', p: 1.25, borderRadius: 2, color: '#2563eb', display: 'flex' }}>
              <WarehouseIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                Godown Wise Stock Report
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                Complete Stock Inventory, Lot Balances & Valuation by Godown Location
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Button
              component={Link}
              to="/stock-alerts"
              variant="outlined"
              color="warning"
              size="small"
              startIcon={<AlertIcon />}
              sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700 }}
            >
              Alerts Dashboard
            </Button>
            <Button
              component={Link}
              to="/stock-alerts/config"
              variant="outlined"
              color="info"
              size="small"
              startIcon={<TuneIcon />}
              sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700 }}
            >
              Min Stock Config
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={fetchGodownStock}
              sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700 }}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              color="success"
              size="small"
              startIcon={<ExportIcon />}
              onClick={handleExportExcel}
              sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700 }}
            >
              Export Excel
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<PrintIcon />}
              onClick={handlePrintReport}
              sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700, bgcolor: '#1e293b', '&:hover': { bgcolor: '#0f172a' } }}
            >
              Print Report
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* ================= FILTER CARD ================= */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', tracking: '0.5px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SearchIcon sx={{ fontSize: 18, color: '#2563eb' }} />
          Filter Inventory, Godown & Stock Levels
        </Typography>

        <form onSubmit={handleSearchSubmit}>
          <Grid container spacing={2} alignItems="center">
            {/* Godown Selection */}
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                select
                fullWidth
                size="small"
                label="Select Godown"
                value={selectedGodown}
                onChange={(e) => setSelectedGodown(e.target.value)}
                sx={{ bgcolor: '#f8fafc' }}
              >
                <MenuItem value="all">📍 All Godowns</MenuItem>
                {godowns.map((g) => (
                  <MenuItem key={g.id} value={String(g.id)}>
                    📍 {g.godown_name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Item Name / Code Search */}
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                fullWidth
                size="small"
                label="Search Item / Code"
                placeholder="Item Name or Code..."
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
                sx={{ bgcolor: '#f8fafc' }}
              />
            </Grid>

            {/* Lot Number Dropdown/Input */}
            <Grid item xs={12} sm={6} md={1.5}>
              {godownLots.length > 0 ? (
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Lot Number"
                  value={searchLotNo}
                  onChange={(e) => setSearchLotNo(e.target.value)}
                  sx={{ bgcolor: '#f8fafc' }}
                >
                  <MenuItem value="">All Lots</MenuItem>
                  {godownLots.map((lot) => (
                    <MenuItem key={lot} value={lot}>
                      {lot}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  fullWidth
                  size="small"
                  label="Lot Number"
                  placeholder="Enter Lot No..."
                  value={searchLotNo}
                  onChange={(e) => setSearchLotNo(e.target.value)}
                  sx={{ bgcolor: '#f8fafc' }}
                />
              )}
            </Grid>

            {/* Block Division Filter */}
            <Grid item xs={12} sm={6} md={1.5}>
              <TextField
                select
                fullWidth
                size="small"
                label="Block Division"
                value={selectedBlock}
                onChange={(e) => setSelectedBlock(e.target.value)}
                sx={{ bgcolor: '#f8fafc' }}
              >
                <MenuItem value="all">📁 All Blocks</MenuItem>
                <MenuItem value="RM">🌾 RM Details</MenuItem>
                <MenuItem value="FG">📦 FG Details</MenuItem>
                <MenuItem value="Wastage">🗑️ Wastage Details</MenuItem>
              </TextField>
            </Grid>

            {/* Stock Level Status Filter */}
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="Stock Status"
                value={searchStockStatus}
                onChange={(e) => setSearchStockStatus(e.target.value)}
                sx={{ bgcolor: '#f8fafc' }}
              >
                <MenuItem value="all">⚡ All Statuses</MenuItem>
                <MenuItem value="CRITICAL" sx={{ color: '#dc2626', fontWeight: 700 }}>🚨 Critical (&le; Critical Lvl)</MenuItem>
                <MenuItem value="LOW" sx={{ color: '#ea580c', fontWeight: 700 }}>⚠️ Low Stock (&le; Min Stock)</MenuItem>
                <MenuItem value="REORDER" sx={{ color: '#d97706', fontWeight: 700 }}>📦 Reorder Level</MenuItem>
                <MenuItem value="NORMAL" sx={{ color: '#16a34a', fontWeight: 700 }}>✅ Normal Stock</MenuItem>
              </TextField>
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12} md={2}>
              <Stack direction="row" spacing={1} width="100%">
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  startIcon={<SearchIcon />}
                  sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700, bgcolor: '#2563eb' }}
                >
                  Search
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<ResetIcon />}
                  onClick={handleReset}
                  sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700 }}
                >
                  Reset
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {/* ================= KPI SUMMARY CARDS ================= */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Godowns
              </Typography>
              <WarehouseIcon sx={{ color: '#2563eb', fontSize: 20 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
              {totalGodownsCount}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500 }}>
              Active Locations
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Total Items
              </Typography>
              <InventoryIcon sx={{ color: '#0284c7', fontSize: 20 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
              {totalItemsCount}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500 }}>
              Unique Products
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Stock Lots
              </Typography>
              <LotIcon sx={{ color: '#7c3aed', fontSize: 20 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
              {totalLotsCount}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500 }}>
              Tracked Lot Nos
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f0f9ff' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
                Available Qty
              </Typography>
              <LayersIcon sx={{ color: '#0284c7', fontSize: 20 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#0369a1', mt: 0.5 }}>
              {totalAvailQty.toLocaleString()}
            </Typography>
            <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 600 }}>
              Total Bag / Units
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Stock Weight
              </Typography>
              <ScaleIcon sx={{ color: '#ea580c', fontSize: 20 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
              {totalStockWeight.toFixed(1)} <Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>Kg</Typography>
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500 }}>
              Total Weight (Kg)
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f0fdf4' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>
                Stock Value
              </Typography>
              <CurrencyRupeeIcon sx={{ color: '#16a34a', fontSize: 20 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#15803d', mt: 0.5 }}>
              ₹{totalStockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </Typography>
            <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 600 }}>
              Total Valuation
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* ================= BLOCK-WISE STOCK DATA TABLES ================= */}
      {loading ? (
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #e2e8f0' }}>
          <CircularProgress size={36} />
          <Typography variant="body2" sx={{ mt: 2, color: '#64748b', fontWeight: 600 }}>
            Loading Stock Data...
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={3}>
          {/* Helper render function for each block */}
          {[
            { key: 'RM', title: '🌾 RAW MATERIAL (RM) DETAILS BLOCK', data: rmData, bg: '#fffbe3', headerColor: '#b45309', borderColor: '#fef08a' },
            { key: 'FG', title: '📦 FINISHED GOODS (FG) DETAILS BLOCK', data: fgData, bg: '#f0fdf4', headerColor: '#15803d', borderColor: '#bbf7d0' },
            { key: 'Wastage', title: '🗑️ WASTAGE & REJECTION DETAILS BLOCK', data: wastageData, bg: '#fef2f2', headerColor: '#b91c1c', borderColor: '#fecaca' }
          ]
            .filter((block) => (selectedBlock === 'all' || selectedBlock === block.key) && block.data.length > 0)
            .map((block) => {
              const bOpen = block.data.reduce((a, b) => a + b.opening_qty, 0);
              const bIn = block.data.reduce((a, b) => a + b.in_qty, 0);
              const bOut = block.data.reduce((a, b) => a + b.out_qty, 0);
              const bAvail = block.data.reduce((a, b) => a + b.available_qty, 0);
              const bWt = block.data.reduce((a, b) => a + b.stock_weight, 0);
              const bVal = block.data.reduce((a, b) => a + b.stock_value, 0);

              return (
                <Paper key={block.key} elevation={0} sx={{ borderRadius: 2, border: `1px solid ${block.borderColor}`, overflow: 'hidden', bgcolor: '#ffffff' }}>
                  {/* Block Header Banner */}
                  <Box p={2} bgcolor={block.bg} borderBottom={`1px solid ${block.borderColor}`} display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: block.headerColor, textTransform: 'uppercase', tracking: '0.5px' }}>
                        {block.title}
                      </Typography>
                      <Chip label={`${block.data.length} Items`} size="small" sx={{ fontWeight: 800, bgcolor: '#ffffff', color: block.headerColor, border: `1px solid ${block.borderColor}` }} />
                    </Box>

                    <Stack direction="row" spacing={3} alignItems="center">
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                        Avail Qty: <strong style={{ color: '#0369a1' }}>{bAvail}</strong>
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                        Stock Wt: <strong>{bWt.toFixed(2)} Kg</strong>
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                        Valuation: <strong style={{ color: '#15803d' }}>₹{bVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </Typography>
                    </Stack>
                  </Box>

                  {/* Block Table */}
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ '& th': { bgcolor: '#f8fafc', color: '#334155', fontWeight: 800, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' } }}>
                          <TableCell align="center" width="50">S.No</TableCell>
                          <TableCell>Godown</TableCell>
                          <TableCell>Item Code</TableCell>
                          <TableCell>Item Name</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell>Lot Number</TableCell>
                          <TableCell align="right">Unit Wt</TableCell>
                          <TableCell align="right">Opening</TableCell>
                          <TableCell align="right">In Qty</TableCell>
                          <TableCell align="right">Out Qty</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe !important', color: '#0369a1 !important' }}>Avail Qty</TableCell>
                          <TableCell align="right">Stock Wt (Kg)</TableCell>
                          <TableCell align="right">Rate (₹)</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#dcfce7 !important', color: '#15803d !important' }}>Stock Value (₹)</TableCell>
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {block.data.map((row, idx) => (
                          <TableRow key={row.id || idx} hover sx={{ '&:nth-of-type(even)': { bgcolor: '#f8fafc' } }}>
                            <TableCell align="center" sx={{ color: '#94a3b8', fontSize: '11px' }}>{idx + 1}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>{row.godown_name}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', color: '#64748b', fontSize: '11px' }}>{row.item_code}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>{row.item_name}</TableCell>
                            <TableCell sx={{ color: '#64748b', fontSize: '11px' }}>{row.category}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>{row.lot_no}</TableCell>
                            <TableCell align="right" sx={{ color: '#475569' }}>{row.unit_weight} {row.unit}</TableCell>
                            <TableCell align="right" sx={{ color: '#64748b' }}>{row.opening_qty}</TableCell>
                            <TableCell align="right" sx={{ color: '#16a34a', fontWeight: 600 }}>{row.in_qty}</TableCell>
                            <TableCell align="right" sx={{ color: '#dc2626', fontWeight: 600 }}>{row.out_qty}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 900, color: '#0284c7', bgcolor: '#f0f9ff' }}>{row.available_qty}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>{row.stock_weight.toFixed(2)} Kg</TableCell>
                            <TableCell align="right" sx={{ color: '#475569' }}>₹{row.rate}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 900, color: '#15803d', bgcolor: '#f0fdf4' }}>
                              ₹{row.stock_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>

                      {/* Block Subtotal */}
                      <TableHead>
                        <TableRow sx={{ '& th': { bgcolor: block.bg, color: '#0f172a', fontWeight: 900, fontSize: '12px' } }}>
                          <TableCell colSpan={7} align="right" sx={{ textTransform: 'uppercase' }}>
                            Subtotal ({block.title}):
                          </TableCell>
                          <TableCell align="right">{bOpen}</TableCell>
                          <TableCell align="right">{bIn}</TableCell>
                          <TableCell align="right">{bOut}</TableCell>
                          <TableCell align="right" sx={{ color: '#0369a1 !important', bgcolor: '#bae6fd !important' }}>{bAvail}</TableCell>
                          <TableCell align="right">{bWt.toFixed(2)} Kg</TableCell>
                          <TableCell align="right">-</TableCell>
                          <TableCell align="right" sx={{ color: '#15803d !important', bgcolor: '#bbf7d0 !important' }}>
                            ₹{bVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                    </Table>
                  </TableContainer>
                </Paper>
              );
            })}

          {filteredData.length === 0 && (
            <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #e2e8f0', color: '#94a3b8' }}>
              No stock items found for the selected filters.
            </Paper>
          )}

          {/* Grand Total Summary Banner */}
          {filteredData.length > 0 && (
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: '#0f172a', color: '#ffffff', border: '1px solid #1e293b' }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, textTransform: 'uppercase', tracking: '0.5px' }}>
                  📊 TOTAL GRAND STOCK INVENTORY SUMMARY (ALL BLOCKS COMBINED)
                </Typography>
                <Stack direction="row" spacing={3} alignItems="center">
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#93c5fd' }}>
                    Avail Qty: <strong style={{ color: '#ffffff', fontSize: '16px' }}>{totalAvailQty}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#fed7aa' }}>
                    Stock Wt: <strong style={{ color: '#ffffff', fontSize: '16px' }}>{totalStockWeight.toFixed(2)} Kg</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#86efac' }}>
                    Grand Valuation: <strong style={{ color: '#ffffff', fontSize: '16px' }}>₹{totalStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </Typography>
                </Stack>
              </Box>
            </Paper>
          )}
        </Stack>
      )}
    </Container>
  );
};

export default GodownStockReport;
