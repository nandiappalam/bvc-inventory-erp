import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  TextField,
  Alert,
  IconButton,
  InputAdornment,
  Divider,
  LinearProgress
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import WarningIcon from '@mui/icons-material/Warning';
import PsycholgyIcon from '@mui/icons-material/Psychology';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function AiIntelligenceCenter() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [forecasts, setForecasts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [supplierRisks, setSupplierRisks] = useState([]);
  const [anomalies, setAnomalies] = useState([]);

  // AI Assistant Chat state
  const [assistantQuery, setAssistantQuery] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your BVC ERP AI Intelligence Assistant. Ask me anything about stock shortages, quarantine lots, supplier risk, or yield anomalies.'
    }
  ]);

  const loadAiData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [foreRes, riskRes, anmRes] = await Promise.all([
        axios.get('/api/ai-intelligence/forecast-recommendations'),
        axios.get('/api/ai-intelligence/supplier-risk'),
        axios.get('/api/ai-intelligence/anomalies')
      ]);

      if (foreRes.data.success) {
        setForecasts(foreRes.data.demandForecasts || []);
        setRecommendations(foreRes.data.purchaseRecommendations || []);
      }
      if (riskRes.data.success) {
        setSupplierRisks(riskRes.data.supplierRisks || []);
      }
      if (anmRes.data.success) {
        setAnomalies(anmRes.data.anomalies || []);
      }
    } catch (err) {
      console.error('Error fetching AI intelligence data:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to load AI intelligence data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAiData();
  }, []);

  const handleSendAssistantQuery = async () => {
    if (!assistantQuery.trim()) return;
    const userText = assistantQuery;
    setAssistantQuery('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: userText }]);

    try {
      const res = await axios.post('/api/ai-intelligence/query-assistant', { query: userText });
      if (res.data.success) {
        setChatMessages((prev) => [
          ...prev,
          { sender: 'ai', text: res.data.answer, payload: res.data.dataPayload }
        ]);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'ai', text: 'Apologies, I encountered an issue querying the ERP intelligence engine.' }
      ]);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1600, margin: '0 auto' }}>
      {/* HEADER */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon sx={{ color: '#8b5cf6' }} /> AI Intelligence Center
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Predictive demand forecasting, automated PO recommendations, supplier risk analytics, and anomaly radar
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadAiData} disabled={loading}>
          Refresh AI Models
        </Button>
      </Box>

      {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}

      {/* TABS CONTAINER */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2, bgcolor: '#faf5ff' }}
        >
          <Tab label="Demand Forecast & Purchase AI" icon={<TrendingUpIcon />} iconPosition="start" />
          <Tab label="Supplier Risk Radar" icon={<WarningIcon />} iconPosition="start" />
          <Tab label="Production & Stock Anomalies" icon={<AutoAwesomeIcon />} iconPosition="start" />
          <Tab label="AI Executive Assistant" icon={<PsycholgyIcon />} iconPosition="start" />
        </Tabs>

        {/* TAB 0: DEMAND FORECAST & PURCHASE RECOMMENDATIONS */}
        {activeTab === 0 && (
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5, color: '#6d28d9' }}>
              30-Day Predictive Demand & Projected Shortage Analysis
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Finished Product</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Monthly Avg</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Confirmed Orders</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>30-Day Forecast</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Available Stock</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Projected Shortage</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Confidence</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Seasonality</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {forecasts.map((f, i) => (
                    <TableRow key={i} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{f.product}</TableCell>
                      <TableCell>{f.historicalMonthlyAvg} KG</TableCell>
                      <TableCell>{f.confirmedOrders} KG</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#1e3a8a' }}>{f.expectedDemand30D} KG</TableCell>
                      <TableCell>{f.currentAvailableStock} KG</TableCell>
                      <TableCell>
                        <Chip
                          label={f.projectedShortage > 0 ? `${f.projectedShortage} KG Shortage` : 'Optimal'}
                          color={f.projectedShortage > 0 ? 'error' : 'success'}
                          size="small"
                          sx={{ fontWeight: 800 }}
                        />
                      </TableCell>
                      <TableCell>{f.confidencePct}%</TableCell>
                      <TableCell sx={{ fontSize: '11px', color: 'text.secondary' }}>{f.seasonalityFactor}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5, color: '#6d28d9', display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShoppingCartIcon /> Automated Purchase Order Recommendations (Phase 2 Integration)
            </Typography>
            <Grid container spacing={2}>
              {recommendations.map((rec) => (
                <Grid item xs={12} md={6} key={rec.id}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderLeft: '5px solid #8b5cf6', bgcolor: '#faf5ff' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#5b21b6' }}>
                        {rec.item}
                      </Typography>
                      <Chip label={`Urgency: ${rec.urgency}`} color={rec.urgency === 'HIGH' ? 'error' : 'warning'} size="small" />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b', mb: 1 }}>
                      Recommended Order: {rec.recommendedQty} {rec.unit}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                      Preferred Supplier: <b>{rec.supplierPreferred}</b> (Lead Time: {rec.leadTimeDays} days)
                    </Typography>
                    <Alert severity="info" sx={{ py: 0.5, fontSize: '12px' }}>
                      AI Rationale: {rec.reason}
                    </Alert>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        )}

        {/* TAB 1: SUPPLIER RISK RADAR */}
        {activeTab === 1 && (
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
              AI Supplier Risk & Quality Analytics
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Supplier Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Risk Level</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>QC Rejection Rate %</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Moisture Trend</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Delivery Delay</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Price Drift</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>AI Observation & Recommendation</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {supplierRisks.map((sr, i) => (
                    <TableRow key={i} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{sr.supplier}</TableCell>
                      <TableCell>
                        <Chip
                          label={sr.riskLevel}
                          color={sr.riskLevel === 'HIGH' ? 'error' : sr.riskLevel === 'MODERATE' ? 'warning' : 'success'}
                          size="small"
                          sx={{ fontWeight: 800 }}
                        />
                      </TableCell>
                      <TableCell>{sr.rejectionRatePct}%</TableCell>
                      <TableCell>{sr.moistureTrend}</TableCell>
                      <TableCell>{sr.deliveryDelayDays} days</TableCell>
                      <TableCell sx={{ color: sr.priceVariancePct.startsWith('+') ? 'error.main' : 'success.main' }}>
                        {sr.priceVariancePct}
                      </TableCell>
                      <TableCell sx={{ fontSize: '12px' }}>{sr.observation}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        )}

        {/* TAB 2: ANOMALY RADAR */}
        {activeTab === 2 && (
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
              Production Yield & Inventory Anomaly Radar
            </Typography>
            <Grid container spacing={2}>
              {anomalies.map((anm) => (
                <Grid item xs={12} key={anm.id}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderLeft: '5px solid #ef4444', bgcolor: '#fff' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WarningIcon color="error" />
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#991b1b' }}>
                          {anm.title}
                        </Typography>
                      </Box>
                      <Chip label={`Detected: ${anm.detectedAt}`} size="small" variant="outlined" />
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5, color: '#334155' }}>
                      {anm.details}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                      POTENTIAL CORRELATED CAUSES:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                      {anm.potentialCauses.map((cause, idx) => (
                        <Chip key={idx} label={cause} size="small" color="warning" variant="outlined" />
                      ))}
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        )}

        {/* TAB 3: AI EXECUTIVE ASSISTANT */}
        {activeTab === 3 && (
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1, color: '#6d28d9' }}>
              Natural Language ERP Assistant
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Type any query regarding ERP stock, quarantine lots, pending POs, financial metrics, or yield anomalies.
            </Typography>

            <Paper variant="outlined" sx={{ p: 2, height: 380, overflowY: 'auto', mb: 2, bgcolor: '#f8fafc' }}>
              {chatMessages.map((msg, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    mb: 1.5
                  }}
                >
                  <Paper
                    sx={{
                      p: 1.5,
                      maxWidth: '75%',
                      bgcolor: msg.sender === 'user' ? '#7c3aed' : '#fff',
                      color: msg.sender === 'user' ? '#fff' : '#1e293b',
                      borderRadius: 2,
                      boxShadow: 1
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontWeight: 500 }}>
                      {msg.text}
                    </Typography>
                  </Paper>
                </Box>
              ))}
            </Paper>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Ask AI e.g. 'Show quarantine lots', 'Pending procurement', 'Yield summary'..."
                value={assistantQuery}
                onChange={(e) => setAssistantQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendAssistantQuery()}
              />
              <Button
                variant="contained"
                onClick={handleSendAssistantQuery}
                sx={{ bgcolor: '#7c3aed', px: 3 }}
                startIcon={<SendIcon />}
              >
                Ask AI
              </Button>
            </Box>
          </CardContent>
        )}
      </Card>
    </Box>
  );
}
