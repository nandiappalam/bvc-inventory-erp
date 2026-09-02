import React, { useState, useEffect } from 'react';
import {
  Box,
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
  IconButton,
  TextField,
  MenuItem,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import api from '../../services/api.js';

const DOC_CATEGORIES = [
  { code: 'ALL', label: 'All Documents (D1–D11)', type: '' },
  { code: 'D1', label: 'D1: Work Instruction File', type: 'Manual / Management', color: 'default' },
  { code: 'D2', label: 'D2: Hazard / CCP / OPRP / VACCP', type: 'ERP + Manual', color: 'primary' },
  { code: 'D3', label: 'D3: MTR Signed Specification', type: 'ERP + Manual', color: 'primary' },
  { code: 'D4', label: 'D4: Training Record', type: 'Master + Manual', color: 'secondary' },
  { code: 'D5', label: 'D5: SOPs Repository', type: 'Manual / Upload', color: 'default' },
  { code: 'D6', label: 'D6: RCCA Record', type: 'ERP + Manual', color: 'warning' },
  { code: 'D7', label: 'D7: Medical Fitness Certificate', type: 'Employee + Upload', color: 'info' },
  { code: 'D8', label: 'D8: FOSTAC Training Certificate', type: 'Employee + Upload', color: 'info' },
  { code: 'D9', label: 'D9: Recall / Withdraw System', type: 'Strong ERP Integration', color: 'error' },
  { code: 'D10', label: 'D10: Halal Declaration', type: 'ERP + Manual', color: 'success' },
  { code: 'D11', label: 'D11: Process Flow Chart', type: 'ERP + Manual', color: 'primary' },
];

export default function ControlledDocumentsList({ onViewDoc, onEditDoc, onCreateDoc, onRefresh }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchDocs = async () => {
    try {
      setLoading(true);
      let endpoint = '/compliance/documents';
      const params = [];
      if (selectedCategory !== 'ALL') {
        params.push(`doc_code=${selectedCategory}`);
      }
      if (searchQuery) {
        params.push(`search=${encodeURIComponent(searchQuery)}`);
      }
      if (params.length > 0) {
        endpoint += `?${params.join('&')}`;
      }

      const data = await api(endpoint);
      if (data && data.success) {
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [selectedCategory, searchQuery]);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      const data = await api(`/compliance/documents/${id}`, { method: 'DELETE' });
      if (data && data.success) {
        fetchDocs();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  const filteredDocs = documents.filter(doc => {
    if (statusFilter !== 'ALL' && doc.status !== statusFilter) return false;
    return true;
  });

  return (
    <Box>
      {/* Category Filter Chips */}
      <Box sx={{ mb: 2.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {DOC_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.code;
          return (
            <Chip
              key={cat.code}
              label={cat.label}
              onClick={() => setSelectedCategory(cat.code)}
              color={isSelected ? 'primary' : 'default'}
              variant={isSelected ? 'filled' : 'outlined'}
              sx={{
                fontWeight: isSelected ? 'bold' : 'normal',
                cursor: 'pointer',
                '&:hover': { opacity: 0.9 },
              }}
            />
          );
        })}
      </Box>

      {/* Action Bar */}
      <Card sx={{ mb: 3, p: 2, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4} md={5}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search by Title, Doc No, Item, or Dept..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
              }}
            />
          </Grid>

          <Grid item xs={12} sm={4} md={3}>
            <TextField
              size="small"
              select
              fullWidth
              label="Status Filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="ALL">All Statuses</MenuItem>
              <MenuItem value="APPROVED">Approved / Active</MenuItem>
              <MenuItem value="UNDER_REVIEW">Under Review</MenuItem>
              <MenuItem value="DRAFT">Draft</MenuItem>
              <MenuItem value="OBSOLETE">Obsolete</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4} md={4} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', sm: 'flex-end' }, gap: 1 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => onCreateDoc(selectedCategory === 'ALL' ? 'D1' : selectedCategory)}
              sx={{ fontWeight: 'bold' }}
            >
              New {selectedCategory === 'ALL' ? 'Document' : selectedCategory}
            </Button>
          </Grid>
        </Grid>
      </Card>

      {/* Documents Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filteredDocs.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', backgroundColor: '#fdfdfd', border: '1px dashed #cbd5e1' }}>
          <MenuBookIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1 }} />
          <Typography variant="h6" color="text.secondary">
            No Controlled Documents found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Click below to create your first controlled document for this category.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => onCreateDoc(selectedCategory === 'ALL' ? 'D1' : selectedCategory)}
          >
            Create New Document
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: 70 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Doc Number</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Title & Description</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Department / Item</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 70 }}>Ver.</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Effective Date</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Approvals</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 110 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: 130 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDocs.map((doc) => {
                const isApproved = doc.status === 'APPROVED';
                return (
                  <TableRow key={doc.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell>
                      <Chip
                        size="small"
                        label={doc.doc_code}
                        color={doc.doc_code === 'D9' ? 'error' : doc.doc_code === 'D2' || doc.doc_code === 'D3' ? 'primary' : 'default'}
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1f4fb2' }}>
                      {doc.doc_number}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                        {doc.title}
                      </Typography>
                      {doc.remarks && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 360, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {doc.remarks}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{doc.department || '—'}</Typography>
                      {doc.item_name && (
                        <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 'bold', display: 'block' }}>
                          Item: {doc.item_name}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>v{doc.version || '1.0'}</TableCell>
                    <TableCell>{doc.effective_date || '—'}</TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        <strong>Prep:</strong> {doc.prepared_by || '—'}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', color: 'success.main' }}>
                        <strong>Appr:</strong> {doc.approved_by || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={doc.status}
                        color={isApproved ? 'success' : doc.status === 'UNDER_REVIEW' ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Tooltip title="View & Print Official Document">
                        <IconButton size="small" color="primary" onClick={() => onViewDoc(doc)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Document">
                        <IconButton size="small" color="secondary" onClick={() => onEditDoc(doc)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(doc.id, doc.title)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
