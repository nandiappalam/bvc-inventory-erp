import React, { useState } from 'react';
import { Box, Paper, Divider, Typography, Tab, Tabs, Button, TableRow, TableCell } from '@mui/material';
import { useNavigate } from 'react-router-dom';

import ERPPageLayout from '../../../components/erp/ERPPageLayout';
import ERPBreadcrumb from '../../../components/erp/ERPBreadcrumb';
import ERPHeader from '../../../components/erp/ERPHeader';
import ERPTable from '../../../components/erp/ERPTable';
import parameterTemplates from '../config/parameterTemplates';

export default function QCTemplateMaster() {
  const navigate = useNavigate();
  const products = Object.keys(parameterTemplates);
  const [activeProduct, setActiveProduct] = useState(products[0] || 'Rice');

  const onExit = () => {
    navigate('/quality/dashboard');
  };

  const getTemplateRows = () => {
    const template = parameterTemplates[activeProduct] || { Physical: [], Chemical: [], Microbiology: [] };
    const rows = [];
    
    Object.keys(template).forEach(cat => {
      const list = template[cat];
      list.forEach(p => {
        rows.push({
          ...p,
          category: cat
        });
      });
    });

    return rows;
  };

  return (
    <ERPPageLayout
      containerProps={{ px: { xs: 0, sm: 0 } }}
      breadcrumb={
        <ERPBreadcrumb
          items={[
            { label: 'Quality Module', isCurrent: false },
            { label: 'Master Registries', isCurrent: false },
            { label: 'QC Template Master', isCurrent: true },
          ]}
        />
      }
      header={<ERPHeader title="Quality Control Specifications & Templates" />}
      childrenBottom={
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={onExit}>Exit Specifications</Button>
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        
        {/* Product selector tabs */}
        <Paper sx={{ border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Tabs 
            value={activeProduct} 
            onChange={(e, val) => setActiveProduct(val)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 2, borderBottom: '1px solid #e0e0e0' }}
          >
            {products.map(p => (
              <Tab 
                key={p} 
                label={p === 'BengalGram' ? 'Bengal Gram Template' : `${p} Template`} 
                value={p} 
                sx={{ fontWeight: 800, textTransform: 'none', py: 2 }}
              />
            ))}
          </Tabs>

          <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                {activeProduct === 'BengalGram' ? 'Bengal Gram' : activeProduct} Quality Control Master Specifications
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Standard physical, chemical, and microbiological thresholds required for receipt clearance and processing
              </Typography>
            </Box>

            <ERPTable
              columns={[
                { key: 'param', label: 'Test Parameter Name', sx: { width: '30%' } },
                { key: 'category', label: 'Category', sx: { width: '15%' } },
                { key: 'spec', label: 'Specification Limits', sx: { width: '25%' } },
                { key: 'unit', label: 'Unit', sx: { width: '10%' } },
                { key: 'method', label: 'Standard Method Reference', sx: { width: '20%' } }
              ]}
              rows={getTemplateRows()}
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
                  <TableCell style={{ padding: '12px 8px', fontWeight: 800, color: '#333' }}>
                    {row.specification || (
                      row.min !== undefined && row.max !== undefined ? `${row.min} - ${row.max}` :
                      row.min !== undefined ? `Min ${row.min}` :
                      row.max !== undefined ? `Max ${row.max}` : '-'
                    )}
                  </TableCell>
                  <TableCell style={{ padding: '12px 8px', fontFamily: 'monospace' }}>{row.unit || '-'}</TableCell>
                  <TableCell style={{ padding: '12px 8px', color: '#555', fontStyle: 'italic' }}>{row.method || '-'}</TableCell>
                </TableRow>
              )}
            />
          </Box>
        </Paper>
      </Box>
    </ERPPageLayout>
  );
}
