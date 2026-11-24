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
import { printHtml } from '../utils/printHelper'
import { generateQcPrintHtml } from '../utils/qcPrintHelper'
import { useAuth } from '../context/AuthContext'

const moduleOptions = ['Purchase', 'Purchase Return', 'Sales', 'Sales Return', 'Stock Transfer', 'Production']

const DEFAULT_PARAMS = [
  { name: 'Moisture Content %', status: 'PASS', detail: '10.5% (Max 12%)' },
  { name: 'Foreign Matter %', status: 'PASS', detail: '0.2% (Max 1%)' },
  { name: 'Damaged / Broken Grains %', status: 'PASS', detail: '1.1% (Max 2%)' },
  { name: 'Odor, Color & Texture', status: 'PASS', detail: 'Normal, clean and uniform' }
]

export default function QualityCheckCreatePage() {
  const navigate = useNavigate()
  const { selectedCompany } = useAuth()

  const [qcDate] = useState(new Date().toISOString().slice(0, 10))
  const [moduleType, setModuleType] = useState('Purchase')
  const [referenceId, setReferenceId] = useState('')
  const [remarks, setRemarks] = useState('')
  const [qcStatus, setQcStatus] = useState('PENDING')

  const [parameters, setParameters] = useState([...DEFAULT_PARAMS])
  const [newParam, setNewParam] = useState({ name: '', status: 'PASS', detail: '' })

  const [evidence, setEvidence] = useState([])
  const [linkDraft, setLinkDraft] = useState({ name: '', url: '', notes: '' })

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      setError('Evidence file must be under 4 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setEvidence((prev) => [
        ...prev,
        { name: file.name, mime_type: file.type || 'application/octet-stream', url: String(reader.result || ''), notes: 'Uploaded in QC Lab' }
      ])
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleAddExternalLink = () => {
    const u = String(linkDraft.url || '').trim()
    if (!u || (!u.startsWith('https://') && !u.startsWith('http://') && !u.startsWith('/'))) {
      setError('Enter a valid http://, https://, or relative / document URL.')
      return
    }
    setEvidence((prev) => [...prev, { name: linkDraft.name.trim() || 'Document Ref', mime_type: 'link', url: u, notes: linkDraft.notes.trim() }])
    setLinkDraft({ name: '', url: '', notes: '' })
    setError('')
  }

  const handleAddParameter = () => {
    if (!String(newParam.name || '').trim()) return
    setParameters((prev) => [...prev, { ...newParam }])
    setNewParam({ name: '', status: 'PASS', detail: '' })
  }

  const handleRemoveParameter = (idx) => {
    setParameters((prev) => prev.filter((_, i) => i !== idx))
  }

  const runChecks = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const payload = {
        moduleType,
        referenceId: referenceId ? referenceId : null,
        remarks,
        status: qcStatus,
        params: parameters,
        evidence,
        created_by: null,
      }

      const res = await api('/qc-tests', { method: 'POST', body: payload })
      if (res && res.success) {
        setResult(res.data)
      } else {
        throw new Error(res?.message || 'Failed to run QC')
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to run QC')
    } finally {
      setLoading(false)
    }
  }

  const handlePrintCoa = () => {
    const html = generateQcPrintHtml(
      {
        qc_no: result?.qc?.qc_no || 'QC-00001',
        qc_date: qcDate,
        module_type: moduleType,
        reference_id: referenceId,
        status: qcStatus,
        remarks,
        params: parameters,
        evidence
      },
      selectedCompany || {},
      'COA'
    )
    printHtml(html, `Certificate of Analysis (COA) - ${result?.qc?.qc_no || 'Draft'}`)
  }

  const handlePrintIqr = () => {
    const html = generateQcPrintHtml(
      {
        qc_no: result?.qc?.qc_no || 'QC-00001',
        qc_date: qcDate,
        module_type: moduleType,
        reference_id: referenceId,
        status: qcStatus,
        remarks,
        params: parameters,
        evidence
      },
      selectedCompany || {},
      'IQR'
    )
    printHtml(html, `Incoming Quality Report (IQR) - ${result?.qc?.qc_no || 'Draft'}`)
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 800, color: '#1e3a8a' }}>
        PURCHASE &amp; INWARD LAB TESTING (QC)
      </Typography>
      <Box sx={{ mb: 2, color: '#666', fontSize: 13 }}>
        Record physical &amp; chemical test parameters, attach photographic/video/document evidence, and set inspection decision status (Hold, Pending, Approve, Return).
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, color: '#1e3a8a' }}>
                QC Header &amp; Decision Status
              </Typography>

              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <TextField label="QC No" value={result?.qc?.qc_no || 'Auto'} fullWidth size="small" disabled />
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
                    label="Reference Invoice / Lot No"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="e.g. PUR-00019 or LOT0016"
                  />
                </Grid>

                {/* Clickable Status Action Buttons */}
                <Grid item xs={12}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#475569', mb: 0.5 }}>
                    Inspection Decision Status:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {['HOLD', 'PENDING', 'APPROVE', 'RETURN'].map((st) => {
                      const active = qcStatus === st
                      const bg = st === 'APPROVE' ? (active ? '#16a34a' : '#f0fdf4') : st === 'HOLD' ? (active ? '#d97706' : '#fffbeb') : st === 'RETURN' ? (active ? '#dc2626' : '#fef2f2') : (active ? '#2563eb' : '#eff6ff')
                      const fg = active ? '#fff' : '#0f172a'
                      return (
                        <Button
                          key={st}
                          size="small"
                          variant={active ? 'contained' : 'outlined'}
                          onClick={() => setQcStatus(st)}
                          sx={{ flex: 1, fontSize: 11, fontWeight: 800, backgroundColor: active ? bg : 'transparent', color: active ? fg : '#334155', borderColor: '#cbd5e1' }}
                        >
                          {st}
                        </Button>
                      )
                    })}
                  </Box>
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
                    placeholder="Detailed physical testing observations..."
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Button
                variant="contained"
                onClick={runChecks}
                disabled={loading}
                fullWidth
                sx={{ backgroundColor: '#1e3a8a', fontWeight: 700 }}
              >
                {loading ? 'Running Lab Tests...' : 'Save & Run QC Inspection'}
              </Button>

              {error && (
                <Typography sx={{ mt: 1, color: 'red', fontSize: 13 }}>
                  {error}
                </Typography>
              )}

              <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" onClick={() => navigate('/reports/quality-check-report')}>
                  Go to Quality Check Report
                </Button>
                {result && (
                  <>
                    <Button size="small" variant="outlined" onClick={handlePrintCoa} sx={{ color: '#0284c7', borderColor: '#0284c7' }}>
                      🖨️ Print COA
                    </Button>
                    <Button size="small" variant="outlined" onClick={handlePrintIqr} sx={{ color: '#16a34a', borderColor: '#16a34a' }}>
                      🖨️ Print IQR
                    </Button>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, color: '#1e3a8a' }}>
                Test Parameter List &amp; Specifications
              </Typography>

              {/* Add Parameter Row */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                <TextField
                  size="small"
                  placeholder="Parameter Name (e.g. Grain Size)"
                  value={newParam.name}
                  onChange={(e) => setNewParam((p) => ({ ...p, name: e.target.value }))}
                  sx={{ flex: 1.5 }}
                />
                <Select
                  size="small"
                  value={newParam.status}
                  onChange={(e) => setNewParam((p) => ({ ...p, status: e.target.value }))}
                  sx={{ width: 90 }}
                >
                  <MenuItem value="PASS">PASS</MenuItem>
                  <MenuItem value="FAIL">FAIL</MenuItem>
                </Select>
                <TextField
                  size="small"
                  placeholder="Specification / Details"
                  value={newParam.detail}
                  onChange={(e) => setNewParam((p) => ({ ...p, detail: e.target.value }))}
                  sx={{ flex: 2 }}
                />
                <Button variant="contained" size="small" onClick={handleAddParameter} sx={{ backgroundColor: '#0284c7', fontWeight: 700, minWidth: 40 }}>
                  +
                </Button>
              </Box>

              <Box sx={{ maxHeight: 240, overflowY: 'auto' }}>
                {parameters.map((p, idx) => (
                  <Box key={idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', py: 0.75, borderBottom: '1px solid #e2e8f0' }}>
                    <Typography sx={{ width: 180, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                      {p.name}
                    </Typography>
                    <Typography sx={{ width: 60, fontSize: 12, fontWeight: 800, color: p.status === 'PASS' ? '#16a34a' : '#dc2626' }}>
                      {p.status}
                    </Typography>
                    <Typography sx={{ flex: 1, fontSize: 12, color: '#475569' }}>
                      {p.detail}
                    </Typography>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleRemoveParameter(idx)}
                      sx={{ minWidth: 28, height: 28, p: 0, fontWeight: 900 }}
                    >
                      ✕
                    </Button>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* Photographic / Video / Document Evidence Reference */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e3a8a' }}>
                  Photographic / Video / Document Reference ({evidence.length})
                </Typography>
                <label style={{ backgroundColor: '#1f4fb2', color: '#fff', padding: '5px 11px', borderRadius: '5px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  + Upload Photo / Video / PDF
                  <input type="file" accept="image/*,application/pdf,video/mp4,video/webm" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr auto', gap: '8px', mb: '10px' }}>
                <TextField size="small" placeholder="Document Label" value={linkDraft.name} onChange={(e) => setLinkDraft((p) => ({ ...p, name: e.target.value }))} />
                <TextField size="small" placeholder="https://... or /uploads/..." value={linkDraft.url} onChange={(e) => setLinkDraft((p) => ({ ...p, url: e.target.value }))} />
                <TextField size="small" placeholder="Notes" value={linkDraft.notes} onChange={(e) => setLinkDraft((p) => ({ ...p, notes: e.target.value }))} />
                <Button variant="contained" size="small" onClick={handleAddExternalLink} sx={{ backgroundColor: '#0284c7', fontWeight: 700 }}>
                  + Link
                </Button>
              </Box>

              {evidence.length > 0 && (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                  {evidence.map((ev, idx) => (
                    <Paper key={idx} variant="outlined" sx={{ p: 1, fontSize: '12px' }}>
                      {String(ev.mime_type || '').startsWith('image/') && String(ev.url || '').startsWith('data:image/') && (
                        <img src={ev.url} alt={ev.name} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px', marginBottom: '4px' }} />
                      )}
                      <Typography sx={{ fontWeight: 700, wordBreak: 'break-word', fontSize: '12px' }}>{ev.name}</Typography>
                      <Typography sx={{ fontSize: '11px', color: '#64748b' }}>{ev.notes || ev.mime_type}</Typography>
                      <Button size="small" color="error" onClick={() => setEvidence((p) => p.filter((_, i) => i !== idx))} sx={{ mt: 0.5, p: 0, fontSize: '11px', fontWeight: 700 }}>
                        Remove
                      </Button>
                    </Paper>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
