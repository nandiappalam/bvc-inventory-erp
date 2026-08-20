import React from 'react';
import { Box } from '@mui/material';
import ERPSummaryCard from '../../../components/erp/ERPSummaryCard';

export default function QualitySummaryPanel({ summary }) {
  const s = summary ?? {};
  return (
    <ERPSummaryCard>
      <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
        <Box sx={{ fontSize: 12, fontWeight: 900, color: 'var(--erp-primary)' }}>Overall Result</Box>
        <Box sx={{ mt: 0.5, fontSize: 14, fontWeight: 900 }}>{s.overallResult ?? '-'}</Box>
      </Box>
      <Box sx={{ px: 2, pb: 2 }}>
        <Box sx={{ fontSize: 12, fontWeight: 900, color: 'var(--erp-primary)' }}>Recommendation</Box>
        <Box sx={{ mt: 0.5, fontSize: 13, whiteSpace: 'pre-wrap' }}>{s.recommendation ?? '-'}</Box>
      </Box>
    </ERPSummaryCard>
  );
}

