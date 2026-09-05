import React from 'react';
import {
  TableRow, TableCell, IconButton, Collapse, Box, Table, TableBody, TableHead, Chip, Button, Typography
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';

const VoucherRow = ({ voucher, onEdit, onDelete, openRow, toggleRow, expandedEntries = {} }) => {
const formatParticulars = voucher.narration || 'N/A';

  return (
    <>
      <TableRow hover>
        <TableCell padding="checkbox">
          <IconButton onClick={() => toggleRow(voucher.id)}>
            {openRow === voucher.id ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell><strong>{voucher.voucher_no}</strong></TableCell>
        <TableCell>{voucher.date}</TableCell>
        <TableCell>
          <Chip label={voucher.voucher_type} color="primary" size="small" />
        </TableCell>
        <TableCell>{formatParticulars}</TableCell>
        <TableCell align="right">₹{parseFloat(voucher.total_debit || 0).toLocaleString()}</TableCell>
        <TableCell align="right">₹{parseFloat(voucher.total_credit || 0).toLocaleString()}</TableCell>
        <TableCell align="right">
          <Button size="small" onClick={() => onEdit(voucher.id)}><EditIcon fontSize="small" /></Button>
          <Button size="small" onClick={() => onDelete(voucher.id)} color="error"><DeleteIcon fontSize="small" /></Button>
          <Button size="small"><PrintIcon fontSize="small" /></Button>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ padding: 0 }} colSpan={8}>
          <Collapse in={openRow === voucher.id} timeout="auto" unmountOnExit>
            <Box sx={{ m: 1, p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" gutterBottom>Entries:</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Ledger</TableCell>
                    <TableCell align="right">Debit</TableCell>
                    <TableCell align="right">Credit</TableCell>
                    <TableCell>Remarks</TableCell>
                  </TableRow>
                </TableHead>
  <TableBody>
                  {expandedEntries[voucher.id]?.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>{entry.type}</TableCell>
                      <TableCell>{entry.ledger_name}</TableCell>
                      <TableCell align="right">₹{parseFloat(entry.debit || 0).toLocaleString()}</TableCell>
                      <TableCell align="right">₹{parseFloat(entry.credit || 0).toLocaleString()}</TableCell>
                      <TableCell>{entry.remarks || ''}</TableCell>
                    </TableRow>
                  )) || (
                    <TableRow>
                      <TableCell colSpan={5}>Loading entries...</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                Narration: {voucher.narration || 'N/A'} | Ref: {voucher.reference_no || 'N/A'}
              </Typography>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

export default VoucherRow;

