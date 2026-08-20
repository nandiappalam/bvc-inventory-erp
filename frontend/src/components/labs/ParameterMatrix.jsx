import React from 'react';
import { Box, TableCell, TableRow, TextField } from '@mui/material';

import ERPTable from '../erp/ERPTable';

const ParameterMatrix = ({ parameters = [], onChangeRow }) => {
  const columns = [
    { key: 'parameter', label: 'Parameter', sx: { width: 240 } },
    { key: 'specification', label: 'Specification', sx: { width: 180 } },
    { key: 'result', label: 'Result', sx: { width: 160 } },
    { key: 'unit', label: 'Unit', sx: { width: 90 } },
    { key: 'min', label: 'Min', sx: { width: 90 } },
    { key: 'max', label: 'Max', sx: { width: 90 } },
    { key: 'method', label: 'Method', sx: { width: 160 } },
    { key: 'status', label: 'Status', sx: { width: 120 } },
    { key: 'remarks', label: 'Remarks', sx: { width: 200 } },
  ];

  const rows = parameters;

  return (
    <Box>
      <ERPTable
        columns={columns}
        rows={rows}
        headerSx={{
          '& .MuiTableCell-root': { paddingY: 0.75 },
        }}
        bodySx={{
          '& .MuiTableCell-root': { paddingY: 0.75, verticalAlign: 'top' },
        }}
        renderRow={(p) => {
          const handleResultChange = (value) => {
            onChangeRow?.(p.id, 'result', value);
          };
          const handleRemarksChange = (value) => {
            onChangeRow?.(p.id, 'remarks', value);
          };

          return (
            <TableRow key={p.id}>
              <TableCell sx={{ fontWeight: 800 }}>{p.parameter}</TableCell>
              <TableCell sx={{ color: '#333' }}>{p.specification || '-'}</TableCell>
              <TableCell>
                <TextField
                  size="small"
                  value={p.result ?? ''}
                  onChange={(e) => handleResultChange(e.target.value)}
                  fullWidth
                />
              </TableCell>
              <TableCell>{p.unit || '-'}</TableCell>
              <TableCell>{p.min ?? '-'}</TableCell>
              <TableCell>{p.max ?? '-'}</TableCell>
              <TableCell>{p.method || '-'}</TableCell>
              <TableCell>{p.status || '-'}</TableCell>
              <TableCell>
                <TextField
                  size="small"
                  value={p.remarks ?? ''}
                  onChange={(e) => handleRemarksChange(e.target.value)}
                  fullWidth
                />
              </TableCell>
            </TableRow>
          );
        }}
      />
    </Box>
  );
};

export default ParameterMatrix;


