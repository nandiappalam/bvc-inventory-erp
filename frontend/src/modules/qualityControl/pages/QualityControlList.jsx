import React, { useEffect, useMemo, useState } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  CircularProgress, 
  Alert, 
  InputAdornment,
  Tabs,
  Tab,
  TableRow,
  TableCell,
  Dialog,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Chip,
  Divider
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import VehiclePrint from '../../vehicle/VehiclePrint';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import StoreIcon from '@mui/icons-material/Store';

import ERPPageLayout from '../../../components/erp/ERPPageLayout';
import ERPBreadcrumb from '../../../components/erp/ERPBreadcrumb';
import ERPHeader from '../../../components/erp/ERPHeader';
import ERPTable from '../../../components/erp/ERPTable';
import api from '../../../services/api';

const pendingColumns = [
  { key: 'lot_no', label: 'Lot Number', sx: { width: '15%' } },
  { key: 'item_name', label: 'Item / Product', sx: { width: '25%' } },
  { key: 'supplier_name', label: 'Supplier Name', sx: { width: '25%' } },
  { key: 'received_qty', label: 'Arrived Qty', sx: { width: '15%' } },
  { key: 'actions', label: 'Actions', sx: { width: '20%', textAlign: 'right' } }
];

const completedColumns = [
  { key: 'qc_no', label: 'QC No', sx: { width: '15%' } },
  { key: 'rm_lot_no', label: 'Lot Number', sx: { width: '15%' } },
  { key: 'item_name', label: 'Item / Product', sx: { width: '20%' } },
  { key: 'supplier_name', label: 'Supplier', sx: { width: '20%' } },
  { key: 'inspection_date', label: 'Date', sx: { width: '10%' } },
  { key: 'overall_result', label: 'Status', sx: { width: '10%' } },
  { key: 'actions', label: 'Actions', sx: { width: '20%', textAlign: 'right' } }
];

export default function QualityControlList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  // States
  const [pendingLots, setPendingLots] = useState([]);
  const [completedTests, setCompletedTests] = useState([]);
  const [godowns, setGodowns] = useState([]);
  const [vehicleMovementsIn, setVehicleMovementsIn] = useState([]);
  const [allocationsMap, setAllocationsMap] = useState({});
  const [activePrintMovementId, setActivePrintMovementId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = () => {
    setLoading(true);
    setError('');

    Promise.all([
      api('/qc/pending'),
      api('/quality/registers'),
      api('/masters/all/godowns'),
      api('/vehicle-movements')
    ])
      .then(([pendingRes, registersRes, godownsRes, vehiclesRes]) => {
        if (pendingRes?.success) {
          setPendingLots(pendingRes.data || []);
        }
        if (registersRes?.success) {
          const qcData = registersRes.data?.qc || [];
          setCompletedTests(qcData);

          const initialMap = {};
          qcData.forEach(t => {
            if (t.allocations && t.allocations.length > 0) {
              initialMap[t.rm_lot_no] = t.allocations.map(a => ({
                godownId: a.godown_id || '',
                qty: a.quantity !== undefined ? a.quantity : ''
              }));
            } else {
              initialMap[t.rm_lot_no] = [{
                godownId: t.godown_id || '',
                qty: t.quantity !== undefined ? t.quantity : ''
              }];
            }
          });
          setAllocationsMap(initialMap);
        }
        if (godownsRes?.success) {
          setGodowns(godownsRes.data || []);
        }
        if (Array.isArray(vehiclesRes)) {
          // Filter vehicles with IN status
          const inMovements = vehiclesRes.filter(v => (v.status || '').toUpperCase() === 'IN' || (v.gate_in_time && !v.gate_out_time));
          setVehicleMovementsIn(inMovements);
        } else if (vehiclesRes?.data) {
          const inMovements = (vehiclesRes.data || []).filter(v => (v.status || '').toUpperCase() === 'IN' || (v.gate_in_time && !v.gate_out_time));
          setVehicleMovementsIn(inMovements);
        }
      })
      .catch((err) => {
        console.error('Failed to load QC dashboard data:', err);
        setError('Error loading quality control list records.');
      })
      .finally(() => setLoading(false));
  };

  const handleAddGodownRow = (lotNo) => {
    setAllocationsMap(prev => {
      const current = prev[lotNo] || [{ godownId: '', qty: '' }];
      return {
        ...prev,
        [lotNo]: [...current, { godownId: '', qty: '' }]
      };
    });
  };

  const handleRemoveGodownRow = (lotNo, index) => {
    setAllocationsMap(prev => {
      const current = prev[lotNo] || [];
      if (current.length <= 1) return prev;
      const updated = current.filter((_, i) => i !== index);
      return {
        ...prev,
        [lotNo]: updated
      };
    });
  };

  const handleAllocationChange = (lotNo, index, field, value) => {
    setAllocationsMap(prev => {
      const current = prev[lotNo] || [{ godownId: '', qty: '' }];
      const updated = current.map((item, i) => {
        if (i === index) {
          return { ...item, [field]: value };
        }
        return item;
      });
      return {
        ...prev,
        [lotNo]: updated
      };
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute KPI Statistics
  const stats = useMemo(() => {
    const totalPending = pendingLots.length;
    const totalCompleted = completedTests.length;
    const accepted = completedTests.filter(t => t.overall_result === 'ACCEPTED' || t.overall_result === 'PASS').length;
    const hold = completedTests.filter(t => t.overall_result === 'HOLD').length;
    const rejected = completedTests.filter(t => t.overall_result === 'REJECTED' || t.overall_result === 'FAIL').length;
    const passRate = totalCompleted > 0 ? Math.round((accepted / totalCompleted) * 100) : 100;

    return {
      totalPending,
      totalCompleted,
      accepted,
      hold,
      rejected,
      passRate: `${passRate}%`
    };
  }, [pendingLots, completedTests]);

  // Filtered lists based on search
  const filteredPending = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return pendingLots;
    return pendingLots.filter(l => 
      String(l.lot_no || '').toLowerCase().includes(q) ||
      String(l.item_name || '').toLowerCase().includes(q) ||
      String(l.supplier_name || '').toLowerCase().includes(q)
    );
  }, [pendingLots, searchQuery]);

  const filteredHistory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return completedTests;
    return completedTests.filter(h => 
      String(h.qc_no || '').toLowerCase().includes(q) ||
      String(h.rm_lot_no || '').toLowerCase().includes(q) ||
      String(h.item_name || '').toLowerCase().includes(q) ||
      String(h.supplier_name || '').toLowerCase().includes(q)
    );
  }, [completedTests, searchQuery]);

  const handlePerformLabTest = (lot) => {
    navigate(`/entry/quality-control-create?lotNo=${encodeURIComponent(lot.lot_no)}&supplier=${encodeURIComponent(lot.supplier_name)}&item=${encodeURIComponent(lot.item_name)}&purchaseId=${encodeURIComponent(lot.purchase_id)}`);
  };

  const handleViewInspection = (qcId) => {
    navigate(`/entry/quality-control-create?id=${qcId}`);
  };

  const handleViewIqr = (qcId) => {
    navigate(`/quality/iqr-display/${qcId}`);
  };

  const handleViewCoa = (qcId) => {
    navigate(`/quality/coa-display/${qcId}`);
  };

  const handleReturnLot = (lotNo) => {
    if (!lotNo) return;
    api('/qc/unload', {
      method: 'POST',
      body: { lotNo, status: 'RETURNED' }
    })
      .then((res) => {
        if (res?.success) {
          const rd = res.returnData || {};
          const party = rd.partyName || '';
          const item = rd.itemName || '';
          const q = rd.qty || '';
          const w = rd.weight || '';
          const pId = rd.purchaseId || '';
          const invNo = rd.invNo || '';

          navigate(`/entry/purchase-return-create?partyName=${encodeURIComponent(party)}&itemName=${encodeURIComponent(item)}&qty=${q}&weight=${w}&lotNo=${encodeURIComponent(lotNo)}&referenceId=${pId}&invNo=${encodeURIComponent(invNo)}`);
        } else {
          alert('Failed to initiate return: ' + (res?.message || 'Unknown error'));
        }
      })
      .catch((err) => {
        console.error('Error initiating return:', err);
        alert('Failed to communicate with server.');
      });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
        <Box sx={{ ml: 2 }}>Loading Quality Control registers...</Box>
      </Box>
    );
  }

  return (
    <ERPPageLayout
      containerProps={{ px: { xs: 0, sm: 0 } }}
      breadcrumb={
        <ERPBreadcrumb
          items={[
            { label: 'Entry', isCurrent: false },
            { label: 'Quality Control', isCurrent: true },
          ]}
        />
      }
      header={
        <ERPHeader 
          title="Quality Control (QC) Registers" 
          action={
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => navigate('/entry/quality-control-create')}
            >
              New QA Entry
            </Button>
          }
        />
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        
        {error && (
          <Alert severity="error">{error}</Alert>
        )}

        {/* Vehicle Movement Entry 'IN' Notification Alert Banner */}
        {vehicleMovementsIn.length > 0 && (
          <Paper
            elevation={2}
            sx={{
              p: 2,
              backgroundColor: '#eff6ff',
              borderLeft: '6px solid #2563eb',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(37,99,235,0.1)'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label="QC NOTIFICATION"
                  color="primary"
                  size="small"
                  sx={{ fontWeight: 'bold', fontSize: '11px', backgroundColor: '#1d4ed8' }}
                />
                <Typography variant="subtitle1" fontWeight="bold" color="#1e3a8a">
                  Vehicle Movement Entry "IN" Alert — Gate Entry Received ({vehicleMovementsIn.length} Vehicles In Gate)
                </Typography>
              </Box>
              <Typography variant="caption" fontWeight="bold" color="#2563eb">
                QC Ready to check Item Sample!
              </Typography>
            </Box>

            <Divider sx={{ my: 1, borderColor: '#bfdbfe' }} />

            <Grid container spacing={1.5}>
              {vehicleMovementsIn.slice(0, 4).map((vm) => (
                <Grid item xs={12} sm={6} md={3} key={vm.id || vm.vehicle_no}>
                  <Card variant="outlined" sx={{ backgroundColor: '#ffffff', borderColor: '#93c5fd', p: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                      <Typography variant="body2" fontWeight="bold" color="#1e293b">
                        🚛 {vm.vehicle_no || vm.vehicleNo}
                      </Typography>
                      <Chip label="ENTRY IN" color="info" size="small" sx={{ fontSize: '10px', height: '20px', fontWeight: 'bold' }} />
                    </Box>
                    <Typography variant="caption" display="block" color="text.secondary">
                      <strong>Party:</strong> {vm.party_name || vm.partyName || 'Supplier'}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      <strong>Item:</strong> {vm.item_name || vm.itemName || 'Sample Goods'}
                    </Typography>
                    <Typography variant="caption" display="block" color="#2563eb" fontWeight="bold" sx={{ mt: 0.5 }}>
                      🕒 Gate In: {vm.gate_in_time ? String(vm.gate_in_time).replace('T', ' ').substring(0, 16) : 'Just Now'}
                    </Typography>
                    <Button
                      fullWidth
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={() => navigate('/entry/quality-control-create', { state: { vehicleNo: vm.vehicle_no, itemName: vm.item_name, supplier: vm.party_name } })}
                      sx={{ mt: 1, textTransform: 'none', fontSize: '11px', fontWeight: 'bold' }}
                    >
                      Check Item Sample
                    </Button>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        )}

        {/* KPI Dashboard cards */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderLeft: '4px solid #ed6c02', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>
                  Pending QC Queue
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5, color: '#ed6c02' }}>
                  {stats.totalPending} <span style={{ fontSize: 13, fontWeight: 700, color: '#757575' }}>lots</span>
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderLeft: '4px solid #1976d2', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>
                  Completed Tests
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5, color: '#1976d2' }}>
                  {stats.totalCompleted} <span style={{ fontSize: 13, fontWeight: 700, color: '#757575' }}>records</span>
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderLeft: '4px solid #2e7d32', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>
                  Approved Lots
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5, color: '#2e7d32' }}>
                  {stats.accepted} <span style={{ fontSize: 13, fontWeight: 700, color: '#757575' }}>passed</span>
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderLeft: '4px solid #2e7d32', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>
                  Acceptance Rate
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5, color: '#2e7d32' }}>
                  {stats.passRate}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Search bar and tabs */}
        <Paper sx={{ p: 1, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, newVal) => setActiveTab(newVal)} 
            indicatorColor="primary" 
            textColor="primary"
          >
            <Tab label={`Pending Lots Queue (${filteredPending.length})`} sx={{ fontWeight: 700 }} />
            <Tab label={`Completed QC Register (${filteredHistory.length})`} sx={{ fontWeight: 700 }} />
            <Tab label="Plant Disposal & Unloading" sx={{ fontWeight: 700 }} />
          </Tabs>

          <TextField
            size="small"
            placeholder="Search by lot number, product, or supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: '100%', sm: 300 } }}
          />
        </Paper>

        {/* Tab contents */}
        {activeTab === 0 && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
              Pending Quality Inspections
            </Typography>
            {filteredPending.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                No pending lots found. All arrived lots have completed QC. Go to "Completed QC Register" tab to view them, or arrive a new material in the Purchase module.
              </Box>
            ) : (
              <ERPTable
                columns={pendingColumns}
                rows={filteredPending}
                renderRow={(row, idx) => (
                  <TableRow key={row.stock_lot_id ? `${row.stock_lot_id}-${idx}` : idx}>
                    <TableCell style={{ fontWeight: 800, padding: '12px' }}>{row.lot_no}</TableCell>
                    <TableCell style={{ padding: '12px' }}>{row.item_name}</TableCell>
                    <TableCell style={{ padding: '12px' }}>{row.supplier_name || '-'}</TableCell>
                    <TableCell style={{ padding: '12px' }}>{row.received_qty} bags</TableCell>
                    <TableCell style={{ padding: '12px', textAlign: 'right' }}>
                      <Button
                        size="small"
                        variant="contained"
                        color="warning"
                        startIcon={<AssignmentIcon fontSize="small" />}
                        onClick={() => handlePerformLabTest(row)}
                        sx={{ fontWeight: 800 }}
                      >
                        Perform Lab Test
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              />
            )}
          </Paper>
        )}

        {activeTab === 1 && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
              Completed Laboratory Inspections Register
            </Typography>
            {filteredHistory.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                No completed lab tests found. Select a lot from the "Pending Lots Queue" tab to perform a quality inspection.
              </Box>
            ) : (
              <ERPTable
                columns={completedColumns}
                rows={filteredHistory}
                renderRow={(row, idx) => {
                  const result = row.overall_result || 'ACCEPTED';
                  const badgeColor = result === 'ACCEPTED' || result === 'PASS' 
                    ? '#2e7d32' 
                    : result === 'REJECTED' || result === 'FAIL' 
                    ? '#d32f2f' 
                    : '#ed6c02';
                  
                  const bgBadge = result === 'ACCEPTED' || result === 'PASS' 
                    ? '#e8f5e9' 
                    : result === 'REJECTED' || result === 'FAIL' 
                    ? '#ffebee' 
                    : '#fff3e0';

                   return (
                    <TableRow key={row.id ? `${row.id}-${idx}` : idx}>
                      <TableCell style={{ fontWeight: 800, padding: '12px' }}>{row.qc_no}</TableCell>
                      <TableCell style={{ fontWeight: 700, padding: '12px' }}>{row.rm_lot_no}</TableCell>
                      <TableCell style={{ padding: '12px' }}>{row.item_name}</TableCell>
                      <TableCell style={{ padding: '12px' }}>{row.supplier_name || '-'}</TableCell>
                      <TableCell style={{ padding: '12px' }}>{row.inspection_date || '-'}</TableCell>
                      <TableCell style={{ padding: '12px' }}>
                        <Box 
                          sx={{ 
                            fontWeight: 900, 
                            fontSize: 11,
                            color: badgeColor,
                            backgroundColor: bgBadge,
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            display: 'inline-block',
                            textTransform: 'uppercase'
                          }}
                        >
                          {result}
                        </Box>
                      </TableCell>
                      <TableCell style={{ padding: '12px', textAlign: 'right' }}>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleViewInspection(row.id)}
                          >
                            Specs
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="info"
                            startIcon={<DescriptionIcon fontSize="small" />}
                            onClick={() => handleViewIqr(row.id)}
                            sx={{ fontWeight: 700 }}
                          >
                            ICR
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => handleViewCoa(row.id)}
                            sx={{ fontWeight: 700 }}
                          >
                            COA
                          </Button>
                          {(result === 'REJECTED' || result === 'FAIL' || row.unloading_status === 'RETURNED' || row.return_registered) && (
                            (row.unloading_status === 'RETURNED' || row.return_registered) ? (
                              <Chip 
                                label="RETURNED" 
                                color="error" 
                                size="small" 
                                sx={{ fontWeight: 800 }} 
                              />
                            ) : (
                              <Button
                                size="small"
                                variant="contained"
                                color="error"
                                onClick={() => handleReturnLot(row.rm_lot_no)}
                                sx={{ fontWeight: 800 }}
                              >
                                Return
                              </Button>
                            )
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                }}
              />
            )}
          </Paper>
        )}

        {activeTab === 2 && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              Plant Disposal, Godown Allocation & Unloading Verification
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              Assign godowns for approved arrived products. You can split unloading quantities across multiple godowns. Total allocated quantity must match purchase quantity to issue a Gate Pass and release vehicles.
            </Typography>

            {completedTests.filter(t => (t.overall_result === 'ACCEPTED' || t.overall_result === 'PASS') && t.purchase_id && t.supplier_name).length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                No approved raw material lots available for disposal. All completed lots must pass QC inspection first.
              </Box>
            ) : (
              <ERPTable
                columns={[
                  { key: 'rm_lot_no', label: 'Lot No', sx: { width: '12%' } },
                  { key: 'item_name', label: 'Item Name', sx: { width: '15%' } },
                  { key: 'supplier_name', label: 'Supplier', sx: { width: '13%' } },
                  { key: 'quantity', label: 'Purchase Qty', sx: { width: '12%' } },
                  { key: 'status', label: 'Godown Allocation & Unloading', sx: { width: '32%' } },
                  { key: 'actions', label: 'Disposal Actions', sx: { width: '16%', textAlign: 'right' } }
                ]}
                rows={completedTests.filter(t => (t.overall_result === 'ACCEPTED' || t.overall_result === 'PASS') && t.purchase_id && t.supplier_name)}
                renderRow={(row, idx) => {
                  const isUnloaded = row.unloading_status === 'UNLOADED';
                  const lotNo = row.rm_lot_no;
                  const targetQty = parseFloat(row.quantity) || 0;

                  const lotAllocations = allocationsMap[lotNo] || (
                    row.allocations && row.allocations.length > 0
                      ? row.allocations.map(a => ({ godownId: a.godown_id, qty: a.quantity }))
                      : [{ godownId: row.godown_id || '', qty: row.quantity || '' }]
                  );

                  const totalAllocated = lotAllocations.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
                  const isQtyMatched = Math.abs(totalAllocated - targetQty) < 0.001;

                  const handleConfirmUnload = async () => {
                    if (lotAllocations.some(a => !a.godownId)) {
                      alert('Please select a target Godown for every allocation row.');
                      return;
                    }
                    if (lotAllocations.some(a => !a.qty || parseFloat(a.qty) <= 0)) {
                      alert('Please enter a valid positive quantity for every allocation row.');
                      return;
                    }
                    if (!isQtyMatched) {
                      alert(`Verification Failed!\nTotal allocated quantity (${totalAllocated} bags) MUST exactly equal the Purchase quantity (${targetQty} bags) to confirm unloading.`);
                      return;
                    }

                    try {
                      const res = await api('/qc/confirm-disposal', {
                        method: 'POST',
                        body: {
                          lotNo: row.rm_lot_no,
                          purchaseId: row.purchase_id,
                          allocations: lotAllocations.map(a => ({
                            godownId: a.godownId,
                            qty: parseFloat(a.qty)
                          }))
                        }
                      });

                      if (res?.success) {
                        alert('✓ Plant unloading verified! Items allocated to godowns and Vehicle Gate Pass generated successfully.');
                        loadData();
                      } else {
                        alert('Unloading failed: ' + (res?.message || 'Unknown error'));
                      }
                    } catch (err) {
                      console.error(err);
                      alert('Failed to confirm unloading.');
                    }
                  };

                  const handlePrintGatePass = async () => {
                    if (!row.purchase_id && !row.rm_lot_no) {
                      alert('No purchase reference found for this lot.');
                      return;
                    }
                    try {
                      const movements = await api('/vehicle-movements');
                      const movement = (movements || []).find(m => {
                        const isPurchase = String(m.reference_type || '').toUpperCase() === 'PURCHASE';
                        if (!isPurchase) return false;

                        const mLot = String(m.lot_no || '').toUpperCase().trim();
                        const rLot = String(row.rm_lot_no || '').toUpperCase().trim();
                        if (mLot && rLot && mLot === rLot) {
                          return true;
                        }

                        const mRef = String(m.reference_id || '').toUpperCase().trim();
                        const rPurId = String(row.purchase_id || '').toUpperCase().trim();
                        if (mRef && rPurId && mRef === rPurId) {
                          return true;
                        }

                        const rInv = String(row.invoice_no || '').toUpperCase().trim();
                        if (rInv && mRef && mRef === rInv) {
                          return true;
                        }

                        const rReceipt = String(row.receipt_no || '').toUpperCase().trim();
                        if (rReceipt && mRef && mRef === rReceipt) {
                          return true;
                        }

                        return false;
                      });

                      if (movement) {
                        setActivePrintMovementId(movement.id);
                      } else {
                        alert('No vehicle movement record found for this Purchase receipt.');
                      }
                    } catch (err) {
                      console.error(err);
                      alert('Error loading vehicle movement record.');
                    }
                  };

                  return (
                    <TableRow key={row.id ? `${row.id}-${idx}` : idx}>
                      <TableCell sx={{ fontWeight: 800 }}>{row.rm_lot_no}</TableCell>
                      <TableCell>{row.item_name}</TableCell>
                      <TableCell>{row.supplier_name || '-'}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{row.quantity} bags</TableCell>
                      <TableCell>
                        {isUnloaded ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Box sx={{ color: '#2e7d32', fontWeight: 900, fontSize: 11, bgcolor: '#e8f5e9', px: 1, py: 0.5, borderRadius: 1, display: 'inline-block', width: 'fit-content', textTransform: 'uppercase' }}>
                              ✓ Unloaded & Verified
                            </Box>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              {(row.allocations && row.allocations.length > 0 ? row.allocations : [{ godown_name: row.godown_name, godown_id: row.godown_id, quantity: row.quantity }]).map((alloc, aIdx) => (
                                <Box key={aIdx} sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                  <StoreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                    {alloc.godown_name || `Godown ID: ${alloc.godown_id}`}:
                                  </Typography>
                                  <Chip 
                                    label={`${alloc.quantity} bags`} 
                                    size="small" 
                                    variant="outlined" 
                                    color="success" 
                                    sx={{ fontWeight: 800, height: 22, fontSize: '0.75rem' }} 
                                  />
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, my: 1 }}>
                            {lotAllocations.map((alloc, aIdx) => (
                              <Box key={aIdx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <FormControl size="small" sx={{ minWidth: 150 }}>
                                  <InputLabel id={`godown-select-label-${lotNo}-${aIdx}`}>Select Godown</InputLabel>
                                  <Select
                                    labelId={`godown-select-label-${lotNo}-${aIdx}`}
                                    value={alloc.godownId || ''}
                                    label="Select Godown"
                                    onChange={(e) => handleAllocationChange(lotNo, aIdx, 'godownId', e.target.value)}
                                  >
                                    {godowns.map(g => (
                                      <MenuItem key={g.id} value={g.id}>
                                        {g.godown_name}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>

                                <TextField
                                  size="small"
                                  type="number"
                                  label="Qty (bags)"
                                  value={alloc.qty}
                                  onChange={(e) => handleAllocationChange(lotNo, aIdx, 'qty', e.target.value)}
                                  sx={{ width: 110 }}
                                />

                                {lotAllocations.length > 1 && (
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleRemoveGodownRow(lotNo, aIdx)}
                                    title="Remove Godown Row"
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </Box>
                            ))}

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Button
                                size="small"
                                variant="outlined"
                                color="secondary"
                                startIcon={<AddIcon fontSize="small" />}
                                onClick={() => handleAddGodownRow(lotNo)}
                                sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem' }}
                              >
                                + Add Godown Row
                              </Button>

                              <Chip
                                size="small"
                                label={`Allocated: ${totalAllocated} / ${targetQty} bags`}
                                color={isQtyMatched ? "success" : "warning"}
                                variant={isQtyMatched ? "filled" : "outlined"}
                                sx={{ fontWeight: 800, fontSize: '0.75rem' }}
                              />
                            </Box>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        {isUnloaded ? (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={handlePrintGatePass}
                            sx={{ fontWeight: 800 }}
                          >
                            Print Gate Pass
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            onClick={handleConfirmUnload}
                            sx={{ fontWeight: 800 }}
                          >
                            Verify & Confirm
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }}
              />
            )}
          </Paper>
        )}

      </Box>

      {/* Vehicle Print / Gate Pass Dialog Modal */}
      {activePrintMovementId && (
        <Dialog open={true} onClose={() => setActivePrintMovementId(null)} maxWidth="sm" fullWidth>
          <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800 }}>
            Vehicle Gate Pass
            <Button size="small" variant="outlined" onClick={() => setActivePrintMovementId(null)}>
              Close
            </Button>
          </DialogTitle>
          <DialogContent dividers sx={{ p: 1 }}>
            <VehiclePrint movementId={activePrintMovementId} onClose={() => setActivePrintMovementId(null)} />
          </DialogContent>
        </Dialog>
      )}

    </ERPPageLayout>
  );
}
