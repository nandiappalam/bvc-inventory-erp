import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  MenuItem,
  Divider,
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';

const FREQUENCY_FILTERS = [
  'ALL',
  'Daily',
  '15 Days Once',
  'Monthly Once',
  'RM Receiving',
  'PM Receiving',
  'Loading',
];

export default function ComplianceScheduler({ tasks = [], onRefresh }) {
  const [selectedFreq, setSelectedFreq] = useState('ALL');

  const filteredTasks = tasks.filter((t) => {
    if (selectedFreq === 'ALL') return true;
    if (selectedFreq === 'Daily' && t.frequency.includes('Daily')) return true;
    return t.frequency === selectedFreq;
  });

  return (
    <Box>
      {/* Top Banner */}
      <Card sx={{ mb: 3, p: 2.5, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <CalendarMonthIcon sx={{ color: '#16a34a', fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#166534' }}>
            Compliance & Audit Task Scheduler
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: '#14532d' }}>
          Schedule-driven tracking for all Quality, Hygiene, Inward, and Dispatch records mapped directly to FSSAI & HACCP frequencies.
        </Typography>
      </Card>

      {/* Frequency Filter Chips */}
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {FREQUENCY_FILTERS.map((f) => {
          const isSelected = selectedFreq === f;
          return (
            <Chip
              key={f}
              label={f === 'ALL' ? 'All Frequencies' : f}
              onClick={() => setSelectedFreq(f)}
              color={isSelected ? 'success' : 'default'}
              variant={isSelected ? 'filled' : 'outlined'}
              sx={{ fontWeight: isSelected ? 'bold' : 'normal', cursor: 'pointer' }}
            />
          );
        })}
      </Box>

      {/* Scheduler Table */}
      <TableContainer component={Paper} sx={{ border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: 70 }}>Code</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Record / Checklist Title</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Mandated Frequency</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Last Executed</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Next Due / Trigger</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 130 }}>Compliance Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTasks.map((t, idx) => {
              const isEvent = t.status === 'EVENT_BASED';
              return (
                <TableRow key={idx} hover>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t.code}
                      color={t.category.includes('Production') ? 'primary' : 'success'}
                      sx={{ fontWeight: 'bold' }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                    {t.name}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>
                      {t.category}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t.frequency}
                      variant="outlined"
                      color={
                        t.frequency.includes('Daily')
                          ? 'error'
                          : t.frequency.includes('15')
                          ? 'warning'
                          : t.frequency.includes('Monthly')
                          ? 'info'
                          : 'default'
                      }
                      sx={{ fontWeight: 'bold' }}
                    />
                  </TableCell>
                  <TableCell>{t.last_done}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: isEvent ? '#64748b' : '#0284c7' }}>
                    {t.due_next}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={isEvent ? 'On Event' : t.status === 'COMPLETED' ? 'Completed' : 'On Track'}
                      color={isEvent ? 'default' : 'success'}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
