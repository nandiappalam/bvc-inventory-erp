import React from 'react';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';

/**
 * Generic table wrapper for consistent enterprise styling.
 */
const ERPTable = ({ columns, rows, renderRow, headerSx, bodySx }) => {
  return (
    <TableContainer
      component={Box}
      sx={{
        border: '1px solid var(--erp-border)',
        borderRadius: 'var(--erp-radius)',
        overflowX: 'auto',
        backgroundColor: 'white',
      }}
    >
      <Table size="small">
        <TableHead>
          <TableRow sx={{ backgroundColor: 'rgba(31,79,178,0.06)', ...headerSx }}>
            {columns.map((c) => (
              <TableCell key={c.key} sx={{ fontWeight: 900, color: 'var(--erp-primary)', ...c.sx }}>
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody sx={bodySx}>
          {rows.map((r, idx) => renderRow(r, idx))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ERPTable;

