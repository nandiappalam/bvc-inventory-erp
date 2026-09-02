import React, { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'


const moduleOptions = ['Purchase', 'Purchase Return', 'Sales', 'Sales Return', 'Stock Transfer', 'Production']


function ResultRow({ name, status, detail }) {
  const color = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : '#666'
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', py: 0.75 }}>
      <Typography sx={{ width: 260, fontSize: 13 }}>
        {name}
      </Typography>
      <Typography sx={{ width: 60, fontSize: 13, color, fontWeight: 700 }}>
        {status}
      </Typography>
      <Typography sx={{ flex: 1, fontSize: 12, color: '#444', wordBreak: 'break-word' }}>
        {detail ? JSON.stringify(detail) : ''}
      </Typography>
    </Box>
  )
}

export default function QualityCheckCreatePage() {
  const navigate = useNavigate()

  const [qcDate] = useState(new Date().toISOString().slice(0, 10))
  const [moduleType, setModuleType] = useState('Purchase')
  const [referenceId, setReferenceId] = useState('')
  const [remarks, setRemarks] = useState('')

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [checklist, setChecklist] = useState([])
  const [error, setError] = useState('')

  const summary = useMemo(() => {
    if (!result) return null
    return {
      passed: result?.qc?.total_pass ?? 0,
      failed: result?.qc?.total_fail ?? 0,
      status: result?.qc?.status,
    }
  }, [result])

  const runChecks = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    setChecklist([])

    try {
      const payload = {
        moduleType,
        referenceId: referenceId ? referenceId : null,
        remarks,
        created_by: null,
      }

      const res = await api('/qc-tests', { method: 'POST', body: payload });
      if (res && res.success) {
        setResult(res.data)
        setChecklist(res.data.checklist || [])
      } else {
        throw new Error(res?.message || 'Failed to run QC');
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to run QC')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        PURCHASE LAB TESTING
      </Typography>

      <Box sx={{ mb: 2, color: '#666', fontSize: 13 }}>
        Purchase-wise lab testing with parameter PASS/FAIL.
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                QC Header
              </Typography>

              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <TextField label="QC No" value={'Auto'} fullWidth size="small" disabled />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="QC Date" value={qcDate} fullWidth size="small" disabled />
                </Grid>

                <Grid item xs={12}>
                  <Select value={moduleType} onChange={(e) => setModuleType(e.target.value)} fullWidth size="small">
                    {moduleOptions.map(m => (
                      <MenuItem key={m} value={m}>{m}</MenuItem>
                    ))}
                  </Select>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label="Reference Invoice (optional)"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    fullWidth
                    size="small"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label="Remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Button
                variant="contained"
                onClick={runChecks}
                disabled={loading}
                fullWidth
              >
                {loading ? 'Running...' : 'Run QC (MVP)'}
              </Button>

              {error && (
                <Typography sx={{ mt: 1, color: 'red', fontSize: 13 }}>
                  {error}
                </Typography>
              )}

              <Box sx={{ mt: 1.5 }}>
                <Button size="small" onClick={() => navigate('/reports/quality-check-report')}>
                  Go to Quality Check Report
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                QC Result
              </Typography>

              {!result ? (
                <Typography sx={{ color: '#555', fontSize: 13 }}>
                  If page is blank, check browser console for QC errors.
                </Typography>

              ) : (
                <>
                  <Paper variant="outlined" sx={{ p: 1.25, mb: 2, background: '#fafafa' }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                        Status: {summary?.status}
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: '#333' }}>
                        Passed: {summary?.passed} | Failed: {summary?.failed}
                      </Typography>
                    </Box>
                  </Paper>

                  <Divider sx={{ mb: 1.5 }} />

                  <Box>
                    {checklist.map((c) => (
                      <ResultRow key={c.name} name={c.name} status={c.status} detail={c.detail} />
                    ))}
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
