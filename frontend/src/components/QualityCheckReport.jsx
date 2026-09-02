import React, { useEffect, useState } from 'react'
import { Box, Button, Card, CardContent, MenuItem, Select, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import api from '../../services/api'

export default function QualityCheckReport() {
  const [moduleType, setModuleType] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')


  const load = async () => {
    setLoading(true)
    try {
      const query = moduleType ? `?moduleType=${encodeURIComponent(moduleType)}` : ''
      const res = await api(`/quality-control${query}`)
      if (res && res.success) {
        // Handles various response structures: { success, data: [...] }, { success, data: { rows: [...] } }
        const data = res.data;
        const rowsArr = Array.isArray(data) ? data : (data?.rows ?? []);
        setRows(Array.isArray(rowsArr) ? rowsArr : []);
      } else {
        throw new Error(res?.message || 'Failed to load QC report data.');
      }
    } catch (e) {
      console.error('QC report load failed:', e);
      setError(e.message || 'Failed to load QC tests');
      setRows([]); // Clear previous data on error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const runFilter = () => load()

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Reports → Quality Check Report
      </Typography>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
            <Select size="small" value={moduleType} onChange={(e) => setModuleType(e.target.value)} displayEmpty>
              <MenuItem value="">All Modules</MenuItem>
              <MenuItem value="Purchase">Purchase</MenuItem>
              <MenuItem value="Purchase Return">Purchase Return</MenuItem>
              <MenuItem value="Sales">Sales</MenuItem>
              <MenuItem value="Sales Return">Sales Return</MenuItem>
              <MenuItem value="Stock Transfer">Stock Transfer</MenuItem>
              <MenuItem value="Production">Production</MenuItem>
            </Select>
            <Button size="small" variant="outlined" onClick={runFilter} disabled={loading}>
              {loading ? 'Loading...' : 'Filter'}
            </Button>
          </Box>

          {error && (
            <Typography color="error" sx={{ my: 2 }}>
              Error: {error}
            </Typography>
          )}

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>QC No</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Module</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Pass</TableCell>
                <TableCell>Fail</TableCell>
                <TableCell>Remarks</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ color: '#666' }}>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ color: '#666', textAlign: 'center' }}>
                    No QC runs yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.qc_no}</TableCell>
                    <TableCell>{r.qc_date}</TableCell>
                    <TableCell>{r.module_type}</TableCell>
                    <TableCell style={{ color: r.status === 'PASS' ? 'green' : 'red', fontWeight: 800 }}>
                      {r.status}
                    </TableCell>
                    <TableCell>{r.total_pass}</TableCell>
                    <TableCell>{r.total_fail}</TableCell>
                    <TableCell sx={{ maxWidth: 220, wordBreak: 'break-word' }}>{r.remarks}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  )
}
