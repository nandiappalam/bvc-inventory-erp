import React, { useState, useMemo } from 'react';
import { Box, Paper, Divider, Typography, TextField, InputAdornment, Button, TableRow, TableCell } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';

import ERPPageLayout from '../../../components/erp/ERPPageLayout';
import ERPBreadcrumb from '../../../components/erp/ERPBreadcrumb';
import ERPHeader from '../../../components/erp/ERPHeader';
import ERPTable from '../../../components/erp/ERPTable';
import parameterTemplates from '../config/parameterTemplates';

export default function ParameterMaster() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  // Flatten parameters from all templates
  const allParameters = useMemo(() => {
    const list = [];
    const products = Object.keys(parameterTemplates);
    
    products.forEach(prod => {
      const categories = parameterTemplates[prod];
      Object.keys(categories).forEach(cat => {
        const params = categories[cat];
        params.forEach(p => {
          // Avoid duplicate keys in list display
          if (!list.some(item => item.id === p.id)) {
            list.push({
              id: p.id,
              parameter: p.parameter,
              category: cat,
              defaultMethod: p.method || '-',
              defaultUnit: p.unit || '-',
              productsUsedIn: [prod]
            });
          } else {
            // Append product to existing item
            const found = list.find(item => item.id === p.id);
            if (found && !found.productsUsedIn.includes(prod)) {
              found.productsUsedIn.push(prod);
            }
          }
        });
      });
    });

    return list;
  }, []);

  // Filtered
  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return allParameters;
    return allParameters.filter(p => 
      String(p.parameter).toLowerCase().includes(s) ||
      String(p.category).toLowerCase().includes(s) ||
      String(p.defaultMethod).toLowerCase().includes(s) ||
      p.productsUsedIn.some(prod => prod.toLowerCase().includes(s))
    );
  }, [allParameters, search]);

  const onExit = () => {
    navigate('/quality/dashboard');
  };

  return (
    <ERPPageLayout
      containerProps={{ 
        px: { xs: 2, sm: 3 },
        sx: { pt: { xs: 1, sm: 2 } }
      }}
      breadcrumb={
        <ERPBreadcrumb
          items={[
            { label: 'Quality Module', isCurrent: false },
            { label: 'Master Registries', isCurrent: false },
            { label: 'Parameter Master', isCurrent: true },
          ]}
        />
      }
      header={<ERPHeader title="Laboratory Parameter Registry" />}
      childrenBottom={
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={onExit}>Exit Registry</Button>
        </Box>
      }
    >
      <Paper sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
              Master Test Parameters Library
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Review global testing parameters, standard reference methodologies, and base units
            </Typography>
          </Box>
          <TextField
            size="small"
            placeholder="Search Parameter, Method, Item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: { xs: '100%', sm: 280 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size="small" />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Box sx={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
          <ERPTable
            columns={[
              { key: 'param', label: 'Parameter Name', sx: { width: '25%' } },
              { key: 'category', label: 'QA Category', sx: { width: '15%' } },
              { key: 'method', label: 'Default Test Method', sx: { width: '25%' } },
              { key: 'unit', label: 'Default Unit', sx: { width: '15%' } },
              { key: 'prods', label: 'Used In Products', sx: { width: '20%' } }
            ]}
            rows={filtered}
            renderRow={(row) => (
              <TableRow key={row.id}>
                <TableCell style={{ padding: '12px 8px', fontWeight: 700 }}>{row.parameter}</TableCell>
                <TableCell style={{ padding: '12px 8px' }}>
                  <span style={{ 
                    fontWeight: 800, 
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    color: row.category === 'Physical' ? '#0d47a1' : row.category === 'Chemical' ? '#4a148c' : '#1b5e20',
                    backgroundColor: row.category === 'Physical' ? '#e3f2fd' : row.category === 'Chemical' ? '#f3e5f5' : '#e8f5e9'
                  }}>
                    {row.category}
                  </span>
                </TableCell>
                <TableCell style={{ padding: '12px 8px', color: '#555', fontStyle: 'italic' }}>{row.defaultMethod}</TableCell>
                <TableCell style={{ padding: '12px 8px', fontFamily: 'monospace' }}>{row.defaultUnit}</TableCell>
                <TableCell style={{ padding: '12px 8px', fontWeight: 600, color: '#333' }}>
                  {row.productsUsedIn.join(', ')}
                </TableCell>
              </TableRow>
            )}
          />
        </Box>
      </Paper>
    </ERPPageLayout>
  );
}
