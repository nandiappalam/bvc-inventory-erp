import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Button,
  Paper,
  Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CalculateIcon from '@mui/icons-material/Calculate';

const CalculatorModal = ({ open, onClose }) => {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [copied, setCopied] = useState(false);

  const handleNum = (n) => {
    if (display === '0' || display === 'Error') {
      setDisplay(String(n));
    } else {
      setDisplay(display + n);
    }
  };

  const handleOp = (op) => {
    if (display === 'Error') return;
    setEquation(`${display} ${op} `);
    setDisplay('0');
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
  };

  const handleBackspace = () => {
    if (display.length <= 1 || display === 'Error') {
      setDisplay('0');
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const handleEquals = () => {
    if (!equation || display === 'Error') return;
    try {
      const fullEq = `${equation}${display}`;
      // Safe evaluation of mathematical expressions
      const sanitized = fullEq.replace(/×/g, '*').replace(/÷/g, '/');
      const res = Function(`'use strict'; return (${sanitized})`)();
      
      const numRes = Number(res);
      const formattedRes = Number.isInteger(numRes) ? String(numRes) : String(Number(numRes.toFixed(4)));
      
      setEquation(`${fullEq} =`);
      setDisplay(formattedRes);
    } catch (err) {
      setDisplay('Error');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          maxWidth: '340px'
        }
      }}
    >
      <DialogTitle
        sx={{
          background: 'linear-gradient(135deg, #1f4fb2 0%, #2a5ea0 100%)',
          color: 'white',
          py: 1.5,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalculateIcon fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            ERP Calculator
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2, bg: '#f8fafc' }}>
        {/* Screen */}
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            mb: 2,
            background: '#1e293b',
            color: '#38bdf8',
            borderRadius: '8px',
            textAlign: 'right',
            border: '1px solid #334155'
          }}
        >
          <Typography variant="caption" sx={{ color: '#94a3b8', minHeight: '18px', display: 'block' }}>
            {equation || '\u00A0'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
            <Tooltip title={copied ? 'Copied!' : 'Copy Result'}>
              <IconButton size="small" onClick={handleCopy} sx={{ color: '#64748b' }}>
                <ContentCopyIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
            <Typography variant="h5" sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#ffffff' }}>
              {display}
            </Typography>
          </Box>
        </Paper>

        {/* Keypad Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
          <Button variant="contained" color="error" size="small" onClick={handleClear} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            C
          </Button>
          <Button variant="outlined" color="secondary" size="small" onClick={handleBackspace} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            ⌫
          </Button>
          <Button variant="outlined" color="primary" size="small" onClick={() => handleOp('%')} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            %
          </Button>
          <Button variant="contained" color="primary" size="small" onClick={() => handleOp('÷')} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            ÷
          </Button>

          <Button variant="outlined" color="inherit" size="small" onClick={() => handleNum('7')} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            7
          </Button>
          <Button variant="outlined" color="inherit" size="small" onClick={() => handleNum('8')} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            8
          </Button>
          <Button variant="outlined" color="inherit" size="small" onClick={() => handleNum('9')} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            9
          </Button>
          <Button variant="contained" color="primary" size="small" onClick={() => handleOp('×')} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            ×
          </Button>

          <Button variant="outlined" color="inherit" size="small" onClick={() => handleNum('4')} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            4
          </Button>
          <Button variant="outlined" color="inherit" size="small" onClick={() => handleNum('5')} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            5
          </Button>
          <Button variant="outlined" color="inherit" size="small" onClick={() => handleNum('6')} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            6
          </Button>
          <Button variant="contained" color="primary" size="small" onClick={() => handleOp('-')} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            -
          </Button>

          <Button variant="outlined" color="inherit" size="small" onClick={() => handleNum('1')} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            1
          </Button>
          <Button variant="outlined" color="inherit" size="small" onClick={() => handleNum('2')} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            2
          </Button>
          <Button variant="outlined" color="inherit" size="small" onClick={() => handleNum('3')} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            3
          </Button>
          <Button variant="contained" color="primary" size="small" onClick={() => handleOp('+')} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            +
          </Button>

          <Button variant="outlined" color="inherit" size="small" onClick={() => handleNum('0')} sx={{ minWidth: 0, fontWeight: 'bold', gridColumn: 'span 2' }}>
            0
          </Button>
          <Button variant="outlined" color="inherit" size="small" onClick={() => handleNum('.')} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            .
          </Button>
          <Button variant="contained" color="success" size="small" onClick={handleEquals} sx={{ minWidth: 0, fontWeight: 'bold' }}>
            =
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default CalculatorModal;
